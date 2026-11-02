import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseFormat, resolveCwd } from "../src/lib/options.js";

describe("resolveCwd", () => {
  it("defaults to the current working directory", () => {
    expect(resolveCwd()).toBe(process.cwd());
    expect(resolveCwd(undefined)).toBe(process.cwd());
  });

  it("derives the working directory from a manifest path", () => {
    const manifest = join("/tmp", "project", "package.json");
    expect(resolveCwd(manifest)).toBe(dirname(manifest));
  });

  it("resolves relative manifest paths against the cwd", () => {
    expect(resolveCwd("sub/package.json")).toBe(
      resolve(process.cwd(), "sub"),
    );
  });
});

describe("parseFormat", () => {
  it("defaults to text", () => {
    expect(parseFormat(undefined)).toBe("text");
    expect(parseFormat("text")).toBe("text");
  });

  it("accepts json", () => {
    expect(parseFormat("json")).toBe("json");
  });

  it("rejects unknown formats", () => {
    expect(() => parseFormat("yaml")).toThrow(/invalid --format/);
  });
});
