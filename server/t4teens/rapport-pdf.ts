import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { installEmojiFontEenmalig } from "./emoji-font";

// Render de T4Teens-rapport-HTML naar een A4-PDF met Playwright (chromium).
// Print-CSS wordt gerespecteerd en achtergrondkleuren staan aan (printBackground).
//
// De relatieve afbeeldingen (img/*.png en img/*.jpg) in het rapport worden vóór
// het renderen INLINE gezet als base64 data-URI's. Dat garandeert dat ze zowel
// lokaal als op Render correct laden, zonder afhankelijk te zijn van file://-paden
// of van een <base href> die grote lokale bestanden soms niet oplost.

function afnameDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "client/public/t4teens/afname"),
    path.resolve(process.cwd(), "dist/public/t4teens/afname"),
    path.resolve(process.cwd(), "public/t4teens/afname"),
    path.resolve(__dirname, "../../client/public/t4teens/afname"),
    path.resolve(__dirname, "../public/t4teens/afname"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, "img"))) return c;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

function mimeFor(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

// Vervang elke relatieve img/... verwijzing (in src="..." of url(...)) door een
// absoluut file://-pad. Zo hoeft chromium de afbeeldingen NIET als megabytes-grote
// base64-string in het geheugen te houden (dat liet de render op kleine hosts zoals
// Render free/512MB tegen het RAM-plafond lopen). Chromium leest de bestanden nu
// rechtstreeks en efficient van schijf. Ontbrekende bestanden laten we ongemoeid.
function inlineAfbeeldingen(html: string): string {
  const dir = afnameDir();
  const cache = new Map<string, string | null>();

  function fileUrlVoor(relPad: string): string | null {
    if (cache.has(relPad)) return cache.get(relPad)!;
    let out: string | null = null;
    try {
      const clean = relPad.split(/[?#]/)[0];
      const abs = path.resolve(dir, clean);
      if (fs.existsSync(abs)) {
        // pathToFileURL codeert spaties/speciale tekens correct
        out = pathToFileURL(abs).href;
      }
    } catch {
      out = null;
    }
    cache.set(relPad, out);
    return out;
  }

  // src="img/..." of src='img/...'
  html = html.replace(
    /(src\s*=\s*)(["'])(img\/[^"']+)\2/gi,
    (m, pre, q, ref) => {
      const uri = fileUrlVoor(ref);
      return uri ? `${pre}${q}${uri}${q}` : m;
    }
  );

  // url(img/...) of url("img/...") of url('img/...') binnen CSS/style
  html = html.replace(
    /url\(\s*(["']?)(img\/[^"')]+)\1\s*\)/gi,
    (m, q, ref) => {
      const uri = fileUrlVoor(ref);
      return uri ? `url(${q}${uri}${q})` : m;
    }
  );

  return html;
}

// Onthoud of we al eens een runtime-install probeerden (max. 1 keer per proces).
let runtimeInstallGeprobeerd = false;

// Geheugenzuinige launch-args — nodig op kleine hosts (bv. Render free, 512MB):
// zonder deze vlaggen loopt chromium bij een zwaar rapport (grote ingebedde
// afbeeldingen) tegen het RAM-plafond en crasht de request (502).
const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--single-process",
  "--no-zygote",
  "--disable-extensions",
];

async function launchChromium(chromium: any) {
  try {
    return await chromium.launch({ args: LAUNCH_ARGS });
  } catch (err: any) {
    const msg = String(err?.message || err);
    // Als de browser-executable ontbreekt (bv. build-install niet gepersisteerd
    // op Render), installeer chromium dan lazy IN DEZELFDE runtime-omgeving en
    // probeer opnieuw. Zelfde home/user als het draaiende proces → het pad klopt.
    const ontbreekt = /Executable doesn't exist|Please run the following command|install/i.test(msg);
    if (ontbreekt && !runtimeInstallGeprobeerd) {
      runtimeInstallGeprobeerd = true;
      const { execSync } = await import("node:child_process");
      try {
        console.warn("[T4Teens PDF] chromium ontbreekt — lazy runtime-install gestart...");
        execSync("npx --yes playwright install chromium", { stdio: "inherit" });
        console.warn("[T4Teens PDF] runtime-install klaar, nieuwe launch-poging.");
      } catch (installErr) {
        console.error("[T4Teens PDF] runtime-install mislukt:", installErr);
      }
      return await chromium.launch({ args: LAUNCH_ARGS });
    }
    throw err;
  }
}

export async function bouwT4TeensPdf(html: string): Promise<Buffer> {
  // Additief (Werkprotocol Regel 2): zorg éénmalig per proces dat het gebundelde
  // Noto Color Emoji-lettertype in fontconfig staat, zodat Chromium de emoji-iconen
  // in KLEUR inbedt i.p.v. tofu. Best-effort/non-blocking — mag de render nooit breken.
  try {
    installEmojiFontEenmalig();
  } catch {
    /* ignore */
  }

  // Lazy import zodat de server ook draait als playwright niet beschikbaar is.
  const { chromium } = await import("playwright");
  const browser = await launchChromium(chromium);
  let tmpBestand: string | null = null;
  try {
    const page = await browser.newPage();
    const gereed = inlineAfbeeldingen(html);

    // Schrijf de HTML naar een tijdelijk bestand IN de afname-map en navigeer er
    // via file:// naartoe. Zo laadt chromium de (file://) afbeeldingen betrouwbaar
    // en geheugenzuinig van schijf i.p.v. als grote base64-string in de heap.
    const dir = afnameDir();
    tmpBestand = path.join(dir, `.rapport-render-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    fs.writeFileSync(tmpBestand, gereed, "utf-8");
    await page.goto(pathToFileURL(tmpBestand).href, { waitUntil: "networkidle" });

    // Wacht expliciet tot alle <img> geladen zijn voor we printen.
    await page
      .evaluate(async () => {
        const imgs = Array.from(document.images);
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  img.addEventListener("load", () => res(null));
                  img.addEventListener("error", () => res(null));
                })
          )
        );
        await (document as any).fonts?.ready;
      })
      .catch(() => {});

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
    if (tmpBestand) {
      try {
        fs.unlinkSync(tmpBestand);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function bouwT4TeensPdfBase64(html: string): Promise<string> {
  const buf = await bouwT4TeensPdf(html);
  return buf.toString("base64");
}
