import { Popover, type PopoverProps } from "antd";
import type { TooltipRef } from "antd/es/tooltip";
import { useCallback, useLayoutEffect, useRef, type ReactElement } from "react";

type ViewportAnchoredPopoverProps = PopoverProps & {
  children: ReactElement;
  onAlignerChange?: (aligner: VoidFunction | null) => void;
};

export function ViewportAnchoredPopover({ children, onAlignerChange, open, ...popoverProps }: ViewportAnchoredPopoverProps) {
  const popoverRef = useRef<TooltipRef>(null);
  const forceAlign = useCallback(() => popoverRef.current?.forceAlign(), []);

  useLayoutEffect(() => {
    if (!open) return;
    forceAlign();
    onAlignerChange?.(forceAlign);
    return () => onAlignerChange?.(null);
  }, [forceAlign, onAlignerChange, open]);

  return (
    <Popover ref={popoverRef} open={open} {...popoverProps}>
      {children}
    </Popover>
  );
}
