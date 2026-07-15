# Compact Skill Cards and Sync Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep remote Skill cards compact while fixing authenticated Supabase Storage health checks and showing SQL guidance only for database-setup failures.

**Architecture:** Add an explicit remediation field to session and Skill sync status results so renderer guidance does not infer recovery from raw error text. Route the remote-session bucket probe through the same authenticated headers as other Supabase requests. Render only the remote and local version chips in the compact remote Skill card; move state and source to the existing detail pane.

**Tech Stack:** TypeScript, Electron, React 19, Vitest, CSS, Supabase REST and Storage APIs.

## Global Constraints

- Do not connect to or modify the developer's real Supabase project, Skills, or sessions.
- Use synthetic `fetchImpl` responses for Supabase tests.
- Keep exactly one branch release note and update `.release-notes/stabilize-sync-experience.md`.
- Remote Skill card first rows do not wrap and retain `vN` plus `Local vN` when a local binding exists.
- Only missing tables, columns, buckets, or permissions repaired by the setup SQL expose SQL actions.

---

### Task 1: Authenticated Storage Health Check and Typed Remediation

**Files:**
- Modify: `src/core/remote-session-sync.ts`
- Modify: `src/core/remote-session-sync.test.ts`
- Modify: `src/core/skill-sync.ts`
- Modify: `src/core/skill-sync.test.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/skills-load.ts`
- Modify: `src/renderer/src/skills-load.test.ts`

**Interfaces:**
- Extends `RemoteSessionStatus` and `SkillSyncStatus` non-ready variants with `remediation: "settings" | "sql"`.
- `SupabaseRemoteSessionClient.checkStatus()` sends `apikey` and `Authorization: Bearer <key>` when retrieving bucket metadata.

- [ ] **Step 1: Write failing remote-session client tests**

Add a test whose synthetic `fetchImpl` returns an empty table response first and a bucket response second, then assert the second request headers contain `apikey: anon-key` and `authorization: Bearer anon-key`. Add assertions that missing table/schema/storage statuses use `remediation: "sql"` and a 401 response uses `remediation: "settings"`.

- [ ] **Step 2: Run the remote-session test and verify RED**

Run: `npx vitest run src/core/remote-session-sync.test.ts`

Expected: FAIL because the bucket probe has no authorization headers and statuses have no remediation field.

- [ ] **Step 3: Implement the authenticated probe and remediation values**

Use a private helper that merges these headers without overwriting request-specific headers:

```ts
headers: {
  apikey: this.anonKey,
  Authorization: `Bearer ${this.anonKey}`,
  ...(init.headers ?? {}),
}
```

Return `remediation: "sql"` for missing table, missing schema column, and missing storage; return `remediation: "settings"` for unconfigured or generic errors. Update the unconfigured and fallback status literals in main/renderer code and their fixtures so every non-ready status is explicit.

- [ ] **Step 4: Run the remote-session test and verify GREEN**

Run: `npx vitest run src/core/remote-session-sync.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Add failing Skill status remediation tests**

Extend the existing missing-table test to expect `remediation: "sql"`; add a 401 response test expecting `remediation: "settings"`.

- [ ] **Step 6: Run the Skill sync test and verify RED**

Run: `npx vitest run src/core/skill-sync.test.ts`

Expected: FAIL because Skill statuses have no remediation field.

- [ ] **Step 7: Implement Skill remediation values and verify GREEN**

Return the same `sql`/`settings` values as session sync, then run:

`npx vitest run src/core/skill-sync.test.ts src/core/remote-session-sync.test.ts`

Expected: both files pass.

- [ ] **Step 8: Commit Task 1**

```bash
git add src/core/remote-session-sync.ts src/core/remote-session-sync.test.ts src/core/skill-sync.ts src/core/skill-sync.test.ts src/main/index.ts src/renderer/src/App.tsx src/renderer/src/skills-load.ts src/renderer/src/skills-load.test.ts
git commit -m "fix: authenticate sync health checks"
```

### Task 2: Compact Remote Skill Cards and Correct Recovery Actions

**Files:**
- Modify: `src/renderer/src/components/skills-dialog.tsx`
- Modify: `src/renderer/src/components/remote-sessions-dialog.tsx`
- Modify: `src/renderer/src/components/supabase-setup-guide.tsx`
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/skills-dialog-actions.test.ts`
- Modify: `src/renderer/src/supabase-setup-guide.test.ts`

