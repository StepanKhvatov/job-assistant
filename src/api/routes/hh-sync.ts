import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { HH_DEFAULT_BASE_URL } from "../../integrations/hh/constants.js";
import { resolveSearchTextFromEnv, syncVacanciesFromHh } from "../../services/vacancy-sync.js";

function requireCronSecret(
  request: FastifyRequest,
  reply: FastifyReply,
  secret: string | undefined,
): FastifyReply | undefined {
  if (!secret) {
    return reply.status(503).send({ error: "CRON_SECRET is not configured" });
  }

  const header = request.headers["x-cron-secret"];
  const token = typeof header === "string" ? header : undefined;
  if (!token || token !== secret) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  return undefined;
}

export async function hhSyncRoutes(app: FastifyInstance) {
  app.post("/internal/hh/sync", async (request, reply) => {
    const denied = requireCronSecret(request, reply, app.config.CRON_SECRET);
    if (denied) {
      return denied;
    }

    const searchText = resolveSearchTextFromEnv({
      HH_SEARCH_TEXT: app.config.HH_SEARCH_TEXT,
      HH_KEYWORDS: app.config.HH_KEYWORDS,
    });

    const userAgent = app.config.HH_USER_AGENT?.trim();
    if (!userAgent) {
      return reply.status(400).send({
        error:
          "Set HH_USER_AGENT (e.g. job-assistant/1.0 (+https://github.com/you/job-assistant)) — required by hh.ru API",
      });
    }

    const maxPages = Math.min(
      20,
      Math.max(1, Number.parseInt(app.config.HH_MAX_PAGES_PER_QUERY ?? "5", 10) || 5),
    );
    const detailDelayMs = Math.min(
      5000,
      Math.max(0, Number.parseInt(app.config.HH_DETAIL_DELAY_MS ?? "350", 10) || 350),
    );

    const includeOffice = app.config.HH_INCLUDE_OFFICE !== "false";
    const includeRemote = app.config.HH_INCLUDE_REMOTE !== "false";

    const maxVacanciesDetail = Math.min(
      2000,
      Math.max(1, Number.parseInt(app.config.HH_MAX_VACANCIES_DETAIL ?? "200", 10) || 200),
    );

    const baseUrl = app.config.HH_BASE_URL?.trim() || HH_DEFAULT_BASE_URL;

    const result = await syncVacanciesFromHh({
      searchText,
      userAgent,
      baseUrl,
      maxPagesPerQuery: maxPages,
      detailDelayMs,
      includeOfficeNovosibirsk: includeOffice,
      includeRemoteRussia: includeRemote,
      maxVacanciesDetail,
    });

    return reply.send({
      ok: result.errors.length === 0,
      searchText,
      ...result,
    });
  });
}
