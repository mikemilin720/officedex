import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { buildCodesignTargets } from "./codesign-bundled-officecli.mjs";

test("signs bundled Node before OfficeCLI and the outer app", () => {
  const app = path.join("build", "bin", "OfficeDex.app");
  assert.deepEqual(buildCodesignTargets({ app, binaryName: "officecli" }), [
    path.join(app, "Contents", "Resources", "pptxgenjs-runtime", "bin", "node"),
    path.join(app, "Contents", "Resources", "officecli", "officecli"),
    app,
  ]);
});
