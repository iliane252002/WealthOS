import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
    // DIRECT_URL bypasses the connection pooler for migrations
    // (required for Neon serverless PostgreSQL)
    ...(process.env["DIRECT_URL"] ? { directUrl: process.env["DIRECT_URL"] } : {}),
  },
});
