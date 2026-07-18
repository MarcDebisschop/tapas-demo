// ---------------------------------------------------------------------------
// Gedeelde HTML -> PDF-laag (Fase 3, serverless-launch in Fase 4).
//
// WAAROM
// Elk HTML-instrument (t4p, t4students, t4o, t4sports(+modules), teamscan,
// t4teens) heeft al een VASTE, instrument-specifieke HTML-layout via zijn eigen
// renderXxxHtml(). Die layout is de bindende structuur en mag NIET wijzigen.
// Deze module zet die bestaande HTML-output om naar een downloadbare PDF, zodat
// er ALTIJD een PDF op maat is zonder de layouts te dupliceren.
//
// De pdfkit-instrumenten HDD en Driver-scan hebben al hun eigen echte PDF en
// lopen NIET via deze laag.
//
// DUAL-MODE LAUNCH (Fase 4)
// Render-free heeft GEEN systeem-Chromium. Daarom twee paden:
//  (a) Productie/serverless (Render): playwright-core + @sparticuz/chromium —
//      Chromium komt als npm-dependency mee, geen systeeminstallatie nodig.
//      Launch-per-render met directe close (512MB-veilig, geen gedeelde
//      instance die kan lekken).
//  (b) Lokaal/dev: de gewone Playwright-launch met een gedeelde, hergebruikte
//      browser-instance (snel voor herhaalde renders/tests).
//
// ROBUUSTHEID (bindende eis): een render-fout mag de afname/rapport-flow nooit
// breken. Alles wordt dynamisch geïmporteerd; faalt de render (geen Chromium,
// crash, ...), dan logt deze module de echte oorzaak (incl. executablePath) en
// gooit een fout die de aanroeper opvangt en terugvalt op de HTML-download.
// ---------------------------------------------------------------------------

// Type-only import: brengt geen runtime-afhankelijkheid mee. playwright-core en
// playwright delen dezelfde Browser-types.
import type { Browser } from "playwright-core";

export interface RenderPdfOpts {
  titel?: string;
  // A4-marges (CSS-eenheden). Bewust ruim genoeg voor de bestaande layouts.
  marge?: { top?: string; right?: string; bottom?: string; left?: string };
}

// Render zet standaard RENDER=true; NODE_ENV=production dekt andere productie-
// omgevingen af. In beide gevallen gebruiken we de serverless @sparticuz-launch.
function isServerless(): boolean {
  return !!process.env.RENDER || process.env.NODE_ENV === "production";
}

// --- Dev: gedeelde browser-instance (lazy, hergebruikt) --------------------
let devBrowserPromise: Promise<Browser> | null = null;

async function getDevBrowser(): Promise<Browser> {
  if (!devBrowserPromise) {
    devBrowserPromise = (async () => {
      // Volledige Playwright met zijn eigen gebundelde Chromium (lokale dev).
      const { chromium } = await import("playwright");
      return chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    })();
    // Reset de cache bij een mislukte launch, zodat een volgende poging opnieuw
    // probeert i.p.v. een kapotte promise te blijven hergebruiken.
    devBrowserPromise.catch(() => {
      devBrowserPromise = null;
    });
  }
  return devBrowserPromise;
}

// --- Productie/serverless: @sparticuz/chromium + playwright-core -----------
// Launch-per-render (geen gedeelde instance) zodat op Render-free (512MB) elk
// verzoek een schone, direct-gesloten browser krijgt en geheugen niet lekt.
async function launchServerlessBrowser(): Promise<{ browser: Browser; executablePath: string }> {
  const [{ chromium }, sparticuzMod] = await Promise.all([
    import("playwright-core"),
    import("@sparticuz/chromium"),
  ]);
  // ESM/CJS-interop: @sparticuz/chromium exporteert het object als default.
  const sparticuz: any = (sparticuzMod as any).default ?? sparticuzMod;
  // executablePath() geeft een Promise<string> (pakt de gebundelde binary uit).
  const executablePath: string = await sparticuz.executablePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: sparticuz.args,
  });
  return { browser, executablePath };
}

