import { afterEach, describe, expect, it, vi } from "vitest";

import { buildProgram } from "../src/cli.js";

describe("cli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes the expected commands without info", () => {
    const program = buildProgram();
    const names = program.commands.map((command) => command.name());

    expect(names).toEqual(["lint", "create", "update"]);
    expect(names).not.toContain("info");
  });

  it("--version reports the package version", async () => {
    const chunks: string[] = [];
    const program = buildProgram()
      .exitOverride()
      .configureOutput({
        writeOut: (str) => chunks.push(str),
      });

    try {
      await program.parseAsync(["--version"], { from: "user" });
    } catch {
      // commander throws via exitOverride after printing the version
    }

    expect(chunks.join("")).toMatch(/\d+\.\d+\.\d+/);
  });
});
