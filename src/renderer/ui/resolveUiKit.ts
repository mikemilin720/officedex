export type UiKitName = "antd" | "weboffice";

export function resolveUiKitName(value: string | undefined): UiKitName {
  return value === "weboffice" ? "weboffice" : "antd";
}

export function resolveUiKitBackendAlias(sourceRoot: string, value: string | undefined): string {
  const root = sourceRoot.replace(/\/+$/, "");
  return `${root}/ui/backends/${resolveUiKitName(value)}/index.tsx`;
}
