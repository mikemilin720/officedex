import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { message as antdMessage } from "antd";
import type { DesktopAPI, DesktopTask, GenerateInput, WorkspaceSummary } from "../../shared/types";
import { officecli } from "../bridge";
import { LocaleProvider, type Locale } from "../i18n";
import { DialogueScreen, assembleSlots } from "./DialogueScreens";
import type { ImagePromptSlot } from "../../shared/types";

let resizeObserverRecords: Array<{ callback: ResizeObserverCallback; observed: Element[] }> = [];

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

function installDomStubs() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
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
  class ResizeObserverStub {
    private record: { callback: ResizeObserverCallback; observed: Element[] };

    constructor(callback: ResizeObserverCallback) {
      this.record = { callback, observed: [] };
      resizeObserverRecords.push(this.record);
    }
    observe(target: Element) {
      this.record.observed.push(target);
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    () => ({ getPropertyValue: () => "" }) as unknown as CSSStyleDeclaration,
  );
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => "blob:test-image");
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn();
  }
}

let respondSpy: ReturnType<typeof vi.fn>;
let cancelSpy: ReturnType<typeof vi.fn>;
let listImageTemplatesSpy: ReturnType<typeof vi.fn>;
let createImageTemplateSpy: ReturnType<typeof vi.fn>;
let createImageTemplatePublishRequestSpy: ReturnType<typeof vi.fn>;
let issuePreviewTokenSpy: ReturnType<typeof vi.fn>;
let readArtifactFileSpy: ReturnType<typeof vi.fn>;
let revokePreviewTokenSpy: ReturnType<typeof vi.fn>;
let copyImageToClipboardSpy: ReturnType<typeof vi.fn>;
let savePastedImageSpy: ReturnType<typeof vi.fn>;
let writeTextSpy: ReturnType<typeof vi.fn>;
let originals: Partial<DesktopAPI>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  resizeObserverRecords = [];
  installDomStubs();
  respondSpy = vi.fn(async () => undefined);
  cancelSpy = vi.fn(async () => undefined);
  listImageTemplatesSpy = vi.fn(async () => []);
  createImageTemplateSpy = vi.fn(async () => ({ id: 17, slug: "poster-copy", title: "Poster copy", description: "Cinematic poster", promptPreset: "Template prompt", sortOrder: 10, enabled: true, visibility: "user_private" }));
  createImageTemplatePublishRequestSpy = vi.fn(async () => ({ id: 31, privateTemplateID: 17, provenanceID: 11, status: "pending" }));
  issuePreviewTokenSpy = vi.fn(async (artifact) => ({ token: "test-token", fileName: artifact.fileName, documentType: artifact.documentType }));
  readArtifactFileSpy = vi.fn(async () => ({ data: new Uint8Array([137, 80, 78, 71]) }));
  revokePreviewTokenSpy = vi.fn(async () => undefined);
  copyImageToClipboardSpy = vi.fn(async () => undefined);
  savePastedImageSpy = vi.fn(async (_data: Uint8Array, ext: string) => `/tmp/dropped-template-reference.${ext}`);
  writeTextSpy = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: writeTextSpy },
  });
  originals = {
    respond: officecli.respond,
    cancel: officecli.cancel,
    listImageTemplates: officecli.listImageTemplates,
    createImageTemplate: officecli.createImageTemplate,
    createImageTemplatePublishRequest: officecli.createImageTemplatePublishRequest,
    issuePreviewToken: officecli.issuePreviewToken,
    readArtifactFile: officecli.readArtifactFile,
    revokePreviewToken: officecli.revokePreviewToken,
    copyImageToClipboard: officecli.copyImageToClipboard,
    savePastedImage: officecli.savePastedImage,
  };
  officecli.respond = respondSpy as unknown as DesktopAPI["respond"];
  officecli.cancel = cancelSpy as unknown as DesktopAPI["cancel"];
  officecli.listImageTemplates = listImageTemplatesSpy as unknown as DesktopAPI["listImageTemplates"];
  officecli.createImageTemplate = createImageTemplateSpy as unknown as DesktopAPI["createImageTemplate"];
  (officecli as unknown as { createImageTemplatePublishRequest: typeof createImageTemplatePublishRequestSpy }).createImageTemplatePublishRequest = createImageTemplatePublishRequestSpy;
  officecli.issuePreviewToken = issuePreviewTokenSpy as unknown as DesktopAPI["issuePreviewToken"];
  officecli.readArtifactFile = readArtifactFileSpy as unknown as DesktopAPI["readArtifactFile"];
  officecli.revokePreviewToken = revokePreviewTokenSpy as unknown as DesktopAPI["revokePreviewToken"];
  officecli.copyImageToClipboard = copyImageToClipboardSpy as unknown as DesktopAPI["copyImageToClipboard"];
  officecli.savePastedImage = savePastedImageSpy as unknown as DesktopAPI["savePastedImage"];
});

afterEach(() => {
  cleanup();
  Object.assign(officecli, originals);
  vi.restoreAllMocks();
});

function baseProps(overrides: Partial<React.ComponentProps<typeof DialogueScreen>> = {}) {
  return {
    tasks: [] as DesktopTask[],
    artifacts: [],
    busy: false,
    errorKind: "connection" as const,
    bridgeStatus: "connected",
    onSubmit: vi.fn(async () => undefined),
    onOpenSettings: vi.fn(),
    onOpenLogin: vi.fn(),
    onRetry: vi.fn(),
    onPreview: vi.fn(),
    workspaces: [] as WorkspaceSummary[],
    newChatTarget: { kind: "none" as const },
    onNewChatTargetChange: vi.fn(),
    onAddWorkspace: vi.fn(),
    ...overrides,
  };
}

function makeCompletedImageTask(overrides: Partial<DesktopTask> = {}): DesktopTask {
  return {
    id: "task-img",
    conversationId: "task-img",
    status: "completed",
    events: [{ task_id: "task-img", type: "task.completed", payload: { message: "done" } }],
    artifact: {
      taskId: "task-img",
      filePath: "/tmp/banner.png",
      fileName: "banner.png",
      documentType: "img",
    },
    ...overrides,
  };
}

function makeCompletedGIFTask(overrides: Partial<DesktopTask> = {}): DesktopTask {
  return {
    id: "task-gif",
    conversationId: "task-gif",
    status: "completed",
    events: [{ task_id: "task-gif", type: "task.completed", payload: { message: "done" } }],
    userInput: { prompt: "Make a reaction GIF", fps: 16 },
    artifact: {
      taskId: "task-gif",
      filePath: "/tmp/reaction.gif",
      fileName: "reaction.gif",
      documentType: "gif",
    },
    ...overrides,
  };
}

