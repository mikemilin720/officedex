import type { ButtonHTMLAttributes, ReactNode } from "react";

export type UiButtonType = "default" | "primary" | "text" | "link";
export type UiButtonSize = "small" | "middle" | "large";

export interface UiButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "type"> {
  readonly type?: UiButtonType;
  readonly htmlType?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  readonly size?: UiButtonSize;
  readonly icon?: ReactNode;
  readonly loading?: boolean;
  readonly danger?: boolean;
  readonly children?: ReactNode;
}
