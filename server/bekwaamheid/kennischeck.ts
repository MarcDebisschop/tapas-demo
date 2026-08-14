/**
 * De kennischeck: de samenstelling van een itemset en het nakijken ervan.
 *
 * Bewijsstuk 1 uit draaiboek §4.3: veertig items, online, 45 minuten, open boek,
 * as WETEN, weging 20%, drempel 60%. Dit bestand doet twee dingen en raakt
 * daarbij geen databank en geen Express aan — dezelfde eis als bij
 * `normprofiel.ts`, `beslisregels.ts` en `itembank.ts`.
 *
 * 1. `stelKennischeckSamen` trekt uit een bank een set die het blokplan haalt, of
 *    weigert met een benoembaar tekort per blok.
 * 2. `keurKennischeckNa` rekent een ingeleverde set na.
 *
 * WAAROM SAMENSTELLEN EEN ZUIVERE FUNCTIE IS. Bij een bezwaar is de eerste vraag
 * altijd: waarom kreeg ik deze veertig en niet die veertig. Die vraag is alleen
 * te beantwoorden als de samenstelling geen verborgen invoer heeft. De bank gaat
 * er dus als lijst in, en de dooreenschikking komt uit een zaad dat ook wordt
 * bewaard. Met bank en zaad is elke set exact te herbouwen.
 */

import {
  BLOKNAMEN,
  BLOKPLAN,
  BLOKPLAN_TOTAAL,
  BLOKPLAN_VERKORT,
  BLOKPLAN_VERKORT_TOTAAL,
  KENNISCHECKBLOKKEN,
  type Kennischeckblok,
} from "./schema";
import { isAutomatischScoorbaar, letterNaarIndex } from "./itembank";

// ---------------------------------------------------------------------------
// Samenstellen
// ---------------------------------------------------------------------------

/** Wat de samensteller van een item moet weten. Niets meer. */
export interface Bankitem {
  id: number;
  blok?: string | null;
  soort: string;
  gebruik: string;
  actief?: boolean;
}

export interface Tekort {
  blok: Kennischeckblok;
  gevraagd: number;
  beschikbaar: number;
}

export interface Samenstelling {
  gelukt: boolean;
  /** De item-ids in de volgorde zoals aangeboden. Leeg wanneer het niet lukte. */
  itemIds: number[];
  /** Welke items uit welk blok komen. Voor het dossier en voor de itemanalyse. */
  perBlok: Record<Kennischeckblok, number[]>;
  /** Per blok dat tekortkomt: wat er gevraagd werd en wat er beschikbaar was. */
  tekorten: Tekort[];
  /** Het zaad waarmee deze set is geschikt. Bewaren maakt de set herbouwbaar. */
  zaad: number;
  /** Hoeveel items er zijn uitgesloten omdat de kandidaat ze eerder kreeg. */
  uitgeslotenWegensEerder: number;
}

export interface SamenstelInvoer {
  bank: readonly Bankitem[];
  /** Standaard het volledige blokplan van veertig items. */
  plan?: Record<Kennischeckblok, number>;
  /**
   * Item-ids die deze kandidaat eerder heeft gekregen.
   *
   * Draaiboek §4.3 eist "twee equivalente versies voor herkansingen". Twee vaste
   * versies A en B in de bank zouden dat letterlijk zijn, maar ze vragen een
   * versiekolom, verdubbelen het vulwerk en laten een derde ronde zonder versie
   * staan. Uitsluiten op wat deze persoon werkelijk heeft gezien haalt dezelfde
   * eis, werkt bij elke volgende ronde, en is bovendien strenger: bij twee vaste
   * versies kan een kandidaat in ronde drie versie A terugkrijgen.
   */
  uitsluiten?: readonly number[];
  /** Zaad voor de dooreenschikking. Wordt bewaard in de uitkomst. */
  zaad?: number;
}

