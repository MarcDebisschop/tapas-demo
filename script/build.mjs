// Build script — geen TypeScript, geen tsx nodig
// Kopieert client/public/ (exacte TaPas-Platform-8 bestanden) naar dist/public/
// en bouwt alleen de Express server via esbuild.

import { build as esbuild } from "esbuild";
import { rm, readFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  // 1. Wis dist/ volledig
  await rm(path.join(root, "dist"), { recursive: true, force: true });
  await mkdir(path.join(root, "dist", "public"), { recursive: true });

  // 2. Kopieer client/public/ → dist/public/ (exacte TaPas-Platform-8 bestanden)
  console.log("copying static frontend (TaPas-Platform-8)...");
  await cp(
    path.join(root, "client", "public"),
    path.join(root, "dist", "public"),
    { recursive: true }
  );
  console.log("static frontend copied.");

  // 3. Bouw alleen de server
  console.log("building server...");
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: [path.join(root, "server/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.join(root, "dist/index.cjs"),
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("build complete.");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
