/**
 * client/src/lib/merkbestemming.ts
 *
 * Waar brengt de merknaam in de kopbalk je naartoe?
 *
 * Tot de onthaalpagina bestond, ging die altijd naar "/", en op "/" stond de
 * platformpagina met de rondleiding, de werelden en de tegels. De merknaam was
 * dus de weg terug naar het platform. Sinds de onthaalpagina op "/" staat,
 * bracht diezelfde knop een ingelogde beheerder op de publieke voordeur.
 *
 * De weg terug blijft wat ze was: vanuit een afgeschermde omgeving brengt de
 * merknaam je naar de platformpagina, nu op "/platform". Buiten die omgevingen
 * blijft ze de onthaalpagina aanwijzen.
 *
 * De regel is bewust een pure functie: ze kent alleen het pad en geeft alleen
 * een pad terug, zodat ze zonder browser te toetsen is.
 */

/** Het adres van de platformpagina met de rondleiding, de werelden en de tegels. */
export const PLATFORM_PAD = "/platform";

/** De afgeschermde omgevingen. Daarbinnen is de merknaam de weg terug naar het platform. */
const AFGESCHERMD = ["admin", "coach", "organisatie", "t4r"];

/**
 * Geeft het pad waar de merknaam in de kopbalk naartoe moet.
 *
 * Binnen een afgeschermde omgeving is dat de platformpagina, daarbuiten de
 * onthaalpagina.
 */
export function merkBestemming(pad: string): string {
  const eersteDeel = pad.replace(/^\/+/, "").split(/[/?#]/)[0];
  return AFGESCHERMD.includes(eersteDeel) ? PLATFORM_PAD : "/";
}
