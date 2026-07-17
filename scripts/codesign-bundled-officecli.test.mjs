import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildCodesignTargets,
  codesignEntitlementsForTarget,
  refreshRuntimeManifestNodeChecksum,
} from "./codesign-bundled-officecli.mjs";

test("signs bundled Node before OfficeCLI and the outer app", () => {
  const app = path.join("build", "bin", "OfficeDex.app");
  assert.deepEqual(buildCodesignTargets({ app, binaryName: "officecli" }), [
    path.join(app, "Contents", "Resources", "pptxgenjs-runtime", "bin", "node"),
    path.join(app, "Contents", "Resources", "officecli", "officecli"),
    app,
  ]);
});

test("uses Node-specific JIT entitlements only for the bundled Node target", () => {
  assert.equal(codesignEntitlementsForTarget({
    target: "/app/runtime/bin/node",
    runtimeNode: "/app/runtime/bin/node",
    defaultEntitlements: "/app/default.plist",
    nodeEntitlements: "/app/node.plist",
  }), "/app/node.plist");
  assert.equal(codesignEntitlementsForTarget({
    target: "/app/officecli",
    runtimeNode: "/app/runtime/bin/node",
    defaultEntitlements: "/app/default.plist",
    nodeEntitlements: "/app/node.plist",
  }), "/app/default.plist");
});

test("refreshes runtime.json after codesign changes the Node binary", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pptxgenjs-signed-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const node = path.join(root, "bin", "node");
  await mkdir(path.dirname(node), { recursive: true });
  await writeFile(node, "signed node bytes");
  await writeFile(path.join(root, "runtime.json"), JSON.stringify({ nodeSha256: "before", nodeSigned: false }));

  const manifest = await refreshRuntimeManifestNodeChecksum(node);

  assert.notEqual(manifest.nodeSha256, "before");
  assert.equal(manifest.nodeSigned, true);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "runtime.json"), "utf8")), manifest);
});
