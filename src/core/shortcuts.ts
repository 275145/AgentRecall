export const DEFAULT_GLOBAL_SHORTCUT = "Alt+Space";

export const GLOBAL_SHORTCUT_OPTIONS = [
  { label: "Option + Space", value: "Alt+Space" },
  { label: "Control + Option + Space", value: "Ctrl+Alt+Space" },
  { label: "Command + Option + Space", value: "CommandOrControl+Alt+Space" },
  { label: "Disabled", value: "" },
] as const;

export type GlobalShortcut = (typeof GLOBAL_SHORTCUT_OPTIONS)[number]["value"];

const GLOBAL_SHORTCUT_VALUES = new Set<string>(GLOBAL_SHORTCUT_OPTIONS.map((option) => option.value));

export function normalizeGlobalShortcut(value: unknown): GlobalShortcut {
  return typeof value === "string" && GLOBAL_SHORTCUT_VALUES.has(value)
    ? (value as GlobalShortcut)
    : DEFAULT_GLOBAL_SHORTCUT;
}

export function globalShortcutLabel(value: string): string {
  return GLOBAL_SHORTCUT_OPTIONS.find((option) => option.value === value)?.label ?? "Option + Space";
}
