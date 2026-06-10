import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Modal, message as antdMessage } from "antd";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreditStatus, DesktopAPI, UserSettings, WhoAmIResult } from "../../shared/types";
import { officecli } from "../bridge";
import { NOTIFICATIONS_STORAGE_KEY, readNotificationsEnabled } from "../notifications";

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      destroy: vi.fn(),
    },
  };
});

const DEFAULT_PROXY = { enabled: false, url: "http://127.0.0.1:7890" };

let currentSettings: UserSettings;

function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return key in store ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  };
}

function installDomStubs() {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    () =>
      ({
        getPropertyValue: () => "",
      }) as unknown as CSSStyleDeclaration,
  );
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => "blob:test-json");
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
}

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    version: 1,
    defaults: {
      documentType: "pptx",
      mode: "fast",
      enableImages: true,
      imageQuality: "premium",
      ...(overrides.defaults ?? {}),
    },
    outputDir: overrides.outputDir ?? null,
    llmProvider: overrides.llmProvider ?? null,
    onboardingCompletedAt: overrides.onboardingCompletedAt ?? "2026-05-22T00:00:00Z",
    proxy: overrides.proxy ?? DEFAULT_PROXY,
    imageWatermark: overrides.imageWatermark ?? { showWatermark: true, preferenceSource: "system" },
  };
}

let getSettingsSpy: ReturnType<typeof vi.fn>;
let updateSettingsSpy: ReturnType<typeof vi.fn>;
let getDefaultWorkspaceDirSpy: ReturnType<typeof vi.fn>;
let openDirectoryDialogSpy: ReturnType<typeof vi.fn>;
let testProviderSpy: ReturnType<typeof vi.fn>;
let whoamiSpy: ReturnType<typeof vi.fn>;
let getCreditStatusSpy: ReturnType<typeof vi.fn>;
let originals: Partial<DesktopAPI>;

async function cleanupAntdPortals() {
  Modal.destroyAll();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  cleanup();
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage());
  installDomStubs();
  localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  currentSettings = makeSettings();
  getSettingsSpy = vi.fn(async () => currentSettings);
  updateSettingsSpy = vi.fn(async (patch: Partial<UserSettings>) => {
    currentSettings = {
      ...currentSettings,
      ...patch,
      defaults: { ...currentSettings.defaults, ...(patch.defaults ?? {}) },
    };
    return currentSettings;
  });
  getDefaultWorkspaceDirSpy = vi.fn(async () => "/tmp/default-workspace");
  openDirectoryDialogSpy = vi.fn(async () => null);
  testProviderSpy = vi.fn(async () => ({ ok: true, httpStatus: 200, latencyMs: 10, url: "official" }));
  whoamiSpy = vi.fn(async (): Promise<WhoAmIResult> => ({ mode: "logged_in", userId: "user-settings" }));
  getCreditStatusSpy = vi.fn(async (): Promise<CreditStatus> => ({
    mode: "logged_in",
    accessMode: "hosted",
    planName: "Pro",
    paidEntitlement: true,
    hostedCreditBalance: 100,
    anonymousCreditAvailable: null,
    anonymousCreditReserved: null,
    anonymousCreditBalance: null,
    rewardRemaining: 0,
    paidKeyPrefix: "",
    paidKeyTotal: 0,
    paidKeyUsed: 0,
    paidKeyRemaining: 0,
    raw: "",
  }));
  originals = {
    getSettings: officecli.getSettings,
    updateSettings: officecli.updateSettings,
    getDefaultWorkspaceDir: officecli.getDefaultWorkspaceDir,
    openDirectoryDialog: officecli.openDirectoryDialog,
    testProvider: officecli.testProvider,
    whoami: officecli.whoami,
    getCreditStatus: officecli.getCreditStatus,
  };
  officecli.getSettings = getSettingsSpy as unknown as DesktopAPI["getSettings"];
  officecli.updateSettings = updateSettingsSpy as unknown as DesktopAPI["updateSettings"];
  officecli.getDefaultWorkspaceDir = getDefaultWorkspaceDirSpy as unknown as DesktopAPI["getDefaultWorkspaceDir"];
  officecli.openDirectoryDialog = openDirectoryDialogSpy as unknown as DesktopAPI["openDirectoryDialog"];
  officecli.testProvider = testProviderSpy as unknown as DesktopAPI["testProvider"];
  officecli.whoami = whoamiSpy as unknown as DesktopAPI["whoami"];
  officecli.getCreditStatus = getCreditStatusSpy as unknown as DesktopAPI["getCreditStatus"];
});