function makeCompletedDocTask(docType: string, fileName: string): DesktopTask {
  return {
    id: `task-${docType}`,
    conversationId: `task-${docType}`,
    status: "completed",
    events: [{ task_id: `task-${docType}`, type: "task.completed", payload: { message: "done" } }],
    artifact: {
      taskId: `task-${docType}`,
      filePath: `/tmp/${fileName}`,
      fileName,
      documentType: docType,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("DialogueScreen state machine", () => {
  it("shows a project picker headline for new chats and switches to no-project", async () => {
    const onTargetChange = vi.fn();
    render(
      <DialogueScreen
        {...baseProps({
          workspaces: [
            { id: "ws-a", name: "void-oversea", path: "/tmp/void-oversea", active: true, conversations: [] },
            { id: "ws-b", name: "officedex", path: "/tmp/officedex", active: false, conversations: [] },
          ],
          newChatTarget: { kind: "workspace", workspaceId: "ws-a" },
          onNewChatTargetChange: onTargetChange,
        })}
      />,
    );

    expect(await screen.findByRole("heading", { name: /What should we work on in void-oversea/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /void-oversea/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Don't work in a project/ }));

    expect(onTargetChange).toHaveBeenCalledWith({ kind: "none" });
  });

  it("submits no-project chats without a workspaceId", async () => {
    const onSubmit = vi.fn<(values: GenerateInput) => Promise<void>>(async () => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit, newChatTarget: { kind: "none" } })} />);

    expect(await screen.findByRole("heading", { name: /What should we work on\?/i })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Enter what you want to generate/), {
      target: { value: "Generate a standalone memo" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Generate$/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "Generate a standalone memo",
      noProject: true,
    }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("workspaceId");
  });

  it("Question state with options invokes respond without filling the custom answer input", async () => {
    const task: DesktopTask = {
      id: "task-q",
      conversationId: "task-q",
      status: "question",
      events: [],
      question: {
        id: "q-1",
        question: "Include last quarter's financial comparison data?",
        options: [
          { id: "include", label: "Include" },
          { id: "skip", label: "Exclude" },
        ],
        allowFreeform: true,
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    expect(screen.getByText("Q1")).toBeTruthy();
    const input = screen.getByPlaceholderText(/custom answer if none of the options fit/i) as HTMLInputElement;
    expect(input.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /^include$/i }));
    await waitFor(() => expect(respondSpy).toHaveBeenCalledTimes(1));
    const payload = respondSpy.mock.calls[0][0];
    expect(payload).toMatchObject({ taskId: "task-q", questionId: "q-1", optionId: "include", answer: "Include" });
    expect(input.value).toBe("");
  });

  it("Question state freeform submits typed answer via respond", async () => {
    const task: DesktopTask = {
      id: "task-q2",
      conversationId: "task-q2",
      status: "question",
      events: [],
      question: {
        id: "q-2",
        question: "Anything else?",
        options: [],
        allowFreeform: true,
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    const input = screen.getByPlaceholderText(/custom answer if none of the options fit/i);
    fireEvent.change(input, { target: { value: "Add appendix" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(respondSpy).toHaveBeenCalledTimes(1));
    expect(respondSpy).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "task-q2", questionId: "q-2", answer: "Add appendix" }),
    );
  });

  it("Question state responds to a multi-step option with top-level answer fields", async () => {
    const task: DesktopTask = {
      id: "task-multi-q",
      conversationId: "task-multi-q",
      status: "question",
      events: [],
      question: {
        id: "question-000009",
        question: "Who is the audience?",
        options: [{ id: "leadership", label: "Leadership", description: "Decision makers", recommended: true }],
        allowFreeform: false,
        currentIndex: 0,
        questions: [
          {
            id: "q-audience",
            question: "Who is the audience?",
            options: [{ id: "leadership", label: "Leadership", description: "Decision makers", recommended: true }],
            allowFreeform: false,
          },
          {
            id: "q-tone",
            question: "Which tone should it use?",
            options: [{ id: "detailed", label: "Detailed" }],
            allowFreeform: false,
          },
        ],
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
    expect(screen.getByText("Q1")).toBeTruthy();
    expect(screen.getByText("Recommended")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /leadership/i }));

    await waitFor(() => expect(respondSpy).toHaveBeenCalledTimes(1));
    expect(respondSpy).toHaveBeenCalledWith(expect.objectContaining({
      taskId: "task-multi-q",
      questionId: "question-000009",
      optionId: "leadership",
      answer: "Leadership",
    }));
    expect(respondSpy.mock.calls[0][0]).not.toHaveProperty("answers");
  });

  it("Question state waits for the bridge to send the next prompt after an option", async () => {
    const task: DesktopTask = {
      id: "task-multi-pending",
      conversationId: "task-multi-pending",
      status: "question",
      events: [],
      question: {
        id: "question-000010",
        question: "Who is the audience?",
        options: [{ id: "leadership", label: "Leadership" }],
        allowFreeform: false,
        currentIndex: 0,
        questions: [
          {
            id: "q-audience",
            question: "Who is the audience?",
            options: [{ id: "leadership", label: "Leadership" }],
            allowFreeform: false,
          },
          {
            id: "q-tone",
            question: "Which tone should it use?",
            options: [{ id: "detailed", label: "Detailed" }],
            allowFreeform: false,
          },
        ],
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    fireEvent.click(screen.getByRole("button", { name: /^leadership$/i }));

    await waitFor(() => expect(respondSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Which tone should it use?")).toBeNull();
    expect(screen.getByText("Question 1 of 2")).toBeTruthy();
  });

  it("places the active question between progress and the answer controls", () => {
    const task: DesktopTask = {
      id: "task-q-layout",
      conversationId: "task-q-layout",
      status: "question",
      events: [],
      stages: [
        { id: "analyze", label: "Analyzing request", status: "completed" },
        { id: "outline", label: "Drafting outline", status: "active" },
      ],
      question: {
        id: "q-layout",
        question: "Who is this 10-page deck for?",
        options: [
          { id: "newcomers", label: "Newcomers" },
          { id: "experienced", label: "Experienced users" },
        ],
        allowFreeform: true,
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    const progressPanel = document.querySelector(".fluid-progress-panel")!;
    const composer = document.querySelector(".question-composer") as HTMLElement;
    const prompt = within(composer).getByText("Who is this 10-page deck for?");
    const firstOption = within(composer).getByRole("button", { name: "Newcomers" });
    const freeform = within(composer).getByPlaceholderText(/custom answer if none of the options fit/i);

    expect(composer).toBeTruthy();
    expect(screen.getAllByText("Who is this 10-page deck for?")).toHaveLength(1);
    expect(Boolean(progressPanel.compareDocumentPosition(prompt) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(prompt.compareDocumentPosition(firstOption) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(firstOption.compareDocumentPosition(freeform) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("renders a question after the latest task transitions from running", async () => {
    const runningTask: DesktopTask = {
      id: "task-q-transition",
      conversationId: "task-q-transition",
      status: "running",
      events: [{ task_id: "task-q-transition", type: "task.started", payload: { document_type: "pptx" } }],
      documentType: "pptx",
    };
    const questionTask: DesktopTask = {
      ...runningTask,
      status: "question",
      events: [
        ...runningTask.events,
        { task_id: "task-q-transition", type: "task.question", payload: { question: "Who is the audience?" } },
      ],
      question: {
        id: "q-audience",
        question: "Who is the audience?",
        options: [{ id: "leadership", label: "Leadership" }],
        allowFreeform: false,
      },
    };
    const { rerender } = render(<DialogueScreen {...baseProps()} tasks={[runningTask]} />);

    rerender(<DialogueScreen {...baseProps()} tasks={[questionTask]} />);

    expect(screen.getByRole("button", { name: "Leadership" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Leadership" }));
    await waitFor(() => expect(respondSpy).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "task-q-transition", questionId: "q-audience", optionId: "leadership" }),
    ));
  });

  it("Plan review state auto-approves the proposed plan and hides manual review actions", async () => {
    const task: DesktopTask = {
      id: "task-plan",
      conversationId: "task-plan",
      status: "plan_review",
      events: [],
      plan: {
        id: "plan-1",
        markdown: "# Proposed Plan\n\n- Build a concise deck after approval.",
        revision: 1,
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    expect(screen.getByText(/Build a concise deck after approval/i)).toBeTruthy();
    await waitFor(() => expect(respondSpy).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: "task-plan", optionId: "approve" }),
    ));
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /revise/i })).toBeNull();
    expect(screen.queryByPlaceholderText(/revise the plan/i)).toBeNull();
  });

  it("Plan review cancel marks the task cancelled locally after bridge cancel succeeds", async () => {
    const onForceCancel = vi.fn();
    const task: DesktopTask = {
      id: "task-plan-cancel",
      conversationId: "task-plan-cancel",
      status: "plan_review",
      events: [],
      plan: {
        id: "plan-cancel",
        markdown: "# Proposed Plan\n\n- Review before execution.",
        revision: 1,
      },
    };
    render(<DialogueScreen {...baseProps({ onForceCancel })} tasks={[task]} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith("task-plan-cancel"));
    expect(onForceCancel).toHaveBeenCalledWith("task-plan-cancel");
  });

  it("Cancelled terminal tasks do not show bridge event context", () => {
    const task: DesktopTask = {
      id: "task-cancelled",
      conversationId: "task-cancelled",
      status: "cancelled",
      events: [
        { task_id: "task-cancelled", type: "task.started", ts: "2026-06-12T03:09:32Z", payload: {} },
        { task_id: "task-cancelled", type: "task.progress", ts: "2026-06-12T03:09:48Z", payload: { status: "waiting_input" } },
        { task_id: "task-cancelled", type: "task.cancelled", ts: "2026-06-12T03:10:00Z", payload: {} },
      ],
    };

    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    expect(screen.getByText("Task Cancelled")).toBeTruthy();
    expect(screen.queryByText("Bridge event context")).toBeNull();
    expect(screen.queryByText("task.started")).toBeNull();
  });

  it("shows one reviewed plan on terminal task history", () => {
    const task: DesktopTask = {
      id: "task-plan-history",
      conversationId: "task-plan-history",
      status: "completed",
      events: [{ task_id: "task-plan-history", type: "task.completed", ts: "2026-06-12T03:00:00Z", payload: { message: "done" } }],
      plan: {
        id: "plan-history",
        markdown: "# Reviewed Plan\n\n- Build the approved outline.",
        revision: 2,
        executionPrompt: "Execute the reviewed plan.",
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    expect(document.querySelectorAll(".history-plan-details")).toHaveLength(1);
    expect(screen.getByText("View reviewed plan")).toBeTruthy();
    expect(screen.getByText("Execution prompt")).toBeTruthy();
  });

  it("Running state Cancel button calls officecli.cancel with task id", async () => {
    const task: DesktopTask = {
      id: "task-run",
      conversationId: "task-run",
      status: "running",
      events: [{ task_id: "task-run", type: "task.started", payload: {} }],
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith("task-run"));
  });

  it("connection failure banner shows Retry and triggers onRetry", () => {
    const onRetry = vi.fn();
    render(
      <DialogueScreen {...baseProps({ onRetry })} lastError="Bridge dropped" errorKind="connection" />,
    );
    const retryButtons = screen.getAllByRole("button", { name: /retry/i });
    fireEvent.click(retryButtons[0]);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("auth failure banner triggers onOpenLogin", () => {
    const onOpenLogin = vi.fn();
    render(
      <DialogueScreen
        {...baseProps({ onOpenLogin })}
        lastError="OfficeCLI is not signed in"
        errorKind="auth"
      />,
    );
    const signInButtons = screen.getAllByRole("button", { name: /sign in/i });
    fireEvent.click(signInButtons[0]);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
  });

  it("setup failure banner exposes Open Settings", () => {
    const onOpenSettings = vi.fn();
    render(
      <DialogueScreen
        {...baseProps({ onOpenSettings })}
        lastError="OfficeCLI binary is not configured"
        errorKind="setup"
      />,
    );
    const settingsButtons = screen.getAllByRole("button", { name: /settings/i });
    fireEvent.click(settingsButtons[0]);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("completed image artifact renders Open and Show in folder actions", () => {
    const task: DesktopTask = {
      id: "task-img",
      conversationId: "task-img",
      status: "completed",
      events: [{ task_id: "task-img", type: "task.completed", payload: { message: "done" } }],
      artifact: {
        taskId: "task-img",
        filePath: "/tmp/render-banner.png",
        fileName: "render-banner.png",
        documentType: "img",
      },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    expect(screen.getByText("Generation Complete")).toBeTruthy();
    expect(screen.getAllByText("render-banner.png").length).toBeGreaterThan(0);
    const openButtons = screen.getAllByRole("button", { name: /open/i });
    expect(openButtons.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /show in folder/i })).toBeTruthy();
  });

  it("shows paid users that image watermarks can be disabled in Settings", () => {
    const task = makeCompletedImageTask({
      imageWatermark: { applied: true, paidEntitlement: true, canDisable: true },
    });
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    expect(screen.getByText(/You're a paid user/i)).toBeTruthy();
    expect(screen.getByText(/turn off the image watermark in Settings/i)).toBeTruthy();
  });

  it("shows unpaid users that buying any credits unlocks watermark control", () => {
    const task = makeCompletedImageTask({
      imageWatermark: { applied: true, paidEntitlement: false, canDisable: false },
    });
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    expect(screen.getByText(/This image includes an OfficeDex watermark/i)).toBeTruthy();
    expect(screen.getByText(/Buy any amount of credits/i)).toBeTruthy();
  });

  it("keeps more actions directly beside Show in folder on completed image cards", () => {
    const task = makeCompletedImageTask({
      events: [{ task_id: "task-img", type: "task.completed", request_id: "req-img-1", payload: { message: "done" } }],
    });
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    const showInFolder = screen.getByRole("button", { name: /show in folder/i });
    const moreActions = screen.getByRole("button", { name: /more actions/i });
    const fileActions = showInFolder.closest(".result-image-file-actions");

    expect(fileActions).toBeTruthy();
    expect(fileActions?.contains(moreActions)).toBe(true);
  });

  it("renders completed image actions in a compact single-row toolbar", () => {
    const task = makeCompletedImageTask({
      events: [{ task_id: "task-img", type: "task.completed", request_id: "req-img-1", payload: { message: "done" } }],
    });
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    const continueEditing = screen.getByRole("button", { name: /continue editing/i });
    const actions = continueEditing.closest(".result-image-actions");

    expect(actions).toBeTruthy();
    expect(actions?.classList.contains("result-image-actions-single-row")).toBe(true);
    const buttons = within(actions as HTMLElement).getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label") || button.textContent?.trim())).toEqual([
      "Open",
      "Continue editing",
      "Show in folder",
      "More actions",
    ]);
    const openButton = within(actions as HTMLElement).getByRole("button", { name: /^open$/i });
    expect(openButton.classList.contains("ant-btn-primary")).toBe(false);
    expect(within(actions as HTMLElement).getByRole("button", { name: /show in folder/i })).toBeTruthy();
    expect(within(actions as HTMLElement).getByRole("button", { name: /more actions/i })).toBeTruthy();
  });

  it("submits a completed image task and private template for public review", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "public-poster", title: "Public Poster", description: "", promptPreset: "Public prompt", sortOrder: 0, enabled: true, visibility: "platform_public" },
      { id: 17, slug: "my-poster", title: "My Poster", description: "", promptPreset: "Generated prompt", sortOrder: 0, enabled: true, visibility: "user_private" },
    ]);
    const task = makeCompletedImageTask({
      events: [{ task_id: "task-img", type: "task.completed", request_id: "req-img-1", payload: { message: "done" } }],
    });
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    expect(screen.queryByRole("button", { name: /submit template for review/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /more actions/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /submit template for review/i }));
    expect(await screen.findByText("Publish as public template")).toBeTruthy();
    fireEvent.change(await screen.findByRole("combobox", { name: "Private template" }), { target: { value: "17" } });
    fireEvent.click(screen.getByRole("button", { name: /^Submit for review$/i }));

    await waitFor(() => expect(createImageTemplatePublishRequestSpy).toHaveBeenCalledWith({
      privateTemplateID: 17,
      requestID: "req-img-1",
      submitterNote: "",
    }));
    expect(antdMessage.success).toHaveBeenCalledWith("Submitted for review");
  });

  it("copies generated images through the desktop clipboard bridge", async () => {
    render(<DialogueScreen {...baseProps()} tasks={[makeCompletedImageTask()]} />);

    await waitFor(() => expect(issuePreviewTokenSpy).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByAltText("banner.png"));
    fireEvent.click(await screen.findByRole("button", { name: /copy image/i }));

    await waitFor(() => expect(copyImageToClipboardSpy).toHaveBeenCalledWith("/tmp/banner.png"));
    expect(await screen.findByText("Copied")).toBeTruthy();
    expect(antdMessage.success).toHaveBeenCalledWith("Copied");
  });

  it("shows top error feedback when generated image copy fails", async () => {
    copyImageToClipboardSpy.mockRejectedValueOnce(new Error("native clipboard failed"));
    render(<DialogueScreen {...baseProps()} tasks={[makeCompletedImageTask()]} />);

    await waitFor(() => expect(issuePreviewTokenSpy).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByAltText("banner.png"));
    fireEvent.click(await screen.findByRole("button", { name: /copy image/i }));

    await waitFor(() => expect(antdMessage.error).toHaveBeenCalledWith("Copy failed"));
  });

  it("failed task with credits-exhausted error shows Sign In button wired to onOpenLogin", () => {
    const onOpenLogin = vi.fn();
    const task: DesktopTask = {
      id: "task-credits",
      conversationId: "task-credits",
      status: "failed",
      events: [{ task_id: "task-credits", type: "task.failed", payload: { message: "Anonymous credits are exhausted. Run `officecli login`, then buy hosted credits for your account." } }],
      error: "Anonymous credits are exhausted. Run `officecli login`, then buy hosted credits for your account.",
    };
    render(<DialogueScreen {...baseProps({ onOpenLogin })} tasks={[task]} />);
    expect(screen.getByText(/used up the free credits for anonymous use/i)).toBeTruthy();
    const signInBtn = screen.getByRole("button", { name: /sign in to continue/i });
    fireEvent.click(signInBtn);
    expect(onOpenLogin).toHaveBeenCalledTimes(1);
  });

  it("copies the user message prompt from the conversation bubble", async () => {
    const task: DesktopTask = {
      id: "task-user-copy",
      conversationId: "task-user-copy",
      status: "completed",
      events: [{ task_id: "task-user-copy", type: "task.completed", payload: { message: "done" } }],
      userInput: { prompt: "Build a quarterly planning deck" },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    fireEvent.click(screen.getByRole("button", { name: /copy user message/i }));

    await waitFor(() => expect(writeTextSpy).toHaveBeenCalledWith("Build a quarterly planning deck"));
    expect(antdMessage.success).toHaveBeenCalledWith("Copied");
  });

  it("shows top error feedback when conversation bubble copy fails", async () => {
    writeTextSpy.mockRejectedValueOnce(new Error("clipboard denied"));
    const task: DesktopTask = {
      id: "task-user-copy-fail",
      conversationId: "task-user-copy-fail",
      status: "completed",
      events: [{ task_id: "task-user-copy-fail", type: "task.completed", payload: { message: "done" } }],
      userInput: { prompt: "Build a quarterly planning deck" },
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    fireEvent.click(screen.getByRole("button", { name: /copy user message/i }));

    await waitFor(() => expect(antdMessage.error).toHaveBeenCalledWith("Copy failed"));
  });

  it("copies the assistant result message from the conversation bubble", async () => {
    const task: DesktopTask = {
      id: "task-ai-copy",
      conversationId: "task-ai-copy",
      status: "completed",
      events: [{ task_id: "task-ai-copy", type: "task.completed", payload: { message: "Deck generated successfully" } }],
    };
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);

    fireEvent.click(screen.getByRole("button", { name: /copy assistant message/i }));

    await waitFor(() => expect(writeTextSpy).toHaveBeenCalledWith("Deck generated successfully"));
    expect(antdMessage.success).toHaveBeenCalledWith("Copied");
  });

  it("image generation inserts template prompt and submits edited prompt only", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt: replace PRODUCT", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true },
    ]);
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Poster")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Poster/i }));
    const textarea = screen.getByPlaceholderText(/Enter what you want to generate/i);
    const picker = document.querySelector(".image-template-picker");
    expect(picker).toBeTruthy();
    expect(Boolean(picker!.compareDocumentPosition(textarea) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect((textarea as HTMLTextAreaElement).value).toBe("Template prompt: replace PRODUCT");
    expect(screen.getByText(/Template text has been inserted/i)).toBeTruthy();
    fireEvent.change(textarea, { target: { value: "A red bicycle" } });
    fireEvent.submit(textarea.closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).toEqual(expect.objectContaining({ documentType: "img", prompt: "A red bicycle" }));
    expect(submitted).not.toHaveProperty("promptTemplateId");
  });

  it("keeps dropped reference images when submitting an image template", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt: replace PRODUCT", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true },
    ]);
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Poster")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Poster/i }));
    expect(screen.getByRole("button", { name: /Attach reference images/i })).toBeTruthy();
    await waitFor(() => expect((screen.getByPlaceholderText(/Enter what you want to generate/i) as HTMLTextAreaElement).value).toBe("Template prompt: replace PRODUCT"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dropTarget = document.querySelector(".fluid-new-task") as HTMLElement;
    const form = document.querySelector(".fluid-command-bar") as HTMLFormElement;
    const droppedFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "reference.png", { type: "image/png" });
    fireDropWithFile(dropTarget, droppedFile);

    await waitFor(() => expect(savePastedImageSpy).toHaveBeenCalledWith(expect.any(Uint8Array), "png"));

    const textarea = screen.getByPlaceholderText(/Enter what you want to generate/i);
    fireEvent.change(textarea, { target: { value: "A red bicycle using the reference image" } });
    fireEvent.submit(form);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({
      documentType: "img",
      prompt: "A red bicycle using the reference image",
      referenceImages: ["/tmp/dropped-template-reference.png"],
    }));
  });

  it("prepends enabled local image templates before platform templates", async () => {
    localStorage.setItem("officedex:local-image-templates", JSON.stringify({
      version: 1,
      templates: [
        { slug: "local-admission", title: "Local Admission", description: "Stored locally", promptPreset: "Local prompt", enabled: true },
        { slug: "disabled-local", title: "Disabled Local", description: "", promptPreset: "Disabled prompt", enabled: false },
      ],
    }));
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Platform prompt", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true, visibility: "platform_public" },
    ]);

    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    const localTitle = await screen.findByText("Local Admission");
    const platformTitle = await screen.findByText("Poster");
    expect(Boolean(localTitle.compareDocumentPosition(platformTitle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(screen.queryByLabelText("Local")).toBeNull();
    expect(screen.queryByText("Disabled Local")).toBeNull();
  });

  it("shows image-template wall cards with only thumbnails and titles", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "public-poster", title: "Public Poster", description: "Cinematic poster", promptPreset: "Public prompt", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true, visibility: "platform_public" },
      { id: 8, slug: "private-poster", title: "Private Poster", description: "Private poster", promptPreset: "Private prompt", thumbnailUrl: "/api/image-templates/8/thumbnail", sortOrder: 20, enabled: true, visibility: "user_private" },
    ]);

    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Public Poster")).toBeTruthy();
    expect(screen.getByText("Private Poster")).toBeTruthy();
    expect(screen.queryByText("Public")).toBeNull();
    expect(screen.queryByText("My template")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Copy to my templates$/i })).toBeNull();
    expect(screen.queryByLabelText("Public")).toBeNull();
    expect(screen.queryByLabelText("My template")).toBeNull();
    expect(screen.queryByText("Cinematic poster")).toBeNull();
    expect(screen.queryByText("Private poster")).toBeNull();
    expect(document.querySelectorAll(".image-template-card-title")).toHaveLength(2);
    expect((document.querySelector(".image-template-thumb img") as HTMLImageElement).style.objectFit).toBe("");

    const css = readFileSync("src/renderer/styles/dialogue.css", "utf8");
    const thumbImgRule = css.match(/\.image-template-thumb img\s*\{[^}]*\}/s)?.[0] ?? "";
    const workspaceCardRule = css.match(/\.image-template-workspace \.image-template-card\s*\{[^}]*\}/s)?.[0] ?? "";
    const cardMainRule = css.match(/\.image-template-card-main\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(thumbImgRule).toContain("height: auto;");
    expect(thumbImgRule).not.toContain("height: 100%");
    expect(workspaceCardRule).toContain("align-self: start;");
    expect(cardMainRule).toContain("align-content: start;");
    expect(css).not.toMatch(/\.image-template-workspace \.image-template-card:nth-child\([^)]*\) \.image-template-thumb\s*\{[^}]*aspect-ratio:/s);
  });

  it("shows a polished placeholder for local image templates without thumbnails", async () => {
    localStorage.setItem("officedex:local-image-templates", JSON.stringify({
      version: 1,
      templates: [
        { slug: "local-admission", title: "Local Admission", description: "Stored locally", promptPreset: "Local prompt", enabled: true },
      ],
    }));
    listImageTemplatesSpy.mockResolvedValueOnce([]);

    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Local Admission")).toBeTruthy();
    const placeholder = document.querySelector(".image-template-thumb-placeholder");
    expect(placeholder).toBeTruthy();
    expect(placeholder?.querySelector(".material-symbol")).toBeNull();
    expect(document.querySelector(".image-template-thumb img")).toBeNull();
  });

  it("does not show local template management controls in the photo wall", async () => {
    localStorage.setItem("officedex:local-image-templates", JSON.stringify({
      version: 1,
      templates: [
        { slug: "local-admission", title: "Local Admission", description: "Stored locally", promptPreset: "Local prompt", enabled: true },
        { slug: "local-poster", title: "Local Poster", description: "", promptPreset: "Poster prompt", enabled: true },
      ],
    }));
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Platform prompt", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true, visibility: "platform_public" },
    ]);

    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Local Admission")).toBeTruthy();
    expect(screen.getByText("Local Poster")).toBeTruthy();
    expect(screen.getByText("Poster")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Delete local template Local Admission$/i })).toBeNull();
    expect(screen.queryByText("Stored locally")).toBeNull();
    expect(listImageTemplatesSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("officedex:local-image-templates") ?? "{}").templates).toHaveLength(2);
  });

  it("replaces failed image-template thumbnails with the same placeholder", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt", thumbnailUrl: "/missing-thumbnail.png", sortOrder: 10, enabled: true },
    ]);

    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Poster")).toBeTruthy();
    const image = document.querySelector(".image-template-thumb img") as HTMLImageElement;
    expect(image).toBeTruthy();
    fireEvent.error(image);
    expect(document.querySelector(".image-template-thumb-placeholder")).toBeTruthy();
    expect(document.querySelector(".image-template-thumb img")).toBeNull();
  });

  it("keeps local image-template management out of the picker", async () => {
    listImageTemplatesSpy.mockResolvedValue([]);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText(/No image templates are configured yet/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Import JSON/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Export JSON/i })).toBeNull();
    expect(document.querySelector(".image-template-file-input")).toBeNull();
  });

  it("submits the selected image ratio for new image generation only", async () => {
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "img", topic: "", prompt: "", imageRatio: "square" }} />);

    expect(screen.getByText("Image ratio")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Landscape"));
    fireEvent.change(screen.getByPlaceholderText(/Enter what you want to generate/i), {
      target: { value: "A launch banner" },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Enter what you want to generate/i).closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({
      documentType: "img",
      prompt: "A launch banner",
      imageRatio: "landscape",
    }));
  });

  it("does not submit imageRatio for non-image generation", async () => {
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "pptx", topic: "", prompt: "", imageRatio: "portrait" }} />);

    expect(screen.queryByText("Image ratio")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Enter what you want to generate/i), {
      target: { value: "Build a deck" },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Enter what you want to generate/i).closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({ documentType: "pptx", prompt: "Build a deck" }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("imageRatio");
  });

  it("hides GIF from new generation and falls back to PPTX for GIF drafts", async () => {
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "gif", topic: "", prompt: "", fps: 16 }} />);

    expect(screen.queryByText("GIF")).toBeNull();
    expect(screen.queryByText("GIF FPS")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Enter what you want to generate/i), {
      target: { value: "Build a launch deck" },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Enter what you want to generate/i).closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({
      documentType: "pptx",
      prompt: "Build a launch deck",
    }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("fps");
  });

  it("image generation confirms before replacing an existing prompt with a template", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt: replace PRODUCT", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true },
    ]);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "Existing prompt" }} />);

    expect(await screen.findByText("Poster")).toBeTruthy();
    const textarea = screen.getByPlaceholderText(/Enter what you want to generate/i);
    expect((textarea as HTMLTextAreaElement).value).toBe("Existing prompt");

    fireEvent.click(screen.getByRole("button", { name: /Poster/i }));
    expect((await screen.findAllByText("Replace current prompt?")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => expect(screen.queryAllByText("Replace current prompt?")).toHaveLength(0));
    expect((textarea as HTMLTextAreaElement).value).toBe("Existing prompt");
    expect(screen.queryByText(/Template text has been inserted/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Poster/i }));
    expect((await screen.findAllByText("Replace current prompt?")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /^Replace$/i }));
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe("Template prompt: replace PRODUCT"));
    expect(screen.getByText(/Template text has been inserted/i)).toBeTruthy();
  });

  it("image generation shows an empty state when no templates are configured", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([]);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText(/No image templates are configured yet/i)).toBeTruthy();
  });

  it("replaces the start presets with the image template list when Image is selected", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true },
    ]);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "pptx", topic: "", prompt: "" }} />);

    expect(screen.getByText("Quarterly Analysis Report")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Image"));

    expect(await screen.findByText("Poster")).toBeTruthy();
    expect(screen.queryByText("Quarterly Analysis Report")).toBeNull();
    expect(screen.queryByText(/Choose a preset scenario/i)).toBeNull();
    expect(document.querySelectorAll(".image-template-picker")).toHaveLength(1);
    expect(document.querySelector(".fluid-start-card .image-template-picker")).toBeTruthy();
    expect(document.querySelector(".fluid-command-bar .image-template-picker")).toBeNull();
  });

  it("places a full-width scratch generation card before image templates", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    const scratchCard = await screen.findByRole("button", { name: /Start from scratch/i });
    const picker = document.querySelector(".image-template-picker");
    const templateTitle = await screen.findByText("Promo");
    expect(picker?.firstElementChild).toBe(scratchCard);
    expect(Boolean(scratchCard.compareDocumentPosition(templateTitle) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(scratchCard.classList.contains("image-template-scratch-card")).toBe(true);

    const css = readFileSync("src/renderer/styles/dialogue.css", "utf8");
    const pickerRule = css.match(/\.image-template-workspace \.image-template-picker\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(pickerRule).toContain("padding-top: 1px;");

    fireEvent.click(screen.getByRole("button", { name: /Promo/i }));
    expect(document.querySelector(".image-template-form-title")?.textContent).toBe("What should we work on?");
    expect(screen.getByText("Fill in the template")).toBeTruthy();

    fireEvent.click(scratchCard);
    expect(document.querySelector(".image-template-form-title")?.textContent).toBe("What should we work on?");
    expect(screen.queryByText("Fill in the template")).toBeNull();
    expect((screen.getByPlaceholderText(/Enter what you want to generate/i) as HTMLTextAreaElement).value).toBe("");
  });

  it("lays out image templates as a 1:1 photo wall and form workspace", async () => {
    const masonryTemplates = [0, 1, 2, 3].map((index) => ({
      ...SLOTTED_TEMPLATE,
      id: 80 + index,
      slug: `promo-${index + 1}`,
      title: `Promo ${index + 1}`,
    }));
    listImageTemplatesSpy.mockResolvedValueOnce(masonryTemplates);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Promo 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Promo 1/i }));

    const workspace = document.querySelector(".image-template-workspace");
    const galleryPane = document.querySelector(".image-template-gallery-pane");
    const formPane = document.querySelector(".image-template-form-pane");
    const actionsFooter = document.querySelector(".image-template-actions-footer");
    const commandBar = document.querySelector(".fluid-command-bar");
    const templateGrid = document.querySelector(".image-template-grid");
    const masonryColumns = document.querySelectorAll(".image-template-masonry-column");
    const uploadButton = screen.getByRole("button", { name: /Attach reference images/i });
    const generateButton = screen.getByRole("button", { name: /Generate$/i });

    expect(workspace).toBeTruthy();
    expect(galleryPane).toBeTruthy();
    expect(formPane).toBeTruthy();
    expect(actionsFooter).toBeTruthy();
    expect(commandBar).toBeTruthy();
    expect(workspace?.contains(galleryPane)).toBe(true);
    expect(workspace?.contains(formPane)).toBe(true);
    expect(formPane?.contains(commandBar)).toBe(true);
    expect(formPane?.contains(actionsFooter)).toBe(true);
    expect(actionsFooter?.parentElement).toBe(formPane);
    expect(actionsFooter?.contains(uploadButton)).toBe(true);
    expect(actionsFooter?.contains(generateButton)).toBe(true);
    expect(Boolean(uploadButton.compareDocumentPosition(generateButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(templateGrid?.classList.contains("image-template-vertical-wall")).toBe(true);
    expect(masonryColumns).toHaveLength(3);
    expect(masonryColumns[0].textContent).toContain("Promo 1");
    expect(masonryColumns[0].textContent).toContain("Promo 4");
    expect(masonryColumns[1].textContent).toContain("Promo 2");
    expect(masonryColumns[2].textContent).toContain("Promo 3");
    expect(document.querySelector(".image-template-form-title")?.textContent).toBe("What should we work on?");

    const css = readFileSync("src/renderer/styles/dialogue.css", "utf8");
    const galleryGridRule = css.match(/\.image-template-workspace \.image-template-grid\s*\{[^}]*\}/s)?.[0] ?? "";
    const galleryCardRule = css.match(/\.image-template-workspace \.image-template-card\s*\{[^}]*\}/s)?.[0] ?? "";
    const masonryColumnRule = css.match(/\.image-template-masonry-column\s*\{[^}]*\}/s)?.[0] ?? "";
    const actionsRule = css.match(/\.image-template-actions-footer\s*\{[^}]*\}/s)?.[0] ?? "";
    const actionsOverrideRule = css.match(/\.composer-actions\.image-template-actions-footer\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(galleryGridRule).toContain("display: grid;");
    expect(galleryGridRule).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(galleryGridRule).not.toContain("column-count:");
    expect(masonryColumnRule).toContain("display: grid;");
    expect(masonryColumnRule).toContain("align-content: start;");
    expect(galleryCardRule).toContain("break-inside: avoid;");
    expect(actionsRule).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(actionsOverrideRule).toContain("display: grid;");
  });

  it("places the image-template headline and document format selector in a compact full-width toolbar", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    render(
      <DialogueScreen
        {...baseProps({
          workspaces: [{ id: "ws-1", path: "/tmp/ppt-test", name: "ppt-test", active: true, conversations: [] }],
          newChatTarget: { kind: "workspace", workspaceId: "ws-1" },
        })}
        newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }}
      />,
    );

    expect(await screen.findByText("Promo")).toBeTruthy();
    const workspace = document.querySelector(".image-template-workspace");
    const fullWidthHeader = document.querySelector(".image-template-prompt-header");
    const formPane = document.querySelector(".image-template-form-pane");
    const galleryPane = document.querySelector(".image-template-gallery-pane");
    const formatRow = fullWidthHeader?.querySelector(".format-row");

    expect(workspace?.firstElementChild).toBe(fullWidthHeader);
    expect(fullWidthHeader?.contains(document.querySelector(".image-template-form-title"))).toBe(true);
    expect(formatRow).toBeTruthy();
    expect(formPane?.contains(fullWidthHeader)).toBe(false);
    expect(formPane?.querySelector(".format-row")).toBeNull();
    expect(galleryPane).toBeTruthy();
    expect(fullWidthHeader).toBeTruthy();
    expect(galleryPane!.compareDocumentPosition(fullWidthHeader!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    const css = readFileSync("src/renderer/styles/dialogue.css", "utf8");
    const workspaceRule = css.match(/\.image-template-workspace\s*\{[^}]*\}/s)?.[0] ?? "";
    const headerRule = css.match(/\.image-template-prompt-header\s*\{[^}]*\}/s)?.[0] ?? "";
    const galleryPaneRule = css.match(/\.image-template-workspace \.image-template-gallery-pane\s*\{[^}]*\}/s)?.[0] ?? "";
    const formPaneRule = css.match(/\.image-template-form-pane\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(workspaceRule).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(headerRule).toContain("grid-column: 1 / -1;");
    expect(headerRule).toContain("grid-row: 1;");
    expect(headerRule).toContain("display: flex;");
    expect(headerRule).toContain("justify-content: space-between;");
    expect(headerRule).toContain("text-align: left;");
    expect(galleryPaneRule).toContain("grid-row: 2;");
    expect(formPaneRule).toContain("grid-row: 2;");

    const formatRowRule = css.match(/\.image-template-prompt-header \.format-row\s*\{[^}]*\}/s)?.[0] ?? "";
    const titleRule = css.match(/\.image-template-prompt-header \.fluid-start-title\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(formatRowRule).toContain("justify-content: flex-end;");
    expect(titleRule).toContain("justify-content: flex-start;");
  });

  it("uses the project headline in the image-template form header", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    render(
      <DialogueScreen
        {...baseProps({
          workspaces: [{ id: "ws-1", path: "/tmp/ppt-test", name: "ppt-test", active: true, conversations: [] }],
          newChatTarget: { kind: "workspace", workspaceId: "ws-1" },
        })}
        newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }}
      />,
    );

    expect(await screen.findByText("Promo")).toBeTruthy();
    const header = document.querySelector(".image-template-form-header")!;
    expect(within(header as HTMLElement).getByText("What should we work on in")).toBeTruthy();
    expect(within(header as HTMLElement).getByRole("button", { name: "ppt-test" })).toBeTruthy();
    expect(within(header as HTMLElement).queryByText(/^Image templates$/i)).toBeNull();
  });

  it("shows an antd spinner and loading text while image templates are pending", async () => {
    const pending = deferred<Awaited<ReturnType<DesktopAPI["listImageTemplates"]>>>();
    listImageTemplatesSpy.mockReturnValueOnce(pending.promise);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(document.querySelector(".ant-spin")).toBeTruthy();
    const loadingStatus = document.querySelector(".image-template-status")!;
    const loadingText = Array.from(loadingStatus.children).find((child) => !child.classList.contains("ant-spin"));
    expect(loadingText?.textContent).toBe("Loading image templates…");

    await act(async () => {
      pending.resolve([
        { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true },
      ]);
      await pending.promise;
    });
    expect(await screen.findByText("Poster")).toBeTruthy();
  });

  it("refreshes the image-template list from the picker head", async () => {
    listImageTemplatesSpy
      .mockResolvedValueOnce([
        { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true },
      ])
      .mockResolvedValueOnce([
        { id: 8, slug: "banner", title: "Banner", description: "Hero banner", promptPreset: "Second prompt", thumbnailUrl: "/api/image-templates/8/thumbnail", sortOrder: 20, enabled: true },
      ]);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Poster")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Refresh$/i }));

    await waitFor(() => expect(listImageTemplatesSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Banner")).toBeTruthy();
  });

  it("does not expose image-template copy controls in the picker", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([
      { id: 7, slug: "poster", title: "Poster", description: "Cinematic poster", promptPreset: "Template prompt", thumbnailUrl: "/api/image-templates/7/thumbnail", sortOrder: 10, enabled: true, visibility: "platform_public" },
    ]);
    render(<DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);

    expect(await screen.findByText("Poster")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Copy to my templates$/i })).toBeNull();
    expect(createImageTemplateSpy).not.toHaveBeenCalled();
  });
});

