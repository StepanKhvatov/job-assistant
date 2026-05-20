import type { FastifyInstance } from "fastify";

import { prisma } from "../../db/client.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "job-assistant",
  }));

  app.get("/health/db", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "connected" };
    } catch (error) {
      request.log.error(error, "Database health check failed");
      return reply.status(503).send({
        status: "error",
        db: "disconnected",
      });
    }
  });
}
