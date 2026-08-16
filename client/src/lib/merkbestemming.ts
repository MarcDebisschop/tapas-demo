/**
 * client/src/lib/merkbestemming.ts
 *
 * Waar brengt de merknaam in de kopbalk je naartoe?
 *
 * Tot nu ging die altijd naar "/". Sinds de onthaalpagina de voordeur van Tapas
 * CORE is, betekende dat: wie in de beheeromgeving op de merknaam klikte, stond
 * plots op de publieke onthaalpagina. Binnen een afgeschermde omgeving hoort de
 * merknaam naar de eigen thuisbasis te gaan, niet naar buiten.
 *
 * De regel is bewust een pure functie: ze kent alleen het pad en geeft alleen
 * een pad terug, zodat ze zonder browser te toetsen is.
 */

/** De thuisbasis per afgeschermde omgeving. Langste pad eerst is niet nodig: de vergelijking gebeurt op het eerste paddeel. */
const THUISBASIS: Record<string, string> = {
  admin: "/admin",
  coach: "/coach",
  organisatie: "/organisatie",
  t4r: "/t4r",
};

/**
 * Geeft het pad waar de merknaam in de kopbalk naartoe moet.
 *
 * Binnen een afgeschermde omgeving is dat de thuisbasis van die omgeving,
 * daarbuiten de onthaalpagina.
 */
export function merkBestemming(pad: string): string {
  const eersteDeel = pad.replace(/^\/+/, "").split(/[/?#]/)[0];
  return THUISBASIS[eersteDeel] ?? "/";
}
