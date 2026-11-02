import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type LintSeverity = "error" | "warning";

export type LintIssue = {
  severity: LintSeverity;
  /** Where the issue was found, e.g. "package.json" or ".npmignore". */
  source: string;
  /** The offending entry, when applicable. */
  entry?: string;
  message: string;
};

export type LintResult = {
  issues: LintIssue[];
  /** True when no `error`-severity issues were found. */
  ok: boolean;
};

type PackageJsonLike = {
  files?: unknown;
};

/**
 * Patterns for entries that are typically *not* required at runtime and
 * therefore should not be shipped via the `files` field of package.json.
 * Each matcher receives a normalized (trimmed, no leading `./`) entry.
 */
const NON_RUNTIME_FILE_MATCHERS: Array<{ test: RegExp; reason: string }> = [
  { test: /^src(\/|$)/i, reason: "source directory (ship the built output instead)" },
  { test: /^tests?(\/|$)/i, reason: "test directory" },
  { test: /^__tests__(\/|$)/i, reason: "test directory" },
  { test: /^(coverage|\.nyc_output)(\/|$)/i, reason: "coverage output" },
  { test: /^node_modules(\/|$)/i, reason: "installed dependencies" },
  { test: /^\.github(\/|$)/i, reason: "repository CI configuration" },
  { test: /^\.(vscode|idea)(\/|$)/i, reason: "editor configuration" },
  { test: /\.(test|spec)\.[cm]?[jt]sx?$/i, reason: "test file" },
  { test: /^(tsconfig|jsconfig)(\..+)?\.json$/i, reason: "TypeScript/JS config" },
  { test: /^(tsup|vite|vitest|jest|rollup|webpack|esbuild)\.config\.[cm]?[jt]s$/i, reason: "build/test config" },
  { test: /^eslint\.config\.[cm]?[jt]s$/i, reason: "lint config" },
  { test: /^\.eslintrc(\..+)?$/i, reason: "lint config" },
  { test: /^(\.prettierrc.*|prettier\.config\.[cm]?[jt]s)$/i, reason: "formatter config" },
  { test: /^\.(editorconfig|nvmrc|gitignore|npmignore|npmrc)$/i, reason: "dotfile" },
  { test: /^\.env(\..+)?$/i, reason: "environment file" },
];

/**
 * Entries that npm *always* excludes from published tarballs by default,
 * so listing them in an `.npmignore` is unnecessary noise.
 *
 * Note: only entries that npm ignores unconditionally belong here. Files such
 * as `.editorconfig`, `.github/`, `.vscode/` or `.nvmrc` are NOT ignored by
 * npm by default and must be excluded explicitly (via `.npmignore` or a
 * `files` allowlist), so they must not be flagged as unnecessary.
 */
const UNNECESSARY_NPMIGNORE_MATCHERS: Array<{ test: RegExp; reason: string }> = [
  { test: /^\.git(\/|$)/i, reason: "always ignored by npm" },
  { test: /^\.gitignore$/i, reason: "always ignored by npm" },
  { test: /^\.npmignore$/i, reason: "always ignored by npm" },
  { test: /^node_modules(\/|$)/i, reason: "always ignored by npm" },
  { test: /^(npm-debug\.log.*|yarn-error\.log.*|\.pnpm-debug\.log.*)$/i, reason: "always ignored by npm" },
  { test: /^\.npmrc$/i, reason: "always ignored by npm" },
  { test: /^\.ds_store$/i, reason: "always ignored by npm" },
  { test: /^(\.svn|\.hg|cvs)(\/|$)/i, reason: "always ignored by npm" },
];

function normalizeEntry(entry: string): string {
  return entry.trim().replace(/^\.\//, "").replace(/\/+$/, "");
}

/**
 * Root-level files npm *always* publishes regardless of the `files` allowlist,
 * so they are never considered stray.
 */
const ALWAYS_PUBLISHED = /^(package\.json|readme(\..+)?|licen[sc]e(\..+)?|changelog(\..+)?)$/i;

/**
 * Root-level files npm *never* publishes regardless of configuration, so they
 * are never considered stray either.
 */
const NEVER_PUBLISHED =
  /^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/i;

/**
 * Minimal glob matcher supporting `*` and `?` within a single path segment.
 * Falls back to an exact (case-insensitive) comparison when no wildcard is used.
 */
function matchesGlob(name: string, pattern: string): boolean {
  if (pattern.toLowerCase() === name.toLowerCase()) return true;
  if (!/[*?]/.test(pattern)) return false;
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
    "i",
  );
  return re.test(name);
}

/**
 * Detect top-level files that would be neither published via the `package.json`
 * `files` allowlist nor explicitly excluded via `.npmignore` — "stray" files
 * whose publishing status is left unaccounted for. Each such file should either
 * be added to `files` (to publish it) or to `.npmignore` (to exclude it).
 *
 * This check is opt-in (enabled via `--enforce-no-strays`); any stray found is
 * reported as an `error`, failing the lint.
 *
 * The check targets the `files` allowlist flow; when no allowlist is present
 * there is nothing to compare against, so no strays are reported.
 */
