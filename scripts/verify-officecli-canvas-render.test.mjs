import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfficecliEnvironment,
  responseForQuestion,
  validatePptxBuffer,
} from "./verify-officecli-canvas-render.mjs";

test("builds a restricted OfficeCLI child environment with explicit runtime paths", () => {
  const env = buildOfficecliEnvironment({
    baseEnv: { PATH: "/opt/homebrew/bin:/usr/bin", KEEP: "yes" },
    platform: "darwin",
    nodePath: "/runtime/bin/node",
    moduleRoot: "/runtime/node_modules",
  });
  assert.equal(env.PATH, "/usr/bin:/bin:/usr/sbin:/sbin");
  assert.equal(env.OFFICECLI_PPTXGENJS_NODE, "/runtime/bin/node");
  assert.equal(env.OFFICECLI_PPTXGENJS_NODE_MODULES, "/runtime/node_modules");
  assert.equal(env.KEEP, "yes");
});

test("confirms the idea node when no action options are present", () => {
  assert.deepEqual(responseForQuestion({ id: "question-1", question: "Idea is ready", options: [] }), {
    question_id: "question-1",
    answer: JSON.stringify({ kind: "vibe_node_confirmed", nodeId: "root" }),
  });
});

test("chooses the first explicit Canvas action", () => {
  assert.deepEqual(responseForQuestion({ id: "question-2", options: [{ id: "generate_chapters" }] }), {
    question_id: "question-2",
    option_id: "generate_chapters",
  });
});

test("accepts a PPTX buffer containing required ZIP entries", () => {
  const fixture = Buffer.from("PK\\x03\\x04...[Content_Types].xml...ppt/presentation.xml...");
  assert.doesNotThrow(() => validatePptxBuffer(fixture, "fixture.pptx"));
});

test("rejects a generated artifact missing presentation.xml", () => {
  const fixture = Buffer.from("PK\\x03\\x04...[Content_Types].xml...");
  assert.throws(() => validatePptxBuffer(fixture, "fixture.pptx"), /ppt\/presentation\.xml/);
});
