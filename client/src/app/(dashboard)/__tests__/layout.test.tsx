import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { DashboardLayout } from "../layout";

const mounted: Array<{ root: Root; container: HTMLElement }> = [];

function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(ui);
  mounted.push({ root, container });
  return { container };
}

afterEach(() => {
  while (mounted.length > 0) {
    const entry = mounted.pop();
    if (!entry) {
      continue;
    }
    entry.root.unmount();
    entry.container.remove();
  }
});

describe("DashboardLayout", () => {
  it("renders responsive slots", () => {
    render(
      <DashboardLayout
        sidebar={<nav aria-label="Test Sidebar">Sidebar</nav>}
        header={<div>Header</div>}
        toolbar={<div>Toolbar</div>}
      >
        <div>Main Content</div>
      </DashboardLayout>
    );

    const sidebar = document.querySelector("nav[aria-label='Test Sidebar']");
    const header = document.querySelector("header");

    expect(sidebar).toBeTruthy();
    expect(header?.textContent).toContain("Header");
    expect(document.body.textContent).toContain("Main Content");
    expect(document.body.textContent).toContain("Toolbar");
  });
});