export function findStrayFiles(
  cwd: string,
  pkg: PackageJsonLike,
  npmignoreEntries: string[],
): LintIssue[] {
  const issues: LintIssue[] = [];

  if (!Array.isArray(pkg.files)) return issues;

  const allowlist = pkg.files
    .filter((f): f is string => typeof f === "string")
    .map(normalizeEntry)
    .filter((f) => f !== "");

  const ignores = npmignoreEntries
    .filter((e) => !e.startsWith("!"))
    .map((e) => normalizeEntry(e))
    .filter((e) => e !== "");

  let names: string[];
  try {
    names = readdirSync(cwd);
  } catch {
    return issues;
  }

  for (const name of names) {
    // Only consider top-level regular files.
    let isFile = false;
    try {
      isFile = statSync(join(cwd, name)).isFile();
    } catch {
      continue;
    }
    if (!isFile) continue;

    // Dotfiles are configuration/noise, not publishable content.
    if (name.startsWith(".")) continue;

    const normalized = normalizeEntry(name);

    // npm always publishes these regardless of the allowlist.
    if (ALWAYS_PUBLISHED.test(normalized)) continue;

    // npm never publishes these regardless of configuration.
    if (NEVER_PUBLISHED.test(normalized)) continue;

    // Covered by the `files` allowlist (exact or glob match).
    if (allowlist.some((entry) => matchesGlob(normalized, entry))) continue;

    // Explicitly excluded via `.npmignore` (exact or glob match).
    if (ignores.some((entry) => matchesGlob(normalized, entry))) continue;

    issues.push({
      severity: "error",
      source: name,
      entry: name,
      message: `stray file not covered by the \`files\` allowlist nor excluded via \`.npmignore\` (add it to \`files\` to publish it, or to \`.npmignore\` to exclude it)`,
    });
  }

  return issues;
}

/**
 * Check that the `files` field of a package.json only lists items that are
 * required at runtime, flagging source, test, config and tooling entries.
 */
export function lintPackageFiles(pkg: PackageJsonLike): LintIssue[] {
  const issues: LintIssue[] = [];
  const files = pkg.files;

  if (files === undefined) {
    issues.push({
      severity: "warning",
      source: "package.json",
      message:
        "no `files` field: the whole project (minus npm defaults) will be published; add a `files` allowlist",
    });
    return issues;
  }

  if (!Array.isArray(files)) {
    issues.push({
      severity: "error",
      source: "package.json",
      message: "`files` must be an array of glob patterns",
    });
    return issues;
  }

  for (const raw of files) {
    if (typeof raw !== "string") {
      issues.push({
        severity: "error",
        source: "package.json",
        entry: String(raw),
        message: "`files` entries must be strings",
      });
      continue;
    }

    const entry = normalizeEntry(raw);
    if (entry === "") continue;

    const match = NON_RUNTIME_FILE_MATCHERS.find((m) => m.test.test(entry));
    if (match) {
      issues.push({
        severity: "error",
        source: "package.json",
        entry: raw,
        message: `\`files\` includes "${raw}" which is not required at runtime (${match.reason})`,
      });
    }
  }

  return issues;
}

/**
 * Parse an `.npmignore` file body into meaningful, non-comment entries.
 */
export function parseNpmignore(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Check an `.npmignore` body for unnecessary dotfiles and repository
 * artefacts that npm already ignores or that should not be referenced.
 */
export function lintNpmignore(content: string): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const raw of parseNpmignore(content)) {
    const entry = normalizeEntry(raw.replace(/^!/, ""));
    if (entry === "") continue;

    const match = UNNECESSARY_NPMIGNORE_MATCHERS.find((m) => m.test.test(entry));
    if (match) {
      issues.push({
        severity: "warning",
        source: ".npmignore",
        entry: raw,
        message: `\`.npmignore\` lists "${raw}" which is unnecessary (${match.reason})`,
      });
    }
  }

  return issues;
}

/**
 * Run all lint checks against a project directory. Reads `package.json`
 * (required) and `.npmignore` (optional) relative to `cwd`.
 */
export function lintProject(
  cwd: string = process.cwd(),
  options: { checkStrays?: boolean } = {},
): LintResult {
  const issues: LintIssue[] = [];

  let pkg: PackageJsonLike;
  try {
    const raw = readFileSync(join(cwd, "package.json"), "utf8");
    pkg = JSON.parse(raw) as PackageJsonLike;
  } catch {
    return {
      issues: [
        {
          severity: "error",
          source: "package.json",
          message: "could not read or parse package.json",
        },
      ],
      ok: false,
    };
  }

  issues.push(...lintPackageFiles(pkg));

  let npmignoreEntries: string[] = [];
  try {
    const npmignore = readFileSync(join(cwd, ".npmignore"), "utf8");
    npmignoreEntries = parseNpmignore(npmignore);
    issues.push(...lintNpmignore(npmignore));
  } catch {
    // .npmignore is optional; nothing to check when it is absent.
  }

  if (options.checkStrays) {
    issues.push(...findStrayFiles(cwd, pkg, npmignoreEntries));
  }

  return { issues, ok: !issues.some((i) => i.severity === "error") };
}
