import { existsSync } from "fs";
import { resolve } from "path";

export function vindDatabasePad(): string {
  if (process.env.TAPAS_DB_PATH) return resolve(process.env.TAPAS_DB_PATH);

  const distDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
  const projectRoot = resolve(distDir, "..");
  const kandidaten = [
    resolve(projectRoot, "data.db"),
    resolve(process.cwd(), "data.db"),
    resolve(distDir, "data.db"),
  ];

  for (const pad of kandidaten) {
    if (existsSync(pad)) return pad;
  }
  return resolve(projectRoot, "data.db");
}
