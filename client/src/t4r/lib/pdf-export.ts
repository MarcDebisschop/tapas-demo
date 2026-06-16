import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ---------------------------------------------------------------------------
// Echte PDF-download zonder afhankelijkheid van de browser-printdialoog.
// De printdialoog vanuit een dynamisch iframe is in een sandbox/iframe-
// omgeving onbetrouwbaar (wordt geblokkeerd of "ignoring too frequent calls
// to print()"). In plaats daarvan renderen we de node naar een canvas en
// bouwen we daarmee een meerpagina A4-PDF die direct gedownload wordt.
// ---------------------------------------------------------------------------
// Resultaat van een exportpoging. "download" = bestand is direct opgeslagen;
// "nieuw-tabblad" = de directe download werd geblokkeerd (sandbox) en de PDF is
// in een nieuw tabblad geopend zodat de gebruiker daar kan opslaan.
export type PdfExportResultaat = "download" | "nieuw-tabblad";

// Foutcode voor een herkenbare, gebruiksvriendelijke melding.
export class PdfExportError extends Error {
  code: "leeg" | "render" | "geblokkeerd";
  constructor(code: "leeg" | "render" | "geblokkeerd", message: string) {
    super(message);
    this.name = "PdfExportError";
    this.code = code;
  }
}

export async function downloadNodeAlsPdf(
  node: HTMLElement | null,
  bestandsnaam: string,
): Promise<PdfExportResultaat> {
  if (!node) {
    throw new PdfExportError("leeg", "Geen rapportinhoud gevonden om te exporteren.");
  }
  // Niets om te tonen? (bv. rapport nog niet opgebouwd)
  if (node.innerText.trim().length === 0) {
    throw new PdfExportError("leeg", "Er is nog geen inhoud om te exporteren.");
  }

  // Forceer de lichte (corporate) weergave in de kloon, ongeacht het actieve
  // thema, en verberg niet-printbare elementen.
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(node, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
    onclone: (clonedDoc) => {
      clonedDoc.documentElement.classList.remove("dark");
      clonedDoc.body.classList.remove("dark");
      // BELANGRIJK: html2canvas itereert document.styleSheets[].cssRules. Een
      // cross-origin stylesheet (bv. Google Fonts) gooit daarbij een
      // SecurityError, waardoor de hele render afbreekt en de PDF-download
      // faalt. De lettertypes worden nu lokaal geserveerd, maar als terugval
      // verwijderen we hier elke externe stylesheet/@import en preconnect uit
      // de kloon, zodat er gegarandeerd geen cross-origin cssRules meer zijn.
      const eigenOrigin = clonedDoc.location?.origin ?? window.location.origin;
      clonedDoc
        .querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')
        .forEach((el) => {
          const href = (el as HTMLLinkElement).href || "";
          try {
            if (href && new URL(href, eigenOrigin).origin !== eigenOrigin) {
              el.parentNode?.removeChild(el);
            }
          } catch {
            el.parentNode?.removeChild(el);
          }
        });
      clonedDoc.querySelectorAll("style").forEach((styleEl) => {
        const txt = styleEl.textContent || "";
        if (/@import\s+url\((['"]?)https?:\/\//i.test(txt)) {
          styleEl.textContent = txt.replace(
            /@import\s+url\([^)]*\)\s*;?/gi,
            "",
          );
        }
      });
      clonedDoc.querySelectorAll("[data-no-print]").forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });
      // html2canvas kan moderne kleurfuncties (color-mix(), color(), oklch(), lab())
      // niet parsen en breekt daarop af. We saneren elke inline-style die zo'n
      // functie gebruikt en vervangen die door een veilige, neutrale waarde.
      const onveilig = /(color-mix|color|oklch|oklab|lab|lch)\s*\(/i;
      const props = ["background-color", "background", "color", "border-color",
        "border-left-color", "border-right-color", "border-top-color",
        "border-bottom-color", "fill", "stroke", "box-shadow"];
      clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const inline = el.getAttribute("style");
        if (inline && onveilig.test(inline)) {
          for (const p of props) {
            const v = el.style.getPropertyValue(p);
            if (v && onveilig.test(v)) {
              // Achtergrond-tints worden transparant, tekst/randen vallen terug op currentColor.
              if (p === "background-color" || p === "background" || p === "box-shadow") {
                el.style.setProperty(p, "transparent");
              } else {
                el.style.removeProperty(p);
              }
            }
          }
        }
      });
    },
      // Beetje extra hoogte zodat de laatste regel nooit tegen de paginarand valt.
      height: node.scrollHeight + 48,
      windowHeight: node.scrollHeight + 48,
    });
  } catch (e) {
    throw new PdfExportError(
      "render",
      "De rapportweergave kon niet worden omgezet naar PDF. Vernieuw de pagina en probeer het opnieuw.",
    );
  }

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12; // mm
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  const imgWmm = usableW;
  const imgHmm = (canvas.height * imgWmm) / canvas.width;

  if (imgHmm <= usableH) {
    pdf.addImage(imgData, "JPEG", margin, margin, imgWmm, imgHmm);
  } else {
    let restHmm = imgHmm;
    let offsetMm = 0;
    let eerste = true;
    while (restHmm > 0) {
      if (!eerste) pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, margin - offsetMm, imgWmm, imgHmm);
      restHmm -= usableH;
      offsetMm += usableH;
      eerste = false;
    }
  }

  // Strip tekens die problematisch zijn in bestandsnamen; behoud letters/cijfers.
  const veilig =
    bestandsnaam.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() || "rapport";
  const fileName = `${veilig}.pdf`;

  // De app draait in de UI binnen een sandboxed iframe; een directe
  // download-klik (<a download>) wordt daar door sommige browsers geblokkeerd.
  // We proberen eerst de directe download en vallen anders terug op het openen
  // van de PDF in een nieuw tabblad, zodat de gebruiker daar kan opslaan/printen.
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);

  // Detecteer of we in een (sandboxed) iframe draaien — dat is het geval in de
  // Perplexity-app-weergave. Een directe download-klik (<a download>) wordt daar
  // door de browser stil geblokkeerd (geen exception), dus dan openen we de PDF
  // direct in een nieuw tabblad, waar de gebruiker hem kan opslaan of printen.
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true; // cross-origin toegang geweigerd => zeker in een iframe
  }

  if (inIframe) {
    // In een iframe is een directe download-klik onbetrouwbaar en de
    // window.open-referentie is niet altijd betrouwbaar af te lezen. We doen
    // daarom BEIDE: open de PDF in een nieuw tabblad én trigger een download-
    // link. Eén daarvan slaagt vrijwel altijd. We tonen een informatieve
    // melding in plaats van een harde fout.
    let popupGeopend = false;
    try {
      const win = window.open(url, "_blank", "noopener,noreferrer");
      popupGeopend = !!win;
    } catch {
      popupGeopend = false;
    }
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      // negeren — het tabblad is dan de terugval
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    // We melden "nieuw-tabblad": dat is het betrouwbare pad in de app-weergave.
    // (popupGeopend wordt enkel als hint gebruikt; de download-link is de terugval.)
    void popupGeopend;
    return "nieuw-tabblad";
  }

  // Niet in een iframe: gewone directe download.
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "download";
}