afterEach(async () => {
  await cleanupAntdPortals();
  Object.assign(officecli, originals);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SettingsScreen", () => {
  it("loads settings on mount and shows current generation defaults", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: /generation defaults/i })).toBeTruthy();
    expect(screen.getByText("Workspace Output Directory")).toBeTruthy();
    expect(screen.getAllByText("Connection").length).toBeGreaterThan(0);
  });

  it("renders a secondary menu inside Settings and jumps to clicked sections", async () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    const menu = await screen.findByRole("navigation", { name: "Settings sections" });
    expect(within(menu).getByRole("button", { name: "Generation Defaults" })).toBeTruthy();
    expect(within(menu).getByRole("button", { name: "Connection" })).toBeTruthy();

    fireEvent.click(within(menu).getByRole("button", { name: "Connection" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(within(menu).getByRole("button", { name: "Connection" }).getAttribute("aria-current")).toBe("true");
  });

  it("places About after the other Settings sections", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    const about = await screen.findByRole("heading", { level: 2, name: "About" });
    const diagnostics = screen.getByRole("heading", { level: 2, name: "Diagnostics" });
    const reset = screen.getByRole("heading", { level: 2, name: "Reset" });

    expect(diagnostics.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reset.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("changing default document type calls updateSettings with the new value", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    // antd Select: locate by current displayed label, click to open dropdown
    const trigger = await screen.findByText(/PowerPoint \(\.pptx\)/);
    fireEvent.mouseDown(trigger);
    const docxOption = await screen.findByText(/Word \(\.docx\)/);
    fireEvent.click(docxOption);

    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalled());
    const last = updateSettingsSpy.mock.calls.at(-1)![0] as Partial<UserSettings>;
    expect(last.defaults?.documentType).toBe("docx");
  });

  it("switching to Smart mode sends mode=best in updateSettings", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    await screen.findByRole("heading", { name: /generation defaults/i });

    fireEvent.click(screen.getByRole("radio", { name: /smart/i }));
    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalled());
    const last = updateSettingsSpy.mock.calls.at(-1)![0] as Partial<UserSettings>;
    expect(last.defaults?.mode).toBe("best");
  });

  it("toggling enableImages persists the new value", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    await screen.findByText("Enable Images");

    // The Switch in Enable Images row
    const enableImagesSwitches = screen.getAllByRole("switch");
    fireEvent.click(enableImagesSwitches[0]);
    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalled());
    const last = updateSettingsSpy.mock.calls.at(-1)![0] as Partial<UserSettings>;
    expect(last.defaults?.enableImages).toBe(false);
  });

  it("shows desktop notifications with generation defaults", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    const generationHeading = await screen.findByRole("heading", { level: 2, name: "Generation Defaults" });
    const generationGroup = generationHeading.closest(".setting-group");

    expect(generationGroup).not.toBeNull();
    expect(within(generationGroup as HTMLElement).getByRole("switch", { name: /desktop notifications/i })).toBeTruthy();
  });

  it("toggles desktop notifications in localStorage without writing Go settings", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    await screen.findByText("Desktop notifications");

    const desktopNotificationsSwitch = screen.getByRole("switch", { name: /desktop notifications/i });
    fireEvent.click(desktopNotificationsSwitch);

    expect(readNotificationsEnabled()).toBe(false);
    expect(localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)).toBe("false");
    expect(
      updateSettingsSpy.mock.calls.every((args) => (args[0] as Partial<UserSettings>).defaults?.enableImages === undefined),
    ).toBe(true);
  });

  it("Browse output directory calls openDirectoryDialog and stores the picked path", async () => {
    openDirectoryDialogSpy.mockResolvedValueOnce("/Users/test/picked/workspace");
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    await screen.findByText("Workspace Output Directory");

    const browseButtons = screen.getAllByRole("button", { name: /browse/i });
    fireEvent.click(browseButtons[0]);

    await waitFor(() => expect(openDirectoryDialogSpy).toHaveBeenCalled());
    await waitFor(() => {
      const matched = updateSettingsSpy.mock.calls.some((args) => {
        const patch = args[0] as Partial<UserSettings>;
        return patch.outputDir === "/Users/test/picked/workspace";
      });
      expect(matched).toBe(true);
    });
  });

  it("Provider form is always visible and lets user edit api key", async () => {
    currentSettings = makeSettings({
      defaults: {
        documentType: "pptx",
        mode: "fast",
        enableImages: true,
        imageQuality: "premium",
      },
    });
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    // Select Custom endpoint to reveal the input fields (Official is default)
    // Ant Design Select: find the displayed value, click to open dropdown
    const officialLabel = await screen.findByText("Official");
    fireEvent.mouseDown(officialLabel);

    const customOption = await screen.findByText("Custom endpoint");
    fireEvent.click(customOption);

    const apiKeyField = await screen.findByPlaceholderText(/api key/i);
    fireEvent.change(apiKeyField, { target: { value: "sk-new-key" } });
    await waitFor(() => {
      const matched = updateSettingsSpy.mock.calls.some((args) => {
        const patch = args[0] as Partial<UserSettings>;
        return patch.llmProvider?.apiKey === "sk-new-key";
      });
      expect(matched).toBe(true);
    });
  });

  it("requires sign-in before selecting and saving Custom endpoint", async () => {
    whoamiSpy.mockResolvedValueOnce({ mode: "anonymous" });
    const onOpenLogin = vi.fn();
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen onOpenLogin={onOpenLogin} />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(whoamiSpy).toHaveBeenCalledTimes(1));

    expect(await screen.findByText(/sign in to use custom endpoints/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(onOpenLogin).toHaveBeenCalledTimes(1);

    const officialLabel = await screen.findByText("Official");
    fireEvent.mouseDown(officialLabel);
    const customOption = await screen.findByText("Custom endpoint");
    fireEvent.click(customOption);

    expect(screen.queryByPlaceholderText(/api key/i)).toBeNull();
    expect(
      updateSettingsSpy.mock.calls.every((args) => (args[0] as Partial<UserSettings>).llmProvider === undefined),
    ).toBe(true);
  });

  it("Provider test in Settings confirms before running a paid official probe", async () => {
    testProviderSpy.mockResolvedValueOnce({
      ok: true,
      httpStatus: 0,
      latencyMs: 25,
      url: "official",
      probeType: "officialPaid",
    });
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /test connection/i }));

    expect(await screen.findByText(/may consume credits/i)).toBeTruthy();
    expect(testProviderSpy).not.toHaveBeenCalled();
    const okButton = await waitFor(() => {
      const buttons = document.querySelectorAll(".ant-modal-confirm-btns button");
      if (buttons.length < 2) throw new Error("OK button not rendered yet");
      return buttons[buttons.length - 1] as HTMLButtonElement;
    });
    fireEvent.click(okButton);

    await waitFor(() => expect(testProviderSpy).toHaveBeenCalledTimes(1));
    expect(testProviderSpy).toHaveBeenCalledWith({
      useProviderOverride: true,
      llmProvider: null,
      allowPaidOfficialProbe: true,
    });
    expect(await screen.findByText(/Official generation probe passed/)).toBeTruthy();
  });

  it("Provider test in Settings uses the saved custom settings without an override payload", async () => {
    currentSettings = makeSettings({
      llmProvider: {
        type: "custom",
        baseUrl: "https://custom.example/v1",
        apiKey: "sk-test",
        model: "gpt-test",
      },
    });
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /test connection/i }));

    await waitFor(() => expect(testProviderSpy).toHaveBeenCalledTimes(1));
    expect(testProviderSpy).toHaveBeenCalledWith();
    expect(await screen.findByText(/HTTP 200/)).toBeTruthy();
  });

  it("Reset everything opens a confirm modal and applies the reset patch on OK", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    await screen.findByRole("heading", { name: /generation defaults/i });

    fireEvent.click(screen.getByRole("button", { name: /reset everything/i }));

    // Modal.confirm renders portal-mounted buttons in .ant-modal-confirm-btns.
    // Wait for it, then click the OK button (the danger-styled one).
    const okButton = await waitFor(() => {
      const buttons = document.querySelectorAll(".ant-modal-confirm-btns button");
      const ok = Array.from(buttons).find((btn) => btn.classList.contains("ant-btn-dangerous"));
      if (!ok) throw new Error("OK button not rendered yet");
      return ok as HTMLButtonElement;
    });
    fireEvent.click(okButton);

    await waitFor(() => {
      const matched = updateSettingsSpy.mock.calls.some((args) => {
        const patch = args[0] as Partial<UserSettings>;
        return patch.onboardingCompletedAt === null && patch.llmProvider === null;
      });
      expect(matched).toBe(true);
    });
  });

  it("'Show wizard' confirms then sets onboardingCompletedAt to null", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));
    await screen.findByRole("heading", { name: /generation defaults/i });

    fireEvent.click(screen.getByRole("button", { name: /show wizard/i }));

    // OK button is the second action inside .ant-modal-confirm-btns (after Cancel).
    const okButton = await waitFor(() => {
      const buttons = document.querySelectorAll(".ant-modal-confirm-btns button");
      if (buttons.length < 2) throw new Error("OK button not rendered yet");
      return buttons[buttons.length - 1] as HTMLButtonElement;
    });
    fireEvent.click(okButton);

    await waitFor(() => {
      const matched = updateSettingsSpy.mock.calls.some((args) => {
        const patch = args[0] as Partial<UserSettings>;
        return patch.onboardingCompletedAt === null;
      });
      expect(matched).toBe(true);
    });
  });

  it("Proxy card starts disabled with the default local proxy URL ready when enabled", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    const enableSwitch = await screen.findByRole("switch", { name: /enable proxy/i });
    expect(enableSwitch.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(enableSwitch);

    expect(((await screen.findByLabelText(/proxy url/i)) as HTMLInputElement).value).toBe("http://127.0.0.1:7890");
  });

  it("Proxy card saves enabled+url patch and disabling keeps the URL but turns proxy off", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    const enableSwitch = await screen.findByRole("switch", { name: /enable proxy/i });
    fireEvent.click(enableSwitch);

    const urlInput = await screen.findByLabelText(/proxy url/i);
    fireEvent.change(urlInput, { target: { value: "http://127.0.0.1:7890" } });

    const saveButton = screen.getByRole("button", { name: /save proxy/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      const matched = updateSettingsSpy.mock.calls.some((args) => {
        const patch = args[0] as Partial<UserSettings>;
        return patch.proxy?.enabled === true && patch.proxy?.url === "http://127.0.0.1:7890";
      });
      expect(matched).toBe(true);
    });

    cleanup();
    currentSettings = makeSettings({ proxy: { enabled: true, url: "http://127.0.0.1:7890" } });
    updateSettingsSpy.mockClear();
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /enable proxy/i }).getAttribute("aria-checked")).toBe("true");
    });

    fireEvent.click(await screen.findByRole("switch", { name: /enable proxy/i }));
    fireEvent.click(screen.getByRole("button", { name: /save proxy/i }));

    await waitFor(() => {
      const matched = updateSettingsSpy.mock.calls.some((args) => {
        const patch = args[0] as Partial<UserSettings>;
        return patch.proxy?.enabled === false && patch.proxy?.url === "http://127.0.0.1:7890";
      });
      expect(matched).toBe(true);
    });
  });

  it("Proxy card rejects an obviously malformed URL", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("switch", { name: /enable proxy/i }));
    const urlInput = await screen.findByLabelText(/proxy url/i);
    fireEvent.change(urlInput, { target: { value: "not-a-url" } });
    const saveButton = screen.getByRole("button", { name: /save proxy/i });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
    expect(
      updateSettingsSpy.mock.calls.every((args) => (args[0] as Partial<UserSettings>).proxy === undefined),
    ).toBe(true);
  });

  it("disables watermark opt-out for users without paid entitlement", async () => {
    getCreditStatusSpy.mockResolvedValueOnce({
      mode: "logged_in",
      accessMode: "hosted",
      planName: "Free",
      paidEntitlement: false,
      hostedCreditBalance: null,
      anonymousCreditAvailable: null,
      anonymousCreditReserved: null,
      anonymousCreditBalance: null,
      rewardRemaining: 0,
      paidKeyPrefix: "",
      paidKeyTotal: 0,
      paidKeyUsed: 0,
      paidKeyRemaining: 0,
      raw: "",
    } satisfies CreditStatus);
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);

    expect(await screen.findByText(/free images include the officedex watermark/i)).toBeTruthy();
    expect(screen.getByRole("switch", { name: /show watermark/i }).hasAttribute("disabled")).toBe(true);
  });

  it("does not let hosted credit accounts disable watermark when entitlement flag is false", async () => {
    currentSettings = makeSettings({ imageWatermark: { showWatermark: true, preferenceSource: "user" } });
    getCreditStatusSpy.mockResolvedValueOnce({
      mode: "logged_in",
      accessMode: "hosted",
      planName: "",
      paidEntitlement: false,
      hostedCreditBalance: 1097930,
      anonymousCreditAvailable: null,
      anonymousCreditReserved: null,
      anonymousCreditBalance: null,
      rewardRemaining: 0,
      paidKeyPrefix: "",
      paidKeyTotal: 0,
      paidKeyUsed: 0,
      paidKeyRemaining: 0,
      raw: "",
    } satisfies CreditStatus);
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);

    const toggle = await screen.findByRole("switch", { name: /show watermark/i });
    expect(toggle.hasAttribute("disabled")).toBe(true);
    fireEvent.click(toggle);

    expect(
      updateSettingsSpy.mock.calls.every((args) => (args[0] as Partial<UserSettings>).imageWatermark === undefined),
    ).toBe(true);
  });

  it("lets paid users opt into watermark and saves the setting", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);

    const toggle = await screen.findByRole("switch", { name: /show watermark/i });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(updateSettingsSpy).toHaveBeenCalledWith(expect.objectContaining({
        imageWatermark: { showWatermark: true, preferenceSource: "user" },
      }));
    });
  });

  it("lets paid users turn off watermark and removes custom text input", async () => {
    currentSettings = makeSettings({ imageWatermark: { showWatermark: true, preferenceSource: "user" } });
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);

    const toggle = await screen.findByRole("switch", { name: /show watermark/i });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(updateSettingsSpy).toHaveBeenCalledWith(expect.objectContaining({
        imageWatermark: { showWatermark: false, preferenceSource: "user" },
      }));
    });
    expect(screen.queryByLabelText(/watermark text/i)).toBeNull();
  });

  it("imports local image-template JSON from a selected file in Settings", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    expect(await screen.findByText("0 local templates saved")).toBeTruthy();
    const file = new File([
      JSON.stringify({
        version: 1,
        templates: [
          { slug: "local-admission", title: "Local Admission", description: "Stored locally", promptPreset: "Local prompt", enabled: true },
        ],
      }),
    ], "templates.json", { type: "application/json" });
    const input = document.querySelector(".local-image-template-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("1 local template saved")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem("officedex:local-image-templates") || "{}").templates[0].title).toBe("Local Admission");
    expect(antdMessage.success).toHaveBeenCalledWith("Imported 1 local templates");
  });

  it("imports local image-template JSON from the paste modal in Settings", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /Paste JSON/i }));
    const textarea = await screen.findByPlaceholderText(/Paste local image-template JSON/i);
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify([
          { slug: "pasted-admission", title: "Pasted Admission", description: "Pasted locally", promptPreset: "Pasted prompt", enabled: true },
        ]),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/i }));

    await waitFor(() => expect(screen.getByText("1 local template saved")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem("officedex:local-image-templates") || "{}").templates[0].title).toBe("Pasted Admission");
    expect(antdMessage.success).toHaveBeenCalledWith("Imported 1 local templates");
  });

  it("downloads local image-template JSON from Settings", async () => {
    localStorage.setItem("officedex:local-image-templates", JSON.stringify({
      version: 1,
      templates: [
        { slug: "local-admission", title: "Local Admission", description: "Stored locally", promptPreset: "Local prompt", enabled: true },
      ],
    }));
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-templates");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /Download JSON/i }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-templates");
    expect(antdMessage.success).toHaveBeenCalledWith("Exported 1 local templates");
  });

  it("copies local image-template JSON to the clipboard from Settings", async () => {
    const writeTextSpy = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextSpy },
    });
    localStorage.setItem("officedex:local-image-templates", JSON.stringify({
      version: 1,
      templates: [
        { slug: "local-admission", title: "Local Admission", description: "Stored locally", promptPreset: "Local prompt", enabled: true },
      ],
    }));
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /Copy JSON/i }));

    await waitFor(() => expect(writeTextSpy).toHaveBeenCalledTimes(1));
    expect(writeTextSpy.mock.calls[0][0]).toContain("\"title\": \"Local Admission\"");
    expect(antdMessage.success).toHaveBeenCalledWith("Copied 1 local templates");
  });

  it("keeps existing local image templates when pasted JSON is invalid", async () => {
    localStorage.setItem("officedex:local-image-templates", JSON.stringify({
      version: 1,
      templates: [
        { slug: "existing", title: "Existing", description: "Existing local", promptPreset: "Existing prompt", enabled: true },
      ],
    }));
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getSettingsSpy).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: /Paste JSON/i }));
    fireEvent.change(await screen.findByPlaceholderText(/Paste local image-template JSON/i), { target: { value: "{not-json" } });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/i }));

    expect(JSON.parse(localStorage.getItem("officedex:local-image-templates") || "{}").templates[0].title).toBe("Existing");
    expect(antdMessage.error).toHaveBeenCalledWith(expect.stringMatching(/^Template import failed:/));
  });
});

