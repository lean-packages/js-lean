import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Supported output formats, mirroring the sibling `cargo-lean`/`py-lean` tools.
 */
export type OutputFormat = "text" | "json";

/**
 * Common options and flags shared by every command, aligned with the
 * `cargo-lean` option/flag surface (`--manifest-path`, `--format`,
 * `--dry-run`, `--diff`).
 */
export type CommonOptions = {
  manifestPath?: string;
  format?: string;
  dryRun?: boolean;
  diff?: boolean;
  /** Stray publishable file check; disabled by default, enabled via `--enforce-no-strays`. */
  enforceNoStrays?: boolean;
};

/**
 * Resolve the working directory a command should operate on from an optional
 * `--manifest-path`. The manifest path points at a `package.json`; the working
 * directory is derived from its parent directory, matching `cargo-lean`'s
 * `--manifest-path` semantics. When omitted, the current directory is used.
 */
export function resolveCwd(manifestPath?: string): string {
  if (!manifestPath) return process.cwd();
  const abs = isAbsolute(manifestPath)
    ? manifestPath
    : resolve(process.cwd(), manifestPath);
  return dirname(abs);
}

/**
 * Validate and normalize the `--format` option, defaulting to `text`.
 */
export function parseFormat(value: string | undefined): OutputFormat {
  if (value === undefined || value === "text") return "text";
  if (value === "json") return "json";
  throw new Error(`invalid --format "${value}" (expected "text" or "json")`);
}
