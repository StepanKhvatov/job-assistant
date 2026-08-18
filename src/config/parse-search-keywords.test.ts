import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  loadSearchKeywords,
  parseSearchKeywordLines,
  parseSearchKeywordsFromProfile,
} from "./load-content.js";
import { unionVacancyIds } from "../playwright/search.js";
import { HH_AREA_RUSSIA } from "../integrations/hh/constants.js";
import { hhSearchUrl } from "../providers/hh.js";

describe("parseSearchKeywordLines", () => {
  it("reads markdown list items and skips the next heading", () => {
    const markdown = `# Профиль

## Поиск на hh.ru

- Frontend разработчик
- React разработчик
- Frontend Engineer

## Целевая роль

Middle Frontend
`;
    assert.deepEqual(parseSearchKeywordsFromProfile(markdown), [
      "Frontend разработчик",
      "React разработчик",
      "Frontend Engineer",
    ]);
  });

  it("keeps a single-line section as one keyword", () => {
    assert.deepEqual(parseSearchKeywordLines("Frontend разработчик\n"), ["Frontend разработчик"]);
  });

  it("dedupes case-insensitively and collapses spaces", () => {
    assert.deepEqual(parseSearchKeywordLines("- Frontend разработчик\n- frontend   разработчик\n- React разработчик"), [
      "Frontend разработчик",
      "React разработчик",
    ]);
  });

  it("ignores comments when a list is present", () => {
    assert.deepEqual(
      parseSearchKeywordLines("- Frontend разработчик\nНе склеивайте OR в одну строку."),
      ["Frontend разработчик"],
    );
  });
});

describe("content/candidate-profile.md search section", () => {
  it("has distinct title phrases, not one OR blob", () => {
    const markdown = readFileSync(join(process.cwd(), "content/candidate-profile.md"), "utf8");
    const keywords = parseSearchKeywordsFromProfile(markdown);
    assert.ok(keywords.length >= 2, `expected several phrases, got ${JSON.stringify(keywords)}`);
    assert.deepEqual(loadSearchKeywords(), keywords);
    for (const keyword of keywords) {
      assert.equal(keyword.includes(" OR "), false, keyword);
      assert.match(keyword, /frontend|react/i);
    }
  });
});

describe("unionVacancyIds", () => {
  it("keeps first-seen order and counts overlap", () => {
    const merged = unionVacancyIds(["1", "2"], ["2", "3", "1"]);
    assert.deepEqual(merged.ids, ["1", "2", "3"]);
    assert.equal(merged.added, 1);
    assert.equal(merged.overlap, 2);
  });
});

describe("hh search urls per keyword", () => {
  it("builds a separate name-field query for each phrase", () => {
    const keywords = ["Frontend разработчик", "React разработчик", "Frontend Engineer"];
    const urls = keywords.map((keyword) => hhSearchUrl("https://novosibirsk.hh.ru", keyword));
    const texts = urls.map((url) => new URL(url).searchParams.get("text"));
    assert.deepEqual(texts, keywords);
    assert.equal(new Set(texts).size, keywords.length);
    for (const url of urls) {
      const params = new URL(url).searchParams;
      assert.equal(params.get("search_field"), "name");
      assert.equal(params.get("area"), String(HH_AREA_RUSSIA));
      assert.equal(params.has("text"), true);
      assert.equal(params.get("text")?.includes(" OR "), false);
    }
  });
});
