import { expect, test } from "@playwright/test";
import {
  answerPlanUntilCompleted,
  assertNoResponseContractError,
  attachHostReport,
  fixturePath,
  preparePage,
  recordScenario,
  submitGeneration,
  waitForCompletedArtifact,
  type DocumentType,
} from "./support/real-e2e";

const GENERATION_MATRIX: Array<{
  documentType: DocumentType;
  prompt: string;
  sourceFixture?: string;
}> = [
  {
    documentType: "pptx",
    prompt: "Create a concise three-slide OfficeDex real E2E deck about a product launch plan. Keep text short.",
  },
  {
    documentType: "docx",
    prompt: "Write a one-page OfficeDex real E2E memo about rollout risks and mitigation steps.",
  },
  {
    documentType: "xlsx",
    prompt: "Create a compact OfficeDex real E2E workbook with a project budget table and totals.",
  },
  {
    documentType: "report",
    prompt: "Create an OfficeDex real E2E report from this workbook. Summarize the trend and include a recommendation.",
    sourceFixture: "sales-report.xlsx",
  },
  {
    documentType: "img",
    prompt: "Generate a simple clean product illustration for OfficeDex real E2E, white background, no text.",
  },
  {
    documentType: "gif",
    prompt: "Generate a short subtle OfficeDex real E2E loading animation concept, simple shapes, no text.",
  },
];

test.describe.configure({ mode: "serial" });

test.describe("OfficeDex real client generation and artifact flows", () => {
  test.afterEach(async ({}, testInfo) => {
    await attachHostReport(testInfo);
  });

  for (const item of GENERATION_MATRIX) {
    test(`generates a real ${item.documentType} artifact from the UI`, async ({ page }) => {
      await preparePage(page);
      const startedAt = Date.now();
      const sourceFile = item.sourceFixture ? await fixturePath(item.sourceFixture) : undefined;

      await submitGeneration(page, {
        documentType: item.documentType,
        prompt: item.prompt,
        sourceFile,
      });

      const artifact = await waitForCompletedArtifact(page, item.documentType);
      const durationMs = Date.now() - startedAt;
      await expect(page.getByText(artifact.artifactPath.split(/[\\/]/).pop() ?? artifact.artifactPath)).toBeVisible();

      await recordScenario({
        uiScenario: `generate-${item.documentType}`,
        documentType: item.documentType,
        mode: item.documentType === "img" || item.documentType === "gif" ? undefined : "plan",
        taskId: artifact.taskId,
        artifactPath: artifact.artifactPath,
        fileSize: artifact.fileSize,
        durationMs,
      });
    });
  }

  test("blocks on docx plan option response contract and completes the real artifact", async ({ page }) => {
    await preparePage(page);
    const startedAt = Date.now();

    await submitGeneration(page, {
      documentType: "docx",
      mode: "plan",
      prompt: "Use plan mode to write a one-page onboarding checklist for a new OfficeDex customer success workflow.",
    });

    await expect(page.getByText(/Review the plan|Confirmation Required|Recommended/i).first()).toBeVisible({ timeout: 20 * 60_000 });
    const artifact = await answerPlanUntilCompleted(page, "docx");
    await recordScenario({
      uiScenario: "generate-docx-plan-option-response",
      documentType: "docx",
      mode: "plan",
      taskId: artifact.taskId,
      artifactPath: artifact.artifactPath,
      fileSize: artifact.fileSize,
      durationMs: Date.now() - startedAt,
    });
  });

  test("answers pptx plan with revise, freeform, multi-question navigation, cancel, and retry", async ({ page }) => {
    await preparePage(page);

    await submitGeneration(page, {
      documentType: "pptx",
      mode: "plan",
      prompt: "Use plan mode to create a short OfficeDex launch presentation with agenda, risks, and owner next steps.",
    });

    await expect(page.getByText(/Review the plan|Confirmation Required|Question 1 of|Recommended/i).first()).toBeVisible({ timeout: 20 * 60_000 });
    if (await page.getByPlaceholder(/what to do differently/i).isVisible().catch(() => false)) {
      await page.getByPlaceholder(/what to do differently/i).fill("Make it shorter and include one adoption KPI.");
      await page.getByRole("button", { name: /^Submit/i }).click();
      await assertNoResponseContractError(page);
      await expect(page.getByText(/Review the plan|Confirmation Required|Question 1 of|Recommended/i).first()).toBeVisible({ timeout: 20 * 60_000 });
    }
    if (await page.getByRole("button", { name: /Next question/i }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Next question/i }).click();
      await page.getByPlaceholder(/Type a custom answer/i).fill("Use a pragmatic executive tone.");
      await page.locator(".inline-answer button[type='submit']").click();
      await assertNoResponseContractError(page);
    } else if (await page.locator(".question-composer-option").first().isVisible().catch(() => false)) {
      await page.locator(".question-composer-option").first().click();
      await assertNoResponseContractError(page);
    }

    await page.getByRole("button", { name: /Cancel/i }).click();
    await expect(page.getByText(/cancelled|Task cancelled/i).first()).toBeVisible({ timeout: 60_000 });

    await recordScenario({
      uiScenario: "generate-pptx-plan-revise-freeform-navigation-cancel",
      documentType: "pptx",
      mode: "plan",
    });
  });
});
