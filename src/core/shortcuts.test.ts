import { describe, expect, it } from "vitest";
import { DEFAULT_GLOBAL_SHORTCUT, GLOBAL_SHORTCUT_OPTIONS, normalizeGlobalShortcut } from "./shortcuts";

describe("global shortcut settings", () => {
  it("keeps Option Space as the default shortcut", () => {
    expect(DEFAULT_GLOBAL_SHORTCUT).toBe("Alt+Space");
  });

  it("accepts supported shortcuts and rejects unknown accelerator strings", () => {
    expect(normalizeGlobalShortcut("Ctrl+Alt+Space")).toBe("Ctrl+Alt+Space");
    expect(normalizeGlobalShortcut("")).toBe("");
    expect(normalizeGlobalShortcut("Command+Q")).toBe(DEFAULT_GLOBAL_SHORTCUT);
  });

  it("offers a disabled option so users can turn off the global shortcut", () => {
    expect(GLOBAL_SHORTCUT_OPTIONS.some((option) => option.value === "")).toBe(true);
  });
});
