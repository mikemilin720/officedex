import { expect, test } from "@playwright/test";

import {
  assertNoResponseContractError,
  attachHostReport,
  preparePage,
  recordScenario,
  submitGeneration,
} from "./support/real-e2e";

const OFFICECLI_MAGIC_VIBE_PROMPT = "officedex::magic-deck::v1::7f3k9q2x";

test("the bundled runtime enters PPTX Canvas Node mode", async ({ page }) => {
  await preparePage(page);

  await submitGeneration(page, {
    documentType: "pptx",
    mode: "plan",
    prompt: OFFICECLI_MAGIC_VIBE_PROMPT,
  });

  const canvas = page.locator(".living-tree-cockpit").first();
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await assertNoResponseContractError(page);

  await page.getByRole("button", { name: /Cancel/i }).click();
  await expect(page.getByText(/cancelled|Task cancelled/i).first()).toBeVisible({ timeout: 60_000 });

  await recordScenario({
    uiScenario: "canvas-runtime-contract",
    documentType: "pptx",
    mode: "plan",
  });
});

test.afterEach(async ({}, testInfo) => {
  await attachHostReport(testInfo);
});