**Interfaces:**
- Adds `showSqlActions?: boolean` to `SupabaseSetupGuide`; it defaults to `true` for first-time setup panels.
- Remote Skill list rows use `.remote-skill-item-head` with one non-wrapping title/version row.

- [ ] **Step 1: Replace the old layout contract with a failing compact-card test**

Assert the remote card contains `.remote-skill-item-head`, uses `title={group.name}`, renders `v{group.latest.version}` and `Local v...` in that row, and does not render `SkillSyncStateBadge` or the source badge inside the row. Assert the CSS rule includes `display: flex` and `flex-wrap: nowrap`.

- [ ] **Step 2: Run the compact-card test and verify RED**

Run: `npx vitest run src/renderer/src/skills-dialog-actions.test.ts`

Expected: FAIL because remote cards still use a wrapping badge row.

- [ ] **Step 3: Implement the compact remote row**

Render checkbox, `<strong title={group.name}>`, latest version and optional local version in one row. Add the sync state and source badge to the selected remote Skill detail header, where the full name is already visible. Keep local Skill markup unchanged.

- [ ] **Step 4: Run the compact-card test and verify GREEN**

Run: `npx vitest run src/renderer/src/skills-dialog-actions.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Write failing recovery-guidance tests**

Assert `SupabaseSetupGuide` conditionally renders SQL buttons from `showSqlActions`, and both session and Skill panels pass `showSqlActions={status.remediation === "sql"}`. Assert settings-remediation copy tells users to check the Supabase URL and anon key.

- [ ] **Step 6: Run the guidance test and verify RED**

Run: `npx vitest run src/renderer/src/supabase-setup-guide.test.ts`

Expected: FAIL because all error panels currently show SQL actions and default SQL copy.

- [ ] **Step 7: Implement recovery-action filtering and verify GREEN**

Hide Copy/Open SQL buttons when `showSqlActions` is false, retain Refresh, and pass explicit configuration copy for `settings` remediation. Run:

`npx vitest run src/renderer/src/supabase-setup-guide.test.ts src/renderer/src/skills-dialog-actions.test.ts`

Expected: both files pass.

- [ ] **Step 8: Commit Task 2**

```bash
git add src/renderer/src/components/skills-dialog.tsx src/renderer/src/components/remote-sessions-dialog.tsx src/renderer/src/components/supabase-setup-guide.tsx src/renderer/src/styles.css src/renderer/src/skills-dialog-actions.test.ts src/renderer/src/supabase-setup-guide.test.ts
git commit -m "fix: clarify sync status and skill cards"
```

### Task 3: Release Note and Full Verification

**Files:**
- Modify: `.release-notes/stabilize-sync-experience.md`

- [ ] **Step 1: Update the existing user-facing fix bullet**

Replace the current Skill-name fix with:

```md
- 修复远程 Skill 的状态标签过多时名称显示不清，以及远程同步检查误报授权或错误引导执行 SQL 的问题。
```

- [ ] **Step 2: Run all verification commands**

```bash
git diff --check
npm run release-note:check
npm test
npm run typecheck
npm run build
```

Expected: release-note check passes; all Vitest and script tests pass; TypeScript and production build exit successfully.

- [ ] **Step 3: Commit the release note**

```bash
git add .release-notes/stabilize-sync-experience.md
git commit -m "docs: update sync fix notes"
```
