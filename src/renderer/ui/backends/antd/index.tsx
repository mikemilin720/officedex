import { Button as AntdButton } from "antd";
import type { UiButtonProps } from "../../types";

export function Button(props: UiButtonProps) {
  return <AntdButton {...props} />;
}

export type { UiButtonProps };