describe("SettingsScreen > About card", () => {
  let getAppVersionSpy: ReturnType<typeof vi.fn>;
  let checkAppUpdateSpy: ReturnType<typeof vi.fn>;
  let downloadAppUpdateSpy: ReturnType<typeof vi.fn>;
  let installAppUpdateSpy: ReturnType<typeof vi.fn>;
  let cancelAppUpdateSpy: ReturnType<typeof vi.fn>;
  let onAppUpdateEventSpy: ReturnType<typeof vi.fn>;
  let openExternalSpy: ReturnType<typeof vi.fn>;
  let aboutOriginals: Partial<DesktopAPI>;

  beforeEach(() => {
    installDomStubs();
    currentSettings = makeSettings();
    getSettingsSpy = vi.fn(async () => currentSettings);
    updateSettingsSpy = vi.fn(async () => currentSettings);
    getDefaultWorkspaceDirSpy = vi.fn(async () => "/tmp/default-workspace");
    openDirectoryDialogSpy = vi.fn(async () => null);
    getAppVersionSpy = vi.fn(async () => "0.1.0");
    checkAppUpdateSpy = vi.fn(async () => ({
      release: {
        version: "0.2.0",
        notes: "Bug fixes.",
        minSupportedVersion: "0.0.0",
        mandatory: false,
        assets: {},
      },
      status: {
        currentVersion: "0.1.0",
        latestVersion: "0.2.0",
        updateAvailable: true,
        mandatory: false,
        downloading: false,
        downloadedPath: null,
        lastCheckedAt: new Date().toISOString(),
        lastError: null,
      },
    }));
    downloadAppUpdateSpy = vi.fn(async () => "/tmp/x.dmg");
    installAppUpdateSpy = vi.fn(async () => undefined);
    cancelAppUpdateSpy = vi.fn(async () => undefined);
    onAppUpdateEventSpy = vi.fn(() => () => undefined);
    openExternalSpy = vi.fn(async () => undefined);
    aboutOriginals = {
      getSettings: officecli.getSettings,
      updateSettings: officecli.updateSettings,
      getDefaultWorkspaceDir: officecli.getDefaultWorkspaceDir,
      openDirectoryDialog: officecli.openDirectoryDialog,
      openExternal: officecli.openExternal,
      getAppVersion: officecli.getAppVersion,
      checkAppUpdate: officecli.checkAppUpdate,
      downloadAppUpdate: officecli.downloadAppUpdate,
      installAppUpdate: officecli.installAppUpdate,
      cancelAppUpdate: officecli.cancelAppUpdate,
      onAppUpdateEvent: officecli.onAppUpdateEvent,
    };
    officecli.getSettings = getSettingsSpy as unknown as DesktopAPI["getSettings"];
    officecli.updateSettings = updateSettingsSpy as unknown as DesktopAPI["updateSettings"];
    officecli.getDefaultWorkspaceDir = getDefaultWorkspaceDirSpy as unknown as DesktopAPI["getDefaultWorkspaceDir"];
    officecli.openDirectoryDialog = openDirectoryDialogSpy as unknown as DesktopAPI["openDirectoryDialog"];
    officecli.openExternal = openExternalSpy as unknown as DesktopAPI["openExternal"];
    officecli.getAppVersion = getAppVersionSpy as unknown as DesktopAPI["getAppVersion"];
    officecli.checkAppUpdate = checkAppUpdateSpy as unknown as DesktopAPI["checkAppUpdate"];
    officecli.downloadAppUpdate = downloadAppUpdateSpy as unknown as DesktopAPI["downloadAppUpdate"];
    officecli.installAppUpdate = installAppUpdateSpy as unknown as DesktopAPI["installAppUpdate"];
    officecli.cancelAppUpdate = cancelAppUpdateSpy as unknown as DesktopAPI["cancelAppUpdate"];
    officecli.onAppUpdateEvent = onAppUpdateEventSpy as unknown as DesktopAPI["onAppUpdateEvent"];
  });

  afterEach(async () => {
    await cleanupAntdPortals();
    Object.assign(officecli, aboutOriginals);
    vi.restoreAllMocks();
  });

  it("renders the version and a Check for updates button", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getAppVersionSpy).toHaveBeenCalled());
    expect(await screen.findByRole("heading", { name: "OfficeDex" })).toBeTruthy();
    expect(await screen.findByText(/OfficeDex 0\.1\.0/)).toBeTruthy();
    expect(screen.getByText(/AI desktop workspace for documents/i)).toBeTruthy();
    expect(screen.getByText("Stable")).toBeTruthy();
    expect(screen.getByText(/Check for updates/i)).toBeTruthy();
  });

  it("opens About links and shows the disclaimer modal", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getAppVersionSpy).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: /visit website/i }));
    fireEvent.click(await screen.findByRole("button", { name: /github/i }));
    fireEvent.click(await screen.findByRole("button", { name: /gpl-3\.0/i }));
    fireEvent.click(await screen.findByRole("button", { name: /feedback/i }));

    expect(openExternalSpy).toHaveBeenCalledWith("https://officecli.io");
    expect(openExternalSpy).toHaveBeenCalledWith("https://github.com/officecli/officedex");
    expect(openExternalSpy).toHaveBeenCalledWith("https://github.com/officecli/officedex/blob/main/LICENSE");
    expect(openExternalSpy).toHaveBeenCalledWith("https://github.com/officecli/officedex/issues");

    fireEvent.click(await screen.findByRole("button", { name: /disclaimer/i }));
    expect(await screen.findByText(/OfficeDex AI may produce inaccurate content/i)).toBeTruthy();
  });

  it("Check for updates click invokes checkAppUpdate and surfaces the new version button", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getAppVersionSpy).toHaveBeenCalled());
    const checkBtn = await screen.findByText(/Check for updates/i);
    fireEvent.click(checkBtn.closest("button")!);
    await waitFor(() => expect(checkAppUpdateSpy).toHaveBeenCalled());
    expect(await screen.findByText(/Update to 0\.2\.0/)).toBeTruthy();
  });

  it("clicking Update to <version> triggers download", async () => {
    const { SettingsScreen } = await import("./SettingsScreens");
    render(<SettingsScreen />);
    await waitFor(() => expect(getAppVersionSpy).toHaveBeenCalled());
    fireEvent.click((await screen.findByText(/Check for updates/i)).closest("button")!);
    const updateBtn = await screen.findByText(/Update to 0\.2\.0/);
    fireEvent.click(updateBtn.closest("button")!);
    await waitFor(() => expect(downloadAppUpdateSpy).toHaveBeenCalled());
  });
});
