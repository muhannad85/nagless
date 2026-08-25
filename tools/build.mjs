import { cpSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });

for (const target of ["firefox", "chrome"]) {
  const manifestPath = join(root, `manifest.${target}.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")); // validates JSON
  const out = join(dist, target);
  mkdirSync(out, { recursive: true });
  const JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
  cpSync(join(root, "src"), out, {
    recursive: true,
    filter: (s) => !JUNK.has(s.split("/").pop()),
  });
  cpSync(manifestPath, join(out, "manifest.json"));
  const zipName = `nagless-${target}-${manifest.version}.zip`;
  const zip = spawnSync("zip", ["-r", "-X", "-q", join(dist, zipName), "."], { cwd: out });
  if (zip.status !== 0) {
    console.error(zip.stderr?.toString() || "zip failed (is the `zip` CLI installed?)");
    process.exit(1);
  }
  console.log(`built dist/${target} and dist/${zipName}`);
}
