import { describe, expect, it } from "vitest";
import { focusLiveSessionTerminal, liveSessionPidForSession } from "./session-focus";
import type { LiveSession, SessionSearchResult } from "./types";

function session(overrides: Partial<SessionSearchResult>): SessionSearchResult {
  return {
    sessionKey: "codex-cli:codex-1",
    rawId: "codex-1",
    source: "codex-cli",
    environmentId: "local",
    environmentKind: "local",
    environmentLabel: "Local",
    projectPath: "",
    filePath: "",
    originalTitle: "",
    firstQuestion: "",
    timestamp: 0,
    fileMtimeMs: 0,
    fileSize: 0,
    prUrl: null,
    prNumber: null,
    tokenUsage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 },
    customTitle: null,
    displayTitle: "",
    favorited: false,
    pinned: false,
    hidden: false,
    tags: [],
    matchSnippet: null,
    lastOpenedAt: null,
    lastResumedAt: null,
    lastActivityAt: 0,
    messageCount: 0,
    aiSummary: null,
    aiSummaryStale: false,
    ...overrides,
  };
}

describe("live session focus", () => {
  it("matches an open process by session family and raw id", () => {
    const liveSessions: LiveSession[] = [
      { family: "claude", rawId: "codex-1", pid: 10 },
      { family: "codex", rawId: "codex-1", pid: 20 },
    ];

    expect(liveSessionPidForSession(session({ source: "codex-cli", rawId: "codex-1" }), liveSessions)).toBe(20);
  });

  it("does not match unsupported sources against CodeBuddy live sessions", () => {
    const liveSessions: LiveSession[] = [{ family: "codebuddy", rawId: "same-id", pid: 30 }];

    expect(liveSessionPidForSession(session({ source: "opencode-cli", rawId: "same-id" }), liveSessions)).toBeNull();
  });

  it("activates the terminal app that owns the live session process", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner = async (command: string, args: string[]): Promise<string> => {
      calls.push({ command, args });
      if (args.join(" ") === "-o tty= -p 303") return "ttys003\n";
      if (args.join(" ") === "-o pid=,ppid=,command= -p 303") return "303 202 /opt/homebrew/bin/codex resume codex-1\n";
      if (args.join(" ") === "-o pid=,ppid=,command= -p 202") return "202 101 -zsh\n";
      if (args.join(" ") === "-o pid=,ppid=,command= -p 101") return "101 1 /Applications/iTerm.app/Contents/MacOS/iTerm2\n";
      return "false\n";
    };

    await focusLiveSessionTerminal(303, { platform: "darwin", runner });

    expect(calls.at(-1)).toEqual({
      command: "/usr/bin/osascript",
      args: ["-e", 'tell application "iTerm" to activate'],
    });
    expect(calls.some((call) => call.args.join(" ") === "-axo pid=,ppid=,command=")).toBe(false);
  });

  it("falls back to app activation when tty lookup fails", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner = async (command: string, args: string[]): Promise<string> => {
      calls.push({ command, args });
      if (args.join(" ") === "-o tty= -p 303") throw new Error("tty unavailable");
      if (args.join(" ") === "-o pid=,ppid=,command= -p 303") return "303 202 /opt/homebrew/bin/codex resume codex-1\n";
      if (args.join(" ") === "-o pid=,ppid=,command= -p 202") return "202 101 -zsh\n";
      if (args.join(" ") === "-o pid=,ppid=,command= -p 101") return "101 1 /System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal\n";
      return "";
    };

    await focusLiveSessionTerminal(303, { platform: "darwin", runner });

    expect(calls.at(-1)).toEqual({
      command: "/usr/bin/osascript",
      args: ["-e", 'tell application "Terminal" to activate'],
    });
  });

  it("uses PowerShell to focus the owning terminal window on Windows", async () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner = async (command: string, args: string[]): Promise<string> => {
      calls.push({ command, args });
      return "";
    };

    await focusLiveSessionTerminal(404, { platform: "win32", runner });

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("powershell.exe");
    expect(calls[0].args).toEqual(expect.arrayContaining(["-NoProfile", "-Command"]));
    expect(calls[0].args.at(-1)).toContain("$targetProcessId = 404");
    expect(calls[0].args.at(-1)).toContain("SetForegroundWindow");
  });
});
