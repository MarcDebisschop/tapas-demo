// ---------------------------------------------------------------------------
// server/bekwaamheid/regiekamer.ts — de rekenkern achter scherm 9.6.
//
// Scherm 9.6 uit het bouwplan (`/admin/bekwaamheid`) toont vijf dingen: rondes
// per fase, de agenda met openstaande posten, ICC per bewijsstuk, de KPI's uit
// sectie 13 van het draaiboek, en de poortsimulatie. Dit bestand rekent er vier
// van uit; de vijfde (de poortsimulatie) heeft al een eigenaar in `poort.ts` en
// `poortbrug.ts` en wordt hier niet nagebouwd.
//
// Alles in dit bestand is een zuivere functie: rijen in, uitkomst uit, geen
// databank, geen tijd, geen omgeving. De queries staan in
// `routes-regiekamer.ts`. Dat is geen vormelijkheid — een regiekamer die haar
// eigen cijfers uit de databank haalt én er tegelijk over rekent, is niet te
// testen zonder een gevulde databank, en dan wordt ze nooit getest.
//
// Drie dingen die deze kern bewust NIET doet.
//
// Ze beslist niets. Er komt geen licentiestatus, geen uitkomst en geen voorstel
// uit dit bestand. De regiekamer kijkt; `beslisregels.ts` beslist. Een KPI die
// rood staat, is een aanwijzing voor een mens, niet een grond voor een besluit.
//
// Ze verzint geen betrouwbaarheidsinterval. Sectie 13.1 van het draaiboek vraagt
// ICC ≥ .75 op de ondergrens van het interval, en die ondergrens wordt sinds de
// tweede bouwronde ook echt berekend — met de formules van McGraw & Wong (1996)
// voor ICC(A,1) en de F-kwantielen uit `statistiek.ts`. Wat de kern niet doet, is
// die ondergrens als een oordeel presenteren wanneer het interval de norm omvat:
// dan staat er "onbeslist" en niet "niet gehaald". Een breed interval betekent te
// weinig data, niet een slecht panel.
//
// Ze vult geen gaten op. Een onvolledige beoordelaarsmatrix wordt niet met
// gemiddelden aangevuld; ze wordt teruggebracht tot het grootste volledige blok
// en het scherm krijgt te zien wat er is afgevallen en hoe volledig de matrix was.
//
// Ze meldt onvolledigheid niet via de ICC. Onvolledig beoordeelde bewijsstukken
// zijn een procesfeit en horen op de agenda; de ICC meet overeenstemming. Toen die
// twee taken bij één getal lagen, deed het getal geen van beide goed: één
// ontbrekende cel kon de hele ICC wegnemen.
// ---------------------------------------------------------------------------
import { RONDEFASEN, AGENDASOORTEN, type Rondefase, type Agendasoort } from "./schema";
import { P_ONDERGRENS, P_BOVENGRENS } from "./itemanalyse";
import { fKwantiel } from "./statistiek";
import { feestdatumsTussenJaren } from "./feestdagen";

// ---------------------------------------------------------------------------
// 1. Rondes per fase
// ---------------------------------------------------------------------------

/** Eén ronde, teruggebracht tot wat de regiekamer erover moet weten. */
export interface RondeRegel {
  id: number;
  fase: Rondefase;
  soort: string;
  instrumentId: string;
  /** Uiterste inleverdatum. Vergeleken met de peildatum, niet met vandaag. */
  vensterTot: string;
}

export interface FaseTelling {
  fase: Rondefase;
  aantal: number;
  /** Rondes waarvan het inleveringsvenster op de peildatum verstreken is. */
  vensterVerstreken: number;
}

/**
 * Telt de rondes per fase, in de vaste orde van `RONDEFASEN`.
 *
 * Alle elf fasen komen terug, ook de lege. Een regiekamer waarin een fase pas
 * verschijnt zodra er iemand in zit, verbergt precies wat je wil zien: dat er
 * niemand in de fase "gedebrieft" staat terwijl er twaalf beslissingen liggen.
 *
 * `vensterVerstreken` telt alleen mee zolang de ronde nog loopt. Bij een
 * afgesloten of gestaakte ronde zegt een verstreken venster niets meer.
 */
