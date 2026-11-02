import pc from "picocolors";

/**
 * Minimal, dependency-light logger with colored, prefixed output.
 * Honors the `NO_COLOR` convention via picocolors' auto-detection.
 */
export const logger = {
  info(message: string): void {
    console.log(`${pc.cyan("info")}  ${message}`);
  },
  success(message: string): void {
    console.log(`${pc.green("done")}  ${message}`);
  },
  ok(message: string): void {
    console.log(`${pc.green("✓")} ${message}`);
  },
  warn(message: string): void {
    console.warn(`${pc.yellow("warn")}  ${message}`);
  },
  error(message: string): void {
    console.error(`${pc.red("error")} ${message}`);
  },
};
