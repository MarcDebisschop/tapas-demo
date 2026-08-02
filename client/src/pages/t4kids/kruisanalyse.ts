// ---------------------------------------------------------------------------
// client/src/pages/t4kids/kruisanalyse.ts — de cross-eiland-analyse.
//
// Dit stond eerder als een useMemo midden in t4kids-rapport.tsx. Het is hier
// losgemaakt zodat de zinnen die een kind te lezen krijgt, getest kunnen
// worden zonder een browser. De logica is ongewijzigd overgenomen, met een
// uitzondering: de zin over perfectionisme viel eerder bij elke driver en valt
// nu alleen nog bij de driver die er echt over gaat. Zie DRIVERZINNEN.
//
// Versterkingen (signalen die samenvallen) + "verwonderlijke dingen om samen
// te bespreken" (zachte spanning). Nooit "tegenstrijdig"; robuust bij lege data.
// ---------------------------------------------------------------------------

export interface KruisFocusTally {
  focus: string;
  activiteit: string;
  keuzes: number;
}
export interface KruisArchetype {
  id: string;
  naam: string;
  focus: string;
  topRang?: number | null;
}
export interface KruisTop3 {
  id: string;
}
export interface KruisStelling {
  soort: string;
  mapping: string;
  gekozenWaarde: number;
  gekozenWoord: string;
}
export interface KruisInvoer {
  focusTally?: KruisFocusTally[];
  archetypen?: KruisArchetype[];
  top3?: KruisTop3[];
  stellingen?: KruisStelling[];
}
export interface KruisAnalyse {
  versterkingen: string[];
  verwonderlijk: string[];
  ouder: string;
}

// Een stelling telt als een duidelijk signaal vanaf "vaak" (2) op de
// woordschaal van 0 tot 3.
const DUIDELIJK = 2;

// Per driver de zin die het kind erover te lezen krijgt. De zin over
// perfectionisme hoort bij Be Perfect en bij niets anders; eerder viel die zin
// ook bij Please Others, Hurry Up, Try Hard en Be Strong, terwijl die vier
// over iets heel anders gaan.
const DRIVERZINNEN: Record<string, string> = {
  "Be Perfect":
    "Je liet zien dat je dingen graag héél goed wil doen. Dat is een mooie kracht, en soms best spannend. Wat helpt jou als iets even niet lukt?",
  "Please Others":
    "Je liet zien dat je graag zorgt dat anderen blij zijn. Dat is fijn voor de mensen om je heen, en soms best veel om te dragen. Wat wil jij zelf graag?",
  "Hurry Up":
    "Je liet zien dat je graag veel doet en dat het snel mag gaan. Dat geeft veel energie, en soms is het fijn om even te vertragen. Wanneer lukt het jou om rustig te doen?",
  "Try Hard":
    "Je liet zien dat je extra je best doet als iemand in je gelooft. Dat is een mooie kracht, en soms best zwaar. Wat helpt jou als het niet meteen lukt?",
  "Be Strong":
    "Je liet zien dat je dingen graag zelf oplost. Dat is knap, en soms mag je best hulp vragen. Bij wie zou jij aankloppen als iets te groot voelt?",
};

