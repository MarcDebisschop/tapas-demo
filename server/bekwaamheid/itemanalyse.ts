/**
 * Itemanalyse: wat de afnames over de items zeggen.
 *
 * Draaiboek §4.3 legt vast dat er na twintig afnames itemanalyse volgt, en
 * protocol blok 4 legt de grens vast waarop een item uit de scoring gaat:
 * "p < .30 of > .95, of een negatieve item-restcorrelatie. Dat is een fout van
 * de itemschrijver en niet van de kandidaat."
 *
 * Dit bestand rekent die twee maten uit en niets meer. Het raakt geen databank
 * en geen Express aan, en het gebruikt geen klok en geen toeval — dezelfde eis
 * als bij `itembank.ts`, `kennischeck.ts`, `normprofiel.ts` en
 * `beslisregels.ts`. De aanleiding is dezelfde als daar: bij een bezwaar is de
 * vraag "waarom is dit item uit mijn score gehaald" alleen te beantwoorden als
 * het antwoord uit de invoer volgt en nergens anders uit.
 *
 * WAT DEZE LAAG NIET DOET. Ze sluit niets uit. Ze levert een advies met de
 * grond eronder; het wegzetten van `p_waarde` en `discriminatie` en het
 * daadwerkelijk uitsluiten bij het nakijken zijn aparte handelingen met een
 * eigen spoor. `keurKennischeckNa` kent al een lijst `uitsluiten` met een
 * `redenUitsluiting`, en die reden hoort een mens te schrijven na het lezen van
 * dit advies. Een laag die zelf items uit de meting gooit, doet een
 * psychometrische ingreep zonder dat iemand ervoor tekent.
 *
 * WAAROM ITEM-REST EN NIET ITEM-TOTAAL. Een item correleert altijd met een
 * totaal waarin het zelf zit. Bij veertig items levert dat een opwaartse
 * vertekening die juist de zwakste items er nog net door helpt. De restscore
 * laat het item zelf weg. Het draaiboek zegt daarom uitdrukkelijk
 * "item-restcorrelatie" en niet "itemtotaalcorrelatie", en dat verschil is hier
 * geen detail: het bepaalt of een omgekeerd werkend item wordt opgemerkt.
 */

// ---------------------------------------------------------------------------
// Grenzen
// ---------------------------------------------------------------------------

/**
 * Onder dit aantal afnames volgt geen uitspraak.
 *
 * Draaiboek §4.3: itemanalyse na 20 afnames. De grens wordt hier niet
 * opgerekt naar "zo veel als er zijn". Een p-waarde op vier afnames is een
 * getal met twee cijfers achter de komma dat op elk scherm even betrouwbaar
 * oogt als een p-waarde op tweehonderd afnames, en juist dat maakt hem
 * gevaarlijk: hij wordt gelezen als bevinding.
 */
export const AFNAMEMINIMUM = 20;

/** Onder deze p-waarde is het item te moeilijk. Draaiboek: p < .30. */
export const P_ONDERGRENS = 0.3;

/** Boven deze p-waarde is het item te makkelijk. Draaiboek: p > .95. */
export const P_BOVENGRENS = 0.95;

/**
 * De grenzen zijn strikt, zoals ze in het draaiboek staan: p < .30 en p > .95.
 * Een item met p precies .30 haalt de grens en blijft dus staan. Dat is een
 * keuze en geen afronding: wie de grens als "≤" leest, sluit items uit die het
 * draaiboek wil houden, en het verschil is niet zichtbaar in de uitkomst.
 */
export const GRENZEN_ZIJN_STRIKT = true;

// ---------------------------------------------------------------------------
// Invoer
// ---------------------------------------------------------------------------

/**
 * Hoe één item bij één afname is uitgepakt. Dit zijn dezelfde vier waarden als
 * `Beoordeling` in `kennischeck.ts`, zodat de uitkomst van het nakijken hier
 * rechtstreeks in kan zonder tussenvertaling.
 */
export type Itembeoordeling = "goed" | "fout" | "wacht_op_mens" | "uitgesloten";

/** Wat één afname over de items zegt. */
export interface Afnameregel {
  /** Waaraan deze afname toebehoort. Alleen nodig om dubbels te betrappen. */
  itemsetId: number;
  /** Item-id naar beoordeling. Items die niet zijn aangeboden, staan er niet in. */
  uitkomsten: Record<number, Itembeoordeling>;
}

