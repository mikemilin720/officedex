import "weboffice-design/button/style";
import type { CSSProperties } from "react";
import type { UiButtonProps, UiButtonSize, UiButtonType } from "../../types";

function buttonVariant(type: UiButtonType | undefined, danger: boolean | undefined) {
  if (danger) return "danger";
  if (type === "primary") return "primary";
  if (type === "text" || type === "link") return "ghost-normal";
  return "secondary";
}

function buttonSize(size: UiButtonSize | undefined) {
  if (size === "small") return "smallPlus";
  if (size === "large") return "large";
  return "medium";
}

function joinClasses(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

function buttonCssVars(variant: ReturnType<typeof buttonVariant>, size: ReturnType<typeof buttonSize>): CSSProperties {
  const height = size === "large" ? "40px" : size === "smallPlus" ? "28px" : "32px";
  const palette = variant === "primary"
    ? { bg: "#2c3033", hover: "#41464b", active: "#1f2326", label: "#ffffff", border: "#2c3033" }
    : variant === "danger"
      ? { bg: "#d92d20", hover: "#b42318", active: "#912018", label: "#ffffff", border: "#d92d20" }
      : { bg: "#ffffff", hover: "#f5f6f7", active: "#eceff1", label: "#2c3033", border: "rgba(65, 70, 75, .18)" };

  return {
    "--ui-button-container-height": height,
    "--ui-button-container-radius": "4px",
    "--ui-button-container-background": palette.bg,
    "--ui-button-container-background-hover": palette.hover,
    "--ui-button-container-background-active": palette.active,
    "--ui-button-container-border-color": palette.border,
    "--ui-button-container-border-color-hover": palette.border,
    "--ui-button-container-border-color-active": palette.border,
    "--ui-button-label-color": palette.label,
    "--ui-button-label-color-hover": palette.label,
    "--ui-button-label-color-active": palette.label,
    "--ui-button-icon-color": palette.label,
    "--ui-button-icon-color-hover": palette.label,
    "--ui-button-icon-color-active": palette.label,
  } as CSSProperties;
}

export function Button({ type, htmlType, size, danger, children, className, disabled, icon, loading, style, ...props }: UiButtonProps) {
  const variant = buttonVariant(type, danger);
  const normalizedSize = buttonSize(size);
  const contentMode = icon && children ? "icon-leading" : icon ? "icon-only" : "text";
  const buttonDisabled = disabled || loading;

  return (
    <button
      {...props}
      type={htmlType}
      className={joinClasses("ui-button", className)}
      data-content-mode={contentMode}
      data-disabled={buttonDisabled ? "true" : "false"}
      data-loading={loading ? "true" : undefined}
      data-size={normalizedSize}
      data-ui-role="ui-button"
      data-variant={variant}
      disabled={buttonDisabled}
      style={{ ...buttonCssVars(variant, normalizedSize), ...style }}
    >
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      {children ? <span className="ui-button__label">{children}</span> : null}
    </button>
  );
}

export type { UiButtonProps };
