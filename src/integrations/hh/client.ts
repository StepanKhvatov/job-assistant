import {
  HH_DEFAULT_BASE_URL,
  HH_DEFAULT_DETAIL_DELAY_MS,
  HH_DEFAULT_MAX_PAGES,
  HH_DEFAULT_PER_PAGE,
} from "./constants.js";
import type { HhVacanciesSearchResponse, HhVacancyDetail, HhVacancyListItem } from "./types.js";

export type HhClientOptions = {
  baseUrl?: string;
  userAgent: string;
  /** Токен приложения с https://dev.hh.ru/admin (обязателен для /vacancies) */
  accessToken?: string;
  detailDelayMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HhApiClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly accessToken?: string;
  private readonly detailDelayMs: number;

  constructor(options: HhClientOptions) {
    this.baseUrl = (options.baseUrl ?? HH_DEFAULT_BASE_URL).replace(/\/$/, "");
    this.userAgent = options.userAgent;
    this.accessToken = options.accessToken?.trim() || undefined;
    this.detailDelayMs = options.detailDelayMs ?? HH_DEFAULT_DETAIL_DELAY_MS;
  }

  async searchVacancies(params: {
    text: string;
    area: number;
    schedule?: "remote";
    page: number;
    perPage?: number;
  }): Promise<HhVacanciesSearchResponse> {
    const perPage = params.perPage ?? HH_DEFAULT_PER_PAGE;
    const search = new URLSearchParams();
    search.set("text", params.text);
    search.set("area", String(params.area));
    search.set("page", String(params.page));
    search.set("per_page", String(perPage));
    if (params.schedule) {
      search.set("schedule", params.schedule);
    }

    const url = `${this.baseUrl}/vacancies?${search.toString()}`;
    return this.fetchJson<HhVacanciesSearchResponse>(url);
  }

  async fetchVacancyDetail(id: string): Promise<HhVacancyDetail> {
    const url = `${this.baseUrl}/vacancies/${encodeURIComponent(id)}`;
    const data = await this.fetchJson<HhVacancyDetail>(url);
    await sleep(this.detailDelayMs);
    return data;
  }

  /** Собирает все страницы поиска до лимита страниц. */
  async collectSearchPages(params: {
    text: string;
    area: number;
    schedule?: "remote";
    maxPages?: number;
    perPage?: number;
  }): Promise<HhVacancyListItem[]> {
    const maxPages = params.maxPages ?? HH_DEFAULT_MAX_PAGES;
    const perPage = params.perPage ?? HH_DEFAULT_PER_PAGE;
    const merged = new Map<string, HhVacancyListItem>();

    for (let page = 0; page < maxPages; page++) {
      const res = await this.searchVacancies({
        text: params.text,
        area: params.area,
        schedule: params.schedule,
        page,
        perPage,
      });

      for (const item of res.items) {
        merged.set(item.id, item);
      }

      if (page + 1 >= res.pages || res.items.length === 0) {
        break;
      }

      await sleep(this.detailDelayMs);
    }

    return [...merged.values()];
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const maxAttempts = 4;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      const headers: Record<string, string> = {
        "User-Agent": this.userAgent,
        Accept: "application/json",
      };
      if (this.accessToken) {
        headers.Authorization = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(url, { headers });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after")) || 2 ** attempt;
        await sleep(Math.min(retryAfter * 1000, 30_000));
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HH API ${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
      }

      return (await response.json()) as T;
    }

    throw new Error(`HH API: too many 429 retries for ${url}`);
  }
}
