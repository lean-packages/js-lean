import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type CreateChange = {
  /** The file that was created or modified. */
  target: string;
  /** Human-readable description of what happened. */
  message: string;
};

export type CreateResult = {
  changes: CreateChange[];
  /** True when at least one file was created or modified. */
  changed: boolean;
  /** True when no files were written because `dryRun` was requested. */
  dryRun: boolean;
};

export type CreateOptions = {
  /** Preview changes without writing any files. */
  dryRun?: boolean;
};

type PackageJsonLike = {
  files?: unknown;
  [key: string]: unknown;
};

/**
 * Sane defaults for the `files` allowlist: ship only the built output.
 */
export const DEFAULT_FILES: string[] = ["dist"];

/**
 * Unnecessary dotfiles and repository artefacts that should not end up in the
 * published release artefact. Used to populate a fresh `.npmignore`.
 */
export const DEFAULT_NPMIGNORE_ENTRIES: string[] = [
  "# Sources & build tooling",
  "src",
  "test",
  "tsconfig.json",
  "tsup.config.ts",
  "vitest.config.ts",
  "eslint.config.js",
  "",
  "# Coverage & caches",
  "coverage",
  ".nyc_output",
  "",
  "# Editor & OS artefacts",
  ".vscode",
  ".idea",
  ".DS_Store",
  "Thumbs.db",
  "",
  "# Repository & CI artefacts",
  ".github",
  ".editorconfig",
  ".nvmrc",
  ".prettierrc",
  ".prettierignore",
  "",
  "# Logs & environment",
  "*.log",
  ".env",
  ".env.*",
];

/**
 * Ensure the `files` field exists with sane defaults. Returns the possibly
 * updated package object and whether a change was made. An existing `files`
 * field is left untouched.
 */
export function ensurePackageFiles(pkg: PackageJsonLike): {
  pkg: PackageJsonLike;
  changed: boolean;
} {
  if (pkg.files !== undefined) {
    return { pkg, changed: false };
  }

  return { pkg: { ...pkg, files: [...DEFAULT_FILES] }, changed: true };
}

/**
 * Build the body of a populated `.npmignore` file.
 */
export function buildNpmignore(): string {
  return `${DEFAULT_NPMIGNORE_ENTRIES.join("\n")}\n`;
}

/**
 * Scaffold publishing hygiene into a project directory:
 *  a) add a default `files` allowlist to package.json when absent, and
 *  b) create a populated `.npmignore` when absent.
 */
export function createProject(
  cwd: string = process.cwd(),
  options: CreateOptions = {},
): CreateResult {
  const dryRun = options.dryRun ?? false;
  const changes: CreateChange[] = [];

  const pkgPath = join(cwd, "package.json");
  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf8");
  } catch {
    throw new Error("could not read package.json");
  }

  let pkg: PackageJsonLike;
  try {
    pkg = JSON.parse(raw) as PackageJsonLike;
  } catch {
    throw new Error("could not parse package.json");
  }

  const { pkg: nextPkg, changed } = ensurePackageFiles(pkg);
  if (changed) {
    if (!dryRun) {
      const indent = detectIndent(raw);
      const trailingNewline = raw.endsWith("\n") ? "\n" : "";
      writeFileSync(
        pkgPath,
        JSON.stringify(nextPkg, null, indent) + trailingNewline,
        "utf8",
      );
    }
    changes.push({
      target: "package.json",
      message: `${dryRun ? "would add" : "added"} default \`files\` allowlist: ${DEFAULT_FILES.join(", ")}`,
    });
  }

  const npmignorePath = join(cwd, ".npmignore");
  if (existsSync(npmignorePath)) {
    changes.push({
      target: ".npmignore",
      message: "already exists, left untouched",
    });
  } else {
    if (!dryRun) {
      writeFileSync(npmignorePath, buildNpmignore(), "utf8");
    }
    changes.push({
      target: ".npmignore",
      message: `${dryRun ? "would create" : "created"} with default dotfile & repository artefact excludes`,
    });
  }

  return {
    changes,
    changed: changes.some((c) => !c.message.includes("untouched")),
    dryRun,
  };
}

/**
 * Detect the indentation (spaces or a tab) used by an existing JSON document,
 * defaulting to two spaces.
 */
function detectIndent(raw: string): string | number {
  const match = raw.match(/^[^\n]*\n([ \t]+)/);
  const indent = match?.[1];
  if (!indent) return 2;
  return indent.includes("\t") ? "\t" : indent.length;
}
