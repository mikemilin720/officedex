import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { syncEmbeddedPptist } from "./sync-embedded-pptist.mjs";

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "officedex-pptist-sync-"));
  const distDir = path.join(root, "dist");
  const publicDir = path.join(root, "public");
  const embedCssPath = path.join(root, "officedex-embed.css");
  await mkdir(path.join(distDir, "assets"), { recursive: true });
  await writeFile(
    path.join(distDir, "index.html"),
    '<!doctype html><html><head><script type="module" src="./assets/app.js"></script></head></html>\n',
  );
  await writeFile(path.join(distDir, "assets", "app.js"), "bundle");
  await writeFile(embedCssPath, ".officedex { display: block; }\n");
  return { distDir, publicDir, embedCssPath };
}

test("copies the complete PPTist dist and injects the OfficeDex embed stylesheet once", async () => {
  const fixture = await createFixture();

  await syncEmbeddedPptist(fixture);
  await syncEmbeddedPptist(fixture);

  const outputHtml = await readFile(path.join(fixture.publicDir, "index.html"), "utf8");
  assert.match(outputHtml, /officedex-embed\.css/);
  assert.match(outputHtml, /<script type="module"/);
  assert.equal(outputHtml.match(/officedex-embed\.css/g)?.length, 1);
  assert.equal(await readFile(path.join(fixture.publicDir, "assets", "app.js"), "utf8"), "bundle");
});

test("deletes stale destination files before copying the PPTist dist", async () => {
  const fixture = await createFixture();
  await mkdir(fixture.publicDir, { recursive: true });
  await writeFile(path.join(fixture.publicDir, "stale.txt"), "stale");

  await syncEmbeddedPptist(fixture);

  await assert.rejects(readFile(path.join(fixture.publicDir, "stale.txt")), { code: "ENOENT" });
});
