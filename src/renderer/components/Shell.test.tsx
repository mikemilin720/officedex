import { createElement } from "react";
import type { ComponentType } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("uses the OfficeDex PNG app icon for the sidebar brand mark", () => {
    render(
      <LocaleProvider value="en">
        {createElement(
          Shell as unknown as ComponentType<Record<string, unknown>>,
          {
            activeNav: "tasks",
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

    expect(screen.getByAltText("OfficeDex logo").getAttribute("src")).toBe("./officedex-logo.png");
  });

  it("places the credit meter above Profile in the sidebar footer", () => {
    render(
      <LocaleProvider value="en">
        {createElement(
          Shell as unknown as ComponentType<Record<string, unknown>>,
          {
            activeNav: "tasks",
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

  it("uses the topbar as the only sidebar control and reveals the hidden sidebar from the left edge", () => {
    render(
      <LocaleProvider value="en">
        {createElement(
          Shell as unknown as ComponentType<Record<string, unknown>>,
          {
            activeNav: "tasks",
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
    const css = readFileSync("src/renderer/styles/shell.css", "utf8");
    const shell = document.querySelector(".app-shell");
    const toggle = screen.getByRole("button", { name: /collapse sidebar/i });

    expect(document.querySelector(".sidebar-divider-toggle")).toBeNull();
    expect(toggle.closest(".topbar-sidebar-slot")).toBeTruthy();
    expect(toggle.getAttribute("data-sidebar-icon-state")).toBe("expanded");

    fireEvent.click(toggle);

    expect(shell?.classList.contains("sidebar-collapsed")).toBe(true);
    const expandToggle = screen.getByRole("button", { name: /expand sidebar/i });
    expect(expandToggle.getAttribute("data-sidebar-icon-state")).toBe("hidden");
    expect(expandToggle.querySelector(".sidebar-toggle-dot")).toBeTruthy();
    const hoverZone = document.querySelector(".sidebar-hover-zone");
    expect(hoverZone).toBeTruthy();
    fireEvent.mouseEnter(hoverZone!);

    expect(expandToggle.getAttribute("data-sidebar-icon-state")).toBe("preview");
    expect(css).toMatch(/\.sidebar-collapsed\s*\.sidebar-hover-zone:hover\s*\+\s*\.sidebar/s);
    expect(css).toMatch(/\.sidebar-collapsed\s*\.sidebar:hover/s);
    expect(css).toMatch(/\.sidebar-collapsed\.sidebar-preview\s*\.sidebar/s);
    expect(css).toMatch(/\.topbar\s*\{[^}]*z-index:\s*40;/s);
    expect(css).toMatch(/\.app-shell\.sidebar-collapsed,[\s\S]*grid-template-columns:\s*0\s+minmax\(0,\s*1fr\)/);
  });
});
