import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as runtimeStager from "./stage-pptxgenjs-runtime.mjs";
import {
  NODE_VERSION,
  PPTXGENJS_VERSION,
  buildRuntimeManifest,
  buildRuntimeSmokeScript,
  findChecksum,
  pruneRuntimeNodeModules,
  verifyFileChecksum,
} from "./stage-pptxgenjs-runtime.mjs";

test("runs npm through a shell only on Windows", () => {
  assert.deepEqual(runtimeStager.npmInvocationForPlatform?.("win32"), {
    command: "npm",
    shell: true,
  });
  assert.deepEqual(runtimeStager.npmInvocationForPlatform?.("darwin"), {
    command: "npm",
    shell: false,
  });
});

test("finds the exact Node archive checksum", () => {
  const expected = "a".repeat(64);
  const shasums = `${"b".repeat(64)}  node-v24.18.0-darwin-x64.tar.gz\n${expected}  node-v24.18.0-darwin-arm64.tar.gz\n`;
  assert.equal(findChecksum(shasums, "node-v24.18.0-darwin-arm64.tar.gz"), expected);
});

test("rejects an archive checksum mismatch", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "officedex-runtime-checksum-"));
  const file = path.join(dir, "node.tar.gz");
  await writeFile(file, "not the expected archive");
  await assert.rejects(() => verifyFileChecksum(file, "0".repeat(64)), /SHA256 mismatch/);
});

test("creates pinned runtime metadata", () => {
  const manifest = buildRuntimeManifest({
    platform: "darwin",
    arch: "universal",
    nodeSha256: "c".repeat(64),
    archives: [{ name: "node.tar.gz", sha256: "d".repeat(64) }],
  });
  assert.equal(manifest.nodeVersion, NODE_VERSION);
  assert.equal(manifest.pptxgenjsVersion, PPTXGENJS_VERSION);
  assert.equal(manifest.platform, "darwin");
  assert.equal(manifest.arch, "universal");
  assert.equal(manifest.nodeSha256, "c".repeat(64));
});

test("rejects a checksum entry for a different filename", () => {
  const shasums = `${"a".repeat(64)}  node-v24.18.0-darwin-arm64.tar.gz.extra\n`;
  assert.throws(() => findChecksum(shasums, "node-v24.18.0-darwin-arm64.tar.gz"), /checksum not found/);
});

test("runtime smoke loads the package without using its private package.json export", () => {
  const script = buildRuntimeSmokeScript();
  assert.match(script, /require\("pptxgenjs"\)/);
  assert.doesNotMatch(script, /pptxgenjs\/package\.json/);
});

test("removes npm command shims that are not needed by the embedded runtime", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pptxgenjs-runtime-prune-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = path.join(root, ".bin");
  await mkdir(bin, { recursive: true });
  await writeFile(path.join(root, "tool.js"), "tool");
  await symlink("../tool.js", path.join(bin, "tool"));

  await pruneRuntimeNodeModules(root);

  await assert.rejects(() => access(bin));
  await access(path.join(root, "tool.js"));
});
