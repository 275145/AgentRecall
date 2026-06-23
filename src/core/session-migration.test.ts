import { describe, expect, it } from "vitest";
import {
  MIGRATION_TOKEN_LIMIT,
  estimatePortableSessionTokens,
  migrationAgentForSource,
  portableSessionFrom,
  supportedMigrationTargets,
} from "./session-migration";
import type { SessionMessage, SessionSearchResult, SessionSource } from "./types";

function session(
  source: SessionSource,
  overrides: Partial<SessionSearchResult> = {},
): SessionSearchResult {
  return {
    sessionKey: `${source}:1`,
    rawId: "1",
    source,
    projectPath: "/repo",
    filePath: "/tmp/source.jsonl",
    originalTitle: "Original",
    firstQuestion: "Question",
    displayTitle: "Display",
    timestamp: Date.parse("2026-06-23T00:00:00Z"),
    fileMtimeMs: 0,
    fileSize: 0,
    prUrl: null,
    prNumber: null,
    environmentId: "local",
    environmentKind: "local",
    environmentLabel: "Local",
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
    },
    customTitle: null,
    favorited: false,
    pinned: false,
    hidden: false,
    tags: [],
    matchSnippet: null,
    lastOpenedAt: null,
    lastResumedAt: null,
    lastActivityAt: 0,
    messageCount: 2,
    aiSummary: null,
    aiSummaryStale: false,
    ...overrides,
  };
}

const messages: SessionMessage[] = [
  { role: "user", content: "你好", timestamp: "2026-06-23T00:00:00Z", index: 9 },
  { role: "assistant", content: "hello", timestamp: "2026-06-23T00:00:01Z", index: 15 },
];

describe("session migration model", () => {
  it.each([
    ["claude-cli", "claude"],
    ["claude-app", "claude"],
    ["claude-internal", "claude"],
    ["codex-cli", "codex"],
    ["codex-app", "codex"],
    ["codex-internal", "codex"],
    ["codebuddy-cli", "codebuddy"],
    ["openclaw", null],
    ["hermes", null],
    ["opencode-cli", null],
    ["cursor-agent", null],
    ["trae", null],
  ] as const)("maps %s to %s", (source, expected) => {
    expect(migrationAgentForSource(source)).toBe(expected);
  });

  it.each([
    ["claude-cli", ["codex", "codebuddy"]],
    ["codex-app", ["claude", "codebuddy"]],
    ["codebuddy-cli", ["claude", "codex"]],
    ["hermes", []],
  ] as const)("returns ordered migration targets for %s", (source, expected) => {
    expect(supportedMigrationTargets(source)).toEqual(expected);
  });

  it("normalizes a local session and copies only user and assistant messages", () => {
    const input = [
      messages[0],
      {
        role: "system",
        content: "do not copy",
        timestamp: "2026-06-23T00:00:00.500Z",
        index: 10,
      },
      messages[1],
    ] as SessionMessage[];

    expect(portableSessionFrom(session("claude-cli"), input)).toEqual({
      sourceSessionKey: "claude-cli:1",
      sourceAgent: "claude",
      title: "Display",
      projectPath: "/repo",
      startedAt: "2026-06-23T00:00:00.000Z",
      messages: [
        { role: "user", content: "你好", timestamp: "2026-06-23T00:00:00Z", index: 0 },
        { role: "assistant", content: "hello", timestamp: "2026-06-23T00:00:01Z", index: 1 },
      ],
    });
  });

  it.each([
    { environmentKind: "ssh", environmentId: "remote" },
    { environmentKind: "local", environmentId: "imported-local" },
  ] as const)("rejects a non-local session", (environment) => {
    expect(() => portableSessionFrom(session("claude-cli", environment), messages)).toThrow(
      "Remote session migration is not supported yet.",
    );
  });

  it("rejects an unsupported source", () => {
    expect(() => portableSessionFrom(session("hermes"), messages)).toThrow(
      "Session source hermes cannot be migrated.",
    );
  });

  it.each(["", "   "])("rejects an empty project path", (projectPath) => {
    expect(() => portableSessionFrom(session("claude-cli", { projectPath }), messages)).toThrow(
      "Session has no project path.",
    );
  });

  it("estimates tokens from Unicode JavaScript character length and rounds up", () => {
    const portable = portableSessionFrom(session("claude-cli"), [
      { role: "user", content: "你好🙂a", timestamp: "2026-06-23T00:00:00Z", index: 0 },
    ]);

    expect("你好🙂a".length).toBe(5);
    expect(estimatePortableSessionTokens(portable)).toBe(2);
    expect(MIGRATION_TOKEN_LIMIT).toBe(60_000);
  });
});
