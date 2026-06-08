import { describe, expect, it, vi } from "vitest";

async function loadHelper() {
  vi.resetModules();
  vi.stubGlobal("window", { sessionSearch: { platform: "darwin" } });
  const module = await import("./App");
  return module;
}

describe("resolveSearchScope", () => {
  it("marks explicit environment and another environment's selected project as incompatible", async () => {
    const { resolveSearchScope } = await loadHelper();

    expect(resolveSearchScope("ssh-b", "/work/app", "ssh-a")).toEqual({
      environmentId: "ssh-b",
      projectPath: "/work/app",
      projectEnvironmentConflict: true,
    });
  });

  it("keeps all-environment project filters scoped to the selected project environment", async () => {
    const { resolveSearchScope } = await loadHelper();

    expect(resolveSearchScope("all", "/work/app", "ssh-a")).toEqual({
      environmentId: "ssh-a",
      projectPath: "/work/app",
      projectEnvironmentConflict: false,
    });
  });
});

describe("existingSshHostAliases", () => {
  it("returns only actual aliases already represented by SSH environments", async () => {
    const { existingSshHostAliases } = await loadHelper();

    expect(
      existingSshHostAliases([
        { kind: "local", label: "Local", hostAlias: null },
        { kind: "ssh", label: "devbox", hostAlias: "devbox" },
        { kind: "ssh", label: "prod", hostAlias: null },
        { kind: "ssh", label: "local", hostAlias: null },
      ]),
    ).toEqual(new Set(["devbox"]));
  });
});
