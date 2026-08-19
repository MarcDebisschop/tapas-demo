// ---------------------------------------------------------------------------
// server/t4r/uit-afname.ts
//
// Het kandidaatprofiel rechtstreeks uit een T4Business-afname van dit platform,
// in plaats van uit een geüpload PDF-bestand.
//
// WAAROM DIT BESTAAT
// De vergelijkende studie van T4Recruitment vroeg tot nu toe om een PDF. Dat
// bestand is een afdruk van gegevens die in dezelfde databank al aanwezig zijn:
// de afname bewaart haar eigen bevroren generatorcontract, en daarin staan de
// zestien constructen met hun nettoscore en hun gemiddelde energie. De omweg via
// de PDF had drie gevolgen die geen van drie iets met inhoud te maken hebben:
//
//   1. Herkomst. Elk PDF-bestand werd aanvaard. Er stond nergens vast dat het
//      vergeleken profiel bij deze persoon hoorde, en een beoordelaar kon in het
//      verificatiescherm elke waarde vrij overtypen. Voor recruitment is dat een
//      integriteitspunt: een beslissing over een mens hoort te kunnen zeggen
//      waar haar cijfers vandaan komen.
//   2. Toestemming en bewaartermijn. Die hangen aan de afname, niet aan een los
//      bestand. Met de interne koppeling reizen ze automatisch mee.
//   3. Nauwkeurigheid. De uitlezing van de PDF herkende in de praktijk enkel de
//      vijf drivers; de talentfoci en de versnellers gaven geen treffer. Uit het
//      contract komen alle zestien lijnen exact.
//
// WAT HIER GEBEURT, EN WAT NIET
// Deze module rekent NIETS opnieuw uit. Zij leest de opgeslagen constructrijen
// en zet ze om naar de zestien sleutels van T4Recruitment. De energiestatus komt
// uit shared/energie-schaal.ts, dezelfde regel die het Kompas-rapport gebruikt,
// zodat het rapport en de studie nooit een andere status kunnen tonen voor
// dezelfde meting.
// ---------------------------------------------------------------------------
import { energieStatusVanGemiddelde, type EnergieStatusDrie } from "../../shared/energie-schaal";

/**
 * De vertaaltabel tussen de canonieke constructnamen van het T4Business-
 * instrument (server/data/instrument.json, veld `construct`) en de sleutels van
 * T4Recruitment (server/t4r/match.ts, veld `key`).
 *
 * De twee lijsten zijn beide zestien lang en dekken elkaar volledig. Er wordt
 * dus niets geraden en niets weggelaten. De namen verschillen enkel in
 * schrijfwijze omdat de twee onderdelen op verschillende momenten geschreven
 * zijn: "Inter-relationeel" tegenover "interrelatie", "Impact" tegenover
 * "impacteren". Precies dat verschil in schrijfwijze was de reden dat de
 * uitlezing van de PDF deze lijnen niet vond.
 */
export const CONSTRUCT_NAAR_T4R_SLEUTEL: Record<string, string> = {
  // Drivers (beschermde term, onvertaald).
  "Be Strong": "be_strong",
  "Be Perfect": "be_perfect",
  "Hurry Up": "hurry_up",
  "Try Hard": "try_hard",
  "Please Others": "please_others",
  // Talent-foci.
  "Inter-relationeel": "interrelatie",
  "Operationeel": "operatie",
  "Strategie": "strategie",
  "Innovatie": "innovatie",
  // Het zelfbeeld is in T4Recruitment een aparte laag, los van talent.
  "TaPas-Beeld": "introspect",
  // Talent-versnellers.
  "Analyse": "analyse",
  "Coaching": "coaching",
  "Constructief onderscheidend": "onderscheiden",
  "Faciliteren": "faciliteren",
  "Impact": "impacteren",
  "Resultaatgericht": "resultaat",
};

/** Het aantal lijnen dat een volledige overname hoort op te leveren. */
export const VERWACHT_AANTAL_LIJNEN = Object.keys(CONSTRUCT_NAAR_T4R_SLEUTEL).length;

/**
 * Het enige instrument waaruit een aanwervingsvergelijking mag overnemen.
 * Dezelfde naam als in server/duiding-manager.ts; de jongereninstrumenten
 * (t4students, t4teens, t4kids) meten andere constructen.
 */
export const T4P_INSTRUMENT = "t4p-business-kompas";

export interface OvergenomenMeting {
  net: number;
  energie: EnergieStatusDrie;
  /** De gemiddelde item-energie waaruit de status volgt; enkel om te tonen. */
  gemiddeldeEnergie: number;
  /** De canonieke constructnaam uit de afname, voor het spoor. */
  bronConstruct: string;
}

export interface OvergenomenContext {
  energieDiscrepantie: number | null;
  herstelTraag: boolean | null;
  perfectionistischeBelasting: boolean | null;
  scheveWederkerigheid: boolean | null;
}

export interface OvernameResultaat {
  metingen: Record<string, OvergenomenMeting>;
  context: OvergenomenContext;
  deelnemer: {
    naam: string | null;
    respondentCode: string | null;
    bedrijf: string | null;
    rol: string | null;
  };
  /** Sleutels die het contract niet bevatte. Leeg bij een volledige afname. */
  ontbrekendeSleutels: string[];
  /** Constructnamen in het contract die geen sleutel hebben. Hoort leeg te zijn. */
  onbekendeConstructen: string[];
  contractVersie: string | null;
  instrumentVersie: number | null;
  gegenereerdOp: string | null;
}

function getal(waarde: unknown): number | null {
  const n = Number(waarde);
  return Number.isFinite(n) ? n : null;
}

