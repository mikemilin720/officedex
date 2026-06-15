import { expect, test } from "@playwright/test";
import {
  answerPlanUntilCompleted,
  attachHostReport,
  dismissOnboarding,
  hostControl,
  preparePage,
  recordScenario,
  submitGeneration,
} from "./support/real-e2e";

test.describe("OfficeDex real client artifact preview, OS actions, and issue reporting", () => {
  test.afterEach(async ({}, testInfo) => {
    await attachHostReport(testInfo);
  });

  test("previews a real completed docx artifact, records OS actions, revokes preview token, and reports a failed task", async ({ page }) => {
    await preparePage(page);
    const startedAt = Date.now();

    await submitGeneration(page, {
      documentType: "docx",
      prompt: "Write a short OfficeDex real E2E preview memo with two sections and one bullet list.",
    });

    const artifact = await answerPlanUntilCompleted(page, "docx");
    const resultCard = page.locator(".result-card").first();
    await expect(resultCard).toBeVisible({ timeout: 60_000 });
    await resultCard.getByRole("button").filter({ hasText: /^Open$/i }).click({ timeout: 60_000 });
    await resultCard.getByRole("button").filter({ hasText: /Show in Folder/i }).click({ timeout: 60_000 });
    await resultCard.getByRole("button").filter({ hasText: /Preview/i }).click({ timeout: 60_000 });
    await expect(page.getByLabel(/Close Preview/i)).toBeVisible({ timeout: 60_000 });
    await page.getByLabel(/Close Preview/i).click();

    const actions = await hostControl<{ actions: Array<{ kind: string; value: string }> }>("/control/actions");
    expect(actions.actions.some((action) => action.kind === "openPath" && action.value === artifact.artifactPath)).toBeTruthy();
    expect(actions.actions.some((action) => action.kind === "showItemInFolder" && action.value === artifact.artifactPath)).toBeTruthy();

    const preview = await hostControl<{ issued: number; revoked: number }>("/control/preview-tokens");
    expect(preview.issued).toBeGreaterThan(0);
    expect(preview.revoked).toBeGreaterThan(0);

    await hostControl("/control/seed/failed-task", {
      method: "POST",
      body: JSON.stringify({ taskId: "real-e2e-failed-ui-task" }),
    });
    await page.reload();
    await dismissOnboarding(page);
    await expect(page.getByText(/Real E2E diagnostic failure fixture/i).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button").filter({ hasText: /Report issue|Copy request id/i }).first().click({ timeout: 60_000 });

    await recordScenario({
      uiScenario: "artifact-preview-os-actions-token-revoke-report-failed-task",
      documentType: "docx",
      mode: "plan",
      taskId: artifact.taskId,
      artifactPath: artifact.artifactPath,
      fileSize: artifact.fileSize,
      durationMs: Date.now() - startedAt,
    });
  });
});
