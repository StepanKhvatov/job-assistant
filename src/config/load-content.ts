import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CANDIDATE_PROFILE } from "./candidate-profile.js";

const CONTENT_DIR = join(process.cwd(), "content");

const SEARCH_SECTION = /##\s*Поиск на hh\.ru\s*\n+([\s\S]*?)(?=\n##\s|$)/i;
const LIST_ITEM = /^(?:[-*+]|\d+\.)\s+(.+)$/;

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

/** Строки секции «Поиск на hh.ru»: список `- фраза` или одна фраза на строку. */
export function parseSearchKeywordLines(sectionBody: string): string[] {
  const lines = sectionBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && line !== "---");

  const listItems = lines
    .map((line) => line.match(LIST_ITEM)?.[1]?.trim() ?? "")
    .filter(Boolean);
  const raw = listItems.length > 0 ? listItems : lines;

  const keywords: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const normalized = normalizeSearchKeyword(item);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    keywords.push(normalized);
  }
  return keywords;
}

export function parseSearchKeywordsFromProfile(markdown: string): string[] {
  const match = markdown.match(SEARCH_SECTION);
  const body = match?.[1]?.trim();
  if (!body) {
    return [];
  }
  return parseSearchKeywordLines(body);
}

/** Фразы для `?text=` на hh.ru из секции «Поиск на hh.ru» в candidate-profile.md */
export function loadSearchKeywords(): string[] {
  const fromMd = parseSearchKeywordsFromProfile(loadAll().candidateProfile);
  if (fromMd.length > 0) {
    return fromMd;
  }
  return [...CANDIDATE_PROFILE.defaultScrapeKeywords];
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
