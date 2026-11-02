import { Command } from "commander";

import { lintProject } from "../lib/lint.js";
import { logger } from "../lib/logger.js";
import { parseFormat, resolveCwd, type CommonOptions } from "../lib/options.js";

export function registerLintCommand(program: Command): void {
  program
    .command("lint")
    .description(
      "Lint the package for publishing hygiene (package.json `files` and `.npmignore`)",
    )
    .option(
      "-m, --manifest-path <path>",
      "path to package.json (default: package.json)",
    )
    .option("--format <format>", "output format: text or json", "text")
    .option("--diff", "show a diff of the entries that should be removed")
    .option(
      "--enforce-no-strays",
      "enable the stray publishable file check (flag root files not covered by `files` nor `.npmignore`)",
    )
    .action((options: CommonOptions) => {
      let format: ReturnType<typeof parseFormat>;
      try {
        format = parseFormat(options.format);
      } catch (error) {
        logger.error(error instanceof Error ? error.message : "invalid --format");
        process.exitCode = 1;
        return;
      }

      const cwd = resolveCwd(options.manifestPath);
      const { issues, ok } = lintProject(cwd, {
        checkStrays: options.enforceNoStrays === true,
      });
      const errors = issues.filter((i) => i.severity === "error").length;
      const warnings = issues.length - errors;

      if (format === "json") {
        console.log(
          JSON.stringify(
            {
              ok,
              errors,
              warnings,
              issues,
              diff: options.diff
                ? issues.filter((i) => i.entry).map((i) => `- ${i.entry}`)
                : undefined,
            },
            null,
            2,
          ),
        );
        if (!ok) process.exitCode = 1;
        return;
      }

      if (options.diff) {
        for (const issue of issues) {
          if (issue.entry) {
            logger.info(`- ${issue.entry}`);
          }
        }
      } else {
        for (const issue of issues) {
          const line = `${issue.source}: ${issue.message}`;
          if (issue.severity === "error") {
            logger.error(line);
          } else {
            logger.warn(line);
          }
        }
      }

      if (issues.length === 0) {
        logger.ok("package.json files allowlist is complete.");
      } else {
        logger.info(`${errors} error(s), ${warnings} warning(s)`);
      }

      if (!ok) {
        process.exitCode = 1;
      }
    });
}
