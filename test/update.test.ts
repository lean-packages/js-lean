import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  collectReferencedSegments,
  computeMissingFiles,
  computeMissingNpmignore,
  updateProject,
} from "../src/lib/update.js";

describe("collectReferencedSegments", () => {
  it("extracts top-level segments from entry-point fields", () => {
    const segments = collectReferencedSegments({
      main: "./dist/index.js",
      types: "dist/index.d.ts",
      bin: { "my-cli": "bin/cli.js" },
      exports: { ".": { import: "./lib/index.js" } },
    });
    expect(segments.sort()).toEqual(["bin", "dist", "lib"]);
  });

  it("ignores bare current-directory references", () => {
    expect(collectReferencedSegments({ main: "." })).toEqual([]);
    expect(collectReferencedSegments({ main: "../sibling/index.js" })).toEqual(
      [],
    );
  });
});

describe("computeMissingFiles", () => {
  it("proposes runtime output present on disk but absent from files", () => {
    const missing = computeMissingFiles(
      { files: ["README.md"] },
      (s) => s === "dist",
    );
    expect(missing).toEqual(["dist"]);
  });

  it("does not propose entries already covered by files", () => {
    const missing = computeMissingFiles(
      { files: ["dist"] },
      (s) => s === "dist",
    );
    expect(missing).toEqual([]);
  });

  it("ignores candidates that do not exist on disk", () => {
    const missing = computeMissingFiles({ files: [] }, () => false);
    expect(missing).toEqual([]);
  });
});

describe("computeMissingNpmignore", () => {
  it("proposes artefacts present on disk but not yet ignored", () => {
    const missing = computeMissingNpmignore(
      "src\n",
      (e) => e === "src" || e === "coverage" || e === ".github",
    );
    expect(missing).toEqual(["coverage", ".github"]);
  });

  it("does not propose entries already listed", () => {
    const missing = computeMissingNpmignore("src\ncoverage\n", () => true);
    expect(missing).not.toContain("src");
    expect(missing).not.toContain("coverage");
  });
});

describe("updateProject", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "js-lean-update-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("complements files and .npmignore to reflect repository state", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["README.md"] }, null, 2) +
        "\n",
    );
    mkdirSync(join(dir, "dist"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "tsconfig.json"), "{}\n");
    writeFileSync(join(dir, ".npmignore"), "node_modules\n");

    const result = updateProject(dir);
    expect(result.changed).toBe(true);

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.files).toEqual(["README.md", "dist"]);

    const npmignore = readFileSync(join(dir, ".npmignore"), "utf8");
    expect(npmignore).toContain("node_modules");
    expect(npmignore).toContain("src");
    expect(npmignore).toContain("tsconfig.json");
    expect(npmignore.endsWith("\n")).toBe(true);
  });

  it("is a no-op when already up to date", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["dist"] }, null, 2) +
        "\n",
    );
    mkdirSync(join(dir, "dist"));

    const result = updateProject(dir);
    expect(result.changed).toBe(false);
    expect(result.changes).toEqual([]);
  });

  it("does not create a missing .npmignore", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["dist"] }, null, 2) +
        "\n",
    );
    mkdirSync(join(dir, "src"));

    const result = updateProject(dir);
    // files already covers dist; src only matters for .npmignore which is absent.
    expect(result.changed).toBe(false);
  });

  it("throws when package.json is missing", () => {
    expect(() => updateProject(dir)).toThrow();
  });

  it("does not propose mis-cased entries on case-insensitive filesystems", () => {
    // Regression: on case-insensitive filesystems (e.g. macOS) a naive
    // `existsSync` check matches a differently-cased name, which would cause
    // entries such as `src` to be proposed even though the repository only
    // contains `Src`. Existence must be verified against exact directory
    // entries instead.
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["README.md"] }, null, 2) +
        "\n",
    );
    // Directory with non-canonical casing; no canonical `src`/`dist` present.
    mkdirSync(join(dir, "Src"));
    // File with non-canonical casing for an artefact candidate.
    writeFileSync(join(dir, "TSConfig.json"), "{}\n");
    writeFileSync(join(dir, ".npmignore"), "node_modules\n");

    const result = updateProject(dir);

    // Nothing should be added: neither `src` nor `tsconfig.json` exist with
    // their canonical casing.
    expect(result.changed).toBe(false);

    const npmignore = readFileSync(join(dir, ".npmignore"), "utf8");
    expect(npmignore).toBe("node_modules\n");

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.files).toEqual(["README.md"]);
  });

  it("does not write any files in dry-run mode", () => {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", version: "1.0.0", files: ["README.md"] }, null, 2) +
        "\n",
    );
    mkdirSync(join(dir, "dist"));
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, ".npmignore"), "node_modules\n");

    const result = updateProject(dir, { dryRun: true });
    expect(result.changed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.changes.every((c) => /would/.test(c.message))).toBe(true);

    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(pkg.files).toEqual(["README.md"]);
    expect(readFileSync(join(dir, ".npmignore"), "utf8")).toBe("node_modules\n");
  });
});
