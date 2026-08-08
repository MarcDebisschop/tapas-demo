import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: [
    "./shared/schema.ts",
    "./server/hdd/schema.ts",
    "./server/t4organizations/schema.ts",
    "./server/t4r/schema.ts",
    "./server/teamscan/schema.ts",
  ],
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TAPAS_DB_PATH ?? "./data.db",
  },
});
