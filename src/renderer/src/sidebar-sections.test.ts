import { describe, expect, it } from "vitest";
import { readSidebarSections, serializeSidebarSections, toggleSidebarSection } from "./sidebar-sections";

describe("sidebar sections", () => {
  it("defaults all collapsible sections to expanded", () => {
    expect(readSidebarSections(null)).toEqual({
      environments: true,
      remaining: true,
      projects: true,
      sources: true,
      tags: true,
      views: true,
    });
  });

  it("reads persisted section state and fills missing values with defaults", () => {
    expect(readSidebarSections(JSON.stringify({ projects: false }))).toEqual({
      environments: true,
      remaining: true,
      projects: false,
      sources: true,
      tags: true,
      views: true,
    });
  });

  it("falls back to defaults for invalid persisted state", () => {
    expect(readSidebarSections("{not-json")).toEqual({
      environments: true,
      remaining: true,
      projects: true,
      sources: true,
      tags: true,
      views: true,
    });
  });

  it("toggles one section without mutating the other sections", () => {
    const next = toggleSidebarSection(
      { environments: true, remaining: true, projects: true, sources: true, tags: false, views: true },
      "tags",
    );

    expect(next).toEqual({ environments: true, remaining: true, projects: true, sources: true, tags: true, views: true });
    expect(JSON.parse(serializeSidebarSections(next))).toEqual(next);
  });
});
