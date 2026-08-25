// Het getekende wiel omzetten naar een PNG, zodat een PDF het kan opnemen.
//
// Waarom dit in de browser gebeurt
//   De 24 wielposities en de kleurvolgorde die op elke positie geldt staan in
//   posities.ts en worden getekend door wiel.ts. Die volgorde is gemeten op de
//   speelmat en is de enige bron van waarheid. Zou de server het wiel opnieuw
//   natekenen voor de PDF, dan bestonden er twee tekeningen die uit elkaar
//   kunnen groeien. Daarom wordt het wiel dat op het scherm staat letterlijk
//   overgenomen: dezelfde tekening, enkel als beeld.
//
// De omzetting gebruikt een data-URL en geen externe bron, zodat het canvas
// niet besmet raakt en de pixels leesbaar blijven.

/** Zijde van het uitgevoerde beeld in pixels. Ruim voor druk op A4. */
const ZIJDE = 1100;

/**
 * Zet een wiel-SVG om naar een PNG-data-URL. Geeft null terug wanneer de
 * omzetting niet lukt; de beller hoort dan gewoon zonder beeld verder te gaan.
 */
export async function wielAlsPng(svg: SVGSVGElement, zijde = ZIJDE): Promise<string | null> {
  try {
    // Kopie maken en de maten hard zetten: een SVG zonder width/height rendert
    // in sommige browsers op nul pixels.
    const kopie = svg.cloneNode(true) as SVGSVGElement;
    kopie.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    kopie.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    kopie.setAttribute("width", String(zijde));
    kopie.setAttribute("height", String(zijde));
    kopie.removeAttribute("style");

    const bron = new XMLSerializer().serializeToString(kopie);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bron)}`;

    const beeld = await new Promise<HTMLImageElement>((klaar, mis) => {
      const img = new Image();
      img.onload = () => klaar(img);
      img.onerror = () => mis(new Error("wiel-SVG kon niet worden geladen"));
      img.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = zijde;
    canvas.height = zijde;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Witte ondergrond: een PDF-pagina is wit, en zonder vulling wordt
    // doorzichtigheid zwart in sommige lezers.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, zijde, zijde);
    ctx.drawImage(beeld, 0, 0, zijde, zijde);
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("[temperamentenwiel] omzetten naar PNG mislukt:", e);
    return null;
  }
}
