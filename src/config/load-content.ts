import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT_DIR = join(process.cwd(), "content");

function readContentFile(name: string): string {
  const path = join(CONTENT_DIR, name);
  return readFileSync(path, "utf8").trim();
}

let cache: { rankSystem: string; candidateProfile: string } | null = null;

/** Markdown из `content/` для AI-промптов (редактируются без пересборки логики). */
export function loadRankContent(): { rankSystem: string; candidateProfile: string } {
  if (!cache) {
    cache = {
      rankSystem: readContentFile("rank-system.md"),
      candidateProfile: readContentFile("candidate-profile.md"),
    };
  }
  return cache;
}
