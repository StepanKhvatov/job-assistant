import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTENT_DIR = join(process.cwd(), "content");

function readContentFile(name: string): string {
  return readFileSync(join(CONTENT_DIR, name), "utf8").trim();
}

type ContentCache = {
  rankSystem: string;
  candidateProfile: string;
  coverLetter: string;
};

let cache: ContentCache | null = null;

function loadAll(): ContentCache {
  if (!cache) {
    cache = {
      rankSystem: readContentFile("rank-system.md"),
      candidateProfile: readContentFile("candidate-profile.md"),
      coverLetter: readContentFile("cover-letter.md"),
    };
  }
  return cache;
}

export function loadRankContent(): Pick<ContentCache, "rankSystem" | "candidateProfile"> {
  const { rankSystem, candidateProfile } = loadAll();
  return { rankSystem, candidateProfile };
}

/**
 * Одно сопроводительное для всех откликов (без DeepSeek).
 * Пишите plain text в cover-letter.md (без обязательного markdown).
 */
export function loadCoverLetter(): string {
  const raw = loadAll().coverLetter;
  return raw
    .split("\n")
    .filter((line) => !line.startsWith("#") && line.trim() !== "---")
    .join("\n")
    .trim();
}