function fireDropWithFile(target: HTMLElement, file: File) {
  fireEvent.dragOver(target, {
    dataTransfer: {
      files: [file],
      items: [],
      types: ["Files"],
      dropEffect: "copy",
    },
  });
  fireEvent.drop(target, {
    dataTransfer: {
      files: [file],
      items: [],
      types: ["Files"],
      dropEffect: "copy",
    },
  });
}

const SLOTTED_TEMPLATE = {
  id: 8,
  slug: "promo",
  title: "Promo",
  description: "Promo poster",
  promptPreset: "Poster for {{product}}, {{style}} style. Notes: {{notes}}",
  thumbnailUrl: "/api/image-templates/8/thumbnail",
  sortOrder: 5,
  enabled: true,
  slots: [
    { key: "product", label: "Product", defaultValue: "PRODUCT_HINT", required: true },
    { key: "style", label: "Style", defaultValue: "minimalist" },
    { key: "notes", label: "Notes", defaultValue: "NOTES_HINT", multiline: true },
  ] as ImagePromptSlot[],
};

async function selectSlottedTemplate(locale?: Locale, template = SLOTTED_TEMPLATE) {
  const screenNode = <DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />;
  render(locale ? <LocaleProvider value={locale}>{screenNode}</LocaleProvider> : screenNode);
  expect(await screen.findByText("Promo")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Promo/i }));
  return screen.getByPlaceholderText(template.slots[0].defaultValue!) as HTMLInputElement;
}

