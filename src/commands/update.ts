import { Command } from "commander";

import { logger } from "../lib/logger.js";
import { parseFormat, resolveCwd, type CommonOptions } from "../lib/options.js";
import { updateProject } from "../lib/update.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description(
      "Non-destructively update the package.json `files` field and `.npmignore` to reflect the repository state",
    )
    .option(
      "-m, --manifest-path <path>",
      "path to package.json (default: package.json)",
    )
    .option("--format <format>", "output format: text or json", "text")
    .option("--dry-run", "preview changes without writing any files")
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

      let result;
      try {
        result = updateProject(cwd, { dryRun: options.dryRun });
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : "failed to update project",
        );
        process.exitCode = 1;
        return;
      }

      if (format === "json") {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      for (const change of result.changes) {
        logger.info(`${change.target}: ${change.message}`);
      }

      if (result.changed) {
        logger.success(
          result.dryRun
            ? "project changes previewed (dry run)"
            : "project updated to reflect the repository state",
        );
      } else {
        logger.success("nothing to do: project already up to date");
      }
    });
}
