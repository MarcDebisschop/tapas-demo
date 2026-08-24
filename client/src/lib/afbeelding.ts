// Een foto die iemand met de gsm neemt is vaak vier tot acht megabyte. Zo'n
// bestand rauw als base64 naar de server sturen zou het bericht ongeveer een
// derde groter maken en die tekst ook in de databank zetten. Voor een portret
// van enkele honderden pixels op het scherm heeft dat geen enkel nut.
//
// Daarom verkleint de browser de foto eerst: de langste zijde wordt hoogstens
// MAX_ZIJDE pixels en het resultaat is een JPEG. Een gewone gsm-foto komt
// daarmee onder de honderd kilobyte uit.

/** Langste zijde van de verkleinde afbeelding, in pixels. */
export const MAX_ZIJDE = 512;

/** Kwaliteit van de JPEG, tussen 0 en 1. */
export const JPEG_KWALITEIT = 0.85;

/**
 * Leest een afbeeldingsbestand, verkleint het en geeft een data-URL terug.
 * Faalt met een leesbare melding wanneer het bestand geen afbeelding is of de
 * browser geen canvas geeft; de aanroeper hoort die melding te tonen in plaats
 * van stilzwijgend het rauwe bestand te versturen.
 */
export function verkleinAfbeeldingNaarDataUrl(
  bestand: File,
  maxZijde: number = MAX_ZIJDE,
): Promise<string> {
  return new Promise((klaar, mislukt) => {
    const lezer = new FileReader();
    lezer.onerror = () => mislukt(new Error("Kon het bestand niet lezen."));
    lezer.onload = () => {
      const beeld = new Image();
      beeld.onerror = () => mislukt(new Error("Kon de afbeelding niet laden."));
      beeld.onload = () => {
        const factor = Math.min(1, maxZijde / Math.max(beeld.width, beeld.height));
        const breedte = Math.max(1, Math.round(beeld.width * factor));
        const hoogte = Math.max(1, Math.round(beeld.height * factor));
        const doek = document.createElement("canvas");
        doek.width = breedte;
        doek.height = hoogte;
        const tekenaar = doek.getContext("2d");
        if (!tekenaar) return mislukt(new Error("Canvas niet beschikbaar."));
        tekenaar.drawImage(beeld, 0, 0, breedte, hoogte);
        klaar(doek.toDataURL("image/jpeg", JPEG_KWALITEIT));
      };
      beeld.src = lezer.result as string;
    };
    lezer.readAsDataURL(bestand);
  });
}
