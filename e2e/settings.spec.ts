import { test, expect } from "@playwright/test";
import { emitBridgeEvent, getBridgeCalls, installBridgeMock } from "./fixtures/bridge-mock";

test.describe("Settings screen", () => {
  test("loads current defaults and persists changes", async ({ page }) => {
    await installBridgeMock(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /^generation$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connection" })).toBeHidden();

    await expect(page.getByText("Generation Mode")).toHaveCount(0);
    await expect(page.getByText("Smart")).toHaveCount(0);
    const calls = await getBridgeCalls(page, "updateSettings");
    expect(calls.some((args) => (args[0] as { defaults?: { mode?: string } })?.defaults?.mode !== undefined)).toBe(false);
  });

  test("switching default document type via Select sends the patch", async ({ page }) => {
    await installBridgeMock(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /^generation$/i })).toBeVisible();

    // Open the document type select (first compact selector under Settings)
    await page.getByText("PowerPoint (.pptx)").click();
    await page.getByText("Word (.docx)", { exact: true }).click();

    await expect.poll(async () => {
      const calls = await getBridgeCalls(page, "updateSettings");
      return calls.some((args) => (args[0] as { defaults?: { documentType?: string } })?.defaults?.documentType === "docx");
    }).toBe(true);
  });

  test("switching to Custom provider from Connection reveals the LLM provider form", async ({ page }) => {
    await installBridgeMock(page, { whoami: { mode: "logged_in", userId: "settings-e2e" } });
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /^generation$/i })).toBeVisible();

    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Connection" }).click();
    await expect(page.getByRole("heading", { name: "Connection" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^generation$/i })).toBeHidden();
    await page.locator(".setting-row").filter({ hasText: "LLM Provider" }).getByTitle("Official").click();
    await page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden)").getByText("Custom endpoint", { exact: true }).click();

    await expect(page.getByPlaceholder(/api key/i)).toBeVisible();
    await page.getByPlaceholder(/api key/i).fill("sk-e2e-key");
    await expect.poll(async () => {
      const calls = await getBridgeCalls(page, "updateSettings");
      return calls.some((args) => {
        const patch = args[0] as { llmProvider?: { apiKey?: string } };
        return patch?.llmProvider?.apiKey === "sk-e2e-key";
      });
    }).toBe(true);
  });

  test("workspace section is read-only and points users to Projects", async ({ page }) => {
    await installBridgeMock(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /^generation$/i })).toBeVisible();

    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Workspace" }).click();
    await expect(page.getByText("Workspace projects")).toBeVisible();
    await expect(page.locator(".setting-row").filter({ hasText: "Workspace projects" }).getByRole("textbox")).toBeDisabled();

    const calls = await getBridgeCalls(page, "updateSettings");
    expect(calls.some((args) => (args[0] as { workspaceDir?: string })?.workspaceDir !== undefined)).toBe(false);
  });

  test("Projects sidebar adds folders and keeps no-project chats under Chats", async ({ page }) => {
    await installBridgeMock(page, { pickedFile: "/Users/test/projects/officedex" });
    await page.goto("/");

    await expect(page.getByText("Projects", { exact: true })).toBeVisible();
    await expect(page.getByText("Chats", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "workspace", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Add project" }).click();
    await page.getByRole("menuitem", { name: "Use an existing folder" }).click();
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByRole("button", { name: "officedex", exact: true })).toBeVisible();
    await expect.poll(async () => (await getBridgeCalls(page, "addWorkspace")).length).toBe(1);

    await sidebar.getByRole("button", { name: "Project actions for officedex", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Pin project" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByRole("menuitem", { name: "Create permanent worktree" })).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("menuitem", { name: "Reveal in Finder" }).click();
    await expect.poll(async () => (await getBridgeCalls(page, "showItemInFolder")).length).toBe(1);

    await sidebar.getByRole("button", { name: "New chat in officedex", exact: true }).click();
    await expect(page.getByRole("heading", { name: /What should we work on in officedex/i })).toBeVisible();

    await emitBridgeEvent(page, {
      task_id: "task-no-project",
      type: "task.started",
      payload: { document_type: "pptx", topic: "Standalone chat" },
    });
    await emitBridgeEvent(page, {
      task_id: "task-no-project",
      type: "task.completed",
      payload: { result: { file_path: "/tmp/no-project.pptx", file_name: "no-project.pptx", document_type: "pptx" } },
    });

    await expect(page.locator(".chat-section").getByRole("button", { name: /Standalone chat/ })).toBeVisible();
    await sidebar.getByRole("button", { name: "Collapse Chats" }).click();
    await expect(page.locator(".chat-section").getByRole("button", { name: /Standalone chat/ })).toHaveCount(0);
    await sidebar.getByRole("button", { name: "Expand Chats" }).click();
    await expect(page.locator(".chat-section").getByRole("button", { name: /Standalone chat/ })).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await sidebar.getByRole("button", { name: "Project actions for officedex", exact: true }).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect.poll(async () => (await getBridgeCalls(page, "removeWorkspace")).length).toBe(1);
    await expect(sidebar.getByRole("button", { name: "officedex", exact: true })).toHaveCount(0);

    await sidebar.getByRole("button", { name: /New chat/ }).first().click();
    await expect(page.getByRole("heading", { name: "What should we work on?" })).toBeVisible();
  });

  test("Reset everything modal triggers a full settings reset patch", async ({ page }) => {
    await installBridgeMock(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /^generation$/i })).toBeVisible();

    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("heading", { name: "Reset", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /reset everything/i }).first().click();
    // Click the dangerous-styled OK button inside the confirm modal.
    await page.locator(".ant-modal-confirm-btns button.ant-btn-dangerous").click();

    await expect.poll(async () => {
      const calls = await getBridgeCalls(page, "updateSettings");
      return calls.some((args) => {
        const patch = args[0] as { onboardingCompletedAt?: unknown; llmProvider?: unknown };
        return patch?.onboardingCompletedAt === null && patch?.llmProvider === null;
      });
    }).toBe(true);
  });
});
