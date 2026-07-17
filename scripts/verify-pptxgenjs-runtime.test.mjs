import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyRuntime } from "./verify-pptxgenjs-runtime.mjs";

async function writeRuntimeFixture({ nodeVersion = "24.18.0", pptxgenjsVersion = "4.0.1", includeNode = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "officedex-verify-runtime-"));
  await mkdir(path.join(root, "bin"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "pptxgenjs"), { recursive: true });
  await mkdir(path.join(root, "licenses"), { recursive: true });
  if (includeNode) await writeFile(path.join(root, "bin", "node"), "fake node");
  await writeFile(path.join(root, "node_modules", "pptxgenjs", "package.json"), JSON.stringify({ version: pptxgenjsVersion }));
  await writeFile(path.join(root, "licenses", "Node.js-LICENSE.txt"), "Node license");
  await writeFile(path.join(root, "licenses", "PptxGenJS-LICENSE.txt"), "PptxGenJS license");
  await writeFile(path.join(root, "runtime.json"), JSON.stringify({
    schemaVersion: 1,
    nodeVersion,
    pptxgenjsVersion,
    platform: "darwin",
    arch: "universal",
    nodeSha256: "fixture",
    archives: [],
  }));
  return root;
}

test("accepts pinned metadata and required runtime files", async () => {
  const root = await writeRuntimeFixture();
  const result = await verifyRuntime({ root, platform: "darwin", skipExecution: true, skipNodeChecksum: true });
  assert.equal(result.nodeVersion, "24.18.0");
  assert.equal(result.pptxgenjsVersion, "4.0.1");
});

test("rejects a package missing Node", async () => {
  const root = await writeRuntimeFixture({ includeNode: false });
  await assert.rejects(() => verifyRuntime({ root, platform: "darwin", skipExecution: true }), /missing Node/);
});

test("rejects the wrong PptxGenJS version", async () => {
  const root = await writeRuntimeFixture({ pptxgenjsVersion: "4.0.0" });
  await assert.rejects(() => verifyRuntime({ root, platform: "darwin", skipExecution: true }), /expected PptxGenJS 4\.0\.1/);
});

test("rejects missing runtime license files", async () => {
  const root = await writeRuntimeFixture();
  await writeFile(path.join(root, "licenses", "PptxGenJS-LICENSE.txt"), "");
  await assert.rejects(() => verifyRuntime({ root, platform: "darwin", skipExecution: true }), /empty license/);
  assert.equal((await readFile(path.join(root, "licenses", "Node.js-LICENSE.txt"), "utf8")).trim(), "Node license");
});
