import { describe, expect, it } from "vitest";
import { syncLoadedSessionsInBatches } from "./indexer";
import { createInMemoryStore } from "./session-store";
import type { IndexedSession, LoadedSession } from "./types";

function session(index: number): LoadedSession {
  const id = `session-${index}`;
  const item: IndexedSession = {
    sessionKey: `codex:${id}`,
    rawId: id,
    source: "codex-cli",
    projectPath: `/repo/${index}`,
    filePath: `/tmp/${id}.jsonl`,
    originalTitle: `Session ${index}`,
    firstQuestion: `Question ${index}`,
    timestamp: index,
    fileMtimeMs: index,
    fileSize: 100 + index,
    prUrl: null,
    prNumber: null,
  };

  return {
    session: item,
    messages: [{ role: "user", content: `Question ${index}`, timestamp: "2026-06-01T10:00:00Z", index: 0 }],
  };
}

describe("indexer", () => {
  it("indexes loaded sessions in batches and yields between batches", async () => {
    const store = createInMemoryStore();
    const progress: number[] = [];
    let yields = 0;

    const status = await syncLoadedSessionsInBatches(store, [session(1), session(2), session(3)], {
      batchSize: 1,
      onProgress: (nextStatus) => progress.push(nextStatus.indexed),
      yieldToEventLoop: async () => {
        yields++;
      },
    });

    expect(progress).toEqual([1, 2, 3]);
    expect(yields).toBe(3);
    expect(status).toMatchObject({ running: false, indexed: 3, total: 3, error: null });
    expect(store.searchSessions({ query: "Question", limit: 10 })).toHaveLength(3);
  });
});
