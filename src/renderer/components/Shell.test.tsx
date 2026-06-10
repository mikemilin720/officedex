import { createElement } from "react";
import type { ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopAPI } from "../../shared/types";
import { LocaleProvider } from "../i18n";
import { Shell } from "./Shell";

vi.mock("../bridge", () => ({
  officecli: new Proxy({} as DesktopAPI, {
    get(_target, prop) {
      if (prop === "getBridgeRuntimeSnapshot") {
        return vi.fn(async () => null);
      }
      if (prop === "onBridgeEvent") {
        return vi.fn(() => () => undefined);
      }
      return vi.fn();
    },
  }),
}));

afterEach(() => {
  cleanup();
});

describe("Shell sidebar layout", () => {
  it("uses the OfficeDex SVG logo for the sidebar brand mark", () => {
    render(
      <LocaleProvider value="en">
        {createElement(
          Shell as unknown as ComponentType<Record<string, unknown>>,
          {
            activeNav: "tasks",
            bridgeStatus: "connected",
            failed: false,
            tasks: [],
            selectedTaskId: undefined,
            workspaces: [],
            chats: [],
            activeWorkspaceId: undefined,
            activeWorkspaceName: undefined,
            selectedConversationId: undefined,
            onNavChange: vi.fn(),
            onNewGeneration: vi.fn(),
            onSelectWorkspace: vi.fn(),
            onAddWorkspace: vi.fn(),
            onRevealWorkspace: vi.fn(),
            onRemoveWorkspace: vi.fn(),
            onSelectTask: vi.fn(),
            onDeleteTask: vi.fn(),
            onDeleteConversation: vi.fn(),
          },
          <div />,
        )}
      </LocaleProvider>,
    );

    expect(screen.getByAltText("OfficeDex logo").getAttribute("src")).toBe("./officedex-logo.svg");
  });

  it("places the credit meter above Profile in the sidebar footer", () => {
    render(
      <LocaleProvider value="en">
        {createElement(
          Shell as unknown as ComponentType<Record<string, unknown>>,
          {
            activeNav: "tasks",
            bridgeStatus: "connected",
            failed: false,
            tasks: [],
            selectedTaskId: undefined,
            workspaces: [],
            chats: [],
            activeWorkspaceId: undefined,
            activeWorkspaceName: undefined,
            selectedConversationId: undefined,
            credit: { displayMode: "balance", used: 0, total: 42, planLabel: "Credits" },
            onNavChange: vi.fn(),
            onNewGeneration: vi.fn(),
            onSelectWorkspace: vi.fn(),
            onAddWorkspace: vi.fn(),
            onRevealWorkspace: vi.fn(),
            onRemoveWorkspace: vi.fn(),
            onSelectTask: vi.fn(),
            onDeleteTask: vi.fn(),
            onDeleteConversation: vi.fn(),
          },
          <div />,
        )}
      </LocaleProvider>,
    );

    const meter = screen.getByRole("group", { name: /credit balance/i });
    const profile = screen.getByRole("button", { name: /profile/i });

    expect(meter.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps sidebar footer navigation controls vertically centered", () => {
    const css = readFileSync("src/renderer/styles/shell.css", "utf8");
    const settingsRule = css.match(/\.sidebar-settings\s*\{[^}]*\}/s)?.[0] ?? "";

    expect(css).toContain("grid-template-columns: 28px minmax(0, 1fr)");
    expect(css).toMatch(/\.nav-item > \.anticon\s*\{[^}]*place-items:\s*center;/s);
    expect(css).toMatch(/\.nav-item > span:not\(\.anticon\)\s*\{[^}]*line-height:\s*20px;/s);
    expect(settingsRule).not.toContain("border-top");
    expect(settingsRule).not.toContain("padding-top");
    expect(css).toMatch(/\.sidebar-settings::after\s*\{[^}]*background:\s*var\(--n-hairline-soft\);/s);
  });
});
