import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: [
    "./shared/schema.ts",
    "./server/audit/schema.ts",
    "./server/hdd/schema.ts",
    "./server/prive-aankoop/schema.ts",
    "./server/stm/schema.ts",
    "./server/t4organizations/schema.ts",
    "./server/t4r/schema.ts",
    "./server/t4sports/schema.ts",
    "./server/teamscan/schema.ts",
  ],
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TAPAS_DB_PATH ?? "./data.db",
  },
});
