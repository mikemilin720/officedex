import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const NODE_VERSION = "24.18.0";
export const PPTXGENJS_VERSION = "4.0.1";
const NODE_DIST_BASE = `https://nodejs.org/dist/v${NODE_VERSION}`;

export function findChecksum(shasums, filename) {
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^([a-fA-F0-9]{64})\\s+\\*?${escaped}$`, "m");
  const match = String(shasums).match(pattern);
  if (!match) throw new Error(`Node checksum not found for ${filename}`);
  return match[1].toLowerCase();
}

export async function sha256File(file) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

export async function verifyFileChecksum(file, expected) {
  const actual = await sha256File(file);
  if (actual !== String(expected).toLowerCase()) {
    throw new Error(`SHA256 mismatch for ${file}: expected ${expected}, got ${actual}`);
  }
  return actual;
}

export function buildRuntimeManifest({ platform, arch, nodeSha256, archives }) {
  return {
    schemaVersion: 1,
    nodeVersion: NODE_VERSION,
    pptxgenjsVersion: PPTXGENJS_VERSION,
    platform,
    arch,
    nodeSha256,
    archives: [...archives]
      .map((entry) => ({ name: entry.name, sha256: entry.sha256 }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function buildRuntimeSmokeScript() {
  return `require("pptxgenjs");`;
}

export function npmInvocationForPlatform(platform) {
  return platform === "win32"
    ? { command: "npm", shell: true }
    : { command: "npm", shell: false };
}

export async function pruneRuntimeNodeModules(moduleRoot) {
  await rm(path.join(moduleRoot, ".bin"), { recursive: true, force: true });
}

function archivePlan(platform, arch) {
  if (platform === "darwin") {
    if (arch !== "universal") throw new Error(`macOS runtime must be universal, got ${arch}`);
    return [
      `node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
      `node-v${NODE_VERSION}-darwin-x64.tar.gz`,
    ];
  }
  if (platform === "win32") {
    if (arch !== "x64") throw new Error(`Windows runtime must be x64, got ${arch}`);
    return [`node-v${NODE_VERSION}-win-x64.zip`];
  }
  throw new Error(`unsupported runtime platform: ${platform}`);
}

async function downloadFile(url, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const data = new Uint8Array(await response.arrayBuffer());
      await writeFile(partial, data);
      await rename(partial, destination);
      return;
    } catch (error) {
      lastError = error;
      await rm(partial, { force: true });
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw new Error(`download failed for ${url}: ${lastError instanceof Error ? lastError.message : lastError}`);
}

async function ensureDownload(url, destination) {
  try {
    await access(destination);
  } catch {
    await downloadFile(url, destination);
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const capture = options.capture === true;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
      shell: options.shell ?? false,
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
    }
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

async function extractArchive({ archive, destination, platform }) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  if (platform === "darwin") {
    await run("tar", ["-xzf", archive, "-C", destination]);
    return;
  }
  await run("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -LiteralPath '${archive.replaceAll("'", "''")}' -DestinationPath '${destination.replaceAll("'", "''")}' -Force`,
  ]);
}

async function readPptxgenjsVersion(moduleRoot) {
  const packagePath = path.join(moduleRoot, "pptxgenjs", "package.json");
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  return pkg.version;
}

