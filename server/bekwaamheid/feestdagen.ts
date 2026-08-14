/**
 * De Belgische wettelijke feestdagen, berekend en niet bijgehouden.
 *
 * Waarom berekend en niet als lijst per jaar. Een lijst moet elk jaar door een
 * mens worden bijgewerkt. Dat gaat de eerste twee jaar goed en daarna niet meer,
 * en dan meet de teller stil verkeerde termijnen zonder dat iets alarmeert. Zeven
 * van de tien dagen staan op een vaste datum; de drie andere hangen aan Pasen, en
 * Pasen is exact te berekenen. Er is dus geen reden om iets bij te houden.
 *
 * De tien dagen liggen vast in de wet van 4 januari 1974 en zijn sinds 1947
 * onveranderd: 1 januari, paasmaandag, 1 mei, Onze-Heer-Hemelvaart,
 * pinkstermaandag, 21 juli, 15 augustus, 1 november, 11 november en 25 december
 * (FOD Werkgelegenheid, Arbeid en Sociaal Overleg,
 * https://werk.belgie.be/nl/themas/feestdagen-en-verloven/feestdagen).
 *
 * Alleen België. Het draaiboek belegt de debrief en de publicatie bij het bureau
 * dat de beslissing neemt, en dat bureau staat in België. De landcode in het
 * register hoort bij een persoon en niet bij het bureau, en zou hier dus het
 * verkeerde antwoord geven. Komt er een tweede land bij, dan hoort dat een tweede
 * kalender te worden met een expliciete keuze erboven — niet een landcode die
 * ergens uit een persoonsregel wordt gevist.
 *
 * Wat deze module NIET doet: vervangingsdagen. Valt een feestdag op een zondag of
 * op een gewone inactiviteitsdag, dan moet de werkgever ze vervangen door een
 * gewone activiteitsdag, en die dag wordt collectief vastgelegd per onderneming
 * (zelfde bron). Zo'n dag is per definitie niet te berekenen. Gevolg: in een jaar
 * met een feestdag in het weekend telt deze module één werkdag te veel, want de
 * vervangingsdag valt wél op een werkdag. De teller meet dan iets krap. Dat is
 * dezelfde richting als de fout die hij vervangt, maar veel kleiner: hoogstens
 * twee dagen per jaar in plaats van tien.
 */

/** Eén feestdag: de datum als `JJJJ-MM-DD` en de naam zoals de wet hem noemt. */
export interface Feestdag {
  datum: string;
  naam: string;
}

function alsDatumtekst(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function verschoven(basis: Date, dagen: number): Date {
  const d = new Date(basis.getTime());
  d.setUTCDate(d.getUTCDate() + dagen);
  return d;
}

/**
 * Eerste paasdag in de gregoriaanse kalender, volgens het anonieme algoritme
 * (Meeus/Butcher). Geldig voor alle jaren in de gregoriaanse kalender.
 *
 * De uitkomst is geijkt op een onafhankelijke implementatie voor de jaren 2024
 * tot en met 2035; zie `tests/bekwaamheid-feestdagen.test.ts`.
 */
export function eerstePaasdag(jaar: number): Date {
  const a = jaar % 19;
  const b = Math.floor(jaar / 100);
  const c = jaar % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31); // 3 = maart, 4 = april
  const dag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(jaar, maand - 1, dag));
}

/**
 * De tien wettelijke feestdagen van één jaar, op datum gesorteerd.
 *
 * Extralegale en regionale dagen staan er niet in: 11 juli (Vlaamse
 * Gemeenschap), 15 november (Koningsfeest), 2 november en 26 december zijn geen
 * wettelijke feestdagen in de zin van de wet van 1974. Ze meerekenen zou de
 * termijn ruimer maken dan de wet toestaat, en dat is de verkeerde kant om op te
 * fout te gaan bij een termijn die een kandidaat beschermt.
 */
export function feestdagenVan(jaar: number): Feestdag[] {
  const pasen = eerstePaasdag(jaar);
  const dagen: Feestdag[] = [
    { datum: `${jaar}-01-01`, naam: "Nieuwjaar" },
    { datum: alsDatumtekst(verschoven(pasen, 1)), naam: "Paasmaandag" },
    { datum: `${jaar}-05-01`, naam: "Feest van de Arbeid" },
    { datum: alsDatumtekst(verschoven(pasen, 39)), naam: "Onze-Heer-Hemelvaart" },
    { datum: alsDatumtekst(verschoven(pasen, 50)), naam: "Pinkstermaandag" },
    { datum: `${jaar}-07-21`, naam: "Nationale feestdag" },
    { datum: `${jaar}-08-15`, naam: "Onze-Lieve-Vrouw-Hemelvaart" },
    { datum: `${jaar}-11-01`, naam: "Allerheiligen" },
    { datum: `${jaar}-11-11`, naam: "Wapenstilstand" },
    { datum: `${jaar}-12-25`, naam: "Kerstmis" },
  ];
  return dagen.sort((a, b) => a.datum.localeCompare(b.datum));
}

/**
 * Alle feestdatums tussen twee jaren, als verzameling om snel in op te zoeken.
 *
 * De grenzen zijn inclusief. Een termijn die over de jaarwissel loopt, heeft
 * beide jaren nodig; daarom neemt de werkdagenteller altijd het jaar van de
 * begindatum tot en met dat van de einddatum.
 */
export function feestdatumsTussenJaren(vanJaar: number, totJaar: number): Set<string> {
  const uit = new Set<string>();
  for (let j = vanJaar; j <= totJaar; j += 1) {
    for (const f of feestdagenVan(j)) uit.add(f.datum);
  }
  return uit;
}

/** Is deze datum een Belgische wettelijke feestdag? */
export function isFeestdag(datum: string): boolean {
  const dag = datum.slice(0, 10);
  const jaar = Number(dag.slice(0, 4));
  if (!Number.isFinite(jaar)) return false;
  return feestdagenVan(jaar).some((f) => f.datum === dag);
}