function kleineAct(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function bouwKruisanalyse(exact: KruisInvoer | null | undefined, naam: string): KruisAnalyse {
  const res: KruisAnalyse = { versterkingen: [], verwonderlijk: [], ouder: "" };
  if (!exact) return res;

  const tally = [...(exact.focusTally ?? [])]
    .filter((f) => f.keuzes > 0)
    .sort((a, b) => b.keuzes - a.keuzes);
  const archs = exact.archetypen ?? [];
  const top3 = exact.top3 ?? [];
  const stellingen = exact.stellingen ?? [];
  const archFocus = new Set(archs.map((a) => a.focus));
  const dom = tally[0];

  // A. Versterkingen / bevestigingen
  if (dom && archs.length > 0) {
    const passend = archs.filter((a) => a.focus === dom.focus);
    if (passend.length > 0) {
      const namen = passend.slice(0, 2).map((a) => a.naam).join(" en ");
      res.versterkingen.push(
        `Op Eiland 1 koos je vaak voor ${kleineAct(dom.activiteit)}, en op Eiland 2 koos je figuren als ${namen} die daar prachtig bij passen. Dat versterkt elkaar, een duidelijk signaal van waar jouw energie zit. 💪`,
      );
    }
  }
  const sterkeSterktes = stellingen.filter((s) => s.soort === "Sterkte" && s.gekozenWaarde >= DUIDELIJK);
  if (sterkeSterktes.length > 0 && dom) {
    const woorden = sterkeSterktes.slice(0, 2).map((s) => `“${s.gekozenWoord}”`).join(" en ");
    res.versterkingen.push(
      `Je liet op Eiland 3 ook zien dat ${woorden} vaak bij jou past. Zulke krachten helpen je om met ${kleineAct(dom.activiteit)} nog verder te groeien.`,
    );
  }

  // B. Verwonderlijke dingen die fijn zijn om samen te bespreken
  if (dom && archs.length > 0 && !archFocus.has(dom.focus)) {
    const yArch = archs[0]!;
    res.verwonderlijk.push(
      `Je koos op Eiland 1 vaak voor ${kleineAct(dom.activiteit)}, maar bij de figuren viel je meer op ${yArch.naam}. Dat is niet gek, misschien speelt het ene vooral thuis, en het andere vooral op school? Fijn om er samen eens over te praten: wanneer voelt ${naam} zich het meest zichzelf?`,
    );
  } else if (dom && archs.length > 0 && top3.length > 0) {
    const topArch =
      archs.find((a) => a.topRang === 1) ?? archs.find((a) => top3.some((t) => t.id === a.id));
    if (topArch && topArch.focus !== dom.focus) {
      res.verwonderlijk.push(
        `Je reisde op Eiland 1 het vaakst naar ${kleineAct(dom.activiteit)}, maar bij je top koos je voor ${topArch.naam}. Twee mooie kanten van jou! Wanneer komt elk van beide het sterkst naar boven, thuis, op school of bij vrienden?`,
      );
    }
  }
  // Alleen de driver die het kind echt aangaf, en alleen de zin die bij die
  // driver hoort. De sterkste eerst, zodat er hoogstens een zin bij komt.
  const sterksteDriver = stellingen
    .filter((s) => s.soort === "Driver" && s.gekozenWaarde >= DUIDELIJK && DRIVERZINNEN[s.mapping])
    .sort((a, b) => b.gekozenWaarde - a.gekozenWaarde)[0];
  if (sterksteDriver) {
    res.verwonderlijk.push(DRIVERZINNEN[sterksteDriver.mapping]!);
  }

  // Warme fallbacks als er geen duidelijke divergentie/versterking is.
  if (res.versterkingen.length === 0) {
    res.versterkingen.push(
      `Over de eilanden heen zie je telkens stukjes van dezelfde ${naam} terugkomen. Zoek samen naar wat op elk eiland het meest opviel.`,
    );
  }
  if (res.verwonderlijk.length === 0) {
    res.verwonderlijk.push(
      `De eilanden vertellen een verrassend consistent verhaal, mooi! Bespreek samen wat ${naam} het meest verraste.`,
    );
  }

  // Ouder-verdieping — context-druk iets explicieter, als uitnodiging.
  const ouderStukken: string[] = [];
  if (dom && archs.length > 0 && !archFocus.has(dom.focus)) {
    ouderStukken.push(
      `Er is een lichte spanning tussen de sterke interesse in “${dom.activiteit}” (Eiland 1) en de gekozen figuren (Eiland 2). Dat kan wijzen op een verschil in context, thuis versus school, of tussen wat ${naam} leuk vindt en waar hij/zij zich (nog) toe durft rekenen.`,
    );
  }
  if (sterksteDriver) {
    ouderStukken.push(
      `De antwoorden op Eiland 3 tonen een merkbare driver (${sterksteDriver.mapping}). Zulke drivers zijn krachtig en kunnen extrinsieke druk meebrengen, de moeite waard om er zonder oordeel over door te vragen.`,
    );
  }
  if (ouderStukken.length === 0) {
    ouderStukken.push(
      `De signalen over de drie eilanden liggen mooi in lijn met elkaar. Dat maakt het gesprek met ${naam} eenvoudiger: bevestig wat je ziet en vraag door op wat hem/haar zelf het meest verraste.`,
    );
  }
  res.ouder = ouderStukken.join(" ");
  return res;
}
