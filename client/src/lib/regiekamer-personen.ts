/**
 * Kleine rekenhulpjes voor het paneel met de mensen en hun rollen van de
 * Regiekamer. Hier staat geen enkele beslissing over wie wat mag zien: dat
 * gebeurt op de server. Deze module zet alleen de namen van rollen om in
 * gewone taal, stelt de inhoud van een verzoek samen en maakt de melding van
 * de server leesbaar.
 */

export const ROLKEUZES = [
  "facilitator",
  "ankerpunt_investeerder",
  "ankerpunt_onderneming",
  "werkstroomleider",
  "adviseur",
  "overlegorgaan",
  "betrokkene",
] as const;

export type Rolkeuze = (typeof ROLKEUZES)[number];

const rolWoorden: Record<Rolkeuze, string> = {
  facilitator: "Facilitator",
  ankerpunt_investeerder: "Ankerpunt van de investeerder",
  ankerpunt_onderneming: "Ankerpunt van de onderneming",
  werkstroomleider: "Leider van een werkstroom",
  adviseur: "Adviseur",
  overlegorgaan: "Lid van het overlegorgaan",
  betrokkene: "Betrokkene",
};

/** De naam van een rol zoals de gebruiker ze op het scherm leest. */
export function rolTekst(rol: string): string {
  return rolWoorden[rol as Rolkeuze] ?? "Rol zonder naam";
}

/** De kring waarin de partij van deze mens hem plaatst. */
export function kringTekst(kring: number | null): string {
  if (kring === null) return "Nog geen kring";
  return `Kring ${kring}`;
}

/**
 * Alleen de leider van een werkstroom hoort bij een werkstroom. De server
 * weigert een werkstroom bij een andere rol en weigert een leider zonder
 * werkstroom; het scherm vraagt de keuze dus precies daar en nergens anders.
 */
export function vraagtWerkstroom(rol: string): boolean {
  return rol === "werkstroomleider";
}

/** De inhoud van het verzoek om iemand een rol te geven. */
export function bouwRolInhoud(
  rol: string,
  werkstroomId: number | null,
): { rol: string; werkstroomId?: number } {
  if (vraagtWerkstroom(rol) && werkstroomId !== null) {
    return { rol, werkstroomId };
  }
  return { rol };
}

function velduitleg(inhoud: unknown): string[] {
  if (typeof inhoud === "string") return [inhoud];
  if (Array.isArray(inhoud)) return inhoud.flatMap(velduitleg);
  if (inhoud !== null && typeof inhoud === "object") {
    return Object.values(inhoud as Record<string, unknown>).flatMap(velduitleg);
  }
  return [];
}

/**
 * Haalt de zin van de server uit haar antwoord. Er komt niets bij: wat hier
 * uitkomt is de tekst die de server zelf gestuurd heeft. Alleen wanneer de
 * server niets zegt, staat er dat ze niets gezegd heeft.
 */
export function leesServermelding(ruw: string): string {
  const zonderCode = ruw.replace(/^\s*\d{3}:\s*/, "").trim();
  if (zonderCode.length === 0) {
    return "De server gaf geen uitleg bij deze weigering.";
  }
  try {
    const gelezen = JSON.parse(zonderCode) as { error?: unknown };
    const fout = gelezen.error;
    if (typeof fout === "string" && fout.trim().length > 0) return fout;
    const regels = velduitleg(fout).filter((regel) => regel.trim().length > 0);
    if (regels.length > 0) return regels.join(" ");
    return zonderCode;
  } catch {
    return zonderCode;
  }
}