export interface AnalyseInvoer {
  afnames: readonly Afnameregel[];
  /**
   * Afwijkend minimum. Alleen voor een proefopstelling; de gewone weg gebruikt
   * `AFNAMEMINIMUM`. Wie hem verlaagt, krijgt het lagere aantal terug in
   * `minimumGebruikt`, zodat een rapport nooit kan verzwijgen op hoeveel
   * afnames het rust.
   */
  minimum?: number;
}

// ---------------------------------------------------------------------------
// Uitkomst
// ---------------------------------------------------------------------------

/** Wat er over één item te zeggen valt. */
export type Itemadvies =
  | "houden"
  | "te_moeilijk"
  | "te_makkelijk"
  | "keert_om"
  | "te_weinig_afnames";

export interface Itemuitkomst {
  itemId: number;
  /** Aantal afnames waarin dit item meetbaar was: goed of fout. */
  aantalMeetbaar: number;
  /** Aantal keer goed. */
  aantalGoed: number;
  /** Aantal keer dat het item bij het nakijken buiten de meting bleef. */
  aantalBuitenMeting: number;
  /** Aandeel goed over `aantalMeetbaar`, of leeg bij te weinig afnames. */
  pWaarde: number | null;
  /** Item-restcorrelatie, of leeg wanneer die niet te berekenen is. */
  discriminatie: number | null;
  /** Waarom `discriminatie` leeg is. Leeg wanneer er een getal staat. */
  redenGeenDiscriminatie: string;
  advies: Itemadvies;
  /** De grond onder het advies, in gewone taal, klaar om te tonen. */
  grond: string;
}

export interface Analyseresultaat {
  /** Aantal afnames dat is meegerekend. */
  aantalAfnames: number;
  /** Het minimum dat is aangehouden. */
  minimumGebruikt: number;
  /** Waar wanneer `aantalAfnames >= minimumGebruikt`. */
  voldoendeAfnames: boolean;
  /** Eén rij per item dat in minstens één afname voorkwam, op item-id. */
  items: Itemuitkomst[];
  /** De item-ids waarvoor het advies niet "houden" is, op item-id. */
  aandacht: number[];
  /** Wat er aan de invoer mankeerde. Leeg wanneer er niets mankeerde. */
  bevindingen: string[];
}

// ---------------------------------------------------------------------------
// Rekenen
// ---------------------------------------------------------------------------

/**
 * Pearson-correlatie tussen twee even lange reeksen.
 *
 * Leeg bij minder dan twee waarnemingen of wanneer een van beide reeksen geen
 * spreiding heeft. Dat laatste is niet zeldzaam: een item dat iedereen goed
 * heeft, heeft een reeks van louter enen, en de noemer is dan nul. Nul
 * teruggeven in plaats van leeg zou "geen samenhang" zeggen waar "niet te
 * bepalen" hoort te staan, en die twee leiden tot een ander besluit.
 */
function correlatie(a: readonly number[], b: readonly number[]): number | null {
  const n = a.length;
  if (n !== b.length || n < 2) return null;

  let somA = 0;
  let somB = 0;
  for (let i = 0; i < n; i += 1) {
    somA += a[i];
    somB += b[i];
  }
  const gemA = somA / n;
  const gemB = somB / n;

  let teller = 0;
  let kwadA = 0;
  let kwadB = 0;
  for (let i = 0; i < n; i += 1) {
    const dA = a[i] - gemA;
    const dB = b[i] - gemB;
    teller += dA * dB;
    kwadA += dA * dA;
    kwadB += dB * dB;
  }

  if (kwadA === 0 || kwadB === 0) return null;
  return teller / Math.sqrt(kwadA * kwadB);
}

/**
 * Afronden op vier cijfers achter de komma.
 *
 * Zonder deze stap komen er getallen als 0.30000000000000004 uit, en dan hangt
 * de vergelijking met een grens af van de laatste bit van een deling. Vier
 * cijfers is ruim genoeg om twee items te onderscheiden en kort genoeg om in
 * een rapport te zetten.
 */
