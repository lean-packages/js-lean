import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type UpdateChange = {
  /** The file that was created or modified. */
  target: string;
  /** Human-readable description of what happened. */
  message: string;
};

export type UpdateResult = {
  changes: UpdateChange[];
  /** True when at least one file was modified. */
  changed: boolean;
  /** True when no files were written because `dryRun` was requested. */
  dryRun: boolean;
};

export type UpdateOptions = {
  /** Preview changes without writing any files. */
  dryRun?: boolean;
};

type PackageJsonLike = {
  files?: unknown;
  main?: unknown;
  module?: unknown;
  types?: unknown;
  typings?: unknown;
  bin?: unknown;
  exports?: unknown;
  [key: string]: unknown;
};

/**
 * Directories that commonly hold the built, runtime output of a package and
 * therefore belong in the `files` allowlist when present in the repository.
 */
export const RUNTIME_DIR_CANDIDATES: string[] = [
  "dist",
  "build",
  "lib",
  "out",
  "esm",
  "cjs",
  "types",
];

/**
 * Dotfiles, source, tooling and repository artefacts that should be excluded
 * from the published tarball. Used to complement an existing `.npmignore`
 * with entries that actually exist in the repository.
 */
export const ARTEFACT_CANDIDATES: string[] = [
  "src",
  "test",
  "tests",
  "__tests__",
  "coverage",
  ".nyc_output",
  "tsconfig.json",
  "tsup.config.ts",
  "vitest.config.ts",
  "eslint.config.js",
  ".github",
  ".vscode",
  ".idea",
  ".editorconfig",
  ".prettierrc",
  ".prettierignore",
  ".DS_Store",
];

function normalizeEntry(entry: string): string {
  return entry
    .trim()
    .replace(/^\.\//, "")
    .replace(/\/\*+$/, "")
    .replace(/\/+$/, "");
}

function topLevelSegment(entry: string): string {
  return normalizeEntry(entry).split("/")[0] ?? "";
}

/**
 * Collect the top-level path segments referenced by package.json entry-point
 * fields (`main`, `module`, `types`, `typings`, `bin`, `exports`). These point
 * at the runtime output of the package.
 */
export function collectReferencedSegments(pkg: PackageJsonLike): string[] {
  const segments = new Set<string>();

  const addPath = (value: unknown): void => {
    if (typeof value !== "string" || value.length === 0) return;
    const segment = topLevelSegment(value);
    if (segment && segment !== "." && !segment.startsWith("..")) {
      segments.add(segment);
    }
  };

  addPath(pkg.main);
  addPath(pkg.module);
  addPath(pkg.types);
  addPath(pkg.typings);

  const collect = (value: unknown): void => {
    if (typeof value === "string") {
      addPath(value);
    } else if (Array.isArray(value)) {
      for (const item of value) collect(item);
    } else if (value && typeof value === "object") {
      for (const item of Object.values(value)) collect(item);
    }
  };

  collect(pkg.bin);
  collect(pkg.exports);

  return [...segments];
}

/**
 * Compute which runtime entries are missing from the package.json `files`
 * field given the repository state. An entry is proposed when it exists on
 * disk (as a runtime directory or an entry-point target) but is not already
 * covered by an existing `files` entry. Existing entries are never removed.
 */
export function computeMissingFiles(
  pkg: PackageJsonLike,
  existsOnDisk: (segment: string) => boolean,
): string[] {
  const existing = new Set<string>(
    (Array.isArray(pkg.files) ? pkg.files : [])
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => topLevelSegment(entry))
      .filter((segment) => segment.length > 0),
  );

  const candidates = new Set<string>([
    ...RUNTIME_DIR_CANDIDATES,
    ...collectReferencedSegments(pkg),
  ]);

  const missing: string[] = [];
  for (const candidate of candidates) {
    if (existing.has(candidate)) continue;
    if (!existsOnDisk(candidate)) continue;
    if (missing.includes(candidate)) continue;
    missing.push(candidate);
  }

  return missing;
}

/**
 * Parse an `.npmignore` body into meaningful, non-comment entries.
 */
export function parseNpmignore(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Compute which artefact entries are missing from an existing `.npmignore`
 * given the repository state. An entry is proposed when it exists on disk but
 * is not already listed. Existing entries are never removed.
 */
export function computeMissingNpmignore(
  content: string,
  existsOnDisk: (entry: string) => boolean,
): string[] {
  const existing = new Set<string>(
    parseNpmignore(content).map((entry) => normalizeEntry(entry.replace(/^!/, ""))),
  );

  const missing: string[] = [];
  for (const candidate of ARTEFACT_CANDIDATES) {
    if (existing.has(normalizeEntry(candidate))) continue;
    if (!existsOnDisk(candidate)) continue;
    missing.push(candidate);
  }

  return missing;
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

/**
 * Non-destructively update a project to reflect its repository state:
 *  a) complement the package.json `files` allowlist with runtime output that
 *     exists on disk, and
 *  b) complement an existing `.npmignore` with dotfiles and repository
 *     artefacts that exist on disk.
 *
 * Existing entries are preserved; nothing is ever removed, and a missing
 * `.npmignore` is left for the `create` command to scaffold.
 */
export function updateProject(
  cwd: string = process.cwd(),
  options: UpdateOptions = {},
): UpdateResult {
  const dryRun = options.dryRun ?? false;
  const changes: UpdateChange[] = [];

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

  // Read the directory entries once so existence checks match the exact
  // filename casing. `existsSync` is case-insensitive on case-insensitive
  // filesystems (e.g. macOS), which would otherwise cause mis-cased entries
  // (e.g. `src` when the repository actually contains `Src`) to be proposed.
  let entries: Set<string>;
  try {
    entries = new Set(readdirSync(cwd));
  } catch {
    entries = new Set<string>();
  }

  const existsDir = (segment: string): boolean => {
    if (!entries.has(segment)) return false;
    try {
      return statSync(join(cwd, segment)).isDirectory();
    } catch {
      return false;
    }
  };

  const missingFiles = computeMissingFiles(pkg, existsDir);
  if (missingFiles.length > 0) {
    const current = Array.isArray(pkg.files)
      ? pkg.files.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (!dryRun) {
      const nextPkg = { ...pkg, files: [...current, ...missingFiles] };
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
      message: `${dryRun ? "would add" : "added"} runtime \`files\` entries: ${missingFiles.join(", ")}`,
    });
  }

  const npmignorePath = join(cwd, ".npmignore");
  if (existsSync(npmignorePath)) {
    const content = readFileSync(npmignorePath, "utf8");
    const existsEntry = (entry: string): boolean => entries.has(entry);
    const missing = computeMissingNpmignore(content, existsEntry);
    if (missing.length > 0) {
      if (!dryRun) {
        const needsNewline = content.length > 0 && !content.endsWith("\n");
        const appended =
          (needsNewline ? "\n" : "") + missing.join("\n") + "\n";
        writeFileSync(npmignorePath, content + appended, "utf8");
      }
      changes.push({
        target: ".npmignore",
        message: `${dryRun ? "would add" : "added"} artefact excludes: ${missing.join(", ")}`,
      });
    }
  }

  return { changes, changed: changes.length > 0, dryRun };
}
