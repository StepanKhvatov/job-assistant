import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    config: {
      NODE_ENV: string;
      PORT: number;
      HOST: string;
      DATABASE_URL: string;
      DIRECT_URL?: string;
      CRON_SECRET?: string;
      HH_SEARCH_TEXT?: string;
      HH_KEYWORDS?: string;
      HH_BASE_URL?: string;
      HH_USER_AGENT?: string;
      HH_ACCESS_TOKEN?: string;
      HH_MAX_PAGES_PER_QUERY?: string;
      HH_DETAIL_DELAY_MS?: string;
      HH_INCLUDE_OFFICE?: string;
      HH_INCLUDE_REMOTE?: string;
      HH_MAX_VACANCIES_DETAIL?: string;
      DEEPSEEK_API_KEY?: string;
      DEEPSEEK_MODEL?: string;
      DEEPSEEK_BASE_URL?: string;
      AI_RANK_LIMIT?: string;
      AI_RANK_DELAY_MS?: string;
    };
  }
}
