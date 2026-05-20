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
    };
  }
}
