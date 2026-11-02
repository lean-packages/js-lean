import { Command } from "commander";

import { createProject } from "../lib/create.js";
import { logger } from "../lib/logger.js";
import { parseFormat, resolveCwd, type CommonOptions } from "../lib/options.js";

export function registerCreateCommand(program: Command): void {
  program
    .command("create")
    .description(
      "Scaffold publishing hygiene (default `files` allowlist and `.npmignore`)",
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
        result = createProject(cwd, { dryRun: options.dryRun });
      } catch (error) {
        logger.error(
          error instanceof Error ? error.message : "failed to scaffold project",
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
            ? "publishing hygiene scaffolding previewed (dry run)"
            : "publishing hygiene scaffolding applied",
        );
      } else {
        logger.success("nothing to do: project already scaffolded");
      }
    });
}
