// Pure, renderer-safe terminal metadata. Must not import any node builtins so
// both the main process and the React renderer can share it.
export type TerminalChoice =
  | "Terminal"
  | "iTerm"
  | "Ghostty"
  | "WezTerm"
  | "Warp"
  | "WindowsTerminal"
  | "PowerShell"
  | "Cmd";

const MAC_TERMINALS: TerminalChoice[] = ["Terminal", "iTerm", "Ghostty", "WezTerm", "Warp"];
const WINDOWS_TERMINALS: TerminalChoice[] = ["WindowsTerminal", "PowerShell", "Cmd"];

const TERMINAL_LABELS: Record<TerminalChoice, string> = {
  Terminal: "Terminal",
  iTerm: "iTerm",
  Ghostty: "Ghostty",
  WezTerm: "WezTerm",
  Warp: "Warp",
  WindowsTerminal: "Windows Terminal",
  PowerShell: "PowerShell",
  Cmd: "Command Prompt",
};

export function terminalOptionsFor(platform: NodeJS.Platform = process.platform): TerminalChoice[] {
  return platform === "win32" ? [...WINDOWS_TERMINALS] : [...MAC_TERMINALS];
}

export function defaultTerminalFor(platform: NodeJS.Platform = process.platform): TerminalChoice {
  return platform === "win32" ? "WindowsTerminal" : "Terminal";
}

export function normalizeTerminal(value: unknown, platform: NodeJS.Platform = process.platform): TerminalChoice {
  const options = terminalOptionsFor(platform);
  return options.includes(value as TerminalChoice) ? (value as TerminalChoice) : defaultTerminalFor(platform);
}

// {label,value} pairs for a settings dropdown, filtered to the platform.
export function terminalSelectOptions(
  platform: NodeJS.Platform = process.platform,
): Array<{ label: string; value: TerminalChoice }> {
  return terminalOptionsFor(platform).map((value) => ({ label: TERMINAL_LABELS[value], value }));
}
