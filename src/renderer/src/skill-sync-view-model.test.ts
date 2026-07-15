import { describe, expect, it } from "vitest";
import type { InstalledSkill, InstalledSkillsSnapshot } from "../../core/skill-manager";
import type { RemoteSkillGroup, SkillSyncSnapshot } from "../../core/skill-sync";
import { buildUnifiedSkillEntries } from "./skill-sync-view-model";

function local(overrides: Partial<InstalledSkill> = {}): InstalledSkill {
  return {
    id: "local-review",
    name: "review",
    description: "Review code",
    agent: "codex",
    source: "codex-user",
    path: "/home/.codex/skills/review/SKILL.md",
    directoryPath: "/home/.codex/skills/review",
    rootPath: "/home/.codex/skills",
    markdown: "# Review",
    mtimeMs: 10,
    ...overrides,
  };
}

function remote(overrides: Partial<RemoteSkillGroup> = {}): RemoteSkillGroup {
  const version = {
    id: "remote-review-v1",
    name: "review",
    description: "Review code",
    agent: "codex" as const,
    source: "codex-user" as const,
    localFingerprint: "fp-review",
    contentHash: "hash",
    uploadedFromPath: "",
    portableScope: "codex-user" as const,
    relativePath: "review",
    identityVersion: 2,
    legacy: false,
    version: 1,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
  return {
    fingerprint: "fp-review",
    agent: "codex",
    name: "review",
    description: "Review code",
    source: "codex-user",
    portableScope: "codex-user",
    relativePath: "review",
    legacy: false,
    latest: version,
    versions: [version],
    ...overrides,
  };
}

function snapshot(skills: InstalledSkill[], remoteSkillGroups: RemoteSkillGroup[], relations: NonNullable<SkillSyncSnapshot["relations"]>, ready = true): { installed: InstalledSkillsSnapshot; sync: SkillSyncSnapshot } {
  return {
    installed: { skills, roots: [], scannedAt: 1 },
    sync: {
      status: ready
        ? { kind: "ready", setupSql: "sql" }
        : { kind: "unconfigured", setupSql: "sql", message: "Configure", remediation: "settings" },
      remoteSkillGroups,
      bindings: [],
      relations,
      scannedAt: 1,
    },
  };
}

describe("unified Skill sync entries", () => {
  it("merges local and remote only through the recorded portable relation", () => {
    const data = snapshot([local()], [remote()], [{
      identity: "codex-user/review",
      localSkillPath: "/home/.codex/skills/review/SKILL.md",
      localContentHash: "hash",
      remoteFingerprint: "fp-review",
      remoteLatestId: "remote-review-v1",
      remoteContentHash: "hash",
      state: "synced",
    }]);

    const entries = buildUnifiedSkillEntries(data.installed, data.sync);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ identity: "codex-user/review", name: "review", state: "synced", syncable: true });
    expect(entries[0].local?.id).toBe("local-review");
    expect(entries[0].remote?.fingerprint).toBe("fp-review");
  });

  it("keeps local-only, remote-only, and same-name different identities separate", () => {
    const localOne = local();
    const localTwo = local({ id: "shared-review", source: "codex-shared", rootPath: "/home/.agents/skills", directoryPath: "/home/.agents/skills/review-local", path: "/home/.agents/skills/review-local/SKILL.md" });
    const remoteOnly = remote({ fingerprint: "fp-remote", portableScope: "shared", relativePath: "review", latest: { ...remote().latest, id: "remote-shared", localFingerprint: "fp-remote", portableScope: "shared" }, versions: [{ ...remote().latest, id: "remote-shared", localFingerprint: "fp-remote", portableScope: "shared" }] });
    const data = snapshot([localOne, localTwo], [remoteOnly], [
      { identity: "codex-user/review", localSkillPath: localOne.path, localContentHash: "local", remoteFingerprint: null, remoteLatestId: null, remoteContentHash: "", state: "local-only" },
      { identity: "shared/review", localSkillPath: null, localContentHash: "", remoteFingerprint: "fp-remote", remoteLatestId: "remote-shared", remoteContentHash: "remote", state: "remote-only" },
    ]);

    const entries = buildUnifiedSkillEntries(data.installed, data.sync);

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.identity)).toEqual(expect.arrayContaining(["codex-user/review", "shared/review"]));
    expect(entries.filter((entry) => entry.name === "review")).toHaveLength(3);
  });

  it("keeps managed and legacy records isolated from automatic cloud actions", () => {
    const plugin = local({ id: "plugin", source: "claude-plugin", agent: "claude", path: "/plugin/access/SKILL.md", directoryPath: "/plugin/access", rootPath: "/plugin", name: "access" });
    const legacy = remote({ fingerprint: "legacy-fp", legacy: true, portableScope: null, relativePath: "", latest: { ...remote().latest, id: "legacy", localFingerprint: "legacy-fp", legacy: true, portableScope: null, relativePath: "" }, versions: [{ ...remote().latest, id: "legacy", localFingerprint: "legacy-fp", legacy: true, portableScope: null, relativePath: "" }] });
    const data = snapshot([plugin], [legacy], [{ identity: "legacy:legacy-fp", localSkillPath: null, localContentHash: "", remoteFingerprint: "legacy-fp", remoteLatestId: "legacy", remoteContentHash: "hash", state: "legacy" }]);

    const entries = buildUnifiedSkillEntries(data.installed, data.sync);

    expect(entries.find((entry) => entry.local?.id === "plugin")).toMatchObject({ syncable: false, state: null });
    expect(entries.find((entry) => entry.remote?.fingerprint === "legacy-fp")).toMatchObject({ syncable: false, state: "legacy" });
  });

  it("still lists local Skills when Supabase is not configured", () => {
    const data = snapshot([local()], [], [], false);
    expect(buildUnifiedSkillEntries(data.installed, data.sync)).toMatchObject([
      { local: { id: "local-review" }, remote: null, state: null, syncable: true },
    ]);
  });
});
