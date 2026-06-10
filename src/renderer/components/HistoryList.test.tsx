import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConversationListItem } from "../taskState";
import { LocaleProvider } from "../i18n";
import { HistoryList } from "./HistoryList";

afterEach(() => {
  cleanup();
});

function conversation(overrides: Partial<ConversationListItem>): ConversationListItem {
  return {
    conversationId: "task-1",
    firstTaskId: "task-1",
    latestTaskId: "task-1",
    status: "completed",
    title: "Quarterly review",
    documentType: "pptx",
    ...overrides,
  };
}

function renderHistory(conversations: ConversationListItem[], overrides: Partial<Parameters<typeof HistoryList>[0]> = {}) {
  return render(
    <LocaleProvider value="en">
      <HistoryList
        conversations={conversations}
        selectedConversationId={conversations[0]?.conversationId}
        collapsed={false}
        onSelect={() => undefined}
        onDelete={() => undefined}
        {...overrides}
      />
    </LocaleProvider>,
  );
}

describe("HistoryList", () => {
  it("renders active conversations with a spinner instead of a solid status dot", () => {
    renderHistory([
      conversation({ conversationId: "conv-running", latestTaskId: "task-running", status: "running", title: "Running conversation" }),
      conversation({ conversationId: "conv-starting", latestTaskId: "task-starting", status: "starting", title: "Starting conversation" }),
      conversation({ conversationId: "conv-done", latestTaskId: "task-done", status: "completed", title: "Done conversation" }),
    ]);

    const runningItem = screen.getByRole("button", { name: /Running conversation/ });
    const startingItem = screen.getByRole("button", { name: /Starting conversation/ });
    const completedItem = screen.getByRole("button", { name: /Done conversation/ });

    expect(runningItem.querySelector(".status-spinner")).toBeTruthy();
    expect(runningItem.querySelector(".status-dot")).toBeNull();
    expect(startingItem.querySelector(".status-spinner")).toBeTruthy();
    expect(startingItem.querySelector(".status-dot")).toBeNull();
    expect(completedItem.querySelector(".status-dot.green")).toBeTruthy();
  });

  it("selects the latest task id while deleting by conversation id", () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    renderHistory(
      [
        conversation({
          conversationId: "conv-1",
          firstTaskId: "task-1",
          latestTaskId: "task-2",
          title: "Stable title",
        }),
      ],
      { onSelect, onDelete },
    );

    fireEvent.click(screen.getByRole("button", { name: /Stable title/ }));
    expect(onSelect).toHaveBeenCalledWith("task-2");

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalledWith("conv-1");
  });

  it("keeps the delete affordance in a reserved layout slot to avoid hover jitter", () => {
    const css = readFileSync("src/renderer/styles/shell.css", "utf8");

    expect(css).toContain("grid-template-columns: 22px minmax(0, 1fr) 14px 24px");
    expect(css).toMatch(/\.history-item-delete\s*\{[^}]*opacity:\s*0;/s);
    expect(css).toMatch(/\.history-item-delete\s*\{[^}]*pointer-events:\s*none;/s);
    expect(css).not.toMatch(/\.history-item-delete\s*\{[^}]*display:\s*none;/s);
  });
});
