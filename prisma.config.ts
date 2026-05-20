import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Runtime URL; migrate uses DIRECT_URL via npm script (Prisma 7 has no directUrl)
    url: process.env["DATABASE_URL"],
  },
});
