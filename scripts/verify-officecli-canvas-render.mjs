#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { verifyInitializeResult, verifyVersionOutput } from "./verify-officecli-canvas-contract.mjs";

const MAGIC_PROMPT = "officedex::magic-deck::v1::7f3k9q2x";
const DEFAULT_TIMEOUT_MS = 180_000;

export function buildOfficecliEnvironment({ baseEnv = process.env, platform = process.platform, nodePath, moduleRoot }) {
  const env = {
    ...baseEnv,
    PATH: platform === "win32" || platform === "windows"
      ? path.win32.join(baseEnv.SystemRoot || "C:\\Windows", "System32")
      : "/usr/bin:/bin:/usr/sbin:/sbin",
    OFFICECLI_PPTXGENJS_NODE: nodePath,
    OFFICECLI_PPTXGENJS_NODE_MODULES: moduleRoot,
    OFFICECLI_SKIP_SKILL_PREFLIGHT: "1",
    OFFICECLI_SKIP_PUBLISH_SETUP: "1",
    OFFICECLI_SKIP_UPDATE_CHECK: "1",
  };
  return env;
}

export function responseForQuestion(question) {
  if (!question?.id) throw new Error("Canvas question is missing an id");
  const option = Array.isArray(question.options) ? question.options.find((item) => item?.id) : null;
  if (option) return { question_id: question.id, option_id: option.id };
  return {
    question_id: question.id,
    answer: JSON.stringify({ kind: "vibe_node_confirmed", nodeId: "root" }),
  };
}

export function validatePptxBuffer(buffer, label = "generated PPTX") {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(`${label} is not a ZIP/PPTX`);
  }
  for (const entry of ["[Content_Types].xml", "ppt/presentation.xml"]) {
    if (!buffer.includes(Buffer.from(entry))) throw new Error(`${label} is missing ${entry}`);
  }
}

