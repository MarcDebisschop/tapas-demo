import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

// Additieve module (Werkprotocol Regel 2): installeert het gebundelde
// Noto Color Emoji-lettertype in een door de runtime-user schrijfbare fontmap
// (~/.fonts) en draait fc-cache, zodat fontconfig/Chromium het vindt en de
// emoji-iconen in het T4Teens-rapport in KLEUR renderen i.p.v. als tofu.
//
// Op Render mist de Node-image het emoji-lettertype: Chromium valt dan terug op
// DejaVuSans en tekent lege vierkantjes. Deze installer lost dat op zonder ook
// maar iets aan het bestaande render-gedrag te wijzigen. Alles is best-effort en
// non-blocking: een fout mag NOOIT de server-start of een PDF-request breken.

// Robuuste kandidaat-paden voor de gebundelde TTF (zelfde idee als afnameDir()
// in rapport-pdf.ts): dev draait vanuit server/, productie vanuit dist/.
function bundledFontCandidates(): string[] {
  return [
    path.resolve(process.cwd(), "server/assets/fonts/NotoColorEmoji.ttf"),
    path.resolve(process.cwd(), "dist/assets/fonts/NotoColorEmoji.ttf"),
    path.resolve(process.cwd(), "assets/fonts/NotoColorEmoji.ttf"),
    path.resolve(__dirname, "../assets/fonts/NotoColorEmoji.ttf"),
    path.resolve(__dirname, "assets/fonts/NotoColorEmoji.ttf"),
  ];
}

function vindGebundeldeFont(): string | null {
  for (const c of bundledFontCandidates()) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

// Onthoud of we de installatie al probeerden (max. 1 keer per proces).
let installGeprobeerd = false;

// Best-effort, idempotent, non-blocking. Retourneert true als het lettertype na
// afloop op de doellocatie staat, anders false. Gooit NOOIT een fout naar boven.
export function installEmojiFontEenmalig(): boolean {
  if (installGeprobeerd) return true;
  installGeprobeerd = true;

  try {
    const bron = vindGebundeldeFont();
    if (!bron) {
      console.warn("[emoji-font] gebundelde NotoColorEmoji.ttf niet gevonden — overslaan.");
      return false;
    }

    const fontDir = path.join(os.homedir(), ".fonts");
    const doel = path.join(fontDir, "NotoColorEmoji.ttf");

    // Idempotent: alleen kopiëren als het doel ontbreekt of een andere grootte heeft.
    let moetKopieren = true;
    try {
      if (fs.existsSync(doel)) {
        const bronStat = fs.statSync(bron);
        const doelStat = fs.statSync(doel);
        if (bronStat.size === doelStat.size) moetKopieren = false;
      }
    } catch {
      moetKopieren = true;
    }

    if (moetKopieren) {
      fs.mkdirSync(fontDir, { recursive: true });
      fs.copyFileSync(bron, doel);
      console.log("[emoji-font] NotoColorEmoji.ttf geïnstalleerd in", doel);
    }

    // fc-cache verversen zodat fontconfig/Chromium het nieuwe lettertype ziet.
    // Best-effort: sommige hosts hebben geen fontconfig — dan negeren we het.
    try {
      execSync(`fc-cache -f ${JSON.stringify(fontDir)}`, { stdio: "ignore" });
    } catch (cacheErr: any) {
      console.warn("[emoji-font] fc-cache niet gelukt (best-effort):", cacheErr?.message || cacheErr);
    }

    return fs.existsSync(doel);
  } catch (err: any) {
    console.warn("[emoji-font] installatie overgeslagen (best-effort):", err?.message || err);
    return false;
  }
}