export function telRondesPerFase(rondes: RondeRegel[], peildatum: string): FaseTelling[] {
  const dag = peildatum.slice(0, 10);
  const AFGEHANDELD: readonly Rondefase[] = ["afgesloten", "gestaakt"];
  return RONDEFASEN.map((fase) => {
    const eigen = rondes.filter((r) => r.fase === fase);
    return {
      fase,
      aantal: eigen.length,
      vensterVerstreken: AFGEHANDELD.includes(fase)
        ? 0
        : eigen.filter((r) => r.vensterTot.slice(0, 10) < dag).length,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. De agenda
// ---------------------------------------------------------------------------

export interface AgendaRegel {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  soort: Agendasoort;
  datum: string;
}

export interface AgendaSoortTelling {
  soort: Agendasoort;
  aantal: number;
  /** Oudste openstaande datum in deze soort; `null` als de soort leeg is. */
  oudste: string | null;
  /** Dagen tussen de oudste datum en de peildatum. */
  dagenOud: number | null;
}

/** Kalenderdagen tussen twee ISO-datums. Negatief als `tot` vóór `van` ligt. */
export function dagenTussen(van: string, tot: string): number {
  const a = Date.parse(van.slice(0, 10) + "T00:00:00Z");
  const b = Date.parse(tot.slice(0, 10) + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

/**
 * Vat de openstaande agenda samen per soort, in de orde van `AGENDASOORTEN`.
 *
 * Ook hier komen de lege soorten mee. En ook hier is de peildatum een argument:
 * de leeftijd van een post is niet af te leiden uit de post zelf.
 */
export function vatAgendaSamen(posten: AgendaRegel[], peildatum: string): AgendaSoortTelling[] {
  return AGENDASOORTEN.map((soort) => {
    const eigen = posten.filter((p) => p.soort === soort);
    const oudste = eigen.reduce<string | null>(
      (min, p) => (min === null || p.datum < min ? p.datum : min),
      null,
    );
    return {
      soort,
      aantal: eigen.length,
      oudste,
      dagenOud: oudste === null ? null : dagenTussen(oudste, peildatum),
    };
  });
}

// ---------------------------------------------------------------------------
// 3. ICC per bewijsstuk
// ---------------------------------------------------------------------------

/** Eén ingevoerde score. Meer heeft de ICC niet nodig. */
export interface ScoreRegel {
  bewijsstukId: number;
  bewijsstukNummer: number;
  beoordelaarId: number;
  onderdeel: string;
  score: number;
  isKalibratie: boolean;
}

/**
 * Wat het interval over de norm van §13.1 (ICC ≥ .75) zegt.
 *
 * `onbeslist` is de belangrijkste van de drie. Ligt .75 binnen het interval, dan
 * is de norm niet gehaald én niet gemist: er is te weinig gemeten om iets te
 * beweren. Dat als "niet gehaald" tonen zou een panel afrekenen op het aantal
 * dossiers dat het kreeg.
 */
export type Normbeeld = "gehaald" | "niet_gehaald" | "onbeslist";

/** De norm uit §13.1 van het draaiboek, op één plek. */
export const ICC_NORM = 0.75;

/**
 * Het kleinste blok waarover een ICC gerapporteerd wordt: drie dossiers en twee
 * beoordelaars.
 *
 * Rekenkundig kan het bij twee dossiers ook, maar dan hangt het hele getal aan
 * één vergelijking en is het interval zo breed dat het niets uitsluit. Een getal
 * dat niets uitsluit en toch op een kwaliteitsscherm staat, wordt gelezen als een
 * bevinding. Daarom liever niets, met de reden erbij.
 */
export const ICC_MIN_DOSSIERS = 3;
export const ICC_MIN_BEOORDELAARS = 2;

export interface IccUitkomst {
  /** ICC(2,1): twee-weg random, absolute overeenstemming, één beoordelaar. */
  icc: number | null;
  /** Ondergrens van het 95%-interval. `null` als er geen ICC is. */
  onder: number | null;
  /** Bovengrens van het 95%-interval. `null` als er geen ICC is. */
  boven: number | null;
  /** Aantal dossiers in het volledige blok. */
  dossiers: number;
  /** Aantal beoordelaars in het volledige blok. */
  beoordelaars: number;
  /** Waarom er geen getal is. `null` zodra `icc` gevuld is. */
  reden: string | null;
  /** Is het interval berekend? Kan `false` zijn terwijl `icc` wel gevuld is. */
  intervalGemeten: boolean;
  /** Waarom er geen interval is terwijl er wel een ICC is. Anders `null`. */
  intervalReden: string | null;
  /** Wat het interval over de norm ≥ .75 zegt. `null` zonder interval. */
  normbeeld: Normbeeld | null;
}

/**
 * ICC(2,1) over een volledige dossier-bij-beoordelaarmatrix.
 *
 * De keuze voor model 2 en niet 1 of 3: de beoordelaars zijn niet per dossier
 * andere mensen (dat zou model 1 zijn) en ze zijn ook niet de enige denkbare
 * beoordelaars (dat zou model 3 zijn). Ze zijn een steekproef uit een panel dat
 * groter is dan zijzelf, en dat is model 2. De vorm met absolute
 * overeenstemming en niet die met consistentie, omdat een beoordelaar die
 * structureel één punt hoger geeft bij een cesuur wél verschil maakt: de
 * consistentievorm rekent dat verschil weg, en juist dat mag hier niet.
 *
 * De enkele-beoordelaarvorm (2,1) en niet het gemiddelde (2,k), omdat een
 * dossier in de praktijk door één beoordelaar wordt bekeken. De vraag is dus:
 * hoe betrouwbaar is één beoordelaar — niet: hoe betrouwbaar is het gemiddelde
 * van het hele panel.
 *
 * De uitkomst wordt niet afgekapt. Bij meer verschil binnen dan tussen
 * dossiers is de ICC negatief; dat is geen rekenfout maar een bevinding, en ze
 * hoort zichtbaar te blijven.
 *
 * Het 95%-interval volgt McGraw & Wong (1996) voor ICC(A,1), met de
 * Satterthwaite-benadering voor de vrijheidsgraden van de noemer. De uitkomst is
 * geijkt op een onafhankelijke implementatie; zie de tests.
 */
export function berekenIcc(matrix: number[][]): IccUitkomst {
  const n = matrix.length;
  const k = n > 0 ? matrix[0].length : 0;
  const leeg = (reden: string): IccUitkomst => ({
    icc: null,
    onder: null,
    boven: null,
    dossiers: n,
    beoordelaars: k,
    reden,
    intervalGemeten: false,
    intervalReden: null,
    normbeeld: null,
  });

  if (n < ICC_MIN_DOSSIERS)
    return leeg(
      `Minder dan ${ICC_MIN_DOSSIERS} dossiers die door dezelfde beoordelaars zijn bekeken.`,
    );
  if (k < ICC_MIN_BEOORDELAARS)
    return leeg(
      `Minder dan ${ICC_MIN_BEOORDELAARS} beoordelaars die dezelfde dossiers bekeken.`,
    );
  if (matrix.some((rij) => rij.length !== k)) return leeg("De matrix is niet volledig.");

  const N = n * k;
  const alles = matrix.flat();
  const groot = alles.reduce((s, v) => s + v, 0) / N;

  const rijGem = matrix.map((rij) => rij.reduce((s, v) => s + v, 0) / k);
  const kolGem = Array.from(
    { length: k },
    (_, j) => matrix.reduce((s, rij) => s + rij[j], 0) / n,
  );

  const sst = alles.reduce((s, v) => s + (v - groot) ** 2, 0);
  const ssr = k * rijGem.reduce((s, m) => s + (m - groot) ** 2, 0);
  const ssc = n * kolGem.reduce((s, m) => s + (m - groot) ** 2, 0);
  const sse = sst - ssr - ssc;

  // Geen variatie tussen dossiers én geen residu: alle beoordelaars gaven
  // overal hetzelfde. Dan is er niets te onderscheiden en is een ICC niet
  // gedefinieerd. Dat is iets anders dan perfecte overeenstemming, en het als
  // 1,00 rapporteren zou vleien.
  if (sst === 0) return leeg("Alle scores zijn gelijk; er is geen variantie om te ontleden.");

  const msr = ssr / (n - 1);
  const msc = ssc / (k - 1);
  const mse = sse / ((n - 1) * (k - 1));

  const noemer = msr + (k - 1) * mse + (k * (msc - mse)) / n;
  if (noemer === 0) return leeg("De noemer van ICC(2,1) is nul.");

  const icc = (msr - mse) / noemer;
  const zonderInterval = (intervalReden: string): IccUitkomst => ({
    icc,
    onder: null,
    boven: null,
    dossiers: n,
    beoordelaars: k,
    reden: null,
    intervalGemeten: false,
    intervalReden,
    normbeeld: null,
  });

  // Bij een ICC van exact 1 is het residu nul: elke beoordelaar gaf per dossier
  // precies hetzelfde. Dan is het interval het punt zelf. De formule zou hier
  // door nul delen, dus de uitkomst wordt rechtstreeks gezet.
  if (icc === 1) {
    return {
      icc,
      onder: 1,
      boven: 1,
      dossiers: n,
      beoordelaars: k,
      reden: null,
      intervalGemeten: true,
      intervalReden: null,
      normbeeld: "gehaald",
    };
  }

  // De formules van McGraw & Wong veronderstellen een positieve ICC: bij nul of
  // lager wordt de hulpgrootheid a nul of negatief en verliezen de
  // vrijheidsgraden hun betekenis. Er wordt dan geen interval getoond en de norm
  // blijft ongetoetst. Dat is geen verzwijgen: de puntschatting staat er, en die
  // ligt in dit geval ver onder .75. Maar de norm van §13.1 gaat over de
  // ondergrens, en die is hier niet te berekenen — dus wordt ze niet beweerd.
  if (!(icc > 0)) {
    return zonderInterval(
      "De ICC is nul of negatief; het interval van McGraw & Wong (1996) is daar niet gedefinieerd.",
    );
  }

  const grens = intervalVoorIcc(icc, n, k, msr, msc, mse);
  if (!Number.isFinite(grens.onder) || !Number.isFinite(grens.boven)) {
    return zonderInterval("De grenzen van het interval leverden geen getal op.");
  }

  return {
    icc,
    onder: grens.onder,
    boven: grens.boven,
    dossiers: n,
    beoordelaars: k,
    reden: null,
    intervalGemeten: true,
    intervalReden: null,
    normbeeld: leesNorm(grens.onder, grens.boven),
  };
}

/**
 * Het 95%-interval rond ICC(A,1) volgens McGraw & Wong (1996), tabel 7.
 *
 * De vrijheidsgraden van de noemer zijn een Satterthwaite-benadering en dus
 * gebroken; daarom moet het F-kwantiel gebroken vrijheidsgraden aankunnen.
 */
function intervalVoorIcc(
  icc: number,
  n: number,
  k: number,
  msr: number,
  msc: number,
  mse: number,
): { onder: number; boven: number } {
  const alpha = 0.05;
  const a = (k * icc) / (n * (1 - icc));
  const b = 1 + (k * icc * (n - 1)) / (n * (1 - icc));
  const v =
    (a * msc + b * mse) ** 2 /
    ((a * msc) ** 2 / (k - 1) + (b * mse) ** 2 / ((n - 1) * (k - 1)));

  const fOnder = fKwantiel(1 - alpha / 2, n - 1, v);
  const fBoven = fKwantiel(1 - alpha / 2, v, n - 1);

  const onder =
    (n * (msr - fOnder * mse)) / (fOnder * (k * msc + (k * n - k - n) * mse) + n * msr);
  const boven =
    (n * (fBoven * msr - mse)) / (k * msc + (k * n - k - n) * mse + n * fBoven * msr);

  return { onder, boven };
}

/**
 * Wat het interval over de norm van §13.1 zegt.
 *
 * Gehaald betekent: de héle ondergrens ligt op of boven .75. Niet gehaald
 * betekent: zelfs de bovengrens komt er niet aan. Al het overige is onbeslist —
 * en dat is bij kleine aantallen dossiers de normale uitkomst, niet een
 * uitzondering.
 */
function leesNorm(onder: number, boven: number): Normbeeld {
  if (onder >= ICC_NORM) return "gehaald";
  if (boven < ICC_NORM) return "niet_gehaald";
  return "onbeslist";
}

export interface IccPerBewijsstuk {
  bewijsstukNummer: number;
  uitkomst: IccUitkomst;
  /** Beoordelaars die buiten het gekozen blok vielen. */
  beoordelaarsAfgevallen: number;
  /** Dossiers die buiten het gekozen blok vielen. */
  dossiersAfgevallen: number;
  /** Hoeveel van de gebruikte scores als kalibratie zijn ingevoerd. */
  kalibratieScores: number;
  /**
   * Aandeel gevulde cellen vóór de reductie: hoe volledig het panel dit
   * bewijsstuk bekeken heeft. Dit hoort naast elke ICC te staan, want een hoge
   * overeenstemming over een half beoordeelde stapel is geen goed nieuws.
   */
  dekkingsgraad: number;
  /** Cellen die ontbraken vóór de reductie. Nul betekent: niets weggelaten. */
  ontbrekendeCellen: number;
}

/**
 * ICC per bewijsstuknummer.
 *
 * Twee dingen die uitleg vragen.
 *
 * Waarom per nummer en niet per dossier. Een ICC vergelijkt de spreiding tussen
 * dossiers met de spreiding binnen een dossier. Binnen één enkel dossier is er
 * geen "tussen", dus over één bewijsstuk is geen ICC te berekenen — hoeveel
 * beoordelaars er ook naar kijken. Het bouwplan vraagt "ICC per bewijsstuk"; de
 * enige rekenkundig mogelijke lezing daarvan is: per soort bewijsstuk, over de
 * dossiers heen. Dat is ook wat sectie 13.1 doet, waar de ICC per instrument van
 * meting wordt genormeerd en niet per kandidaat.
 *
 * Waarom het grootste volledige blok en niet een vaste orde. Een matrix met
 * gaten moet worden teruggebracht tot een blok waarin elke overgebleven
 * beoordelaar elk overgebleven dossier bekeek. Aanvankelijk gebeurde dat in een
 * vaste orde: eerst de beoordelaars met een gat eruit, dan de dossiers. Die orde
 * had één ernstig gevolg: bij twee beoordelaars nam één ontbrekende cel het hele
 * getal weg, terwijl er een bruikbaar blok lag als je in plaats daarvan dat ene
 * dossier had laten vallen. Een kwaliteitsindicator die op niets uitkomt bij één
 * gat, is fragiel, en fragiele indicatoren worden genegeerd.
 *
 * Nu wordt het grootste volledige blok gekozen, gemeten in cellen. Bij gelijk
 * aantal cellen wint het blok met meer dossiers: dossiers leveren de variantie
 * tussen doelen waar de ICC op rust, beoordelaars leveren die niet. De keuze is
 * deterministisch — dezelfde data geeft altijd hetzelfde blok — dus er valt
 * niets te kiezen achteraf.
 *
 * Wat daarmee verschuift: de melding dat een bewijsstuk onvolledig beoordeeld is,
 * hoort nu op de agenda en niet meer in het wegvallen van de ICC. Twee taken, twee
 * plekken. Om dat leesbaar te houden staat bij elke ICC de dekkingsgraad en het
 * aantal ontbrekende cellen vóór de reductie.
 *
 * Waarom de score van een beoordelaar het gemiddelde over de onderdelen is. Een
 * bewijsstuk heeft meerdere onderdelen, en niet elke beoordelaar vult
 * noodzakelijk dezelfde in. Het gemiddelde over wat iemand wél invulde, is één
 * getal per dossier per beoordelaar en dus de enige vorm die in een matrix past.
 * Wie de ICC per onderdeel wil, heeft een fijnere doorsnede nodig; die staat
 * hier niet, en dat is een bekende beperking en geen omissie.
 */
export function iccPerBewijsstuk(scores: ScoreRegel[]): IccPerBewijsstuk[] {
  const nummers = Array.from(new Set(scores.map((s) => s.bewijsstukNummer))).sort((a, b) => a - b);

  return nummers.map((nummer) => {
    const eigen = scores.filter((s) => s.bewijsstukNummer === nummer);

    // Per dossier per beoordelaar het gemiddelde over de onderdelen.
    const cel = new Map<string, { som: number; aantal: number; kalibratie: number }>();
    for (const s of eigen) {
      const sleutel = `${s.bewijsstukId}|${s.beoordelaarId}`;
      const vorig = cel.get(sleutel) ?? { som: 0, aantal: 0, kalibratie: 0 };
      cel.set(sleutel, {
        som: vorig.som + s.score,
        aantal: vorig.aantal + 1,
        kalibratie: vorig.kalibratie + (s.isKalibratie ? 1 : 0),
      });
    }

    const alleDossiers = Array.from(new Set(eigen.map((s) => s.bewijsstukId))).sort(
      (a, b) => a - b,
    );
    const alleBeoordelaars = Array.from(new Set(eigen.map((s) => s.beoordelaarId))).sort(
      (a, b) => a - b,
    );
    const cellenMogelijk = alleDossiers.length * alleBeoordelaars.length;
    const ontbrekendeCellen = cellenMogelijk - cel.size;

    const { dossiers, beoordelaars } = grootsteVolledigeBlok(
      alleDossiers,
      alleBeoordelaars,
      (d, b) => cel.has(`${d}|${b}`),
    );

    const matrix = dossiers.map((d) =>
      beoordelaars.map((b) => {
        const c = cel.get(`${d}|${b}`)!;
        return c.som / c.aantal;
      }),
    );

    let kalibratieScores = 0;
    for (const d of dossiers) {
      for (const b of beoordelaars) kalibratieScores += cel.get(`${d}|${b}`)!.kalibratie;
    }

    return {
      bewijsstukNummer: nummer,
      uitkomst: berekenIcc(matrix),
      beoordelaarsAfgevallen: alleBeoordelaars.length - beoordelaars.length,
      dossiersAfgevallen: alleDossiers.length - dossiers.length,
      kalibratieScores,
      dekkingsgraad: cellenMogelijk === 0 ? 0 : cel.size / cellenMogelijk,
      ontbrekendeCellen,
    };
  });
}

/**
 * Het grootste volledige blok in een matrix met gaten.
 *
 * Het exacte probleem (de grootste volledige deelmatrix) is NP-hard, dus dit is
 * geen uitputtende zoektocht. De aanpak: voor elke ondergrens aan het aantal
 * beoordelaars wordt gekeken welk blok daarbij mogelijk is, en het beste blok
 * wint. Bij een panel van enkele beoordelaars — en dat is de werkelijkheid hier —
 * doorloopt dat alle zinvolle mogelijkheden.
 *
 * Deterministisch: dezelfde invoer geeft altijd hetzelfde blok. Dat is de
 * voorwaarde om het getal te mogen rapporteren, want een blokkeuze die van de
 * doorloopvolgorde afhangt, zou het cijfer laten meebewegen met iets wat niemand
 * kan navertellen.
 */
export function grootsteVolledigeBlok(
  alleDossiers: number[],
  alleBeoordelaars: number[],
  gevuld: (dossier: number, beoordelaar: number) => boolean,
): { dossiers: number[]; beoordelaars: number[] } {
  let beste = { dossiers: [] as number[], beoordelaars: [] as number[] };
  let besteCellen = 0;

  // Kandidaatverzamelingen van beoordelaars, geordend op hoeveel dossiers ze
  // dekken. Voor elk aantal beoordelaars houden we de beoordelaars met de
  // ruimste dekking, en daarna de dossiers die door die hele groep zijn bekeken.
  const dekking = alleBeoordelaars
    .map((b) => ({ b, aantal: alleDossiers.filter((d) => gevuld(d, b)).length }))
    .sort((x, y) => y.aantal - x.aantal || x.b - y.b);

  for (let hoeveel = 1; hoeveel <= dekking.length; hoeveel += 1) {
    const groep = dekking.slice(0, hoeveel).map((x) => x.b);
    const dossiers = alleDossiers.filter((d) => groep.every((b) => gevuld(d, b)));
    const cellen = dossiers.length * groep.length;
    const beterOpCellen = cellen > besteCellen;
    // Gelijkspel op cellen: meer dossiers wint. Dossiers leveren de variantie
    // tussen doelen waar de ICC op rust; beoordelaars leveren die niet.
    const gelijkMaarMeerDossiers =
      cellen === besteCellen && dossiers.length > beste.dossiers.length;
    if (beterOpCellen || gelijkMaarMeerDossiers) {
      besteCellen = cellen;
      beste = {
        // Beide lijsten oplopend, ongeacht de volgorde van de invoer: de matrix
        // die hierop gebouwd wordt, moet bij dezelfde data dezelfde matrix zijn.
        dossiers: [...dossiers].sort((a, b) => a - b),
        beoordelaars: [...groep].sort((a, b) => a - b),
      };
    }
  }

  return beste;
}

// ---------------------------------------------------------------------------
// 4. De KPI's uit sectie 13 van het draaiboek
// ---------------------------------------------------------------------------

/**
 * Werkdagen tussen twee datums: maandag tot vrijdag, de Belgische wettelijke
 * feestdagen niet meegeteld, de begindag niet meegeteld, de einddag wel.
 *
 * De feestdagen komen uit `feestdagen.ts` en worden hier niet opnieuw
 * opgeschreven. Wat die module niet kan, kan deze functie ook niet:
 * vervangingsdagen voor een feestdag die in het weekend valt, zijn per
 * onderneming collectief vastgelegd en dus niet berekenbaar. In zo'n jaar telt
 * deze functie hoogstens twee dagen te veel en meet ze dus nog licht krap. Dat
 * staat in de uitkomst, als `vervangingsdagen: false`.
 */
export function werkdagenTussen(van: string, tot: string): number {
  const a = new Date(van.slice(0, 10) + "T00:00:00Z");
  const b = new Date(tot.slice(0, 10) + "T00:00:00Z");
  if (b <= a) return 0;
  const feestdatums = feestdatumsTussenJaren(a.getUTCFullYear(), b.getUTCFullYear());
  let dagen = 0;
  const loper = new Date(a.getTime());
  while (loper < b) {
    loper.setUTCDate(loper.getUTCDate() + 1);
    const dag = loper.getUTCDay();
    if (dag === 0 || dag === 6) continue;
    if (feestdatums.has(loper.toISOString().slice(0, 10))) continue;
    dagen += 1;
  }
  return dagen;
}

export interface TermijnKpi {
  /** Waar de norm staat, letterlijk uit het draaiboek. */
  norm: string;
  /** Dossiers waarvan beide datums bekend zijn en de termijn dus meetbaar is. */
  gemeten: number;
  /** Dossiers binnen de termijn. */
  binnen: number;
  /** Dossiers buiten de termijn, met hun id erbij. */
  buiten: number[];
  /** Dossiers waarvan de tweede datum nog ontbreekt. */
  nogOpen: number;
  /** Aandeel binnen de termijn, of `null` als er niets te meten was. */
  aandeel: number | null;
  /** Zijn de Belgische wettelijke feestdagen verwerkt? */
  feestdagen: boolean;
  /**
   * Zijn vervangingsdagen voor feestdagen in het weekend verwerkt? Altijd
   * `false`: die worden per onderneming collectief vastgelegd en zijn niet te
   * berekenen. Zie `feestdagen.ts`.
   */
  vervangingsdagen: boolean;
}

function termijn(
  norm: string,
  regels: Array<{ id: number; van: string | null; tot: string | null }>,
  grens: number,
  meet: (van: string, tot: string) => number,
): TermijnKpi {
  const meetbaar = regels.filter((r) => r.van !== null && r.tot !== null);
  const buiten = meetbaar.filter((r) => meet(r.van!, r.tot!) > grens).map((r) => r.id);
  const gemeten = meetbaar.length;
  return {
    norm,
    gemeten,
    binnen: gemeten - buiten.length,
    buiten,
    nogOpen: regels.filter((r) => r.van !== null && r.tot === null).length,
    aandeel: gemeten === 0 ? null : (gemeten - buiten.length) / gemeten,
    // De bezwaartermijn loopt in kalenderdagen en raakt feestdagen dus niet; de
    // twee werkdagentermijnen doen dat wel. Het onderscheid staat in de uitkomst
    // zodat het scherm niet hoeft te gokken welke telling gebruikt is.
    feestdagen: meet === werkdagenTussen,
    vervangingsdagen: false,
  };
}

/** Eén ronde met de twee datums die de debrieftermijn bepalen. */
export interface DebriefRegel {
  rondeId: number;
  /** Laatste onderdeel: de jongste inleverdatum van de bewijsstukken. */
  laatsteOnderdeelOp: string | null;
  debriefOp: string | null;
}

/** Eén beslissing met de twee datums die de publicatietermijn bepalen. */
export interface PublicatieRegel {
  beslissingId: number;
  debriefOp: string | null;
  gepubliceerdOp: string | null;
}

/** Eén bezwaar met de twee datums die de behandeltermijn bepalen. */
export interface BezwaarRegel {
  bezwaarId: number;
  ingediendOp: string;
  uitspraakOp: string | null;
}

/** Eén item uit de bank, teruggebracht tot de twee gemeten grootheden. */
export interface ItemRegel {
  id: number;
  pWaarde: number | null;
  discriminatie: number | null;
  actief: boolean;
}

export interface ItembankKpi {
  /** Actieve items in de bank. */
  items: number;
  /** Actieve items waarvan een p-waarde bekend is. */
  metPWaarde: number;
  /** Items met p onder de ondergrens of boven de bovengrens. */
  buitenBereik: number[];
  /** Aandeel buiten bereik, gemeten over `metPWaarde`. Norm: onder 0,10. */
  aandeelBuitenBereik: number | null;
  /** Items met een negatieve item-restcorrelatie. Norm: 0 in de scoring. */
  negatieveDiscriminatie: number[];
  /** De gebruikte grenzen, zodat het scherm ze niet zelf hoeft te kennen. */
  pOndergrens: number;
  pBovengrens: number;
}

/**
 * De itembank tegen sectie 13.1.
 *
 * De grenzen komen uit `itemanalyse.ts` en worden hier niet opnieuw
 * opgeschreven. Zou dat wel gebeuren, dan bestaat er een tweede ondergrens die
 * ooit van de eerste gaat afwijken, en dan is niet meer te zeggen welke gold.
 *
 * Alleen actieve items tellen mee. Een item dat uit de scoring is gehaald, is
 * geen tekort in de bank meer — het is een verholpen tekort, en het als tekort
 * blijven tellen zou het herstel onzichtbaar maken.
 */
export function beoordeelItembank(items: ItemRegel[]): ItembankKpi {
  const actief = items.filter((i) => i.actief);
  const metP = actief.filter((i) => i.pWaarde !== null);
  const buitenBereik = metP
    .filter((i) => i.pWaarde! < P_ONDERGRENS || i.pWaarde! > P_BOVENGRENS)
    .map((i) => i.id);
  return {
    items: actief.length,
    metPWaarde: metP.length,
    buitenBereik,
    aandeelBuitenBereik: metP.length === 0 ? null : buitenBereik.length / metP.length,
    negatieveDiscriminatie: actief
      .filter((i) => i.discriminatie !== null && i.discriminatie < 0)
      .map((i) => i.id),
    pOndergrens: P_ONDERGRENS,
    pBovengrens: P_BOVENGRENS,
  };
}

export interface ProcesKpis {
  debrief: TermijnKpi;
  publicatie: TermijnKpi;
  bezwaar: TermijnKpi;
}

/**
 * De drie termijnen uit sectie 13.2 die uit de eigen tabellen te meten zijn.
 *
 * De drie andere indicatoren uit die tabel staan hier niet, en met opzet niet.
 * Deelname (≥ 90%) vraagt een uitnodigingenregister dat er nog niet is; of
 * iemand het kader vooraf gelezen heeft (≥ 85%) is een bevestiging die nergens
 * wordt vastgelegd; assessments per beoordelaarsduo per dag (≤ 3) vraagt een
 * agenda per duo. Een nul tonen waar geen meting bestaat, leest als "gehaald",
 * en dat is de gevaarlijkste soort leeg vakje.
 */
export function meetProcesKpis(invoer: {
  debriefs: DebriefRegel[];
  publicaties: PublicatieRegel[];
  bezwaren: BezwaarRegel[];
}): ProcesKpis {
  return {
    debrief: termijn(
      "Debrief binnen 10 werkdagen na het laatste onderdeel — 100%",
      invoer.debriefs.map((d) => ({
        id: d.rondeId,
        van: d.laatsteOnderdeelOp,
        tot: d.debriefOp,
      })),
      10,
      werkdagenTussen,
    ),
    publicatie: termijn(
      "Schriftelijke beslissing binnen 3 werkdagen na debrief — 100%",
      invoer.publicaties.map((p) => ({
        id: p.beslissingId,
        van: p.debriefOp,
        tot: p.gepubliceerdOp,
      })),
      3,
      werkdagenTussen,
    ),
    bezwaar: termijn(
      "Bezwaar behandeld binnen 30 dagen — 100%",
      invoer.bezwaren.map((b) => ({
        id: b.bezwaarId,
        van: b.ingediendOp,
        tot: b.uitspraakOp,
      })),
      30,
      dagenTussen,
    ),
  };
}

// ---------------------------------------------------------------------------
// 5. Het geheel
// ---------------------------------------------------------------------------

/**
 * Eén bewijsstuknummer dat niet door het hele panel is bekeken.
 *
 * Dit is de post die vroeger onzichtbaar was omdat ze in het wegvallen van de ICC
 * verstopt zat. Ze staat naast de agenda en niet erin: de agendatabel heeft een
 * gesloten lijst van soorten met een CHECK-conditie eromheen, en die lijst hoort
 * bij de beslislaag. Een berekende bevinding daar tussen zetten zou een migratie
 * vragen en het beslisvocabulaire vervuilen met iets wat niemand aanmaakt. Het
 * doel is dat de bevinding zichtbaar is, en dat is ze hier.
 */
export interface OnvolledigBeoordeeld {
  bewijsstukNummer: number;
  /** Cellen die ontbreken: dossiers × beoordelaars min wat is ingevuld. */
  ontbrekendeCellen: number;
  dekkingsgraad: number;
  /** Is er ondanks de gaten nog een ICC uitgekomen? */
  iccBerekend: boolean;
}

/**
 * De bewijsstuknummers waar het panel gaten liet, met de ernst erbij.
 *
 * Oplopend op dekkingsgraad: het slechtst bekeken bewijsstuk staat bovenaan.
 */
export function vindOnvolledigBeoordeeld(icc: IccPerBewijsstuk[]): OnvolledigBeoordeeld[] {
  return icc
    .filter((r) => r.ontbrekendeCellen > 0)
    .map((r) => ({
      bewijsstukNummer: r.bewijsstukNummer,
      ontbrekendeCellen: r.ontbrekendeCellen,
      dekkingsgraad: r.dekkingsgraad,
      iccBerekend: r.uitkomst.icc !== null,
    }))
    .sort((a, b) => a.dekkingsgraad - b.dekkingsgraad || a.bewijsstukNummer - b.bewijsstukNummer);
}

export interface RegiekamerBeeld {
  peildatum: string;
  rondes: FaseTelling[];
  agenda: AgendaSoortTelling[];
  icc: IccPerBewijsstuk[];
  /** Bewijsstukken die niet door het hele panel zijn bekeken. */
  onvolledigBeoordeeld: OnvolledigBeoordeeld[];
  proces: ProcesKpis;
  itembank: ItembankKpi;
  /**
   * Indicatoren uit sectie 13 waarvoor geen bron bestaat. Ze staan met naam en
   * al in het antwoord, zodat het scherm ze kan tonen als "niet gemeten" in
   * plaats van ze weg te laten.
   */
  nietGemeten: Array<{ indicator: string; waarom: string }>;
}

/** De indicatoren uit sectie 13 die het platform vandaag niet kan meten. */
export const NIET_GEMETEN: ReadonlyArray<{ indicator: string; waarom: string }> = [
  {
    indicator: "Vervangingsdagen voor feestdagen in het weekend (§13.2)",
    waarom:
      "De Belgische wettelijke feestdagen zijn verwerkt, maar een vervangingsdag wordt per onderneming collectief vastgelegd en is niet te berekenen. In een jaar met een feestdag in het weekend telt de termijn hoogstens twee werkdagen te veel.",
  },
  {
    indicator: "Beslissingsconsistentie op 10% herbeoordeelde dossiers (§13.1)",
    waarom: "Herbeoordelingen worden niet als aparte ronde vastgelegd en zijn dus niet te koppelen.",
  },
  {
    indicator: "Interne consistentie van de kennischeck (§13.1)",
    waarom: "Wordt in het platform niet gemeten; zie ITEMBRON §3.2.",
  },
  {
    indicator: "Deelname van wie een uitnodiging kreeg (§13.2)",
    waarom: "Er bestaat geen uitnodigingenregister om tegen af te zetten.",
  },
  {
    indicator: "Kandidaten die het kader vooraf gelezen hebben (§13.2)",
    waarom: "Die bevestiging wordt nergens vastgelegd.",
  },
  {
    indicator: "Assessments per beoordelaarsduo per dag (§13.2)",
    waarom: "Beoordelaarsduo's hebben geen eigen agenda in het platform.",
  },
  {
    indicator: "Fairnessmonitoring (§13.3)",
    waarom:
      "Vraagt uitsplitsing naar taal, geslacht, leeftijd en route. Geslacht en leeftijd staan niet in het register van geaccrediteerden.",
  },
  {
    indicator: "Ervaring van de kandidaten (§13.4)",
    waarom: "De anonieme bevraging na de schriftelijke beslissing bestaat nog niet.",
  },
];
