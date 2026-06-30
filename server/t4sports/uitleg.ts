// server/t4sports/uitleg.ts
// Uitleg-script engine voor T4Sports — Mental Talent Profiel.
// Bouwt een gesproken script van 6 blokken op basis van het T4Sports contract.

import { sportNaam } from "./scoring";

export interface UitlegBlok {
  id: string;
  titel: string;
  tekst: string;
}

export interface UitlegScript {
  taal: string;
  toon: "deelnemer" | "coach";
  naam: string;
  blokken: UitlegBlok[];
}

export type Toon = "deelnemer" | "coach";

// VLAAMSE_STEM_PROMPT — zelfde als in server/uitleg.ts
export const VLAAMSE_STEM_PROMPT =
  "Lees onderstaande voor in vlot Belgisch-Nederlands met een zachte Vlaamse tongval " +
  "(Oost-Vlaanderen): zachte g, geen scherpe Hollandse klanken, geen Randstad-intonatie. " +
  "Klink warm, kalm en uitnodigend.";

interface ConstructRow {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
  mostItems?: string[];
}

function parseContract(raw: unknown): any | null {
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;
  const c = obj?.contract ?? obj;
  return c?.sections ?? null;
}

function voornaam(naam: string): string {
  return (naam || "").trim().split(/\s+/)[0] ?? "";
}

const DRIVER_SPORTDUIDING: Record<string, { positief: string; eerlijk: string; gaspedaal: string }> = {
  "Be Perfect": {
    positief: "Je zoekt altijd het allerbeste in jezelf. Die gedrevenheid om perfect te zijn is een echte kracht in sport.",
    eerlijk: "Maar het kan ook een val worden: wanneer 'bijna perfect' nooit goed genoeg is, begint die lat je meer energie te kosten dan ze oplevert.",
    gaspedaal: "Jouw perfectiestreven kan een gaspedaal zijn in de goede momenten, maar pas op dat het geen rem wordt in de kritieke seconden.",
  },
  "Be Strong": {
    positief: "Je bent sterk, je houdt vol, je toont nooit zwakte. In sport is dat een groot wapen.",
    eerlijk: "Maar kracht tonen ten koste van alles kan ervoor zorgen dat je pijn, vermoeidheid of twijfel te lang verbergt, ook voor jezelf.",
    gaspedaal: "Je kracht kan je doen accelleren wanneer anderen afhaken — maar zorg dat je die kracht niet opbrandt door er nooit op te rusten.",
  },
  "Hurry Up": {
    positief: "Je bent snel, je beslist in het moment, je voelt de flow. Dat is goud waard in sport.",
    eerlijk: "De keerzijde: ongeduld en haast kunnen je doen ontploffen voor het echte moment er is, of leiden tot overhaaste keuzes.",
    gaspedaal: "Jouw snelheid is een gaspedaal — maar weet ook wanneer bewust vertragen de slimste keuze is.",
  },
  "Please Others": {
    positief: "Je bent afgestemd op je omgeving, je voelt aan wat anderen nodig hebben, je past je aan. Dat maakt je een waardevolle ploeggenoot.",
    eerlijk: "Maar als je prestatiemotivatie te sterk leunt op de goedkeuring van je coach of je publiek, ben je kwetsbaar wanneer die goedkeuring wegvalt.",
    gaspedaal: "Leer ook presteren voor jezelf — dat geeft een stabilere en duurzamere energiebron dan externe goedkeuring.",
  },
  "Try Hard": {
    positief: "Jouw doorzettingsvermogen is grenzeloos als er iemand op je rekent. Die loyale kracht is uniek.",
    eerlijk: "Maar wat als die persoon er niet is? Je motivatie is sterk afhankelijk van die bijzondere verbinding, en dat kan een kwetsbaarheid zijn.",
    gaspedaal: "Leer die kracht te internaliseren — draag die inspirerende stem met je mee als innerlijk kompas, onafhankelijk van de aanwezigheid van die persoon.",
  },
};

