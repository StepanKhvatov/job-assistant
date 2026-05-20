import "dotenv/config";

import fastifyEnv from "@fastify/env";
import Fastify from "fastify";

import { registerRoutes } from "./api/index.js";
import { envSchema } from "./config/env.js";
import { prisma } from "./db/client.js";

const app = Fastify({ logger: true });

await app.register(fastifyEnv, {
  schema: envSchema,
  dotenv: true,
});

await registerRoutes(app);

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

const port = app.config.PORT;
const host = app.config.HOST;

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
