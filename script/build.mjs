// Build script — geen TypeScript, geen tsx nodig
// 1. Draait Vite om de React-app te bundelen → dist/public/
// 2. Kopieert extra statische assets (afbeeldingen, audio, PDF's …) van
//    client/public/ → dist/public/  (assets/ en index.html worden overgeslagen
//    want die komen al van Vite)
// 3. Bouwt de Express server via esbuild → dist/index.cjs

import { build as esbuild } from "esbuild";
import { rm, readFile, cp, mkdir } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

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
  "pdf-lib",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf-8"));
  // 0a. VERSIE INBAKKEN (auditbevinding O-3). Het statusadres las het nummer uit
  //     process.env.npm_package_version, en die variabele bestaat niet wanneer
  //     Render met `node dist/index.cjs` start. De drie waarden hieronder worden
  //     daarom als vaste tekst in de bundel gezet, zodat de draaiende toepassing
  //     niet afhangt van de manier van starten.
  const versie = pkg.version;
  let commit = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? "onbekend";
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  } catch {
    // Geen git beschikbaar (bijvoorbeeld in een uitgepakt broncodepakket): dan
    // blijft de waarde uit de omgeving of "onbekend" staan.
  }
  const bouwdatum = new Date().toISOString();

  // 0b. EEN BRON VAN WAARHEID. Het nummer staat uitsluitend in package.json.
  //     Loopt de bovenste kop van VERSION.md daarop achter, dan is de
  //     release-documentatie niet bijgewerkt en stopt de bouw hier. Zo kunnen
  //     code en documentatie niet stil uiteenlopen.
  const versieDoc = await readFile(path.join(root, "VERSION.md"), "utf-8");
  const gedocumenteerd = versieDoc.match(/^## Huidige versie: v(\d+\.\d+\.\d+)/m)?.[1];
  if (gedocumenteerd !== versie) {
    console.error(
      `FOUT: package.json staat op ${versie}, maar VERSION.md documenteert ` +
        `${gedocumenteerd ?? "geen versie"}. Werk de bovenste kop van VERSION.md bij ` +
        `("## Huidige versie: v${versie} - ...") voordat je uitbrengt.`,
    );
    process.exit(1);
  }
  console.log(`versie ingebakken: v${versie} (commit ${commit}, gebouwd ${bouwdatum})`);

  // 1. Wis dist/ volledig
  await rm(path.join(root, "dist"), { recursive: true, force: true });
  await mkdir(path.join(root, "dist", "public"), { recursive: true });

  // 2. Vite build — compileert de React/TSX app naar dist/public/
  console.log("building frontend (Vite)...");
  execSync("node_modules/.bin/vite build", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  console.log("frontend built.");

  // 3. Kopieer extra statische assets van client/public/ naar dist/public/
  //    Sla 'assets/' en 'index.html' over — die komen van Vite.
  console.log("copying static assets (images, audio, fonts, ...)...");
  const srcPublic = path.join(root, "client", "public");
  const dstPublic = path.join(root, "dist", "public");

  async function copyDir(src, dst) {
    await mkdir(dst, { recursive: true });
    const entries = readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      // Sla de Vite-bundle-map en index.html over (al aanwezig via Vite output)
      if (src === srcPublic && entry.name === "assets") continue;
      if (src === srcPublic && entry.name === "index.html") continue;
      if (entry.isDirectory()) {
        await copyDir(srcPath, dstPath);
      } else {
        await cp(srcPath, dstPath, { force: true });
      }
    }
  }

  await copyDir(srcPublic, dstPublic);
  console.log("static assets copied.");

  // 4. Bouw de Express server
  console.log("building server...");

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

  // 5. Kopieer server/tts.py naar dist/ (wordt aangeroepen via spawn vanuit index.cjs)
  await cp(path.join(root, "server", "tts.py"), path.join(root, "dist", "tts.py"), { force: true });
  console.log("tts.py gekopieerd naar dist/.");

  // NB (Fase 4): geen 'playwright install chromium' meer nodig. De PDF-render
  // gebruikt in productie @sparticuz/chromium (Chromium als npm-dependency),
  // dus de build hangt niet meer af van een systeem-Chromium-download.

  // 6. BEWAKING VLAAMSE STEM — blokkeert de build als de stem-architectuur kapot is.
  //    Draait de statische controles (geen speechSynthesis, Sulafat, VLAAMSE_STEM_PROMPT,
  //    spawn-import, /api/tts-route, prompt-prepend, spawn-error-handler).
  //    Bij een regressie faalt de build met exit-code 1 → geen kapotte deploy mogelijk.
  console.log("bewaking Vlaamse stem controleren...");
  execSync("node script/verify-vlaamse-stem.mjs", { cwd: root, stdio: "inherit" });
  console.log("Vlaamse stem OK.");

  // 7. BEWAKING DUIDINGSBEHEER — blokkeert de build als de LIVE AI-duidinglaag
  //    onveilig wordt (regie-prompt zonder "verzin ge"-grens, ontbrekende
  //    fallback naar bouwRapportInhoud, of TaPas-Beeld dat als anker lekt).
  console.log("bewaking duidingsbeheer controleren...");
  execSync("node script/verify-duidingsbeheer.mjs", { cwd: root, stdio: "inherit" });
  console.log("Duidingsbeheer OK.");

  console.log("build complete.");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
