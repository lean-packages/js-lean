import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type PackageJson = {
  name: string;
  version: string;
  description?: string;
};

/**
 * Locate and read the nearest package.json by walking up the directory tree
 * from the current module. Works both in dev (src/) and when bundled (dist/).
 */
export function readPackageJson(): PackageJson {
  let dir = dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 5; depth++) {
    try {
      const candidate = join(dir, "package.json");
      const raw = readFileSync(candidate, "utf8");
      return JSON.parse(raw) as PackageJson;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  return { name: "js-lean", version: "0.0.0" };
}