// Wikkelt een fragment in een volledig HTML-document. De bestaande generators
// leveren al een volledige pagina (<html>...</html>); dan laten we de HTML met
// rust. Enkel een kaal fragment krijgt een minimale wrapper.
function alsVolledigDocument(html: string): string {
  if (/<html[\s>]/i.test(html) || /<!doctype/i.test(html)) return html;
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<style>@page{size:A4;margin:0}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1e293b}</style>
</head><body>${html}</body></html>`;
}

// Rendert één document op een gegeven browser naar een PDF-buffer. Sluit altijd
// de pagina (finally); de browser-levensduur wordt door de aanroeper beheerd.
async function rendermetBrowser(
  browser: Browser,
  document: string,
  opts: RenderPdfOpts,
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(document, { waitUntil: "networkidle" });
    if (opts.titel) {
      await page.evaluate((t) => {
        // In evaluate verwijst `document` naar de browser-DOM (niet de string).
        document.title = t;
      }, opts.titel);
    }
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: opts.marge?.top ?? "12mm",
        right: opts.marge?.right ?? "0mm",
        bottom: opts.marge?.bottom ?? "12mm",
        left: opts.marge?.left ?? "0mm",
      },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Zet een (volledige) HTML-string om naar een PDF-buffer via headless Chromium.
 * A4, printBackground aan. Kiest automatisch de serverless- (@sparticuz) of
 * dev-launch. Gooit bij een render-fout — de aanroeper moet dat opvangen en
 * terugvallen op de HTML-download.
 */
export async function renderRapportPdf(html: string, opts: RenderPdfOpts = {}): Promise<Buffer> {
  const documentHtml = alsVolledigDocument(html);

  if (isServerless()) {
    // Launch-per-render + directe close (512MB-veilig).
    let browser: Browser | null = null;
    let executablePath = "(nog niet bepaald)";
    try {
      const launched = await launchServerlessBrowser();
      browser = launched.browser;
      executablePath = launched.executablePath;
      return await rendermetBrowser(browser, documentHtml, opts);
    } catch (e) {
      console.error(
        `[rapport-pdf] Serverless PDF-render mislukt (executablePath=${executablePath}): ` +
          `${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  // Lokaal/dev: gedeelde instance hergebruiken.
  try {
    const browser = await getDevBrowser();
    return await rendermetBrowser(browser, documentHtml, opts);
  } catch (e) {
    console.error(
      `[rapport-pdf] Dev PDF-render mislukt: ${e instanceof Error ? e.message : String(e)}`,
    );
    throw e;
  }
}

// --- TIJDELIJK (Fase 5) diagnose -------------------------------------------
// Forceert de serverless-launch + een mini-PDF en rapporteert stap-voor-stap
// waar het misgaat. Uitsluitend voor het tijdelijke /api/_pdfdiag-endpoint.
export interface PdfDiagResult {
  ok: boolean;
  stap: string;
  executablePath?: string;
  chromiumArgsCount?: number;
  pdfBytes?: number;
  error?: string;
  stack?: string;
}

export async function diagServerlessPdf(): Promise<PdfDiagResult> {
  let stap = "start";
  let executablePath = "(nog niet bepaald)";
  let chromiumArgsCount: number | undefined;
  try {
    stap = "import playwright-core + @sparticuz/chromium";
    const [{ chromium }, sparticuzMod] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium"),
    ]);
    const sparticuz: any = (sparticuzMod as any).default ?? sparticuzMod;

    stap = "sparticuz.executablePath()";
    executablePath = await sparticuz.executablePath();
    chromiumArgsCount = Array.isArray(sparticuz.args) ? sparticuz.args.length : undefined;

    stap = "chromium.launch";
    const browser = await chromium.launch({
      headless: true,
      executablePath,
      args: sparticuz.args,
    });
    try {
      stap = "newPage + setContent";
      const page = await browser.newPage();
      await page.setContent("<h1>test</h1>", { waitUntil: "load" });
      stap = "page.pdf";
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      await page.close().catch(() => {});
      return {
        ok: true,
        stap: "klaar",
        executablePath,
        chromiumArgsCount,
        pdfBytes: Buffer.from(pdf).length,
      };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (e) {
    return {
      ok: false,
      stap,
      executablePath,
      chromiumArgsCount,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error && e.stack ? e.stack.slice(0, 1500) : undefined,
    };
  }
}

// Best-effort opruimen bij server-shutdown. Sluit enkel de gedeelde dev-instance;
// serverless-browsers worden al per render gesloten. Aanroep is optioneel.
export async function sluitPdfBrowser(): Promise<void> {
  if (!devBrowserPromise) return;
  try {
    const b = await devBrowserPromise;
    await b.close();
  } catch {
    // stil
  } finally {
    devBrowserPromise = null;
  }
}
