import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export function bundledRuntimeDestination(target) {
  return target.endsWith(".app")
    ? path.join(target, "Contents", "Resources", "pptxgenjs-runtime")
    : path.join(target, "pptxgenjs-runtime");
}

export async function bundleRuntime({ source, target }) {
  if (!source || !target) throw new Error("source and target are required");
  await access(source);
  const destination = bundledRuntimeDestination(target);
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, preserveTimestamps: true });
  return destination;
}

function parseArgs(argv) {
  const args = { source: "build/pptxgenjs-runtime", target: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--source") args.source = argv[++i];
    else if (argv[i] === "--target") args.target = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!args.target) throw new Error("--target is required");
  return args;
}

const scriptPath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const rootDir = path.resolve(path.dirname(scriptPath), "..");
  const args = parseArgs(process.argv.slice(2));
  bundleRuntime({ source: path.resolve(rootDir, args.source), target: path.resolve(rootDir, args.target) })
    .then((destination) => console.log(`Bundled PptxGenJS runtime into ${destination}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 1;
    });
}