describe("assembleSlots (pure assembly)", () => {
  const slots: ImagePromptSlot[] = [
    { key: "product", label: "Product", defaultValue: "a gadget" },
    { key: "style", label: "Style" },
  ];

  it("uses the user value when provided", () => {
    expect(assembleSlots("Make {{product}} in {{style}}", slots, { product: "shoes", style: "retro" }))
      .toBe("Make shoes in retro");
  });

  it("falls back to defaultValue, then [label] — never the literal marker", () => {
    const out = assembleSlots("Make {{product}} in {{style}}", slots, {});
    expect(out).toBe("Make a gadget in [Style]");
    expect(out).not.toContain("{{");
  });

  it("treats a whitespace-only value as empty", () => {
    expect(assembleSlots("X {{product}}", slots, { product: "   " })).toBe("X a gadget");
  });

  it("leaves orphan markers (no matching slot) verbatim", () => {
    expect(assembleSlots("Has {{ghost}} marker", slots, {})).toBe("Has {{ghost}} marker");
  });
});

describe("Image template slots (guided fill-in)", () => {
  it("renders the slot form tab by default and switches to the prompt preview tab", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    await selectSlottedTemplate();

    expect(screen.getByText("Fill in the template")).toBeTruthy();
    const formTab = screen.getByRole("tab", { name: "Form" });
    const previewTab = screen.getByRole("tab", { name: "Preview" });
    expect(formTab.getAttribute("aria-selected")).toBe("true");
    expect(previewTab.getAttribute("aria-selected")).toBe("false");
    // multiline slot renders a <textarea>, single-line slots render <input>
    expect((screen.getByPlaceholderText("PRODUCT_HINT") as HTMLElement).tagName).toBe("INPUT");
    expect((screen.getByPlaceholderText("NOTES_HINT") as HTMLElement).tagName).toBe("TEXTAREA");
    expect((screen.getByPlaceholderText("PRODUCT_HINT") as HTMLInputElement).value).toBe("PRODUCT_HINT");
    expect((screen.getByPlaceholderText("NOTES_HINT") as HTMLTextAreaElement).value).toBe("NOTES_HINT");

    expect(document.querySelector(".template-slot-preview-body")).toBeNull();

    fireEvent.click(previewTab);

    const preview = document.querySelector(".template-slot-preview-body")!;
    expect(formTab.getAttribute("aria-selected")).toBe("false");
    expect(previewTab.getAttribute("aria-selected")).toBe("true");
    expect(preview.textContent).toBe("Poster for PRODUCT_HINT, minimalist style. Notes: NOTES_HINT");
    expect(preview.textContent).not.toContain("{{");
  });

  it("updates the preview live as slots are filled", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    const productInput = await selectSlottedTemplate();
    fireEvent.change(productInput, { target: { value: "sneakers" } });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    const preview = document.querySelector(".template-slot-preview-body")!;
    expect(preview.textContent).toBe("Poster for sneakers, minimalist style. Notes: NOTES_HINT");
  });

  it("labels the image reference upload button with visible upload guidance", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    await selectSlottedTemplate();

    const uploadButton = screen.getByRole("button", { name: /Attach reference images/i });
    expect(within(uploadButton).getByText(/Upload reference images/i)).toBeTruthy();
  });

  it("uses a required slot defaultValue when the user leaves it empty", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);
    expect(await screen.findByText("Promo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Promo/i }));

    const productInput = screen.getByPlaceholderText("PRODUCT_HINT");
    fireEvent.submit(productInput.closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({
      prompt: "Poster for PRODUCT_HINT, minimalist style. Notes: NOTES_HINT",
    }));
  });

  it("rejects a slot value containing double-brace markers", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);
    expect(await screen.findByText("Promo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Promo/i }));

    const productInput = screen.getByPlaceholderText("PRODUCT_HINT");
    fireEvent.change(productInput, { target: { value: "evil {{inject}}" } });
    fireEvent.submit(productInput.closest("form")!);

    await waitFor(() => expect(screen.getAllByText(/double-brace markers/i).length).toBeGreaterThan(0));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the assembled prompt (slots filled) with no promptTemplateId", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(<DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />);
    expect(await screen.findByText("Promo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Promo/i }));

    fireEvent.change(screen.getByPlaceholderText("PRODUCT_HINT"), { target: { value: "sneakers" } });
    fireEvent.change(screen.getByPlaceholderText("NOTES_HINT"), { target: { value: "bright colors" } });
    fireEvent.submit(screen.getByPlaceholderText("PRODUCT_HINT").closest("form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted).toEqual(expect.objectContaining({
      documentType: "img",
      prompt: "Poster for sneakers, minimalist style. Notes: bright colors",
    }));
    expect(submitted).not.toHaveProperty("promptTemplateId");
  });

  it("renders zh slot labels and uses them in required warnings", async () => {
    const requiredNoDefaultTemplate = {
      ...SLOTTED_TEMPLATE,
      slots: [
        { key: "product", label: "Product", required: true },
        { key: "style", label: "Style", defaultValue: "minimalist" },
        { key: "notes", label: "Notes", defaultValue: "NOTES_HINT", multiline: true },
      ] as ImagePromptSlot[],
    };
    listImageTemplatesSpy.mockResolvedValueOnce([requiredNoDefaultTemplate]);
    const onSubmit = vi.fn(async (_values: GenerateInput) => undefined);
    render(
      <LocaleProvider value="zh">
        <DialogueScreen {...baseProps({ onSubmit })} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />
      </LocaleProvider>,
    );
    expect(await screen.findByText("Promo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Promo/i }));

    expect(screen.getByText("产品")).toBeTruthy();
    expect(screen.getByText("风格")).toBeTruthy();
    expect(screen.getByText("备注")).toBeTruthy();

    fireEvent.submit(document.querySelector(".template-slot-form input")!.closest("form")!);
    await waitFor(() => expect(screen.getAllByText(/请填写产品/).length).toBeGreaterThan(0));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("falls back to the English slot label when a slug/key is not translated", async () => {
    const untranslatedTemplate = {
      ...SLOTTED_TEMPLATE,
      id: 9,
      slug: "untranslated",
      slots: [
        { key: "hero", label: "Hero Product", defaultValue: "HERO_HINT", required: true },
      ] as ImagePromptSlot[],
    };
    listImageTemplatesSpy.mockResolvedValueOnce([untranslatedTemplate]);
    render(
      <LocaleProvider value="zh">
        <DialogueScreen {...baseProps()} newGenerationDraft={{ documentType: "img", topic: "", prompt: "" }} />
      </LocaleProvider>,
    );
    expect(await screen.findByText("Promo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Promo/i }));

    expect(screen.getByText("Hero Product")).toBeTruthy();
  });

  it("escape hatch: editing the raw prompt detaches slots, and reset re-attaches them", async () => {
    listImageTemplatesSpy.mockResolvedValueOnce([SLOTTED_TEMPLATE]);
    await selectSlottedTemplate();

    // Open the raw prompt editor, then edit it to decouple from the slots.
    fireEvent.click(screen.getByRole("button", { name: /Edit raw prompt/i }));
    const rawTextarea = screen.getByPlaceholderText(/Enter what you want to generate/i);
    fireEvent.change(rawTextarea, { target: { value: "fully custom raw prompt" } });

    expect(screen.getByText(/You're editing the raw prompt/i)).toBeTruthy();
    expect(screen.queryByText("Fill in the template")).toBeNull();

    // Reset re-seeds the guided form and restores the assembled prompt.
    fireEvent.click(screen.getByRole("button", { name: /Reset to template/i }));
    expect(screen.getByText("Fill in the template")).toBeTruthy();
    expect((screen.getByPlaceholderText(/Enter what you want to generate/i) as HTMLTextAreaElement).value)
      .toBe("Poster for PRODUCT_HINT, minimalist style. Notes: NOTES_HINT");
  });
});

describe("Conversation multi-round", () => {
  it("scrolls to the bottom after switching between completed conversations", async () => {
    const firstTask = makeCompletedImageTask({
      id: "task-img-1",
      conversationId: "conv-1",
      events: [{ task_id: "task-img-1", type: "task.completed", payload: { message: "done" } }],
      artifact: {
        taskId: "task-img-1",
        filePath: "/tmp/first.png",
        fileName: "first.png",
        documentType: "img",
      },
    });
    const secondTask = makeCompletedImageTask({
      id: "task-img-2",
      conversationId: "conv-2",
      events: [{ task_id: "task-img-2", type: "task.completed", payload: { message: "done" } }],
      artifact: {
        taskId: "task-img-2",
        filePath: "/tmp/second.png",
        fileName: "second.png",
        documentType: "img",
      },
    });
    const scrollIntoView = window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    const { rerender } = render(<DialogueScreen {...baseProps()} tasks={[firstTask]} />);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    rerender(<DialogueScreen {...baseProps()} tasks={[secondTask]} />);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
  });

  it("sets the scroll container to the true bottom after switching conversations", async () => {
    const firstTask = makeCompletedImageTask({ id: "task-img-1", conversationId: "conv-1" });
    const secondTask = makeCompletedImageTask({ id: "task-img-2", conversationId: "conv-2" });
    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this instanceof HTMLElement && this.classList.contains("stage") ? 300 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this instanceof HTMLElement && this.classList.contains("stage") ? 1200 : 0;
      },
    });

    try {
      const { rerender } = render(
        <section className="stage" data-testid="stage-scroll">
          <DialogueScreen {...baseProps()} tasks={[firstTask]} />
        </section>,
      );
      const stage = screen.getByTestId("stage-scroll");

      await waitFor(() => expect(stage.scrollTop).toBe(900));
      stage.scrollTop = 120;
      rerender(
        <section className="stage" data-testid="stage-scroll">
          <DialogueScreen {...baseProps()} tasks={[secondTask]} />
        </section>,
      );

      await waitFor(() => expect(stage.scrollTop).toBe(900));
    } finally {
      if (clientHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "clientHeight", clientHeightDescriptor);
      if (scrollHeightDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scrollHeightDescriptor);
    }
  });

  it("keeps the continuation composer in a fixed footer outside the chat thread", async () => {
    render(<DialogueScreen {...baseProps()} tasks={[makeCompletedImageTask()]} />);
    const composer = screen.getByTestId("continuation-composer");
    const footer = composer.closest(".conversation-footer");
    const thread = document.querySelector(".chat-thread");

    expect(footer).toBeTruthy();
    expect(thread).toBeTruthy();
    expect(thread?.contains(composer)).toBe(false);
    expect(footer?.parentElement).toBe(document.querySelector(".conversation-layout"));
  });

  it("scrolls to a sentinel inside the chat thread instead of the fixed footer", async () => {
    render(<DialogueScreen {...baseProps()} tasks={[makeCompletedImageTask()]} />);
    const scrollIntoView = window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    const thread = document.querySelector(".chat-thread");
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(thread?.lastElementChild);
  });

  it("scrolls again when restored conversation content resizes after preview loading", async () => {
    render(<DialogueScreen {...baseProps()} tasks={[makeCompletedImageTask()]} />);
    const scrollIntoView = window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    const layout = document.querySelector(".conversation-layout");
    const layoutObserver = resizeObserverRecords.find((record) => record.observed.includes(layout!));
    expect(layoutObserver).toBeTruthy();

    act(() => {
      layoutObserver!.callback([], {} as ResizeObserver);
    });

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it("renders time markers for each task round", () => {
    const task1: DesktopTask = {
      id: "task-1",
      conversationId: "conv-1",
      status: "completed",
      events: [{ task_id: "task-1", type: "task.completed", ts: "2026-05-26T10:00:00Z", payload: { message: "done" } }],
    };
    const task2: DesktopTask = {
      id: "task-2",
      conversationId: "conv-1",
      parentTaskId: "task-1",
      status: "completed",
      events: [{ task_id: "task-2", type: "task.completed", ts: "2026-05-26T10:05:00Z", payload: { message: "done" } }],
    };
    render(<DialogueScreen {...baseProps()} tasks={[task1, task2]} />);

    // Two time markers (one per round) — verify they exist and differ
    const markers = document.querySelectorAll(".time-marker");
    expect(markers.length).toBe(2);
    // Content depends on local timezone rendering, just verify non-empty dates
    const datePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    expect(datePattern.test(markers[0].textContent?.trim() || "")).toBe(true);
    expect(datePattern.test(markers[1].textContent?.trim() || "")).toBe(true);
    expect(markers[0].textContent).not.toBe(markers[1].textContent);
  });
});

describe("Bottom continuation composer — acceptance criteria", () => {
  it("T1: renders on a completed image task with correct placeholder", () => {
    const task = makeCompletedImageTask();
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    const composer = screen.getByTestId("continuation-composer");
    expect(composer).toBeTruthy();
    expect(screen.getByPlaceholderText(/describe what you want to generate/i)).toBeTruthy();
  });

  it("T2: renders on completed non-image tasks (all types support continuation)", () => {
    for (const [docType, fileName] of [
      ["pptx", "deck.pptx"],
      ["docx", "letter.docx"],
      ["xlsx", "data.xlsx"],
      ["report", "analysis.report"],
    ] as const) {
      cleanup();
      const task = makeCompletedDocTask(docType, fileName);
      render(<DialogueScreen {...baseProps()} tasks={[task]} />);
      expect(screen.getByTestId("continuation-composer")).toBeTruthy();
    }
  });

  it("T3: NOT rendered on running tasks, rendered on terminal tasks", () => {
    const runningTask: DesktopTask = {
      id: "task-run",
      conversationId: "task-run",
      status: "running",
      events: [{ task_id: "task-run", type: "task.started", payload: {} }],
    };
    render(<DialogueScreen {...baseProps()} tasks={[runningTask]} />);
    expect(screen.queryByTestId("continuation-composer")).toBeNull();
    cleanup();

    const failedTask: DesktopTask = {
      id: "task-fail",
      conversationId: "task-fail",
      status: "failed",
      events: [{ task_id: "task-fail", type: "task.failed", payload: { message: "err" } }],
    };
    render(<DialogueScreen {...baseProps()} tasks={[failedTask]} />);
    expect(screen.getByTestId("continuation-composer")).toBeTruthy();
  });

  it("T4: submit button disabled when textarea empty, enabled with non-whitespace", () => {
    const task = makeCompletedImageTask();
    render(<DialogueScreen {...baseProps()} tasks={[task]} />);
    const submitBtn = document.querySelector(".composer-row .ant-btn-primary") as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const textarea = screen.getByPlaceholderText(/describe what you want to generate/i);
    fireEvent.change(textarea, { target: { value: "Make sky brighter" } });
    expect(submitBtn.disabled).toBe(false);
  });

  it("T5: clicking submit calls onContinueGeneration with documentType, prompt, referenceImages, and imageRatio", () => {
    const onContinueGeneration = vi.fn();
    const task = makeCompletedImageTask();
    render(<DialogueScreen {...baseProps({ onContinueGeneration })} tasks={[task]} />);

    expect(screen.getByText("Image ratio")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Portrait"));
    const textarea = screen.getByPlaceholderText(/describe what you want to generate/i);
    fireEvent.change(textarea, { target: { value: "Add a sunset" } });
    const submitBtn = document.querySelector(".composer-row .ant-btn-primary") as HTMLButtonElement;
    fireEvent.click(submitBtn);

    expect(onContinueGeneration).toHaveBeenCalledTimes(1);
    expect(onContinueGeneration).toHaveBeenCalledWith("img", "Add a sunset", undefined, "portrait");
  });

  it("continues GIF generation with fps and no imageRatio", () => {
    const onContinueGeneration = vi.fn();
    const task = makeCompletedGIFTask();
    render(<DialogueScreen {...baseProps({ onContinueGeneration })} tasks={[task]} />);

    expect(screen.getByText("GIF FPS")).toBeTruthy();
    expect(screen.queryByText("Image ratio")).toBeNull();
    const fpsInput = screen.getByRole("spinbutton", { name: /GIF FPS/i });
    fireEvent.change(fpsInput, { target: { value: "12" } });
    const textarea = screen.getByPlaceholderText(/describe what you want to generate/i);
    fireEvent.change(textarea, { target: { value: "Make the wink slower" } });
    const submitBtn = document.querySelector(".composer-row .ant-btn-primary") as HTMLButtonElement;
    fireEvent.click(submitBtn);

    expect(onContinueGeneration).toHaveBeenCalledTimes(1);
    expect(onContinueGeneration).toHaveBeenCalledWith("gif", "Make the wink slower", undefined, undefined, 12);
  });

  it("T6: Enter submits, Shift+Enter does not", () => {
    const onContinueGeneration = vi.fn();
    const task = makeCompletedImageTask();
    render(<DialogueScreen {...baseProps({ onContinueGeneration })} tasks={[task]} />);

    const textarea = screen.getByPlaceholderText(/describe what you want to generate/i);
    fireEvent.change(textarea, { target: { value: "Brighten colors" } });

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onContinueGeneration).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onContinueGeneration).toHaveBeenCalledTimes(1);
    expect(onContinueGeneration).toHaveBeenCalledWith("img", "Brighten colors", undefined, "square");
  });

  it("adds a completed image as a continuation reference only after Continue editing is clicked", () => {
    const onContinueGeneration = vi.fn();
    const task = makeCompletedImageTask();
    render(<DialogueScreen {...baseProps({ onContinueGeneration })} tasks={[task]} />);

    fireEvent.click(screen.getByRole("button", { name: /continue editing/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue editing/i }));

    expect(document.querySelectorAll(".reference-image-chip")).toHaveLength(1);
    const textarea = screen.getByPlaceholderText(/describe what you want to generate/i);
    fireEvent.change(textarea, { target: { value: "Add a sunset" } });
    const submitBtn = document.querySelector(".composer-row .ant-btn-primary")!;
    fireEvent.click(submitBtn);

    expect(onContinueGeneration).toHaveBeenCalledTimes(1);
    expect(onContinueGeneration).toHaveBeenCalledWith("img", "Add a sunset", ["/tmp/banner.png"], "square");
  });

  it("does not submit a generated image reference after it is removed from the continuation composer", () => {
    const onContinueGeneration = vi.fn();
    const task = makeCompletedImageTask();
    render(<DialogueScreen {...baseProps({ onContinueGeneration })} tasks={[task]} />);

    fireEvent.click(screen.getByRole("button", { name: /continue editing/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove banner.png/i }));

    expect(document.querySelectorAll(".reference-image-chip")).toHaveLength(0);
    const textarea = screen.getByPlaceholderText(/describe what you want to generate/i);
    fireEvent.change(textarea, { target: { value: "Add a sunset" } });
    const submitBtn = document.querySelector(".composer-row .ant-btn-primary")!;
    fireEvent.click(submitBtn);

    expect(onContinueGeneration).toHaveBeenCalledTimes(1);
    expect(onContinueGeneration).toHaveBeenCalledWith("img", "Add a sunset", undefined, "square");
  });
});
