import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CANDIDATE_PROFILE } from "./candidate-profile.js";

const CONTENT_DIR = join(process.cwd(), "content");

const SEARCH_SECTION = /##\s*Поиск на hh\.ru\s*\n+([^\n#]+)/i;

function readContentFile(name: string): string {
  return readFileSync(join(CONTENT_DIR, name), "utf8").trim();
}

export function normalizeSearchKeyword(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").normalize("NFC");
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

/** Фраза для `?text=` на hh.ru из секции «Поиск на hh.ru» в candidate-profile.md */
export function loadSearchKeyword(): string {
  const match = loadAll().candidateProfile.match(SEARCH_SECTION);
  const fromMd = match?.[1]?.trim();
  if (fromMd) {
    return normalizeSearchKeyword(fromMd);
  }
  return CANDIDATE_PROFILE.defaultScrapeKeyword;
}

export function loadRankContent(): Pick<ContentCache, "rankSystem" | "candidateProfile"> {
  const { rankSystem, candidateProfile } = loadAll();
  return { rankSystem, candidateProfile };
}

export function loadCoverLetter(): string {
  const raw = loadAll().coverLetter;
  return raw
    .split("\n")
    .filter((line) => !line.startsWith("#") && line.trim() !== "---")
    .join("\n")
    .trim();
}
