import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../../preload/index.ts", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../../main/index.ts", import.meta.url), "utf8");

describe("detail panel actions", () => {
  it("exposes terminal focus and markdown export in the detail panel", () => {
    const detailPanel = appSource.slice(appSource.indexOf("function DetailPanel"), appSource.indexOf("function MessageBlock"));

    expect(detailPanel).toContain("onFocusTerminal");
    expect(detailPanel).toContain("onExportMarkdown");
    expect(detailPanel).toMatch(/Bring to Front/);
    expect(detailPanel).toMatch(/Export MD/);
    expect(detailPanel).toMatch(/disabled=\{actionRunning \|\| liveState !== "open"\}/);
  });

  it("keeps right-click terminal focus and markdown export without plain text copy", () => {
    const contextMenu = appSource.slice(appSource.indexOf("function ContextMenu"), appSource.indexOf("function SettingsDialog"));

    expect(contextMenu).toMatch(/Bring to Front/);
    expect(contextMenu).toMatch(/disabled=\{liveState !== "open"\}/);
    expect(contextMenu).toMatch(/Export Markdown/);
    expect(contextMenu).not.toMatch(/Copy Plain Text/);
  });

  it("wires markdown export through IPC to a save dialog", () => {
    expect(preloadSource).toContain("exportMarkdown");
    expect(preloadSource).toContain("command:export-markdown");
    expect(mainSource).toContain("command:export-markdown");
    expect(mainSource).toContain("showSaveDialog");
    expect(mainSource).toContain("formatSessionMarkdown");
  });
});
