import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findStrayFiles,
  lintNpmignore,
  lintPackageFiles,
  lintProject,
  parseNpmignore,
} from "../src/lib/lint.js";

describe("lintPackageFiles", () => {
  it("accepts a runtime-only files allowlist", () => {
    const issues = lintPackageFiles({ files: ["dist"] });
    expect(issues).toHaveLength(0);
  });

  it("flags source, test and config entries as non-runtime", () => {
    const issues = lintPackageFiles({
      files: [
        "dist",
        "src",
        "test",
        "tsconfig.json",
        "tsup.config.ts",
        "foo.test.ts",
      ],
    });
    const entries = issues.map((i) => i.entry);
    expect(entries).toEqual([
      "src",
      "test",
      "tsconfig.json",
      "tsup.config.ts",
      "foo.test.ts",
    ]);
    expect(issues.every((i) => i.severity === "error")).toBe(true);
  });

  it("normalizes leading ./ and trailing slashes", () => {
    const issues = lintPackageFiles({ files: ["./src/", "./dist/"] });
    expect(issues).toHaveLength(1);
    expect(issues[0].entry).toBe("./src/");
  });

  it("warns when the files field is missing", () => {
    const issues = lintPackageFiles({});
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("errors when files is not an array", () => {
    const issues = lintPackageFiles({ files: "dist" });
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });
});

describe("parseNpmignore", () => {
  it("drops blank lines and comments", () => {
    const entries = parseNpmignore("# comment\n\nsrc\n  test  \n");
    expect(entries).toEqual(["src", "test"]);
  });
});

describe("lintNpmignore", () => {
  it("flags only entries npm already ignores by default", () => {
    const content = [
      "node_modules",
      ".git",
      ".gitignore",
      ".npmignore",
      ".DS_Store",
      ".svn",
      "src",
    ].join("\n");
    const issues = lintNpmignore(content);
    const entries = issues.map((i) => i.entry);
    expect(entries).toEqual([
      "node_modules",
      ".git",
      ".gitignore",
      ".npmignore",
      ".DS_Store",
      ".svn",
    ]);
    expect(issues.every((i) => i.severity === "warning")).toBe(true);
  });

  it("does not flag entries npm does not ignore by default", () => {
    const issues = lintNpmignore(
      ".editorconfig\n.github/\n.vscode\n.nvmrc\n",
    );
    expect(issues).toHaveLength(0);
  });

  it("does not flag legitimate runtime excludes", () => {
    const issues = lintNpmignore("src\ntest\n*.map\n");
    expect(issues).toHaveLength(0);
  });
});

describe("findStrayFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "js-lean-stray-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("flags a root file not covered by files nor .npmignore", () => {
    writeFileSync(join(dir, "FOO.md"), "stray");
    const issues = findStrayFiles(dir, { files: ["dist", "README.md"] }, []);
    expect(issues).toHaveLength(1);
    expect(issues[0].entry).toBe("FOO.md");
    expect(issues[0].severity).toBe("error");
  });

  it("does not flag files listed in the allowlist", () => {
    writeFileSync(join(dir, "FOO.md"), "kept");
    const issues = findStrayFiles(dir, { files: ["FOO.md"] }, []);
    expect(issues).toHaveLength(0);
  });

  it("does not flag files excluded via .npmignore (incl. globs)", () => {
    writeFileSync(join(dir, "FOO.md"), "ignored");
    writeFileSync(join(dir, "notes.txt"), "ignored");
    const issues = findStrayFiles(dir, { files: ["dist"] }, ["FOO.md", "*.txt"]);
    expect(issues).toHaveLength(0);
  });

  it("never flags always-published, lockfiles or dotfiles", () => {
    for (const name of [
      "README.md",
      "LICENSE.md",
      "CHANGELOG.md",
      "package-lock.json",
      ".editorconfig",
    ]) {
      writeFileSync(join(dir, name), "x");
    }
    const issues = findStrayFiles(dir, { files: ["dist"] }, []);
    expect(issues).toHaveLength(0);
  });

  it("does nothing when there is no files allowlist", () => {
    writeFileSync(join(dir, "FOO.md"), "stray");
    expect(findStrayFiles(dir, {}, [])).toHaveLength(0);
  });
});

describe("lintProject", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "js-lean-lint-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("flags stray files when the check is enabled", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["dist"] }),
    );
    writeFileSync(join(dir, "FOO.md"), "stray");

    const result = lintProject(dir, { checkStrays: true });
    expect(result.issues.some((i) => i.entry === "FOO.md")).toBe(true);
    // Enforced strays are errors, so the lint fails.
    expect(result.ok).toBe(false);
  });

  it("does not flag stray files when the check is disabled", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["dist"] }),
    );
    writeFileSync(join(dir, "FOO.md"), "stray");

    const result = lintProject(dir);
    expect(result.issues.some((i) => i.entry === "FOO.md")).toBe(false);
  });

  it("reports ok for a clean package", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["dist"] }),
    );
    const result = lintProject(dir);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("aggregates package.json and .npmignore issues", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["dist", "src"] }),
    );
    writeFileSync(join(dir, ".npmignore"), "node_modules\n.git\n");

    const result = lintProject(dir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.source === "package.json")).toBe(true);
    expect(result.issues.some((i) => i.source === ".npmignore")).toBe(true);
  });

  it("errors when package.json is missing", () => {
    const result = lintProject(dir);
    expect(result.ok).toBe(false);
    expect(result.issues[0].source).toBe("package.json");
  });
});
