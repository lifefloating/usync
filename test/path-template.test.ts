import path from "node:path";
import { describe, expect, test } from "vitest";
import { resolveTemplatePath, templatePathToPortablePath, toTemplatePath } from "../src/path-template.js";

describe("path template", () => {
  test("maps project paths to $PROJECT token", () => {
    const project = "/tmp/work/project";
    const absolute = "/tmp/work/project/.opencode/skills/a/SKILL.md";
    expect(toTemplatePath(absolute, project)).toBe("$PROJECT/.opencode/skills/a/SKILL.md");
  });

  test("resolves project token back", () => {
    const project = "/tmp/work/project";
    expect(resolveTemplatePath("$PROJECT/.codex/settings.json", project)).toBe(
      path.resolve("/tmp/work/project/.codex/settings.json"),
    );
  });

  test("portable path keeps bucket prefixes", () => {
    expect(templatePathToPortablePath("$HOME/.claude/settings.json")).toBe("home/.claude/settings.json");
    expect(templatePathToPortablePath("$PROJECT/.gemini/settings.json")).toBe("project/.gemini/settings.json");
  });
});