const FOCUS_SPORTDUIDING: Record<string, string> = {
  "Functioneel Innovatief": "Als Probleemoplosser vind jij creatieve wegen in het veld die anderen niet zien. Die innovatieve geest is een van je sterkste troeven.",
  "Artistiek Innovatief": "Als Expressionist breng jij stijl en gevoel mee in je sport. Je beweging is niet alleen functioneel — ze is ook een uitdrukking van wie je bent.",
  "Complexiteit/Conceptueel": "Als Strateeg zie jij het grote plaatje. Tactische diepgang en het begrijpen van het 'waarom' zijn jouw springveer naar betere prestaties.",
  "Systematisch/Uitvoerend": "Als Uitvoerder ben jij de betrouwbaarheid in persoon. Een solide systeem, een vaste routine, consistente kwaliteit — dat is jouw kracht.",
  "Sociaal Interactief": "Als Verbinder haal jij het beste uit jezelf in contact met anderen. Die verbinding met je team is geen bijproduct van je sport — het ís jouw sport.",
  "Overdrachtelijk Interactief": "Als Activator geef jij anderen energie en inzicht. Het overdragen van kennis en enthousiasme is voor jou net zo vervullend als je eigen prestatie.",
};

const VERSNELLER_SPORTDUIDING: Record<string, string> = {
  "Analyse": "Als Ontleder verwerk jij prestatie-informatie grondig. Inzicht in patronen en fouten maakt jou scherper dan gemiddeld.",
  "Individueel ondersteunend": "Als Mentor investeer jij in de groei van anderen. Die één-op-één verbinding geeft jou ook energie en richting.",
  "Groepsondersteunend": "Als Orkestrator bouw jij aan teamflow. Een team dat jij ondersteunt, presteert als één geheel.",
  "Impact": "Als Performer kom jij het best tot je recht wanneer er echt iets op het spel staat. Druk is voor jou geen belasting — het is brandstof.",
  "Resultaat": "Als Finisher richt jij je volledig op het doel. Die focus is een krachtige versneller die anderen moeilijk evenaren.",
  "Constructief onderscheidend": "Als Vrijdenker durf jij je eigen weg te gaan. Dat eigenwijze denken leidt tot doorbraken die anderen missen.",
};

