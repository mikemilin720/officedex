import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { NODE_VERSION, PPTXGENJS_VERSION, sha256File } from "./stage-pptxgenjs-runtime.mjs";

async function requireFile(file, label) {
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
  } catch (error) {
    throw new Error(`missing ${label}: ${file}: ${error instanceof Error ? error.message : error}`);
  }
}

async function requireNonEmptyFile(file, label) {
  await requireFile(file, label);
  const content = await readFile(file);
  if (content.length === 0 || content.toString("utf8").trim() === "") {
    throw new Error(`empty license file for ${label}: ${file}`);
  }
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with ${code}: ${stderr.trim() || stdout.trim()}`));
    });
  });
}

function restrictedPath(platform) {
  if (platform === "win32") {
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    return path.win32.join(systemRoot, "System32");
  }
  return "/usr/bin:/bin:/usr/sbin:/sbin";
}

function assertPptxZip(data, output) {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) {
    throw new Error(`runtime smoke output is not a ZIP/PPTX: ${output}`);
  }
  for (const entry of ["[Content_Types].xml", "ppt/presentation.xml"]) {
    if (!data.includes(Buffer.from(entry))) throw new Error(`runtime smoke PPTX is missing ${entry}`);
  }
}

export async function verifyRuntime({
  root,
  platform = process.platform,
  skipExecution = false,
  skipNodeChecksum = false,
} = {}) {
  if (!root) throw new Error("runtime root is required");
  if (platform === "windows") platform = "win32";
  const nodePath = path.join(root, "bin", platform === "win32" ? "node.exe" : "node");
  const moduleRoot = path.join(root, "node_modules");
  const packagePath = path.join(moduleRoot, "pptxgenjs", "package.json");
  const manifestPath = path.join(root, "runtime.json");

  await requireFile(nodePath, "Node executable");
  await requireFile(manifestPath, "runtime manifest");
  await requireFile(packagePath, "PptxGenJS package metadata");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.nodeVersion !== NODE_VERSION) {
    throw new Error(`runtime manifest Node version is ${manifest.nodeVersion}, expected Node ${NODE_VERSION}`);
  }
  if (manifest.pptxgenjsVersion !== PPTXGENJS_VERSION) {
    throw new Error(`runtime manifest PptxGenJS version is ${manifest.pptxgenjsVersion}, expected PptxGenJS ${PPTXGENJS_VERSION}`);
  }

  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  if (pkg.version !== PPTXGENJS_VERSION) {
    throw new Error(`installed package is ${pkg.version}, expected PptxGenJS ${PPTXGENJS_VERSION}`);
  }

  await requireNonEmptyFile(path.join(root, "licenses", "Node.js-LICENSE.txt"), "Node.js");
  await requireNonEmptyFile(path.join(root, "licenses", "PptxGenJS-LICENSE.txt"), "PptxGenJS");

  if (!skipNodeChecksum) {
    const actualNodeSha256 = await sha256File(nodePath);
    if (actualNodeSha256 !== manifest.nodeSha256) {
      throw new Error(`bundled Node SHA256 mismatch: expected ${manifest.nodeSha256}, got ${actualNodeSha256}`);
    }
  }

  if (!skipExecution) {
    const env = { ...process.env, PATH: restrictedPath(platform), NODE_PATH: moduleRoot };
    const version = await run(nodePath, ["--version"], env);
    if (version.stdout.trim() !== `v${NODE_VERSION}`) {
      throw new Error(`bundled Node reports ${version.stdout.trim()}, expected v${NODE_VERSION}`);
    }

    const temp = await mkdtemp(path.join(os.tmpdir(), "officedex-runtime-smoke-"));
    const output = path.join(temp, "smoke.pptx");
    const script = `const PptxGenJS=require("pptxgenjs");(async()=>{const pptx=new PptxGenJS();pptx.layout="LAYOUT_WIDE";const slide=pptx.addSlide();slide.addText("OfficeDex runtime smoke",{x:1,y:1,w:8,h:1,fontSize:24});await pptx.writeFile({fileName:process.argv[1]});})().catch(e=>{console.error(e);process.exit(1);});`;
    try {
      await run(nodePath, ["-e", script, output], env);
      await access(output);
      assertPptxZip(await readFile(output), output);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }

  return manifest;
}

function parseArgs(argv) {
  let root = "build/pptxgenjs-runtime";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) root = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return root;
}

const scriptPath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  verifyRuntime({ root: path.resolve(parseArgs(process.argv.slice(2))) })
    .then((manifest) => console.log(`Verified PptxGenJS runtime Node ${manifest.nodeVersion}, PptxGenJS ${manifest.pptxgenjsVersion}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 1;
    });
}
