import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { SessionStore } from "./session-store";
import type { IndexedSession, SessionMessage } from "./types";
// The MCP server runs standalone; we exercise its SDK-free query functions here.
// The .mjs bin has no type declarations, so we type the imports explicitly.
// @ts-expect-error -- untyped .mjs bin
import * as mcp from "../../bin/agent-session-search-mcp.mjs";

type Db = import("node:sqlite").DatabaseSync;
type SearchResult = { sessionKey: string; project: string; title: string; summary: string | null };
const searchSessions = mcp.searchSessions as (db: Db, args?: Record<string, unknown>) => SearchResult[];
const getSession = mcp.getSession as (db: Db, args: Record<string, unknown>) => (SearchResult & { messages: Array<{ content: string }> }) | null;
const listProjects = mcp.listProjects as (db: Db) => Array<{ project: string; sessions: number }>;
const listTags = mcp.listTags as (db: Db) => string[];

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => import("node:sqlite").DatabaseSync };

function seedStore(): { db: import("node:sqlite").DatabaseSync; store: SessionStore } {
  const db = new DatabaseSync(":memory:");
  const store = new SessionStore(db);
  const session = (overrides: Partial<IndexedSession>): IndexedSession => ({
    sessionKey: "codex:abc",
    rawId: "abc",
    source: "codex-cli",
    projectPath: "/repo",
    filePath: "/tmp/a.jsonl",
    originalTitle: "fix login",
    firstQuestion: "fix login expiry bug",
    timestamp: new Date("2026-06-01T10:00:00Z").getTime(),
    fileMtimeMs: 10,
    fileSize: 100,
    prUrl: null,
    prNumber: null,
    ...overrides,
  });
  const messages = (text: string): SessionMessage[] => [
    { role: "user", content: text, timestamp: "2026-06-01T10:00:00Z", index: 0 },
  ];
  store.upsertIndexedSession(session({}), messages("the refresh token expired after 30 minutes"), [], []);
  store.upsertIndexedSession(
    session({ sessionKey: "codex:def", rawId: "def", projectPath: "/other", firstQuestion: "add dark mode toggle", fileMtimeMs: 20 }),
    messages("implement a theme switcher in react"),
    [],
    [],
  );
  store.addTag("codex:abc", "auth");
  return { db, store };
}

describe("MCP query functions", () => {
  it("finds a session by transcript keywords via FTS", () => {
    const { db } = seedStore();
    const results = searchSessions(db, { query: "refresh token" });
    expect(results.map((r) => r.sessionKey)).toContain("codex:abc");
    expect(results.find((r) => r.sessionKey === "codex:abc")?.project).toBe("/repo");
  });

  it("returns recent sessions when no query is given", () => {
    const { db } = seedStore();
    const results = searchSessions(db, {});
    // Ordered by file_mtime_ms DESC, so the newer session comes first.
    expect(results[0].sessionKey).toBe("codex:def");
  });

  it("filters by project substring", () => {
    const { db } = seedStore();
    const results = searchSessions(db, { project: "other" });
    expect(results).toHaveLength(1);
    expect(results[0].sessionKey).toBe("codex:def");
  });

  it("does not break on FTS special characters", () => {
    const { db } = seedStore();
    expect(() => searchSessions(db, { query: 'token" OR (' })).not.toThrow();
  });

  it("gets a single session with messages", () => {
    const { db } = seedStore();
    const session = getSession(db, { sessionKey: "codex:abc" });
    expect(session?.title).toBe("fix login expiry bug");
    expect(session?.messages[0].content).toContain("refresh token");
    expect(getSession(db, { sessionKey: "missing" })).toBeNull();
  });

  it("lists projects and tags", () => {
    const { db } = seedStore();
    expect(listProjects(db).map((p) => p.project).sort()).toEqual(["/other", "/repo"]);
    expect(listTags(db)).toContain("auth");
  });
});
