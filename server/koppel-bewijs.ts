/**
 * server/koppel-bewijs.ts
 *
 * Auditbevinding K-1 (kritiek). Het eindscherm koppelt een e-mailadres aan een
 * afname via POST /api/afnames/:id/koppel-dashboard. Dat pad stond open: het
 * enige argument was het oplopende afname-id, dus wie de id's aftelde kon een
 * willekeurig e-mailadres aan een willekeurige afname hangen en een bestaande
 * koppeling onvoorwaardelijk overschrijven.
 *
 * Deze module bevat de twee poortwachters als pure functies, zodat ze los van
 * Express getest kunnen worden:
 *
 *   1. bewijsGeldig()      - de oproeper moet bewijzen dat hij deze afname zelf
 *                            heeft afgelegd, door de respondentCode of het
 *                            invite-token mee te sturen. Beide zijn onraadbaar;
 *                            het id is dat niet.
 *   2. koppelBeslissing()  - een afname die al aan een e-mailadres hangt wordt
 *                            nooit overschreven. Hetzelfde adres blijft
 *                            idempotent doorlopen (het eindscherm mag opnieuw
 *                            verzonden worden), een ander adres wordt geweigerd.
 *
 * De vergelijking is tijdconstant, zodat het antwoordtempo niet verklapt hoeveel
 * tekens van een code juist waren.
 */
import { timingSafeEqual } from "node:crypto";

/** Alleen de velden die de poortwachters nodig hebben. */
export interface KoppelAfname {
  respondentCode?: string | null;
  inviteToken?: string | null;
  deelnemerEmail?: string | null;
}

/** Zelfde normalisatie als de opslaglaag: kleine letters, zonder witruimte. */
export function normaliseerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Tijdconstante tekstvergelijking; verschillende lengtes leveren false. */
function gelijkTijdconstant(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Haalt het bewijs uit de body. Het eindscherm stuurt `respondentCode`; de
 * uitnodigingsflow mag ook `token` (het invite-token) gebruiken.
 */
export function bewijsUitBody(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const ruw = b.respondentCode ?? b.token ?? b.bewijs;
  return typeof ruw === "string" ? ruw.trim() : "";
}

/**
 * True zodra het meegestuurde bewijs overeenkomt met de respondentCode of het
 * invite-token van deze afname. Een leeg bewijs is altijd ongeldig.
 */
export function bewijsGeldig(afname: KoppelAfname, bewijs: string): boolean {
  const kandidaat = (bewijs ?? "").trim();
  if (!kandidaat) return false;
  const geldigeWaarden = [afname.respondentCode, afname.inviteToken]
    .filter((w): w is string => typeof w === "string" && w.length > 0);
  return geldigeWaarden.some((w) => gelijkTijdconstant(w, kandidaat));
}

export type KoppelBeslissing =
  /** Nog niet gekoppeld: koppelen mag. */
  | { toegestaan: true; reeds: false }
  /** Al aan hetzelfde adres gekoppeld: idempotent doorlaten, niet herschrijven. */
  | { toegestaan: true; reeds: true }
  /** Al aan een ander adres gekoppeld: weigeren, nooit overschrijven. */
  | { toegestaan: false; reden: "reeds-gekoppeld" };

/**
 * Beslist of deze afname aan dit e-mailadres gekoppeld mag worden. Een
 * bestaande koppeling wordt nooit overschreven.
 */
export function koppelBeslissing(afname: KoppelAfname, email: string): KoppelBeslissing {
  const bestaand = afname.deelnemerEmail ? normaliseerEmail(afname.deelnemerEmail) : "";
  if (!bestaand) return { toegestaan: true, reeds: false };
  if (bestaand === normaliseerEmail(email)) return { toegestaan: true, reeds: true };
  return { toegestaan: false, reden: "reeds-gekoppeld" };
}
