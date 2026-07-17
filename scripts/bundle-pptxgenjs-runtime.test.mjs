import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { bundleRuntime } from "./bundle-pptxgenjs-runtime.mjs";

test("copies the complete runtime into a macOS app", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pptxgenjs-runtime-bundle-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, "source");
  const targetApp = path.join(dir, "OfficeDex.app");
  await mkdir(path.join(source, "bin"), { recursive: true });
  await mkdir(path.join(source, "node_modules", "pptxgenjs"), { recursive: true });
  await writeFile(path.join(source, "bin", "node"), "node");
  await writeFile(path.join(source, "runtime.json"), "{}\n");
  await writeFile(path.join(source, "node_modules", "pptxgenjs", "package.json"), "{}\n");

  const destination = await bundleRuntime({ source, target: targetApp });

  assert.equal(destination, path.join(targetApp, "Contents", "Resources", "pptxgenjs-runtime"));
  await access(path.join(destination, "bin", "node"));
  await access(path.join(destination, "runtime.json"));
  await access(path.join(destination, "node_modules", "pptxgenjs", "package.json"));
});

test("replaces stale files from an earlier bundled runtime", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pptxgenjs-runtime-bundle-stale-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = path.join(dir, "source");
  const target = path.join(dir, "bin");
  const destination = path.join(target, "pptxgenjs-runtime");
  await mkdir(source, { recursive: true });
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(source, "runtime.json"), "{}\n");
  await writeFile(path.join(destination, "stale.txt"), "stale");

  await bundleRuntime({ source, target });

  await assert.rejects(() => access(path.join(destination, "stale.txt")));
});
