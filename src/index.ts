import { run } from "./cli.js";
import { logger } from "./lib/logger.js";

run().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