/**
 * Een dooreenschikker met een zaad.
 *
 * Geen `Math.random()`: die maakt de samenstelling onherhaalbaar, en dan is bij
 * een bezwaar niet meer na te gaan of de set werkelijk zo is samengesteld als
 * beweerd. Dit is een mulberry32-generator — klein, snel en met een periode die
 * ruim volstaat voor het schikken van enkele tientallen items. Zij hoeft niet
 * cryptografisch te zijn: er is niets aan te winnen door de volgorde te
 * voorspellen, want welke items er in de set zitten wordt er niet door bepaald.
 */
function maakSchikker(zaad: number): () => number {
  let toestand = zaad >>> 0;
  return () => {
    toestand = (toestand + 0x6d2b79f5) >>> 0;
    let t = toestand;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates op een kopie. De invoerlijst blijft ongemoeid. */
function schik<T>(lijst: readonly T[], volgende: () => number): T[] {
  const uit = lijst.slice();
  for (let i = uit.length - 1; i > 0; i -= 1) {
    const j = Math.floor(volgende() * (i + 1));
    const tijdelijk = uit[i]!;
    uit[i] = uit[j]!;
    uit[j] = tijdelijk;
  }
  return uit;
}

/**
 * Stelt een kennischeck samen volgens het blokplan.
 *
 * WAT DE SAMENSTELLER WEIGERT, en waarom weigeren de bedoeling is:
 *
 *   - Een item dat niet op `meten` staat. Oefenitems zijn inhoudelijk bekend;
 *     verbrande items zijn publiek. Dat wordt in `itembank.ts` uitgelegd.
 *   - Een item zonder blok. Zonder blok is niet vast te stellen of de verdeling
 *     uit draaiboek §4.3 gehaald is, en die verdeling is de meting.
 *   - Een niet-actief item.
 *   - Een item dat deze kandidaat eerder kreeg.
 *
 * WAAROM ER GEEN GEDEELTELIJKE SET UIT KOMT. Lukt één blok niet, dan is
 * `gelukt` onwaar en `itemIds` leeg — ook als de andere vier blokken wel vol
 * zaten. Een kennischeck van vierendertig items is geen kennischeck: de wegingen
 * per blok verschuiven, en de drempel van 60% is vastgesteld op de verdeling van
 * veertig. Een set die stil krimpt, levert een score op die niet met de norm te
 * vergelijken is, en dat is erger dan geen set. Het tekort komt per blok terug
 * zodat er gericht items bij te schrijven zijn.
 */
export function stelKennischeckSamen(invoer: SamenstelInvoer): Samenstelling {
  const plan = invoer.plan ?? BLOKPLAN;
  const zaad = invoer.zaad ?? 1;
  const uitsluiten = new Set(invoer.uitsluiten ?? []);
  const volgende = maakSchikker(zaad);

  const perBlok: Record<Kennischeckblok, number[]> = { A: [], B: [], C: [], D: [], E: [] };
  const tekorten: Tekort[] = [];
  let uitgeslotenWegensEerder = 0;

  for (const blok of KENNISCHECKBLOKKEN) {
    const gevraagd = plan[blok] ?? 0;

    const geschikt = invoer.bank.filter((item) => {
      if (item.actief === false) return false;
      if (item.gebruik !== "meten") return false;
      if ((item.blok ?? null) !== blok) return false;
      return true;
    });

    const nietEerder = geschikt.filter((item) => {
      if (uitsluiten.has(item.id)) {
        uitgeslotenWegensEerder += 1;
        return false;
      }
      return true;
    });

    if (nietEerder.length < gevraagd) {
      tekorten.push({ blok, gevraagd, beschikbaar: nietEerder.length });
      continue;
    }

    // Eerst schikken, dan de eerste n nemen. Zo hangt de keuze van de items af
    // van het zaad en niet van de volgorde waarin de databank de rijen teruggaf.
    perBlok[blok] = schik(nietEerder, volgende)
      .slice(0, gevraagd)
      .map((item) => item.id);
  }

  if (tekorten.length > 0) {
    return {
      gelukt: false,
      itemIds: [],
      perBlok: { A: [], B: [], C: [], D: [], E: [] },
      tekorten,
      zaad,
      uitgeslotenWegensEerder,
    };
  }

  // De blokken door elkaar aanbieden. Blok voor blok afwerken zou de kandidaat
  // vertellen waar hij is: acht items op rij over grenzen leest als een
  // hoofdstuk, en dat verandert hoe hij antwoordt.
  const alles = KENNISCHECKBLOKKEN.flatMap((blok) => perBlok[blok]);
  const itemIds = schik(alles, volgende);

  return { gelukt: true, itemIds, perBlok, tekorten: [], zaad, uitgeslotenWegensEerder };
}

/** Het volledige plan: veertig items. */
export function volledigPlan(): Record<Kennischeckblok, number> {
  return { ...BLOKPLAN };
}

/** Het verkorte plan: twintig items, voor hercertificering en reactivatie. */
export function verkortPlan(): Record<Kennischeckblok, number> {
  return { ...BLOKPLAN_VERKORT };
}

/** Hoeveel items een plan in totaal vraagt. */
export function planTotaal(plan: Record<Kennischeckblok, number>): number {
  return KENNISCHECKBLOKKEN.reduce((som, blok) => som + (plan[blok] ?? 0), 0);
}

/** Of dit plan het volledige plan van veertig is. */
export function isVolledigPlan(plan: Record<Kennischeckblok, number>): boolean {
  return planTotaal(plan) === BLOKPLAN_TOTAAL;
}

/** Of dit plan het verkorte plan van twintig is. */
export function isVerkortPlan(plan: Record<Kennischeckblok, number>): boolean {
  return planTotaal(plan) === BLOKPLAN_VERKORT_TOTAAL;
}

// ---------------------------------------------------------------------------
// Nakijken
// ---------------------------------------------------------------------------

/** Wat het nakijken van een item moet weten. */
export interface NakijkItem {
  id: number;
  soort: string;
  sleutel: string;
  blok?: string | null;
}

export type Beoordeling = "goed" | "fout" | "wacht_op_mens" | "uitgesloten";

export interface ItemUitkomst {
  itemId: number;
  soort: string;
  blok: string | null;
  beoordeling: Beoordeling;
  /** Waarom dit item is uitgesloten. Leeg bij de andere beoordelingen. */
  redenUitsluiting: string;
}

export interface Nakijkresultaat {
  /**
   * De ruwe score tussen 0 en 1, of `null`.
   *
   * `null` zolang `volledig` onwaar is. Dat is de kern van dit bestand: zolang er
   * één open item op een mens wacht, is er geen score. Zie het commentaar bij
   * `keurKennischeckNa`.
   */
  ruweScore: number | null;
  /** Waar wanneer elk meetbaar item een beoordeling heeft. */
  volledig: boolean;
  /** Hoeveel items meetellen: de set min de uitgesloten items. */
  meetbaar: number;
  /** Hoeveel daarvan goed zijn. */
  goed: number;
  /** Item-ids die op een beoordelaar wachten. */
  wachtOp: number[];
  /** Item-ids die buiten de scoring vallen, met de reden per item. */
  uitgesloten: number[];
  perItem: ItemUitkomst[];
}

export interface NakijkInvoer {
  /** De items van de set, in de volgorde zoals aangeboden. */
  items: readonly NakijkItem[];
  /** Antwoord per item-id. Een ontbrekend antwoord geldt als onjuist. */
  antwoorden: Record<string, string>;
  /**
   * Scores die een mens heeft gegeven op open items: item-id naar 0 of 1.
   *
   * Alleen voor items van een soort die een machine niet kan nakijken. Een
   * handmatige score op een meerkeuze-item wordt genegeerd, niet stil
   * overgenomen: anders kan een beoordelaar een automatisch fout antwoord
   * goedrekenen zonder dat daar ergens een spoor van is. Wie een sleutel
   * verkeerd vindt, past het item aan.
   */
  handmatigeScores?: Record<string, number>;
  /**
   * Item-ids die buiten de scoring van deze ronde vallen.
   *
   * Draaiboek §4.3: na de eerste twintig afnames volgt itemanalyse, en items met
   * een p-waarde onder .30 of boven .95, of met een negatieve
   * item-restcorrelatie, "gaan uit de scoring van die ronde. Dat besluit wordt
   * gedocumenteerd." Uitsluiten verkleint de noemer; het item telt niet als fout
   * en ook niet als goed. Het alternatief — een slecht item als fout laten staan —
   * straft de kandidaat voor een fout van de itemschrijver.
   */
  uitsluiten?: readonly number[];
  /** Waarom er is uitgesloten. Komt per item terug in `perItem`. */
  redenUitsluiting?: string;
}

function normaliseerAntwoord(tekst: string): string {
  return tekst.trim().toLowerCase();
}

/**
 * Kijkt een ingeleverde kennischeck na.
 *
 * WAAROM ER GEEN SCORE IS ZOLANG EEN MENS NOG MOET KIJKEN. Er staat één getal in
 * `ruweScore`, en dat getal gaat rechtstreeks naar `berekenAsscores` en van daar
 * naar de beslismachine. Zou dit bestand bij een half nagekeken set het
 * automatische deel als score teruggeven, dan is dat getal te laag om een
 * verkeerde reden: de open items staan er dan als onbeantwoord in. Een
 * beslisvoorstel op zo'n getal is niet fout omdat de rekenregel fout is, maar
 * omdat het over een andere kandidaat gaat dan die er zat. Dat soort fout is bij
 * een bezwaar niet uit te leggen.
 *
 * `null` dwingt de aanroeper te wachten. Het bewijsstuk blijft daarmee op
 * `ingeleverd` staan tot de beoordelaar de open items heeft gescoord, en dat is
 * precies de toestand die de wachtrij van blok 5 nodig heeft.
 *
 * WAAROM EEN ONBEANTWOORD ITEM ONJUIST IS. De check is open boek, zonder timer,
 * met alleen een uiterste datum en één inlevering. Wie een item overslaat, heeft
 * ervoor gekozen. Zou leeg niet meetellen, dan verkleint elk overgeslagen item de
 * noemer en wordt overslaan een strategie: wie de twaalf moeilijkste items
 * leeglaat, houdt achtentwintig items over waarop hij goed scoort. Dat is precies
 * de uitholling die de vaste noemer voorkomt.
 */
export function keurKennischeckNa(invoer: NakijkInvoer): Nakijkresultaat {
  const uitsluitenSet = new Set(invoer.uitsluiten ?? []);
  const reden = invoer.redenUitsluiting ?? "";
  const handmatig = invoer.handmatigeScores ?? {};

  const perItem: ItemUitkomst[] = [];
  const wachtOp: number[] = [];
  const uitgesloten: number[] = [];
  let goed = 0;
  let meetbaar = 0;

  for (const item of invoer.items) {
    const blok = item.blok ?? null;

    if (uitsluitenSet.has(item.id)) {
      uitgesloten.push(item.id);
      perItem.push({
        itemId: item.id,
        soort: item.soort,
        blok,
        beoordeling: "uitgesloten",
        redenUitsluiting: reden,
      });
      continue;
    }

    meetbaar += 1;

    if (!isAutomatischScoorbaar(item.soort)) {
      const gegeven = handmatig[String(item.id)];
      if (gegeven === undefined) {
        wachtOp.push(item.id);
        perItem.push({
          itemId: item.id,
          soort: item.soort,
          blok,
          beoordeling: "wacht_op_mens",
          redenUitsluiting: "",
        });
        continue;
      }
      const isGoed = gegeven >= 1;
      if (isGoed) goed += 1;
      perItem.push({
        itemId: item.id,
        soort: item.soort,
        blok,
        beoordeling: isGoed ? "goed" : "fout",
        redenUitsluiting: "",
      });
      continue;
    }

    const antwoord = invoer.antwoorden[String(item.id)];
    const isGoed = antwoord !== undefined && vergelijk(item, antwoord);
    if (isGoed) goed += 1;
    perItem.push({
      itemId: item.id,
      soort: item.soort,
      blok,
      beoordeling: isGoed ? "goed" : "fout",
      redenUitsluiting: "",
    });
  }

  const volledig = wachtOp.length === 0;

  // Een set waarin elk item is uitgesloten levert geen score op. Delen door nul
  // zou Infinity of NaN geven en dat glipt door een reeks berekeningen heen tot
  // het ergens als score op een scherm staat.
  const ruweScore = volledig && meetbaar > 0 ? goed / meetbaar : null;

  return { ruweScore, volledig, meetbaar, goed, wachtOp, uitgesloten, perItem };
}

/** Vergelijkt één antwoord met de sleutel. Alleen voor scoorbare soorten. */
function vergelijk(item: NakijkItem, antwoord: string): boolean {
  const gegeven = normaliseerAntwoord(antwoord);
  if (gegeven.length === 0) return false;

  if (item.soort === "juistfout") {
    return gegeven === normaliseerAntwoord(item.sleutel);
  }

  // Bij scenario en meerkeuze is de sleutel de letter van de juiste mogelijkheid.
  // Het antwoord mag zowel "C" als "c" zijn; iets anders dan één letter is geen
  // geldig antwoord op een keuze-item en geldt als onjuist.
  const sleutelIndex = letterNaarIndex(item.sleutel);
  const antwoordIndex = letterNaarIndex(antwoord);
  if (sleutelIndex === null || antwoordIndex === null) return false;
  return sleutelIndex === antwoordIndex;
}

// ---------------------------------------------------------------------------
// Terugkoppeling onder de drempel
// ---------------------------------------------------------------------------

export interface Zwaartepunt {
  blok: Kennischeckblok | null;
  /** De leesbare naam, of leeg wanneer er geen zwaartepunt is. */
  toelichting: string;
}

/**
 * Het blok waar het zwaartepunt van de gemiste items zat.
 *
 * WAAROM DIT GEEN SUBSCORES GEEFT. Draaiboek §4.3: "Kandidaten die onder de
 * drempel blijven, krijgen geen ongenuanceerde subscores per blok — de standaard
 * waarschuwt expliciet tegen onbetrouwbare subscores richting wie niet slaagt.
 * Wel: een kwalitatieve aanduiding van het blok waar het zwaartepunt zat, plus
 * het gerichte opfrisaanbod."
 *
 * Dat is geen omzichtigheid maar meetkunde. Blok B heeft zes items; een score van
 * 4 op 6 heeft een betrouwbaarheidsinterval waar de hele schaal in past. "Je
 * haalde 67% op scoring en rapportlogica" klinkt als een bevinding en is een
 * ruisgetal. Wat wél houdbaar is, is de rangorde: welk blok leverde de meeste
 * gemiste items. Daarom geeft deze functie één blok terug en geen enkel getal.
 *
 * Bij een gelijke stand komt er geen blok terug. Twee blokken die even zwaar
 * wegen tot één aanwijzing terugbrengen zou een keuze verzinnen die de gegevens
 * niet dragen; dan is het gerichte opfrisaanbod een gesprek en geen automaat.
 */
export function zwaartepuntBlok(resultaat: Nakijkresultaat): Zwaartepunt {
  const gemist: Record<string, number> = {};
  for (const uitkomst of resultaat.perItem) {
    if (uitkomst.beoordeling !== "fout") continue;
    const blok = uitkomst.blok;
    if (blok === null) continue;
    gemist[blok] = (gemist[blok] ?? 0) + 1;
  }

  let hoogste = 0;
  let kandidaten: Kennischeckblok[] = [];
  for (const blok of KENNISCHECKBLOKKEN) {
    const aantal = gemist[blok] ?? 0;
    if (aantal > hoogste) {
      hoogste = aantal;
      kandidaten = [blok];
    } else if (aantal === hoogste && aantal > 0) {
      kandidaten.push(blok);
    }
  }

  if (hoogste === 0 || kandidaten.length !== 1) {
    return { blok: null, toelichting: "" };
  }
  const blok = kandidaten[0]!;
  return { blok, toelichting: BLOKNAMEN[blok] };
}