export function bouwT4SportsUitlegScript(
  contractRaw: unknown,
  taal: string = "nl",
  toon: Toon = "deelnemer",
  naam?: string
): UitlegScript {
  const sections = parseContract(contractRaw);
  const n = naam ?? (typeof contractRaw === "object" && contractRaw !== null
    ? (contractRaw as any)?.name ?? (contractRaw as any)?.contract?.name ?? ""
    : "");
  const vn = voornaam(n);

  if (!sections) {
    return {
      taal,
      toon,
      naam: n,
      blokken: [
        {
          id: "geen_data",
          titel: "Geen profieldata gevonden",
          tekst: "Er kon geen profiel worden opgebouwd op basis van de beschikbare gegevens.",
        },
      ],
    };
  }

  const main = sections.main ?? {};
  const meta = sections.meta ?? {};
  const conn = sections.connection ?? {};
  const rows: ConstructRow[] = Array.isArray(main.constructRows) ? main.constructRows : [];
  const sportprofiel = meta.sportprofiel ?? {};

  const topFoci = rows.filter((r) => r.family === "Talent-foci").sort((a, b) => b.net - a.net).slice(0, 3);
  const topVersnellers = rows.filter((r) => r.family === "Talent-versnellers").sort((a, b) => b.net - a.net).slice(0, 2);
  const topDriverRow = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net)[0];
  const dominanteDriver = topDriverRow?.construct ?? "—";
  const driverDuiding = DRIVER_SPORTDUIDING[dominanteDriver];

  const normEnergy = meta.normalizedQuestionnaireEnergy ?? 5;
  const baselineEnergy = meta.baselineAthleetEnergy ?? 5;
  const drukProfielRaw: string = String(sportprofiel.drukProfiel ?? "wisselvallig");
  const drukProfiel: "gaspedaal" | "rem" | "wisselvallig" =
    drukProfielRaw === "gaspedaal" || drukProfielRaw === "rem" ? drukProfielRaw : "wisselvallig";
  const sportpassie = conn.sportpassie ?? conn.answers?.q1 ?? 5;

  const aanspreking = toon === "deelnemer" ? (vn ? vn : "jij") : (vn ? `${vn}` : "de atleet");
  const jij = toon === "deelnemer" ? "je" : "de atleet";
  const jouw = toon === "deelnemer" ? "jouw" : "zijn/haar";

  // Blok 1: Intro + wie ben je als atleet
  const blok1: UitlegBlok = {
    id: "intro",
    titel: "Wie ben je als atleet?",
    tekst: toon === "deelnemer"
      ? `Welkom bij jouw T4Sports Mental Talent Profiel, ${vn || "atleet"}.\n\n` +
        `Dit profiel vertelt jou wie je bent als atleet — niet alleen wat je kan, maar hoe je denkt, voelt en functioneert onder druk. ` +
        `We kijken naar drie lagen: jouw talent-foci, jouw versnellers, en jouw drivers.\n\n` +
        `Jouw mentale energie uit de vragenlijst staat op ${normEnergy.toFixed(1)} op 10. ` +
        `Jij schatte jezelf in op ${baselineEnergy.toFixed(1)} op 10. ` +
        `${Math.abs(normEnergy - baselineEnergy) > 1.5
          ? "Er zit een opmerkelijk verschil tussen die twee — dat vertelt iets interessants over hoe je jezelf beleeft versus wat de vragenlijst opvangt."
          : "Die twee waarden liggen dicht bij elkaar — dat wijst op een goed zelfbewustzijn."}`
      : `Profiel van ${n || "de atleet"}.\n\n` +
        `Mentale energie (vragenlijst): ${normEnergy.toFixed(1)}/10. Baseline (zelf): ${baselineEnergy.toFixed(1)}/10. ` +
        `Sportpassie: ${sportpassie}/10.\n\n` +
        `${Math.abs(normEnergy - baselineEnergy) > 1.5
          ? "Er is een significant verschil tussen de zelf-ingeschatte energie en de vragenlijstscore. Dit verdient aandacht in het coaching-gesprek."
          : "De energie-inschatting is consistent — de atleet heeft een realistisch zelfbeeld."}`,
  };

  // Blok 2: Talentfocus uitgelegd
  const fociNamen = topFoci.map((r) => sportNaam(r.construct));
  const blok2: UitlegBlok = {
    id: "talentfocus",
    titel: "Je talentfocus: de motor achter je prestatie",
    tekst: toon === "deelnemer"
      ? `Jouw drie sterkste talent-foci zijn: ${fociNamen.join(", ")}.\n\n` +
        topFoci.slice(0, 2).map((r) => FOCUS_SPORTDUIDING[r.construct] ?? sportNaam(r.construct)).join("\n\n") +
        (topFoci[0] ? `\n\nJouw dominante focus — ${sportNaam(topFoci[0].construct)} — is het sterkst aanwezig. Dat is het profiel dat het meest herkenbaar is in jouw dagelijkse sport.` : "")
      : `Talent-foci top-3: ${fociNamen.join(", ")}.\n\n` +
        `Dominante focus: ${topFoci[0] ? sportNaam(topFoci[0].construct) : "—"} (net: ${topFoci[0]?.net ?? "—"}, energie: ${topFoci[0]?.avgEnergy?.toFixed(1) ?? "—"}).\n\n` +
        (topFoci[0] ? FOCUS_SPORTDUIDING[topFoci[0].construct] ?? "" : ""),
  };

  // Blok 3: Versnellers
  const versnellersNamen = topVersnellers.map((r) => sportNaam(r.construct));
  const blok3: UitlegBlok = {
    id: "versnellers",
    titel: "Je versnellers: hoe je talent tot resultaat komt",
    tekst: toon === "deelnemer"
      ? `Jouw versnellers zijn: ${versnellersNamen.join(" en ")}.\n\n` +
        topVersnellers.map((r) => VERSNELLER_SPORTDUIDING[r.construct] ?? sportNaam(r.construct)).join("\n\n") +
        "\n\nDe combinatie van jouw talent-focus en jouw versnellers is de kern van jouw sportidentiteit. Dat is het profiel dat je coach moet kennen."
      : `Versnellers top-2: ${versnellersNamen.join(", ")}.\n\n` +
        topVersnellers.map((r) => `${sportNaam(r.construct)}: ${VERSNELLER_SPORTDUIDING[r.construct] ?? ""}`).join("\n") +
        `\n\nNote: gebruik de combinatie focus + versneller als de ingang voor het coaching-gesprek.`,
  };

  // Blok 4: Dominant driver — het eerlijke verhaal
  const blok4: UitlegBlok = {
    id: "driver",
    titel: `Je dominant driver: ${dominanteDriver}`,
    tekst: toon === "deelnemer"
      ? `Jouw dominant driver is ${dominanteDriver}.\n\n` +
        (driverDuiding
          ? `${driverDuiding.positief}\n\n${driverDuiding.eerlijk}\n\n${driverDuiding.gaspedaal}`
          : `Dit patroon stuurt jouw gedrag onder druk. Het is geen zwakte — het is een signaal. En signalen kun je leren gebruiken.`)
      : `Dominant driver: ${dominanteDriver} (net: ${topDriverRow?.net ?? "—"}, energie: ${topDriverRow?.avgEnergy?.toFixed(1) ?? "—"}).\n\n` +
        (driverDuiding
          ? `Positief: ${driverDuiding.positief}\nRisico: ${driverDuiding.eerlijk}\nCoach-insteek: ${driverDuiding.gaspedaal}`
          : ""),
  };

  // Blok 5: Wat er gebeurt in het kritische moment (drukprofiel)
  const drukUitleg = {
    gaspedaal: toon === "deelnemer"
      ? `Jouw driver werkt als een gaspedaal: in het kritieke moment accelereer je. Druk maakt jou scherper, niet slapper. Dat is een zeldzame kracht — mits je er bewust mee omgaat.`
      : `Drukprofiel: gaspedaal. De atleet presteert beter onder druk. Gebruik dit bewust in training: simuleer drukke situaties.`,
    rem: toon === "deelnemer"
      ? `Jouw driver werkt op dit moment als een rem: in het kritieke moment dreigt je energie te blokkeren. Dat is geen zwakte, maar een signaal. Mental coaching kan dit ombuigen.`
      : `Drukprofiel: rem. De atleet dreigt te blokkeren onder druk. Prioriteit in mental coaching: het opbouwen van drukbestendigheid.`,
    wisselvallig: toon === "deelnemer"
      ? `Jouw drukprofiel is wisselvallig: soms een gaspedaal, soms een rem. De sleutel is bewustzijn — weten wanneer welke modus actief is, zodat je erop kunt anticiperen.`
      : `Drukprofiel: wisselvallig. Onderzoek in het coaching-gesprek welke omstandigheden leiden tot welk patroon.`,
  };

  const blok5: UitlegBlok = {
    id: "drukprofiel",
    titel: "Wat er in jou gebeurt op het kritische moment",
    tekst: drukUitleg[drukProfiel],
  };

  // Blok 6: Hoe je het gaspedaal-principe activeert
  const connPassie = conn.sportpassie ?? conn.answers?.q1 ?? 5;
  const connBillijk = conn.billijkheid ?? conn.answers?.q2 ?? 5;
  const connZelfinv = conn.mentaleZelfinvestering ?? conn.answers?.q3 ?? 5;
  const connClub = conn.clubInvestering ?? conn.answers?.q4 ?? 5;

  const blok6: UitlegBlok = {
    id: "gaspedaal",
    titel: "Hoe je het gaspedaal-principe activeert",
    tekst: toon === "deelnemer"
      ? `Je sportpassie staat op ${connPassie}/10. ` +
        (connPassie >= 7
          ? "Die passie is een sterke interne motor — koester dat."
          : connPassie >= 5
          ? "Er is passie, maar ze kan dieper. Vraag jezelf: wanneer voel jij echt die vuur? Ga terug naar dat moment."
          : "Als de sportpassie laag staat, is dat een signaal dat verdient om besproken te worden. Prestaties kosten energie — en die energie begint bij het innerlijk vuur.") +
        "\n\n" +
        `De investering van jouw club in jou als persoon: ${connClub}/10. ` +
        (connClub < 5 ? "Als je je onvoldoende gesteund voelt als mens achter de prestatie, is dat iets om bespreekbaar te maken." : "Je voelt je gesteund — dat is een fundament.") +
        "\n\n" +
        `Jouw mentale zelfinvestering — buiten de fysieke training — staat op ${connZelfinv}/10. ` +
        (connZelfinv < 6
          ? "Mental coaching begint hier. Jouw mentale groei is net zo bepalend als jouw fysieke training."
          : "Goed — je investeert ook in je mentale kant. Dat is het verschil dat het verschil maakt.")
      : `Sportverbondenheid:\n` +
        `• Sportpassie: ${connPassie}/10\n` +
        `• Billijkheid: ${connBillijk}/10\n` +
        `• Mentale zelfinvestering: ${connZelfinv}/10\n` +
        `• Club-investering: ${connClub}/10\n\n` +
        `${connPassie < 6 || connClub < 5 ? "AANDACHTSPUNT: lage verbondenheid. Bespreek dit als prioriteit in het coaching-gesprek." : "Verbondenheid is gezond. Bouw hierop voort in het coaching-traject."}`,
  };

  return {
    taal,
    toon,
    naam: n,
    blokken: [blok1, blok2, blok3, blok4, blok5, blok6],
  };
}
