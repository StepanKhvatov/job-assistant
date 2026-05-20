import type { FastifyInstance } from "fastify";

import { healthRoutes } from "./routes/health.js";
import { hhSyncRoutes } from "./routes/hh-sync.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(hhSyncRoutes);
}
