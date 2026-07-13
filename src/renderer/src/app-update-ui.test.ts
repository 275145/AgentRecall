import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("application update UI", () => {
  it("shows an update indicator and a dedicated About settings section", () => {
    expect(appSource).toContain('activeSection === "about"');
    expect(appSource).toContain('className="update-release-card"');
    expect(appSource).toContain('className="update-primary-button"');
    expect(appSource).toContain('className="update-indicator"');
    expect(appSource).toContain('className="update-brand-mark"');
    expect(appSource).toContain('className="update-state-copy"');
    expect(appSource).toContain("appUpdateStatus.manifest.notes.features");
    expect(appSource).toContain("appUpdateStatus.manifest.notes.fixes");
  });

  it("keeps the About page readable and scrolls long release notes", () => {
    const card = stylesheet.match(/\.update-release-card\s*\{[^}]*\}/)?.[0] ?? "";
    expect(card).toMatch(/max-height:\s*250px/);
    expect(card).toMatch(/overflow-y:\s*auto/);
  });
});
