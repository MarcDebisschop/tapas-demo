/**
 * Teamscan-itembank — vertaallaag (fr/en/es/ru), met fallback naar NL.
 * --------------------------------------------------------------------
 * De NL-itembank (itembank.json) blijft de bron van waarheid voor
 * scoring (niveau, kleur, pijler-mapping). Deze module levert een
 * vertaalde KOPIE van de itembank voor de afname-UI en het rapport.
 *
 * Vertalingen staan in itembank-vertalingen.json, gekeyd op stabiele
 * string-ID's. Ontbreekt een key of taal → fallback naar NL.
 *
 * Vaktermregels (geborgd in de vertaalbron): "Drivers" en de Engelse
 * labels "Need/Nice/Not needed" blijven onvertaald. De cluster-namen
 * en sourceRefs zitten niet in de itembank, dus geen risico hier.
 */
import itembankJson from "./itembank.json";
import vertalingenJson from "./itembank-vertalingen.json";

export type TeamscanTaal = "nl" | "fr" | "en" | "es" | "ru";
const DOELTALEN: TeamscanTaal[] = ["fr", "en", "es", "ru"];

type VertaalMap = Record<string, string>;
const VERTALINGEN: Record<string, VertaalMap> = vertalingenJson as any;

/** Haal vertaalde string of NL-fallback. */
function v(taal: TeamscanTaal, key: string, fallback: string): string {
  if (taal === "nl") return fallback;
  const map = VERTALINGEN[taal];
  if (!map) return fallback;
  const val = map[key];
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

/** Bouw een diepe kopie van de itembank met vertaalde tekstvelden. */
export function vertaalItembank(taalIn: string): any {
  const taal = (DOELTALEN as string[]).includes(taalIn) ? (taalIn as TeamscanTaal) : "nl";
  // diepe kopie zodat we de bron niet muteren
  const ib: any = JSON.parse(JSON.stringify(itembankJson));
  if (taal === "nl") return ib;

  // --- schaal.labels ---
  for (const n of ["1", "2", "3", "4", "5"]) {
    ib.schaal.labels[n] = v(taal, `schaal.${n}`, ib.schaal.labels[n]);
  }

  // --- Blok A — Fundament ---
  const A = ib.blokken.A_fundament;
  A.naam = v(taal, "A.naam", A.naam);
  A.instructie = v(taal, "A.instructie", A.instructie);
  for (const it of A.items) {
    it.tekst = v(taal, it.id, it.tekst); // F1..F8
  }

  // --- Blok B — Lencioni ---
  const B = ib.blokken.B_lencioni;
  B.naam = v(taal, "B.naam", B.naam);
  B.instructie = v(taal, "B.instructie", B.instructie);
  for (const it of B.items) {
    it.tekst = v(taal, `L${it.id}`, it.tekst); // L1..L38
  }

  // --- Blok C — Vertrouwensanatomie ---
  const C = ib.blokken.C_vertrouwensanatomie;
  C.naam = v(taal, "C.naam", C.naam);
  C.instructie = v(taal, "C.instructie", C.instructie);
  for (const el of C.elementen) {
    el.naam = v(taal, `C.${el.id}.naam`, el.naam);
    el.omschrijving = v(taal, `C.${el.id}.omschrijving`, el.omschrijving);
  }
  for (const n of ["1", "2", "3", "4", "5"]) {
    C.prestatie.labels[n] = v(taal, `C.prestatie.${n}`, C.prestatie.labels[n]);
  }

  // --- Pijlers (facilitator-rapport) ---
  for (const p of ib.pijlers) {
    p.naam = v(taal, `pijler.${p.code}.naam`, p.naam);
    p.korteUitleg = v(taal, `pijler.${p.code}.korteUitleg`, p.korteUitleg);
  }
  if (ib.fundamentPijler) {
    ib.fundamentPijler.naam = v(taal, "pijler.fundament.naam", ib.fundamentPijler.naam);
    ib.fundamentPijler.korteUitleg = v(taal, "pijler.fundament.korteUitleg", ib.fundamentPijler.korteUitleg);
  }

  return ib;
}