export async function verifyOfficecliCanvasRender({
  binary,
  runtimeRoot,
  expectedVersion,
  outputDir,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  platform = process.platform,
}) {
  if (!binary) throw new Error("OfficeCLI binary is required");
  if (!runtimeRoot) throw new Error("PptxGenJS runtime root is required");
  if (!expectedVersion) throw new Error("expected OfficeCLI version is required");
  outputDir ||= await mkdir(path.join(os.tmpdir(), "officedex-canvas-render"), { recursive: true }).then(() => path.join(os.tmpdir(), "officedex-canvas-render"));
  outputDir = path.resolve(outputDir);
  await mkdir(outputDir, { recursive: true });

  const normalizedPlatform = platform === "windows" ? "win32" : platform;
  const nodePath = path.join(runtimeRoot, "bin", normalizedPlatform === "win32" ? "node.exe" : "node");
  const moduleRoot = path.join(runtimeRoot, "node_modules");
  const env = buildOfficecliEnvironment({ baseEnv: process.env, platform: normalizedPlatform, nodePath, moduleRoot });

  verifyVersionOutput(execFileSync(binary, ["--version"], { encoding: "utf8", env }), expectedVersion);
  const child = spawn(binary, ["agent-bridge"], { cwd: process.cwd(), env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const rpc = new LspRpcClient(child);
  const deadline = Date.now() + timeoutMs;
  try {
    const initialize = await rpc.request("initialize", {}, remaining(deadline));
    verifyInitializeResult(initialize, expectedVersion);

    const invoked = await rpc.request("task/invoke", {
      tool: "office.generate",
      interactive: true,
      output_format: "json",
      args: {
        document_type: "pptx",
        topic: MAGIC_PROMPT,
        prompt: MAGIC_PROMPT,
        mode: "best",
        generation_mode: "plan",
        out: outputDir,
        publish: false,
        enable_images: false,
      },
    }, remaining(deadline));
    const taskID = invoked?.task_id;
    if (!taskID) throw new Error(`OfficeCLI task/invoke did not return task_id: ${JSON.stringify(invoked)}`);

    let lastQuestionID = "";
    while (Date.now() < deadline) {
      const status = await rpc.request("task/status", { task_id: taskID }, remaining(deadline));
      if (status?.status === "completed") {
        const filePath = status.result?.file_path;
        if (!filePath) throw new Error(`completed Canvas task has no PPTX artifact: ${JSON.stringify(status.result)}`);
        const info = await stat(filePath);
        if (!info.isFile() || info.size <= 0) throw new Error(`completed Canvas artifact is empty: ${filePath}`);
        validatePptxBuffer(await readFile(filePath), filePath);
        return { taskID, filePath, fileSize: info.size, status };
      }
      if (status?.status === "failed") {
        throw new Error(`OfficeCLI Canvas render failed: ${status.last_error || JSON.stringify(status)}`);
      }
      if (status?.status === "cancelled") throw new Error("OfficeCLI Canvas render was cancelled");

      if (status?.status === "waiting_input" && status.current_question?.id && status.current_question.id !== lastQuestionID) {
        lastQuestionID = status.current_question.id;
        await rpc.request("task/respond", { task_id: taskID, ...responseForQuestion(status.current_question) }, remaining(deadline));
      } else if (status?.status === "waiting_input" && status.current_plan?.plan_id) {
        await rpc.request("task/respond", {
          task_id: taskID,
          question_id: status.current_plan.plan_id,
          option_id: "approve",
        }, remaining(deadline));
      }
      await sleep(50);
    }
    throw new Error(`timed out waiting for Canvas render after ${timeoutMs}ms`);
  } finally {
    rpc.close();
  }
}

function remaining(deadline) {
  const value = deadline - Date.now();
  if (value <= 0) throw new Error("Canvas render deadline exceeded");
  return Math.min(value, 30_000);
}

function encodeLspMessage(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"), body]);
}

class LspRpcClient {
  constructor(child) {
    this.child = child;
    this.nextID = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.stderr = "";
    child.stdout.on("data", (chunk) => this.consume(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => (this.stderr += String(chunk)));
    child.once("error", (error) => this.failAll(error));
    child.once("exit", (code, signal) => this.failAll(new Error(`OfficeCLI agent-bridge exited code=${code ?? ""} signal=${signal ?? ""}: ${this.stderr.trim()}`)));
  }

  request(method, params, timeoutMs) {
    const id = this.nextID++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timed out waiting for ${method} after ${timeoutMs}ms: ${this.stderr.trim()}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, method });
      this.child.stdin.write(encodeLspMessage({ jsonrpc: "2.0", id, method, params }));
    });
  }

  consume(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)/i);
      if (!match) return this.failAll(new Error(`invalid LSP header: ${header}`));
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return;
      const body = this.buffer.subarray(bodyStart, bodyStart + length);
      this.buffer = this.buffer.subarray(bodyStart + length);
      let message;
      try {
        message = JSON.parse(body.toString("utf8"));
      } catch (error) {
        this.failAll(new Error(`invalid JSON-RPC response: ${error instanceof Error ? error.message : error}`));
        return;
      }
      if (message.id === undefined || message.id === null) continue;
      const pending = this.pending.get(Number(message.id));
      if (!pending) continue;
      this.pending.delete(Number(message.id));
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${pending.method} failed: ${JSON.stringify(message.error)}`));
      else pending.resolve(message.result);
    }
  }

  failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  close() {
    this.failAll(new Error("OfficeCLI JSON-RPC client closed"));
    if (!this.child.killed) this.child.kill();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = { binary: "", runtimeRoot: "", expectedVersion: "", outputDir: "", timeoutMs: DEFAULT_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[++i];
    if (!value) throw new Error(`${argv[i - 1]} requires a value`);
    if (argv[i - 1] === "--binary") args.binary = value;
    else if (argv[i - 1] === "--runtime-root") args.runtimeRoot = value;
    else if (argv[i - 1] === "--expected") args.expectedVersion = value;
    else if (argv[i - 1] === "--output-dir") args.outputDir = value;
    else if (argv[i - 1] === "--timeout-ms") args.timeoutMs = Number(value);
    else throw new Error(`unknown argument: ${argv[i - 1]}`);
  }
  return args;
}

const scriptPath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const rootDir = path.resolve(path.dirname(scriptPath), "..");
  const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
  const args = parseArgs(process.argv.slice(2));
  const platform = process.platform;
  verifyOfficecliCanvasRender({
    binary: path.resolve(rootDir, args.binary || path.join("build", "officecli", platform === "win32" ? "officecli.exe" : "officecli")),
    runtimeRoot: path.resolve(rootDir, args.runtimeRoot || path.join("build", "pptxgenjs-runtime")),
    expectedVersion: args.expectedVersion || pkg.officecliVersion,
    outputDir: args.outputDir ? path.resolve(rootDir, args.outputDir) : path.join(rootDir, "build", "canvas-render-smoke"),
    timeoutMs: args.timeoutMs,
    platform,
  })
    .then((result) => console.log(`Verified complete Canvas PPTX render: ${result.filePath} (${result.fileSize} bytes)`))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 1;
    });
}
