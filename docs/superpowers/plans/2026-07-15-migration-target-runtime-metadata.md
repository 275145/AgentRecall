# Migration Target Runtime Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make migrated Codex and Claude-family sessions persist the provider/model selected by the concrete target CLI configuration, with safe target-specific defaults.

**Architecture:** Add a focused runtime-metadata resolver that reads the target home configuration without exposing credentials. Resolve metadata once before serialization, then pass the same value into native serialization and validation so the final JSONL cannot silently diverge.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Vitest, existing JSONL migration writer.

---

### Task 1: Add target runtime metadata resolution

**Files:**
- Create: `src/core/migration-target-runtime.ts`
- Test: `src/core/session-migration-writers.test.ts`

- [x] **Step 1: Write failing Codex configuration tests**

Add parameterized writer tests that create `.codex/config.toml`, `.tcodex/config.toml`, and `.codex-internal/config.toml` with a root `model_provider`, migrate a session, and assert that the first JSONL row contains the configured value. Add cases proving the selected profile overrides the root value, an unselected profile is ignored, and a malformed value uses the target default.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/core/session-migration-writers.test.ts`

Expected: configured-provider assertions fail because the writer still emits `openai`, `tencent`, or `codebuddy` from the hard-coded mapping.

- [x] **Step 3: Implement the resolver**

Create `loadMigrationTargetRuntimeMetadata(target, targetHome)` returning:

```ts
export interface MigrationTargetRuntimeMetadata {
  codexModelProvider?: string;
  claudeModel?: string;
}
```

For Codex family, read the root-level `model_provider` from `config.toml`, apply the provider from a root-selected profile when present, and fall back to `openai` for `codex`/`codex-internal` or `tencent` for `tcodex`. Use a minimal parser that accepts quoted non-empty string values and ignores unselected TOML tables.

- [x] **Step 4: Integrate resolver into the writer**

In `writeMigratedSession`, compute `targetHome` from `homeDir` and the target root, await the resolver, and pass the result to `serializeSession`. Remove `codexModelProvider(target)` from the writer.

- [x] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run src/core/session-migration-writers.test.ts`

Expected: all writer tests pass with Codex Internal defaulting to `openai`.

### Task 2: Follow Claude target model configuration

**Files:**
- Modify: `src/core/migration-target-runtime.ts`
- Modify: `src/core/session-migration-writers.ts`
- Test: `src/core/session-migration-writers.test.ts`

- [x] **Step 1: Write failing Claude configuration tests**

For `claude`, `tclaude`, and `claude-internal`, create the concrete target `settings.json` with `env.ANTHROPIC_MODEL` and assert every migrated assistant row uses it. Add tests for top-level `model`, environment precedence, malformed JSON, and absent configuration falling back to `session-migration`.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/core/session-migration-writers.test.ts`

Expected: configured model assertions fail because assistant rows still contain `session-migration`.

- [x] **Step 3: Implement Claude model resolution and serialization**

Extend the resolver to parse `settings.json` as an object and select `env.ANTHROPIC_MODEL`, then root `model`, then `session-migration`. Pass `claudeModel` into `serializeClaude` and use it for assistant message `model`.

- [x] **Step 4: Strengthen native validation**

Pass runtime metadata into `validateNativeStructure`. Require Codex `payload.model_provider` to equal `codexModelProvider`, and require each Claude assistant `message.model` to equal `claudeModel`.

- [x] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run src/core/session-migration-writers.test.ts`

Expected: all provider/model, atomic-write, tampering, and round-trip tests pass.

### Task 3: Release note and complete verification

**Files:**
- Create: `.release-notes/fix-migration-target-runtime-metadata.md`

- [x] **Step 1: Add user-facing release copy**

Document that migrated Codex and Claude-compatible sessions now follow the selected target Agent configuration and avoid Resume failures caused by mismatched provider/model metadata.

- [x] **Step 2: Run type and release checks**

Run: `npm run typecheck && npm run release-note:check && git diff --check`

Expected: exit code 0 for every command.

- [x] **Step 3: Run the full test suite**

Run: `npm test`

Expected: all Vitest and script tests pass with zero failures.

- [x] **Step 4: Run the production build**

Run: `npm run build`

Expected: Electron main, preload, renderer, and MCP bundles build successfully.

- [x] **Step 5: Review the final diff**

Run: `git status --short && git diff --stat && git diff -- src/core/migration-target-runtime.ts src/core/session-migration-writers.ts src/core/session-migration-writers.test.ts .release-notes/fix-migration-target-runtime-metadata.md`

Expected: only the scoped implementation, tests, design/plan, and one release note are changed.
