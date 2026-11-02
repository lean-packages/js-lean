import { Command } from "commander";

import { registerCreateCommand } from "./commands/create.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerUpdateCommand } from "./commands/update.js";
import { readPackageJson } from "./lib/pkg.js";

/**
 * Build the fully configured CLI program. Exposed separately from `run`
 * so tests can exercise commands without spawning a process.
 */
export function buildProgram(): Command {
  const pkg = readPackageJson();
  const program = new Command();

  program
    .name("js-lean")
    .description(pkg.description ?? "A lean TypeScript CLI")
    .version(pkg.version, "-v, --version", "output the current version")
    .showHelpAfterError();

  registerLintCommand(program);
  registerCreateCommand(program);
  registerUpdateCommand(program);

  return program;
}

/**
 * Parse argv and execute. Returns the resolved program for convenience.
 */
export async function run(argv: string[] = process.argv): Promise<Command> {
  const program = buildProgram();
  return program.parseAsync(argv);
}
