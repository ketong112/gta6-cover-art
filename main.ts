// Vice Cover Studio — the entry program for gta6-cover-art-01.
//
// This program hands the entry in. It runs on Node 22 with the standard
// library only, in a container with no network: it copies this repository's
// app/ folder (the offline cover maker) and its screenshots/ folder into
// the output directory, then writes output/dossier.json, the summary the
// judge reads, using the vendored make.fun library.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, "app"), join(outputDir, "app"), { recursive: true });
mkdirSync(join(outputDir, "screenshots"), { recursive: true });
if (existsSync(join(repoRoot, "screenshots"))) {
  cpSync(join(repoRoot, "screenshots"), join(outputDir, "screenshots"), {
    recursive: true,
  });
}

// The gate's caps, as the competition's reference/gate.json states them:
// the dossier text is capped at 160 KiB, at most 4 screenshots of at most
// 256 KiB each, app/ at most 993 files and 48 MiB in all, and no path
// under app/ longer than 1000 bytes.
writeFileSync(
  join(outputDir, "dossier.json"),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
