// ===========================================================================
// naar-blok.ts: een blok op de onthaalpagina aanwijzen vanaf een andere pagina.
//
// De app gebruikt hash-routing. Een verwijzing als href="#contact" zou de
// router meesturen en op een onbestaande route uitkomen. Binnen één pagina
// lost naarSectie() dat op door het blok in beeld te schuiven. Van een andere
// pagina naar een blok op de onthaalpagina gaan lukt daarmee niet, want de
// pagina bestaat op het moment van de klik nog niet.
//
// Deze twee functies leggen de wens kort vast in sessionStorage. De
// onthaalpagina leest ze bij het openen, rolt naar het blok en wist de wens
// meteen. Er blijft dus niets achter en er verandert niets aan het adres.
// ===========================================================================

const SLEUTEL = "tapas_naar_blok";

/** Legt vast naar welk blok de onthaalpagina straks moet rollen. */
export function onthoudBlok(id: string): void {
  try {
    window.sessionStorage.setItem(SLEUTEL, id);
  } catch {
    /* geen sessionStorage, dan opent de pagina gewoon bovenaan */
  }
}

/** Leest de wens en wist ze onmiddellijk. Geeft null wanneer er geen is. */
export function neemBlokOp(): string | null {
  try {
    const id = window.sessionStorage.getItem(SLEUTEL);
    if (id) window.sessionStorage.removeItem(SLEUTEL);
    return id;
  } catch {
    return null;
  }
}
