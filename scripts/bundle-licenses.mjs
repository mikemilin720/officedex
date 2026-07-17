import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function bundleLicenses({ rootDir, target }) {
  if (!rootDir || !target) throw new Error("rootDir and target are required");
  const destination = target.endsWith(".app")
    ? path.join(target, "Contents", "Resources", "licenses")
    : path.join(target, "licenses");

  await rm(destination, { force: true, recursive: true });
  await mkdir(destination, { recursive: true });

  const files = [
    ["LICENSE", "OfficeDex-GPL-3.0.txt"],
    ["NOTICE", "OfficeDex-NOTICE.txt"],
    ["THIRD_PARTY_NOTICES.md", "THIRD_PARTY_NOTICES.md"],
    [path.join("third_party", "pptist", "LICENSE"), "PPTist-AGPL-3.0.txt"],
    [path.join("third_party", "pptist", "OFFICEDEX_CHANGES.md"), "PPTist-OFFICEDEX_CHANGES.md"],
    [path.join("third_party", "officecli", "LICENSE"), "OfficeCLI-MIT.txt"],
  ];
  for (const [source, name] of files) {
    await cp(path.join(rootDir, source), path.join(destination, name));
  }

  const fontSource = path.join(rootDir, "third_party", "pptist", "src", "assets", "fonts");
  const fontDestination = path.join(destination, "PPTist-font-licenses");
  await mkdir(fontDestination, { recursive: true });
  await cp(path.join(fontSource, "LICENSES.json"), path.join(fontDestination, "LICENSES.json"));
  await cp(path.join(fontSource, "licenses"), path.join(fontDestination, "licenses"), { recursive: true });

  await bundlePptxgenjsRuntimeLicenses({
    runtimeRoot: path.join(rootDir, "build", "pptxgenjs-runtime"),
    destination: path.join(destination, "PptxGenJS-runtime"),
  });

  return destination;
}

async function bundlePptxgenjsRuntimeLicenses({ runtimeRoot, destination }) {
  await mkdir(path.join(destination, "npm"), { recursive: true });
  await cp(path.join(runtimeRoot, "licenses", "Node.js-LICENSE.txt"), path.join(destination, "Node.js-LICENSE.txt"));
  await cp(path.join(runtimeRoot, "licenses", "PptxGenJS-LICENSE.txt"), path.join(destination, "PptxGenJS-LICENSE.txt"));

  const packages = await findInstalledPackages(path.join(runtimeRoot, "node_modules"));
  const manifest = [];
  for (const packageDir of packages) {
    const pkg = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
    if (!pkg.name || !pkg.version) continue;
    const entries = await readdir(packageDir, { withFileTypes: true });
    const licenseEntry = entries.find((entry) => entry.isFile() && /^licen[cs]e(?:\.|$)/i.test(entry.name));
    let licenseFile = null;
    if (licenseEntry) {
      const safeName = `${pkg.name}@${pkg.version}`.replaceAll("/", "+").replace(/[^a-zA-Z0-9@+._-]/g, "_");
      licenseFile = `${safeName}-LICENSE.txt`;
      await cp(path.join(packageDir, licenseEntry.name), path.join(destination, "npm", licenseFile));
    }
    manifest.push({
      name: pkg.name,
      version: pkg.version,
      license: pkg.license || "UNKNOWN",
      author: typeof pkg.author === "string" ? pkg.author : pkg.author?.name || "",
      licenseFile: licenseFile ? path.posix.join("npm", licenseFile) : null,
    });
  }
  manifest.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  await writeFile(path.join(destination, "npm-licenses.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function findInstalledPackages(nodeModulesRoot) {
  const found = new Map();
  async function visitNodeModules(root) {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".bin") continue;
      if (entry.name.startsWith("@")) {
        const scopeRoot = path.join(root, entry.name);
        for (const scoped of await readdir(scopeRoot, { withFileTypes: true })) {
          if (scoped.isDirectory()) await visitPackage(path.join(scopeRoot, scoped.name));
        }
      } else {
        await visitPackage(path.join(root, entry.name));
      }
    }
  }
  async function visitPackage(packageDir) {
    try {
      const pkg = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
      if (pkg.name && pkg.version) found.set(`${pkg.name}@${pkg.version}`, packageDir);
    } catch {
      return;
    }
    try {
      await visitNodeModules(path.join(packageDir, "node_modules"));
    } catch {
      // Most npm installs are flattened and have no nested node_modules.
    }
  }
  await visitNodeModules(nodeModulesRoot);
  return [...found.values()];
}

function parseTarget(argv) {
  const index = argv.indexOf("--target");
  if (index === -1 || !argv[index + 1]) throw new Error("Usage: bundle-licenses.mjs --target <path>");
  return argv[index + 1];
}

const scriptPath = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const rootDir = path.resolve(path.dirname(scriptPath), "..");
  bundleLicenses({ rootDir, target: path.resolve(parseTarget(process.argv.slice(2))) })
    .then((destination) => console.log(`Bundled release licenses into ${destination}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
