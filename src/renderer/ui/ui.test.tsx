import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button as AntdButton } from "./backends/antd";
import { Button as WebOfficeButton } from "./backends/weboffice";
import { resolveUiKitBackendAlias, resolveUiKitName } from "./resolveUiKit";

describe("ui kit facade", () => {
  it("defaults to the AntD backend", () => {
    expect(resolveUiKitName(undefined)).toBe("antd");
    expect(resolveUiKitName("")).toBe("antd");
    expect(resolveUiKitName("experimental")).toBe("antd");
  });

  it("selects the WebOffice backend only for the explicit build flag", () => {
    expect(resolveUiKitName("weboffice")).toBe("weboffice");
  });

  it("resolves backend alias paths from the selected build flag", () => {
    expect(resolveUiKitBackendAlias("/project/src/renderer", undefined)).toBe("/project/src/renderer/ui/backends/antd/index.tsx");
    expect(resolveUiKitBackendAlias("/project/src/renderer", "weboffice")).toBe("/project/src/renderer/ui/backends/weboffice/index.tsx");
  });

  it("renders the basic AntD button contract", () => {
    render(<AntdButton type="primary">AntD action</AntdButton>);

    expect(screen.getByRole("button", { name: "AntD action" })).toBeTruthy();
  });

  it("renders the basic WebOffice button contract", () => {
    render(<WebOfficeButton type="primary">WebOffice action</WebOfficeButton>);

    expect(screen.getByRole("button", { name: "WebOffice action" })).toBeTruthy();
  });
});
