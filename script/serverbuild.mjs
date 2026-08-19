// Serverbouw — alleen de Express-server, niet de webinterface.
//
// Waarom dit script naast script/build.mjs bestaat:
// De volledige bouw draait ook Vite, en dat kost bij deze app veel geheugen en
// tijd. Wie alleen serverbestanden heeft aangepast, wil de webbundel in
// dist/public ongemoeid laten en in enkele seconden opnieuw kunnen starten.
// Dit script doet daarom precies hetzelfde als stap 4 en 5 van de volledige
// bouw, met dezelfde allowlist en dezelfde ingebakken versiegegevens, en het
// wist dist/ niet.
//
// Gebruik:  npm run build:server
// Daarna:   node dist/index.cjs
//
// Let op: gebruik voor een echte uitgave altijd `npm run build`. Die bouwt ook
// de webinterface en bewaakt dat VERSION.md gelijk loopt met package.json.

import { build as esbuild } from "esbuild";
import { readFile, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Dezelfde allowlist als in script/build.mjs: deze pakketten worden mee in de
// bundel gezet, al de rest blijft extern. Wordt de lijst daar aangepast, pas ze
// dan hier ook aan.
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
  "pdf-lib",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildServer() {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf-8"));

  // Versiegegevens inbakken, net als in de volledige bouw: het statusadres kan
  // niet op npm-omgevingsvariabelen rekenen wanneer de server met
  // `node dist/index.cjs` start.
  const versie = pkg.version;
  let commit = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "onbekend";
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  } catch {
    // Geen git beschikbaar (bijvoorbeeld in een uitgepakt broncodepakket).
  }
  const bouwdatum = new Date().toISOString();
  console.log(`serverbouw: v${versie} (commit ${commit}, gebouwd ${bouwdatum})`);

  await mkdir(path.join(root, "dist"), { recursive: true });

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
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.TAPAS_VERSIE": JSON.stringify(versie),
      "process.env.TAPAS_COMMIT": JSON.stringify(commit),
      "process.env.TAPAS_BOUWDATUM": JSON.stringify(bouwdatum),
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // tts.py wordt vanuit index.cjs via spawn aangeroepen en moet dus naast de
  // bundel staan.
  await cp(path.join(root, "server", "tts.py"), path.join(root, "dist", "tts.py"), { force: true });

  // Dezelfde twee bewakingen als in de volledige bouw. Ze zijn statisch en
  // snel, en houden een serverwijziging tegen die de Vlaamse stem of de
  // duidinglaag stukmaakt.
  execSync("node script/verify-vlaamse-stem.mjs", { cwd: root, stdio: "inherit" });
  execSync("node script/verify-duidingsbeheer.mjs", { cwd: root, stdio: "inherit" });

  console.log("serverbouw klaar. De webbundel in dist/public is niet aangeraakt.");
}

buildServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
