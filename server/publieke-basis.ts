/**
 * server/publieke-basis.ts
 *
 * Waar de uitnodigingslinks naar wijzen.
 * ---------------------------------------------------------------------------
 * AANLEIDING. De verzending nam de basis van een uitnodigingslink over van de
 * browser van de beheerder. Die stuurde niet enkel de naam van de server mee,
 * maar ook het pad en soms de hash van de pagina waarop hij stond. Daardoor
 * kwam er een adres in de mail als
 *
 *     https://voorbeeld.be/#/hdd#/deelnemer/abc123
 *
 * met twee hekjes erin. De router leest de route uit de hash, vond die route
 * niet, en de deelnemer zag de melding "404, pagina niet gevonden" terwijl zijn
 * token klopte en zijn uitnodiging klaarstond.
 *
 * Een uitnodigingslink hoort te vertrekken van de voordeur van het platform en
 * van niets anders. Deze module maakt van elke opgegeven basis de voordeur:
 * schema en servernaam blijven staan, pad, zoekreeks en hash gaan eraf.
 *
 * De module zoekt de basis in deze volgorde. Eerst neemt zij PUBLIC_BASE_URL uit
 * de omgeving, want alleen die stelt de beheerder bewust in. Dan de basis die de
 * browser meestuurde; die brengt de module eerst terug tot de voordeur. Tot slot
 * de kop van het verzoek zelf, zodat een link ook klopt wanneer niemand een
 * basis meestuurde.
 */

import type { Request } from "express";

/**
 * Brengt een opgegeven basis terug tot schema en servernaam.
 *
 * Geeft een lege tekst terug wanneer er geen bruikbaar webadres in staat. De
 * aanroeper beslist dan zelf wat er gebeurt; deze functie verzint niets.
 */
export function normaliseerBasis(rauw: unknown): string {
  if (typeof rauw !== "string") return "";
  const tekst = rauw.trim();
  if (!tekst) return "";

  // Een adres met een ander schema dan http of https is geen webadres en wordt
  // niet stilzwijgend omgebouwd: dan liever niets dan een verzonnen basis.
  const heeftSchema = /^[a-z][a-z0-9+.-]*:\/\//i.test(tekst);
  if (heeftSchema && !/^https?:\/\//i.test(tekst)) return "";
  const metSchema = heeftSchema ? tekst : `https://${tekst}`;
  try {
    const url = new URL(metSchema);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (!url.hostname) return "";
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

/**
 * Leest de basis uit het verzoek zelf, via de koppen die de omgekeerde
 * doorgeefserver van Render zet. Zonder die koppen valt zij terug op de gewone
 * servernaam en het schema van de verbinding.
 */
export function basisUitVerzoek(req: Request): string {
  const kop = (naam: string): string => {
    const waarde = req.headers[naam];
    if (Array.isArray(waarde)) return waarde[0] ?? "";
    return typeof waarde === "string" ? waarde : "";
  };

  const host = (kop("x-forwarded-host") || kop("host")).split(",")[0].trim();
  if (!host) return "";
  const schema = (kop("x-forwarded-proto").split(",")[0].trim() || req.protocol || "https").trim();
  return normaliseerBasis(`${schema}://${host}`);
}

/**
 * De basis waarvan elke uitnodigingslink vertrekt.
 *
 * @param req    Het verzoek, voor de koppen van de doorgeefserver.
 * @param opgave Wat de browser meestuurde. Mag ontbreken of rommel zijn.
 */
export function publiekeBasis(req: Request, opgave?: unknown): string {
  const uitOmgeving = normaliseerBasis(process.env.PUBLIC_BASE_URL);
  if (uitOmgeving) return uitOmgeving;

  const uitOpgave = normaliseerBasis(opgave);
  if (uitOpgave) return uitOpgave;

  return basisUitVerzoek(req);
}

/**
 * Haalt een tweede hekje uit een link die naar buiten gaat.
 *
 * De laatste sluitsteen. Normaliseert de basis niet, maar keurt het eindresultaat:
 * welke weg een link ook aflegt, hij verlaat het platform met een hekje en niet
 * met twee. Het eerste deel blijft staan, met zijn zoekreeks, want de 2MINSCAN
 * leest zijn token daaruit; het laatste stuk dat als een route leest, wordt de
 * bestemming.
 */
export function eenHekje(link: string): string {
  const tekst = (link ?? "").trim();
  const eerste = tekst.indexOf("#");
  if (eerste < 0) return tekst;

  const voor = tekst.slice(0, eerste);
  const hash = tekst.slice(eerste + 1);
  if (!hash.includes("#")) return tekst;

  const stukken = hash.split("#").filter((s) => s.length > 0);
  const route = [...stukken].reverse().find((s) => s.startsWith("/"));
  if (!route) return `${voor}#${stukken[stukken.length - 1] ?? ""}`;
  return `${voor}#${route}`;
}
