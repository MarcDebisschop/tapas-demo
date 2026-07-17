// ---------------------------------------------------------------------------
// Gedeelde HTML -> PDF-laag (Fase 3).
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
// ROBUUSTHEID (bindende eis): een render-fout mag de afname/rapport-flow nooit
// breken. Playwright wordt dynamisch geïmporteerd en één browser-instance wordt
// hergebruikt. Faalt de render (geen Chromium, crash, ...), dan gooit deze
// functie een fout die de aanroeper opvangt en terugvalt op de HTML-download.
// ---------------------------------------------------------------------------

// Type-only import: brengt geen runtime-afhankelijkheid mee (playwright wordt
// pas via dynamic import geladen wanneer er echt een PDF gemaakt wordt).
import type { Browser } from "playwright";

export interface RenderPdfOpts {
  titel?: string;
  // A4-marges (CSS-eenheden). Bewust ruim genoeg voor de bestaande layouts.
  marge?: { top?: string; right?: string; bottom?: string; left?: string };
}

// Eén gedeelde browser-instance (lazy). We bewaren de launch-promise zodat
// gelijktijdige aanvragen niet elk een eigen browser starten.
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      // Dynamische import: als playwright/Chromium ontbreekt, faalt dit hier en
      // valt de aanroeper netjes terug op HTML.
      const { chromium } = await import("playwright");
      return chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    })();
    // Reset de cache bij een mislukte launch, zodat een volgende poging opnieuw
    // probeert i.p.v. een kapotte promise te blijven hergebruiken.
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
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

/**
 * Zet een (volledige) HTML-string om naar een PDF-buffer via Playwright headless
 * Chromium. A4, printBackground aan. Gooit bij een render-fout — de aanroeper
 * moet dat opvangen en terugvallen op de HTML-download.
 */
export async function renderRapportPdf(html: string, opts: RenderPdfOpts = {}): Promise<Buffer> {
  const document = alsVolledigDocument(html);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(document, { waitUntil: "networkidle" });
    if (opts.titel) {
      await page.evaluate((t) => {
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

// Best-effort opruimen bij server-shutdown (niet verplicht; Chromium sluit mee
// af met het proces). Aangeroepen vanuit index.ts is optioneel.
export async function sluitPdfBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    // stil
  } finally {
    browserPromise = null;
  }
}
