import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewportAnchoredPopover } from "./ViewportAnchoredPopover";

const forceAlign = vi.hoisted(() => vi.fn());

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  const React = await import("react");
  return {
    ...actual,
    Popover: React.forwardRef(function MockPopover(
      { children }: { children: ReactNode },
      ref,
    ) {
      React.useImperativeHandle(ref, () => ({
        forceAlign,
        nativeElement: document.body,
        popupElement: document.createElement("div"),
      }));
      return children;
    }),
  };
});

afterEach(() => {
  cleanup();
  forceAlign.mockClear();
});

describe("ViewportAnchoredPopover", () => {
  it("registers an aligner for an open popover and clears it when closed", () => {
    const onAlignerChange = vi.fn();
    const { rerender } = render(
      <ViewportAnchoredPopover open onAlignerChange={onAlignerChange} content={<div>Confirm</div>}>
        <button>Node</button>
      </ViewportAnchoredPopover>,
    );
    expect(forceAlign).toHaveBeenCalledTimes(1);
    const aligner = onAlignerChange.mock.calls.at(-1)?.[0] as VoidFunction;
    aligner();
    expect(forceAlign).toHaveBeenCalledTimes(2);

    rerender(
      <ViewportAnchoredPopover open={false} onAlignerChange={onAlignerChange} content={<div>Confirm</div>}>
        <button>Node</button>
      </ViewportAnchoredPopover>,
    );
    expect(onAlignerChange).toHaveBeenLastCalledWith(null);
  });

  it("does not register or align a popover that starts closed", () => {
    const onAlignerChange = vi.fn();
    render(
      <ViewportAnchoredPopover open={false} onAlignerChange={onAlignerChange} content={<div>Confirm</div>}>
        <button>Node</button>
      </ViewportAnchoredPopover>,
    );
    expect(forceAlign).not.toHaveBeenCalled();
    expect(onAlignerChange).not.toHaveBeenCalled();
  });
});