export async function stagePptxgenjsRuntime({
  rootDir,
  outputDir,
  cacheDir,
  platform,
  arch,
}) {
  const packageDir = path.join(rootDir, "runtime", "pptxgenjs");
  const archives = archivePlan(platform, arch);
  const shasumsPath = path.join(cacheDir, `node-v${NODE_VERSION}-SHASUMS256.txt`);
  await ensureDownload(`${NODE_DIST_BASE}/SHASUMS256.txt`, shasumsPath);
  const shasums = await readFile(shasumsPath, "utf8");

  const verifiedArchives = [];
  for (const name of archives) {
    const expected = findChecksum(shasums, name);
    const archive = path.join(cacheDir, name);
    await ensureDownload(`${NODE_DIST_BASE}/${name}`, archive);
    try {
      await verifyFileChecksum(archive, expected);
    } catch (error) {
      await rm(archive, { force: true });
      await downloadFile(`${NODE_DIST_BASE}/${name}`, archive);
      await verifyFileChecksum(archive, expected);
    }
    verifiedArchives.push({ name, sha256: expected, path: archive });
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, "bin"), { recursive: true });
  await copyFile(path.join(packageDir, "package.json"), path.join(outputDir, "package.json"));
  await copyFile(path.join(packageDir, "package-lock.json"), path.join(outputDir, "package-lock.json"));

  const npmInvocation = npmInvocationForPlatform(platform);
  await run(
    npmInvocation.command,
    ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", outputDir],
    { shell: npmInvocation.shell },
  );
  const moduleRoot = path.join(outputDir, "node_modules");
  await pruneRuntimeNodeModules(moduleRoot);
  const actualPptxgenjsVersion = await readPptxgenjsVersion(moduleRoot);
  if (actualPptxgenjsVersion !== PPTXGENJS_VERSION) {
    throw new Error(`PptxGenJS version is ${actualPptxgenjsVersion}, expected ${PPTXGENJS_VERSION}`);
  }

  const extractRoot = await mkdtemp(path.join(os.tmpdir(), "officedex-node-runtime-"));
  let nodePath;
  let nodeLicense;
  try {
    if (platform === "darwin") {
      const roots = {};
      for (const entry of verifiedArchives) {
        const destination = path.join(extractRoot, entry.name.includes("arm64") ? "arm64" : "x64");
        await extractArchive({ archive: entry.path, destination, platform });
        const folder = entry.name.replace(/\.tar\.gz$/, "");
        roots[entry.name.includes("arm64") ? "arm64" : "x64"] = path.join(destination, folder);
      }
      nodePath = path.join(outputDir, "bin", "node");
      await run("lipo", [
        "-create",
        path.join(roots.arm64, "bin", "node"),
        path.join(roots.x64, "bin", "node"),
        "-output",
        nodePath,
      ]);
      await chmod(nodePath, 0o755);
      nodeLicense = path.join(roots.arm64, "LICENSE");
    } else {
      const entry = verifiedArchives[0];
      const destination = path.join(extractRoot, "windows");
      await extractArchive({ archive: entry.path, destination, platform });
      const folder = entry.name.replace(/\.zip$/, "");
      const root = path.join(destination, folder);
      nodePath = path.join(outputDir, "bin", "node.exe");
      await copyFile(path.join(root, "node.exe"), nodePath);
      nodeLicense = path.join(root, "LICENSE");
    }

    const licenses = path.join(outputDir, "licenses");
    await mkdir(licenses, { recursive: true });
    await copyFile(nodeLicense, path.join(licenses, "Node.js-LICENSE.txt"));
    await copyFile(path.join(moduleRoot, "pptxgenjs", "LICENSE"), path.join(licenses, "PptxGenJS-LICENSE.txt"));

    const versionResult = await run(nodePath, ["--version"], { capture: true });
    if (versionResult.stdout.trim() !== `v${NODE_VERSION}`) {
      throw new Error(`Node version is ${versionResult.stdout.trim()}, expected v${NODE_VERSION}`);
    }
    await run(nodePath, ["-e", buildRuntimeSmokeScript()], {
      capture: true,
      env: { ...process.env, NODE_PATH: moduleRoot },
    });

    const manifest = buildRuntimeManifest({
      platform,
      arch,
      nodeSha256: await sha256File(nodePath),
      archives: verifiedArchives,
    });
    const manifestPath = path.join(outputDir, "runtime.json");
    const partialManifest = `${manifestPath}.tmp`;
    await writeFile(partialManifest, `${JSON.stringify(manifest, null, 2)}\n`);
    await rename(partialManifest, manifestPath);
    return manifest;
  } finally {
    await rm(extractRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = { platform: process.platform, arch: process.platform === "darwin" ? "universal" : "x64", output: "build/pptxgenjs-runtime" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--platform") args.platform = argv[++i];
    else if (argv[i] === "--arch") args.arch = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (args.platform === "windows") args.platform = "win32";
  if (args.arch === "amd64") args.arch = "x64";
  return args;
}

const scriptPath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(path.dirname(scriptPath), "..");
  const outputDir = path.resolve(rootDir, args.output);
  const cacheDir = path.join(rootDir, "build", "cache", "pptxgenjs-runtime");
  stagePptxgenjsRuntime({ rootDir, outputDir, cacheDir, platform: args.platform, arch: args.arch })
    .then((manifest) => console.log(`Staged PptxGenJS runtime: ${JSON.stringify(manifest)}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 1;
    });
}
