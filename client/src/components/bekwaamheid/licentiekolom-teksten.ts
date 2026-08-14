/**
 * De teksten van de kolom "licentie" op `/admin/toegang`, in vijf talen.
 *
 * De teksten staan hier niet meer. Ze zijn verhuisd naar `shared/i18n.ts` met het
 * prefix `lk_`, zoals de vorige versie van dit bestand als vervolgstap had
 * aangekondigd. Wat hier overblijft, is de aansluiting: de drie namen waarmee
 * `LicentieKolom.tsx`, `admin-toegang.tsx` en de toetsen de kolom al aanspraken,
 * nu afgeleid uit de gedeelde woordenlijst.
 *
 * Waarom dit bestand niet gewoon verdwijnt. De namen `maakKolomVertaler`,
 * `KOLOM_SLEUTELS` en `KOLOM_WOORDEN` staan in drie andere bestanden. Ze hier
 * laten staan als afgeleide betekent dat de verhuizing precies één inhoudelijke
 * wijziging is — de plek van de teksten — en niet ook nog een aanpassing van
 * schermen die verder niets met de verhuizing te maken hebben. Wie later de
 * aanroepen wil rechttrekken, kan dat doen zonder dat de verhuizing zelf opnieuw
 * beoordeeld hoeft te worden.
 *
 * De teksten zijn woordelijk overgenomen. Geen vertaling is bij de verhuizing
 * herschreven: zou er ook maar één zin veranderd zijn, dan was bij een verschil
 * tussen voor en na niet meer te zeggen of het aan de verhuizing lag.
 *
 * De statusnamen worden nog steeds niet vertaald.
 * `bekrachtigd_met_aandachtspunt` is een term uit het draaiboek en staat zo in de
 * databank, in het auditspoor en in de beslisdocumenten.
 */

import { STRINGS, TALEN, t, type Taal } from "@shared/i18n";

/** De sleutels van de kolom, zonder het `lk_`-prefix waarmee ze in STRINGS staan. */
const SLEUTELS = [
  "kop",
  "uitleg",
  "buiten_het_register",
  "geen_licenties",
  "in_orde",
  "let_op",
  "geen_afnamerecht",
  "geen_licentie_voor_deel",
  "geen_instrument",
  "recht",
  "geen_recht",
  "peildatum",
  "laden",
  "mislukt",
  "alert_open",
  "voorwaarde_open",
  "verloopt",
] as const;

export type Kolomsleutel = (typeof SLEUTELS)[number];

/** Zet een kolomsleutel om naar de sleutel zoals `shared/i18n.ts` hem kent. */
function volledig(sleutel: Kolomsleutel): keyof typeof STRINGS {
  return `lk_${sleutel}` as keyof typeof STRINGS;
}

/**
 * Maakt een vertaler voor deze kolom.
 *
 * De terugval op het Nederlands zit nu in `t()` en niet meer hier: één
 * terugvalregel voor de hele woordenlijst is beter dan twee die kunnen gaan
 * afwijken. Het gedrag blijft hetzelfde — een onbekende taal leest Nederlands en
 * nooit een sleutel.
 */
export function maakKolomVertaler(taal: Taal): (sleutel: Kolomsleutel) => string {
  return (sleutel) => t(volledig(sleutel), taal);
}

/** Voor de toets die bewaakt dat er geen sleutel zonder vertaling bestaat. */
export const KOLOM_SLEUTELS: ReadonlyArray<Kolomsleutel> = SLEUTELS;

/**
 * De woorden per taal, opgebouwd uit de gedeelde woordenlijst.
 *
 * Blijft de vorm `taal → sleutel → tekst` houden, want dat is de vorm waarin de
 * toets die de vijf talen bewaakt hem al leest. Zou die vorm hier veranderen, dan
 * moest de toets mee wijzigen, en dan bewaakt de toets na de verhuizing iets
 * anders dan ervoor.
 */
export const KOLOM_WOORDEN: Record<Taal, Record<Kolomsleutel, string>> = Object.fromEntries(
  TALEN.map((taal) => [
    taal,
    Object.fromEntries(SLEUTELS.map((s) => [s, t(volledig(s), taal)])) as Record<
      Kolomsleutel,
      string
    >,
  ]),
) as Record<Taal, Record<Kolomsleutel, string>>;