/**
 * Zet een opgeslagen generatorcontract van een T4Business-afname om naar de
 * kandidaatgegevens die de vergelijkende studie nodig heeft.
 *
 * Werpt niet: een onvolledig contract levert een resultaat met ontbrekende
 * sleutels. De route beslist wat daarmee gebeurt, zodat de reden die de
 * beoordelaar leest bij de route staat en niet in de rekenlaag.
 */
export function neemProfielOverUitContract(contractRuw: unknown): OvernameResultaat {
  const contract: any = contractRuw ?? {};
  const main: any = contract?.sections?.main ?? {};
  const meta: any = main?.meta ?? {};
  const rijen: any[] = Array.isArray(main?.constructRows) ? main.constructRows : [];

  const metingen: Record<string, OvergenomenMeting> = {};
  const onbekendeConstructen: string[] = [];

  for (const rij of rijen) {
    const naam = typeof rij?.construct === "string" ? rij.construct : null;
    if (!naam) continue;
    const sleutel = CONSTRUCT_NAAR_T4R_SLEUTEL[naam];
    if (!sleutel) {
      onbekendeConstructen.push(naam);
      continue;
    }
    const net = getal(rij?.net);
    const gem = getal(rij?.avgEnergy);
    // Zonder nettoscore is er niets over te nemen. De energie mag ontbreken:
    // dan is de status neutraal, en dat is dezelfde terugval die de rest van het
    // platform gebruikt wanneer er geen energie gemeten is.
    if (net === null) continue;
    const gemiddeldeEnergie = gem ?? 0;
    metingen[sleutel] = {
      net,
      energie: energieStatusVanGemiddelde(gemiddeldeEnergie),
      gemiddeldeEnergie,
      bronConstruct: naam,
    };
  }

  const ontbrekendeSleutels = Object.values(CONSTRUCT_NAAR_T4R_SLEUTEL).filter(
    (s) => !(s in metingen),
  );

  // --- Context -------------------------------------------------------------
  // De energiediscrepantie is een getal uit de afname en wordt letterlijk
  // overgenomen. De drie signalen daaronder zijn AFGELEID: het contract bewaart
  // ze niet als vlag. De regel staat er expliciet bij zodat een beoordelaar kan
  // nagaan waarom een signaal aan staat. Waar het gegeven ontbreekt, blijft de
  // waarde null en niet false: "niet gemeten" is iets anders dan "afwezig".
  const discrepantie = getal(meta?.energyDiscrepancy);

  // Scheve wederkerigheid: dezelfde regel als in het Kompas-rapport, namelijk
  // zelfinvestering (q3) minstens vier punten boven organisatie-investering (q4).
  const antwoorden: any = contract?.sections?.connection?.answers ?? null;
  const q3 = getal(antwoorden?.q3);
  const q4 = getal(antwoorden?.q4);
  const scheveWederkerigheid = q3 !== null && q4 !== null ? q3 - q4 >= 4 : null;

  // Perfectionistische belasting: Be Perfect is aanwezig (nettoscore niet
  // negatief) EN kost energie. Dit is de smalle lezing van het drukpunt
  // "belasting door <driver>" uit het Kompas, toegepast op deze ene driver.
  const bePerfect = metingen["be_perfect"];
  const perfectionistischeBelasting = bePerfect
    ? bePerfect.net >= 0 && bePerfect.energie === "kost"
    : null;

  // Herstel onder spanning: het risicolabel van de afname zelf. Dat label komt
  // uit de gemiddelde energie van de twee sterkste drivers; "hoog" betekent dat
  // die twee lijnen samen energie kosten. Geen nieuwe berekening, enkel het
  // label lezen dat de scoring al zette.
  const risicoLabel = typeof meta?.driverRisk?.label === "string" ? meta.driverRisk.label : null;
  const herstelTraag = risicoLabel === null ? null : risicoLabel === "hoog";

  const deelnemer: any = contract?.participant ?? {};

  return {
    metingen,
    context: {
      energieDiscrepantie: discrepantie,
      herstelTraag,
      perfectionistischeBelasting,
      scheveWederkerigheid,
    },
    deelnemer: {
      naam: typeof deelnemer?.name === "string" ? deelnemer.name : null,
      respondentCode:
        typeof deelnemer?.respondentCode === "string" ? deelnemer.respondentCode : null,
      bedrijf: typeof deelnemer?.company === "string" ? deelnemer.company : null,
      rol: typeof deelnemer?.role === "string" ? deelnemer.role : null,
    },
    ontbrekendeSleutels,
    onbekendeConstructen,
    contractVersie: typeof contract?.contractVersion === "string" ? contract.contractVersion : null,
    instrumentVersie: getal(contract?.instrumentVersie),
    gegenereerdOp: typeof contract?.generatedAt === "string" ? contract.generatedAt : null,
  };
}

/**
 * Welke lijnen wijken af van wat de afname zei? De server rekent dit zelf uit
 * bij het opslaan, op basis van de afname waar het dossier naar verwijst. De
 * lijst komt dus NOOIT van de browser: wie zijn eigen afwijkingen mag opgeven,
 * kan het spoor uitwissen.
 */
export function bepaalHandmatigAangepast(
  bron: Record<string, OvergenomenMeting>,
  opgeslagen: Record<string, { net: number; energie: string }>,
): string[] {
  const afwijkend: string[] = [];
  for (const [sleutel, waarde] of Object.entries(opgeslagen)) {
    const b = bron[sleutel];
    if (!b) {
      // Een lijn die de afname niet had, is per definitie met de hand ingevuld.
      afwijkend.push(sleutel);
      continue;
    }
    if (b.net !== waarde.net || b.energie !== waarde.energie) afwijkend.push(sleutel);
  }
  return afwijkend.sort();
}