function rond(waarde: number): number {
  return Math.round(waarde * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// De analyse
// ---------------------------------------------------------------------------

/**
 * Rekent p-waarde en item-restcorrelatie uit over een reeks afnames.
 *
 * De noemer van de p-waarde is het aantal afnames waarin het item meetbaar
 * was: goed of fout. Een item dat bij het nakijken al buiten de meting bleef —
 * uitgesloten, of nog wachtend op een mens — hoort niet in die noemer. Dat is
 * dezelfde regel als bij het nakijken zelf, waar een uitgesloten item uit de
 * noemer gaat en niet als fout meetelt. Twee lagen die hier verschillend
 * zouden rekenen, geven twee getallen die beide "p" heten.
 */
export function analyseerItems(invoer: AnalyseInvoer): Analyseresultaat {
  const minimum = invoer.minimum ?? AFNAMEMINIMUM;
  const bevindingen: string[] = [];

  // Dubbele itemsets eruit. Twee keer dezelfde afname meerekenen verdubbelt
  // het gewicht van één persoon en tilt het aantal over het minimum heen; dat
  // is precies de vergissing die het minimum moest voorkomen.
  const gezien = new Set<number>();
  const afnames: Afnameregel[] = [];
  for (const regel of invoer.afnames) {
    if (gezien.has(regel.itemsetId)) {
      bevindingen.push(`itemset ${regel.itemsetId} komt meer dan één keer voor en is één keer meegerekend`);
      continue;
    }
    gezien.add(regel.itemsetId);
    afnames.push(regel);
  }

  const aantalAfnames = afnames.length;
  const voldoendeAfnames = aantalAfnames >= minimum;

  // Alle item-ids die ergens voorkomen, oplopend.
  const idsSet = new Set<number>();
  for (const regel of afnames) {
    for (const sleutel of Object.keys(regel.uitkomsten)) {
      const id = Number(sleutel);
      if (!Number.isInteger(id)) {
        bevindingen.push(`item-id "${sleutel}" is geen geheel getal en is overgeslagen`);
        continue;
      }
      idsSet.add(id);
    }
  }
  const ids = Array.from(idsSet).sort((a, b) => a - b);

  // Per afname het aantal goed en het aantal meetbaar. Nodig voor de
  // restscore: die is het aantal goed van de andere items.
  const goedPerAfname: number[] = [];
  for (const regel of afnames) {
    let goed = 0;
    for (const id of ids) {
      if (regel.uitkomsten[id] === "goed") goed += 1;
    }
    goedPerAfname.push(goed);
  }

  const items: Itemuitkomst[] = [];

  for (const id of ids) {
    let aantalMeetbaar = 0;
    let aantalGoed = 0;
    let aantalBuitenMeting = 0;

    // Twee gelijklopende reeksen, alleen over de afnames waarin dit item
    // meetbaar was: de itemscore en de restscore.
    const itemScores: number[] = [];
    const restScores: number[] = [];

    for (let i = 0; i < afnames.length; i += 1) {
      const uitkomst = afnames[i].uitkomsten[id];
      if (uitkomst === undefined) continue;

      if (uitkomst === "uitgesloten" || uitkomst === "wacht_op_mens") {
        aantalBuitenMeting += 1;
        continue;
      }

      const isGoed = uitkomst === "goed";
      aantalMeetbaar += 1;
      if (isGoed) aantalGoed += 1;

      itemScores.push(isGoed ? 1 : 0);
      restScores.push(goedPerAfname[i] - (isGoed ? 1 : 0));
    }

    let pWaarde: number | null = null;
    let discriminatie: number | null = null;
    let redenGeenDiscriminatie = "";
    let advies: Itemadvies;
    let grond: string;

    if (!voldoendeAfnames) {
      advies = "te_weinig_afnames";
      grond =
        `${aantalAfnames} van de ${minimum} afnames binnen. Er wordt geen p-waarde ` +
        "en geen item-restcorrelatie berekend, omdat een getal op te weinig afnames " +
        "als bevinding wordt gelezen.";
      redenGeenDiscriminatie = "te weinig afnames";
      items.push({
        itemId: id,
        aantalMeetbaar,
        aantalGoed,
        aantalBuitenMeting,
        pWaarde,
        discriminatie,
        redenGeenDiscriminatie,
        advies,
        grond,
      });
      continue;
    }

    if (aantalMeetbaar === 0) {
      advies = "te_weinig_afnames";
      grond =
        "Dit item was in geen enkele afname meetbaar: het bleef overal buiten de " +
        "meting. Zonder goed of fout is er niets te rekenen.";
      redenGeenDiscriminatie = "in geen enkele afname meetbaar";
      items.push({
        itemId: id,
        aantalMeetbaar,
        aantalGoed,
        aantalBuitenMeting,
        pWaarde,
        discriminatie,
        redenGeenDiscriminatie,
        advies,
        grond,
      });
      continue;
    }

    if (aantalMeetbaar < minimum) {
      // Er zijn genoeg afnames, maar niet van dit item. Bij twee equivalente
      // versies is dat het normale geval: elk item komt in ongeveer de helft
      // van de afnames voor. Het minimum geldt daarom ook per item.
      advies = "te_weinig_afnames";
      grond =
        `Dit item was in ${aantalMeetbaar} van de ${aantalAfnames} afnames meetbaar; ` +
        `het minimum is ${minimum} per item. Bij twee versies van de check duurt dat ` +
        "langer dan bij één, en dat is geen reden om de grens te verlagen.";
      redenGeenDiscriminatie = "te weinig meetbare afnames voor dit item";
      items.push({
        itemId: id,
        aantalMeetbaar,
        aantalGoed,
        aantalBuitenMeting,
        pWaarde,
        discriminatie,
        redenGeenDiscriminatie,
        advies,
        grond,
      });
      continue;
    }

    pWaarde = rond(aantalGoed / aantalMeetbaar);

    const ruweCorrelatie = correlatie(itemScores, restScores);
    if (ruweCorrelatie === null) {
      discriminatie = null;
      if (aantalGoed === aantalMeetbaar) {
        redenGeenDiscriminatie = "alle kandidaten hadden dit item goed, dus geen spreiding";
      } else if (aantalGoed === 0) {
        redenGeenDiscriminatie = "geen enkele kandidaat had dit item goed, dus geen spreiding";
      } else {
        redenGeenDiscriminatie = "de restscores hebben geen spreiding";
      }
    } else {
      discriminatie = rond(ruweCorrelatie);
    }

    // De volgorde van de drie regels is niet vrij. Een item dat iedereen goed
    // heeft, heeft p = 1 én geen berekenbare correlatie; het advies moet dan
    // "te_makkelijk" zijn en niet "geen uitspraak", want te makkelijk is wat
    // er werkelijk aan de hand is.
    if (pWaarde < P_ONDERGRENS) {
      advies = "te_moeilijk";
      grond =
        `${aantalGoed} van de ${aantalMeetbaar} kandidaten had dit item goed (p = ${pWaarde}). ` +
        `Dat is onder de grens van ${P_ONDERGRENS}. Een item dat bijna niemand haalt, ` +
        "meet de kandidaat niet maar de formulering.";
    } else if (pWaarde > P_BOVENGRENS) {
      advies = "te_makkelijk";
      grond =
        `${aantalGoed} van de ${aantalMeetbaar} kandidaten had dit item goed (p = ${pWaarde}). ` +
        `Dat is boven de grens van ${P_BOVENGRENS}. Een item dat vrijwel iedereen haalt, ` +
        "onderscheidt niemand van niemand en neemt de plaats in van een item dat dat wel doet.";
    } else if (discriminatie !== null && discriminatie < 0) {
      advies = "keert_om";
      grond =
        `De item-restcorrelatie is ${discriminatie}. Wie de rest van de check beter maakt, ` +
        "heeft dit item vaker fout. Dan is de sleutel verkeerd, of de stam vraagt iets " +
        "anders dan hij lijkt te vragen.";
    } else if (discriminatie === null) {
      advies = "houden";
      grond =
        `p = ${pWaarde} ligt binnen de grenzen. De item-restcorrelatie is niet te ` +
        `berekenen: ${redenGeenDiscriminatie}.`;
    } else {
      advies = "houden";
      grond =
        `p = ${pWaarde} ligt tussen ${P_ONDERGRENS} en ${P_BOVENGRENS}, en de ` +
        `item-restcorrelatie is ${discriminatie}. Beide maten geven geen aanleiding ` +
        "om dit item uit de scoring te halen.";
    }

    items.push({
      itemId: id,
      aantalMeetbaar,
      aantalGoed,
      aantalBuitenMeting,
      pWaarde,
      discriminatie,
      redenGeenDiscriminatie,
      advies,
      grond,
    });
  }

  const aandacht = items.filter((i) => i.advies !== "houden").map((i) => i.itemId);

  return {
    aantalAfnames,
    minimumGebruikt: minimum,
    voldoendeAfnames,
    items,
    aandacht,
    bevindingen,
  };
}

/**
 * Waar wanneer dit advies volgens protocol blok 4 grond is om het item uit de
 * scoring te halen. "Te weinig afnames" is dat niet: dat is geen bevinding over
 * het item maar over de hoeveelheid gegevens.
 */
export function isUitsluitgrond(advies: Itemadvies): boolean {
  return advies === "te_moeilijk" || advies === "te_makkelijk" || advies === "keert_om";
}

/**
 * De item-ids die volgens de analyse uit de scoring horen, op item-id.
 *
 * Dit is een voorstel en geen handeling. Wie het overneemt, zet de ids in
 * `uitsluiten` bij `keurKennischeckNa` en schrijft er een reden bij.
 */
export function voorgesteldeUitsluitingen(resultaat: Analyseresultaat): number[] {
  return resultaat.items.filter((i) => isUitsluitgrond(i.advies)).map((i) => i.itemId);
}
