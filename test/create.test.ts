import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildNpmignore,
  createProject,
  DEFAULT_FILES,
  ensurePackageFiles,
} from "../src/lib/create.js";

describe("ensurePackageFiles", () => {
  it("adds default files when absent", () => {
    const { pkg, changed } = ensurePackageFiles({ name: "x" });
    expect(changed).toBe(true);
    expect(pkg.files).toEqual(DEFAULT_FILES);
  });

  it("leaves an existing files field untouched", () => {
    const { pkg, changed } = ensurePackageFiles({ files: ["lib"] });
    expect(changed).toBe(false);
    expect(pkg.files).toEqual(["lib"]);
  });
});

describe("buildNpmignore", () => {
  it("includes repository artefacts and ends with a newline", () => {
    const body = buildNpmignore();
    expect(body.endsWith("\n")).toBe(true);
    expect(body).toContain(".DS_Store");
    expect(body).toContain(".github");
    expect(body).toContain("src");
  });
});

describe("createProject", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "js-lean-create-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("adds files and creates .npmignore on a bare project", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0" }, null, 2) + "\n",
    );

    const result = createProject(dir);
    expect(result.changed).toBe(true);

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.files).toEqual(DEFAULT_FILES);
    expect(existsSync(join(dir, ".npmignore"))).toBe(true);
  });

  it("preserves an existing files field and existing .npmignore", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["lib"] }, null, 2) + "\n",
    );
    writeFileSync(join(dir, ".npmignore"), "custom\n");

    const result = createProject(dir);
    expect(result.changed).toBe(false);

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.files).toEqual(["lib"]);
    expect(readFileSync(join(dir, ".npmignore"), "utf8")).toBe("custom\n");
  });

  it("throws when package.json is missing", () => {
    expect(() => createProject(dir)).toThrow();
  });

  it("does not write any files in dry-run mode", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0" }, null, 2) + "\n",
    );

    const result = createProject(dir, { dryRun: true });
    expect(result.changed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.changes.every((c) => /would/.test(c.message))).toBe(true);

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.files).toBeUndefined();
    expect(existsSync(join(dir, ".npmignore"))).toBe(false);
  });
});
