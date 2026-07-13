/**
 * server/t4teens/scoring.ts — NIEUW BESTAND (Werkprotocol Regel 2)
 * -----------------------------------------------------------------------------
 * 1-op-1 TypeScript-port van de client-side `scoreVonk`/`selectVonk`/`energyContrib`
 * uit `client/public/t4teens/afname/index.html` (bron-kopie:
 * t4teens-build-ref/scoring-and-vonk.js). Formules, SJT-bijladingen, rank-
 * berekeningen en drempels zijn LETTERLIJK overgenomen — niets zelf verzonnen.
 *
 * VONK_MSG, ACC_MAP, FOC_MAP en RIA_MAP zijn eveneens een exacte kopie.
 *
 * Input  = { answers, energy } met client-item-id's (I1, D1..D6, V1..V6,
 *           F1..F5, R1..R6, B1).
 * Output = identiek object als de client-`scoreVonk` teruggeeft.
 */

export type AnswerValue = number | string;
export type Answers = Record<string, AnswerValue>;
export type Energy = Record<string, number>;

export interface VonkMsg {
  icon: string;
  title: string;
  body: string;
  audio: string;
  script: string;
}
export interface VonkMeta {
  audio: string;
  script: string;
}

export interface VonkScore {
  acc: Record<string, number>;
  accEnergy: Record<string, number>;
  accRank: string[];
  foc: Record<string, number>;
  focEnergy: Record<string, number>;
  focRank: string[];
  ria: Record<string, number>;
  riaRank: string[];
  drv: Record<string, number>;
  drvEnergy: Record<string, number | null>;
  drvRank: string[];
  drvDriverKey: Record<string, string>;
  contextBrake: boolean;
  battery: number | null;
  answered: number;
  answers: Answers;
  energy: Energy;
}

// ---- VONK_MSG (exacte kopie uit de bron) ----
export const VONK_MSG: Record<string, VonkMsg | VonkMeta> = {
  opening: { audio: "vonk-opening.mp3", script: "Hey jij. Ik heb even goed naar je antwoorden gekeken. En weet je wat me opvalt? Een paar heel bijzondere dingen. Luister maar." },
  closing: { audio: "vonk-closing.mp3", script: "Dit is wat er vandaag bij jou uitspringt. Het is een momentopname, dus dit mag nog groeien en veranderen. Maar één ding is nu al duidelijk: jij kan echt iets bijzonders. Knap gedaan." },
  acc_Analyse: { icon: "search", title: "Jij wil eerst snappen hoe iets werkt", body: "Voordat je begint, wil je echt begrijpen hoe iets in elkaar zit. Dat is goud waard. Jij bouwt op een stevige basis, en daar word je sterk van.", audio: "vonk-analyse.mp3", script: "Iets wat opvalt: jij wil eerst snappen hoe iets in elkaar zit voor je begint. Dat is goud waard. Jij bouwt op een stevige basis, en daar word je sterk van." },
  acc_Coaching: { icon: "chat", title: "Jij leert het liefst samen", body: "Praten, uitleggen, samen ontdekken: zo komt het bij jou echt binnen. Mensen om je heen voelen zich gehoord bij jou. Dat is een echt talent.", audio: "vonk-coaching.mp3", script: "Iets wat opvalt: jij leert het liefst samen. Praten, uitleggen, samen ontdekken, zo komt het bij jou echt binnen. Mensen voelen zich gehoord bij jou, en dat is een echt talent." },
  acc_Facilitatie: { icon: "people", title: "Jij krijgt een groep mee", body: "Jij laat een groep op een positieve manier samenwerken, soms zelfs zonder dat het moeite kost. En je voelt aan waar het echt om draait. Daar maak jij verschil.", audio: "vonk-facilitatie.mp3", script: "Iets wat opvalt: jij krijgt een groep mee. Jij laat mensen op een positieve manier samenwerken, soms zonder dat het moeite kost. En je voelt aan waar het echt om draait." },
  acc_Resultaat: { icon: "target", title: "Jij weet waar je naartoe wil", body: "Jij ziet het eindplaatje voor je en werkt er gericht naartoe. Die helderheid is zeldzaam, en ze brengt je verder dan je denkt.", audio: "vonk-resultaat.mp3", script: "Iets wat opvalt: jij weet waar je naartoe wil. Jij ziet het eindplaatje voor je en werkt er gericht naartoe. Die helderheid is zeldzaam, en ze brengt je ver." },
  "acc_Constructief onderscheidend": { icon: "spark", title: "Jij maakt er je eigen versie van", body: "Jij neemt niet zomaar over wat er is, je hertekent het tot iets van jezelf. Die eigen kijk is precies wat jou laat opvallen.", audio: "vonk-onderscheidend.mp3", script: "Iets wat opvalt: jij maakt er graag je eigen versie van. Jij neemt niet zomaar over wat er is, je hertekent het tot iets van jezelf. Die eigen kijk laat jou opvallen." },
  "focus_Bedenken/creatie": { icon: "bulb", title: "Jij zit vol ideeën", body: "Nieuwe dingen bedenken geeft jou energie. Jouw verbeelding is een motor, gebruik hem, want daar zit veel van jou in.", audio: "vonk-bedenken.mp3", script: "Jij zit vol ideeën. Nieuwe dingen bedenken geeft jou energie. Jouw verbeelding is een motor, en daar zit veel van jou in." },
  "focus_Uitzoeken/onderzoek": { icon: "search", title: "Jij wil het tot op de bodem uitzoeken", body: "Vragen stellen, dingen uitpluizen, ontdekken hoe het echt zit: daar krijg jij energie van. Die nieuwsgierigheid brengt je ver.", audio: "vonk-uitzoeken.mp3", script: "Jij wil dingen tot op de bodem uitzoeken. Vragen stellen, uitpluizen, ontdekken hoe het echt zit, daar krijg jij energie van. Die nieuwsgierigheid brengt je ver." },
  "focus_Doen/uitvoeren": { icon: "bolt", title: "Jij komt graag in actie", body: "Niet eindeloos praten, maar gewoon doen: zo zit jij in elkaar. Die daadkracht zorgt dat dingen ook echt af raken.", audio: "vonk-doen.mp3", script: "Jij komt graag in actie. Niet eindeloos praten, maar gewoon doen, zo zit jij in elkaar. Die daadkracht zorgt dat dingen ook echt af raken." },
  "focus_Leren/overdragen": { icon: "book", title: "Jij geeft graag door wat je weet", body: "Iets leren en het dan aan iemand uitleggen: daar word jij blij van. Jij tilt anderen mee omhoog, en dat is een mooi talent.", audio: "vonk-leren.mp3", script: "Jij geeft graag door wat je weet. Iets leren en het dan uitleggen aan iemand, daar word jij blij van. Jij tilt anderen mee omhoog." },
  focus_Samenwerken: { icon: "people", title: "Jij bloeit op in een groep", body: "Samen iets maken geeft jou energie. Jij verbindt mensen en zorgt dat het samen beter loopt. Dat voelt iedereen.", audio: "vonk-samenwerken.mp3", script: "Jij bloeit op in een groep. Samen iets maken geeft jou energie. Jij verbindt mensen en zorgt dat het samen beter loopt." },
  int_Realistisch: { icon: "wrench", title: "Jij houdt van iets concreets in je handen", body: "Bouwen, maken, met je handen bezig zijn: dat trekt jou aan. En dat past mooi bij hoe je in elkaar zit.", audio: "vonk-realistisch.mp3", script: "Jij houdt van iets concreets in je handen. Bouwen, maken, bezig zijn, dat trekt jou aan, en dat past mooi bij hoe je in elkaar zit." },
  int_Investigative: { icon: "search", title: "Jij wil de wereld begrijpen", body: "Onderzoeken, uitzoeken, snappen waarom: dat trekt jou aan. Jouw nieuwsgierigheid en hoe je in elkaar zit, wijzen dezelfde kant op.", audio: "vonk-investigative.mp3", script: "Jij wil de wereld begrijpen. Onderzoeken, uitzoeken, snappen waarom, dat trekt jou aan. Jouw nieuwsgierigheid en hoe je in elkaar zit wijzen dezelfde kant op." },
  int_Artistiek: { icon: "palette", title: "Jij hebt een creatieve antenne", body: "Iets maken dat van jou is, vorm en verbeelding: daar voel jij je thuis. Die creatieve kant maakt jou echt bijzonder.", audio: "vonk-artistiek.mp3", script: "Jij hebt een creatieve antenne. Iets maken dat van jou is, vorm en verbeelding, daar voel jij je thuis. Die creatieve kant maakt jou bijzonder." },
  int_Sociaal: { icon: "people", title: "Jij wil iets voor mensen betekenen", body: "Mensen helpen, begeleiden, er zijn voor anderen: dat trekt jou aan. En het past bij hoe warm je met mensen omgaat.", audio: "vonk-sociaal.mp3", script: "Jij wil iets voor mensen betekenen. Mensen helpen, er zijn voor anderen, dat trekt jou aan. En het past bij hoe warm je met mensen omgaat." },
  int_Ondernemend: { icon: "rocket", title: "Jij durft dingen op gang te trekken", body: "Iets opstarten, anderen meekrijgen, kansen zien: dat trekt jou aan. Die ondernemende vonk heeft niet iedereen.", audio: "vonk-ondernemend.mp3", script: "Jij durft dingen op gang te trekken. Iets opstarten, anderen meekrijgen, kansen zien, dat trekt jou aan. Die ondernemende vonk heeft niet iedereen." },
  int_Conventioneel: { icon: "grid", title: "Jij houdt van overzicht en orde", body: "Dingen netjes en geordend houden, structuur aanbrengen: daar voel jij je goed bij. Daar bouwen anderen graag op verder.", audio: "vonk-conventioneel.mp3", script: "Jij houdt van overzicht en orde. Dingen netjes en geordend houden, daar voel jij je goed bij. En daar bouwen anderen graag op verder." },
  driver_TryHard: { icon: "star", title: "Jij gaat ver voor wie in je gelooft", body: "Als er iemand is die voor jou belangrijk is en die in je gelooft, dan haal jij het beste uit jezelf. Nu werkt dat als een gaspedaal: het duwt je recht naar je talenten.", audio: "vonk-tryhard.mp3", script: "Iets moois: jij gaat ver voor wie in je gelooft. Als er iemand belangrijk voor je is en in je gelooft, haal jij het beste uit jezelf. Nu werkt dat als een gaspedaal, het duwt je recht naar je talenten." },
  driver_BeStrong: { icon: "shield", title: "Jij neemt zelf verantwoordelijkheid", body: "Jij neemt graag zelf het heft in handen, zeker als je gelooft dat je het tot een goed einde brengt. Nu werkt dat als een gaspedaal: het zet jou in beweging richting je talenten.", audio: "vonk-bestrong.mp3", script: "Iets wat opvalt: jij neemt zelf verantwoordelijkheid. Jij pakt graag zelf het heft in handen, zeker als je gelooft dat je het tot een goed einde brengt. Nu werkt dat als een gaspedaal richting je talenten." },
  driver_BePerfect: { icon: "check", title: "Jij wil alles zo juist mogelijk doen", body: "Jij legt de lat hoog en wil dat iets echt klopt voor je het loslaat. Nu krijg je daar de ruimte voor, en dan werkt dat als een gaspedaal richting je talenten.", audio: "vonk-beperfect.mp3", script: "Iets wat opvalt: jij wil alles zo juist mogelijk doen. Jij legt de lat hoog en wil dat iets echt klopt. Nu krijg je daar de ruimte voor, en dan werkt dat als een gaspedaal richting je talenten." },
  driver_PleaseOthers: { icon: "heart", title: "Jij maakt het graag goed voor anderen", body: "Jij voelt je het best tussen mensen die jou waarderen, en jij zorgt dat iedereen mee is. Nu werkt dat als een gaspedaal: je voelt je veilig en zet je talenten volop in.", audio: "vonk-pleaseothers.mp3", script: "Iets wat opvalt: jij maakt het graag goed voor anderen. Jij voelt je het best tussen mensen die jou waarderen, en je zorgt dat iedereen mee is. Nu werkt dat als een gaspedaal voor je talenten." },
  driver_HurryUp: { icon: "bolt", title: "Jij pakt graag veel tegelijk aan", body: "Jij neemt graag veel op tegelijk en wil snel resultaat zien. Nu werkt dat als een gaspedaal: die vaart zet dingen in beweging en brengt je richting je talenten.", audio: "vonk-hurryup.mp3", script: "Iets wat opvalt: jij pakt graag veel tegelijk aan en wil snel resultaat zien. Nu werkt dat als een gaspedaal, die vaart zet dingen in beweging richting je talenten." },
  energy_full: { icon: "battery", title: "Jij bracht een volle batterij mee", body: "Je zit lekker in je energie vandaag. Dat is een mooie kracht om mee te werken, gebruik ze voor wat jou blij maakt.", audio: "vonk-energie.mp3", script: "Iets moois: jij bracht vandaag een volle batterij mee. Je zit lekker in je energie. Dat is een mooie kracht, gebruik ze voor wat jou blij maakt." },
  meaning: { icon: "compass", title: "Jij wil iets betekenen", body: "Naast wat je kan, wil je ook iets betekenen. Die richting in jou is misschien wel het mooiste van allemaal.", audio: "vonk-betekenis.mp3", script: "En misschien wel het mooiste: jij wil niet alleen iets kunnen, je wil ook iets betekenen. Die richting in jou is heel waardevol." },
  growth_thin: { icon: "seedling", title: "Dit is nog maar een eerste glimp", body: "Je gaf vandaag een eerste blik op wie je bent. Er zit vast nog veel meer in jou, en dat ontdek je samen met je begeleider.", audio: "vonk-groei.mp3", script: "Dit is nog maar een eerste glimp. Je gaf vandaag een eerste blik op wie je bent. Er zit vast nog veel meer in jou, en dat ontdek je samen met je begeleider." },
  context_brake: { icon: "compass", title: "Eén ding mag je echt weten", body: "Jouw belangrijkste motor staat vandaag een beetje op de rem. Niet omdat er iets mis is met jou, maar omdat er nu iets in je omgeving niet lekker zit. Praat hier zeker over met je begeleider, samen krijg je die motor weer aan het trekken.", audio: "vonk-context.mp3", script: "En eén ding mag je echt weten. Jouw belangrijkste motor staat vandaag een beetje op de rem. Niet omdat er iets mis is met jou, maar omdat er nu iets in je omgeving niet lekker zit. Praat hier zeker over met je begeleider. Samen krijg je die motor weer aan het trekken. En geloof me, dat lukt." },
};

// item -> construct mapping (vast, uit scoringslogica)
export const ACC_MAP: Record<string, string> = { V1: "Analyse", V2: "Coaching", V3: "Facilitatie", V4: "Facilitatie", V5: "Resultaat", V6: "Constructief onderscheidend" };
export const FOC_MAP: Record<string, string> = { F1: "Bedenken/creatie", F2: "Uitzoeken/onderzoek", F4: "Leren/overdragen" };
export const RIA_MAP: Record<string, string> = { R1: "Realistisch", R2: "Investigative", R3: "Artistiek", R4: "Sociaal", R5: "Ondernemend", R6: "Conventioneel" };

export function energyContrib(e: unknown): number {
  return typeof e === "number" ? e / 2 : 0;
}

export function scoreVonk(answers: Answers, energy: Energy): VonkScore {
  // ---- versnellers (5 categorieen; Impact opgenomen in Facilitatie)
  const acc: Record<string, number> = { Analyse: 0, Coaching: 0, Facilitatie: 0, Resultaat: 0, "Constructief onderscheidend": 0 };
  const accEnergy: Record<string, number> = {};
  for (const id in ACC_MAP) {
    const c = ACC_MAP[id];
    if (id in answers) { acc[c] += (answers[id] as number) + energyContrib(energy[id]); }
    if (id in energy) {
      accEnergy[c] = c in accEnergy ? (accEnergy[c] + energy[id]) / 2 : energy[id];
    }
  }
  // SJT-bijladingen op versnellers
  if (answers.D5 === "b") { acc["Coaching"] += 1; }
  if (answers.F5 === "a") { acc["Coaching"] += 1; acc["Facilitatie"] += 1; }
  const accRank = Object.keys(acc).sort((a, b) => acc[b] - acc[a]);

  // ---- foci
  const foc: Record<string, number> = { "Bedenken/creatie": 0, "Uitzoeken/onderzoek": 0, "Doen/uitvoeren": 0, "Leren/overdragen": 0, Samenwerken: 0 };
  const focEnergy: Record<string, number> = {};
  for (const id in FOC_MAP) {
    const c = FOC_MAP[id];
    if (id in answers) { foc[c] += (answers[id] as number) + energyContrib(energy[id]); }
    if (id in energy) focEnergy[c] = energy[id];
  }
  if (answers.F3 === "a") { foc["Doen/uitvoeren"] += 2 + energyContrib(energy.F3); if ("F3" in energy) focEnergy["Doen/uitvoeren"] = energy.F3; }
  else if (answers.F3 === "b") { foc["Doen/uitvoeren"] -= 1; focEnergy["Doen/uitvoeren"] = -1; }
  if (answers.F5 === "a") { foc["Samenwerken"] += 2; }
  if (answers.D5 === "b") { foc["Samenwerken"] += 1; }
  const focRank = Object.keys(foc).sort((a, b) => foc[b] - foc[a]);

  // ---- interesse
  const ria: Record<string, number> = {};
  for (const id in RIA_MAP) { if (id in answers) ria[RIA_MAP[id]] = answers[id] as number; else ria[RIA_MAP[id]] = 0; }
  const riaRank = Object.keys(ria).sort((a, b) => ria[b] - ria[a]);

  // ---- drivers (sterkte + energie). Energie bepaalt gaspedaal (>0) vs rem (<0).
  const drv: Record<string, number> = { "Be Perfect": 0, "Please Others": 0, "Try Hard": 0, "Hurry Up": 0, "Be Strong": 0 };
  const drvEnergy: Record<string, number | null> = { "Be Perfect": null, "Please Others": null, "Try Hard": null, "Hurry Up": null, "Be Strong": null };
  // sterkte
  if ("D1" in answers) drv["Be Perfect"] += answers.D1 as number;
  if ("D2" in answers) drv["Please Others"] += answers.D2 as number;
  if ("D3" in answers) drv["Try Hard"] += answers.D3 as number;
  if ("D4" in answers) drv["Hurry Up"] += answers.D4 as number;
  if (answers.D5 === "a") drv["Be Strong"] += 2;
  if (answers.D5 === "b") drv["Please Others"] += 2;
  if (answers.D6 === "a") drv["Be Strong"] += 2;
  if (answers.D6 === "b") drv["Hurry Up"] += 2;
  // energie per driver (uit de bijbehorende energie-items, indien aanwezig)
  const setDrvE = (cat: string, e: unknown) => { if (typeof e === "number") { drvEnergy[cat] = drvEnergy[cat] === null ? e : ((drvEnergy[cat] as number) + e) / 2; } };
  setDrvE("Be Perfect", energy.D1);
  setDrvE("Please Others", energy.D2);
  setDrvE("Try Hard", energy.D3);
  setDrvE("Hurry Up", energy.D4);
  if (answers.D5 === "a") setDrvE("Be Strong", energy.D5);
  if (answers.D5 === "b") setDrvE("Please Others", energy.D5);
  if (answers.D6 === "a") setDrvE("Be Strong", energy.D6);
  if (answers.D6 === "b") setDrvE("Hurry Up", energy.D6);
  const drvRank = Object.keys(drv).sort((a, b) => drv[b] - drv[a]);

  // ---- contextsignaal: rem op driver #1 of #2 (energie < 0 bij een dominante driver)
  const drvDriverKey: Record<string, string> = { "Try Hard": "driver_TryHard", "Be Strong": "driver_BeStrong", "Be Perfect": "driver_BePerfect", "Please Others": "driver_PleaseOthers", "Hurry Up": "driver_HurryUp" };
  let contextBrake = false;
  for (let i = 0; i < 2; i++) {
    const d = drvRank[i];
    if (d && drv[d] >= 3 && typeof drvEnergy[d] === "number" && (drvEnergy[d] as number) < 0) { contextBrake = true; }
  }

  // ---- energie-ijkpunt
  const battery = typeof answers.I1 === "number" ? (answers.I1 as number) : null;

  // ---- volledigheid
  const answered = Object.keys(answers).length;

  return {
    acc, accEnergy, accRank, foc, focEnergy, focRank, ria, riaRank,
    drv, drvEnergy, drvRank, drvDriverKey, contextBrake,
    battery, answered, answers, energy,
  };
}

/* selectie: max 5 boodschap-ids op sterkte, met drempels.
   Drivers worden ALLEEN als gaspedaal-kaart getoond (energie >= 0).
   Bij contextBrake komt onderaan een warme contextsignaal-kaart i.p.v. een driver-kaart. */
export function selectVonk(s: VonkScore): string[] {
  const picks: { id: string; prio: number; strength: number }[] = [];
  const used = new Set<string>();
  const push = (id: string, prio: number, strength: number) => { if (!used.has(id)) { picks.push({ id, prio, strength }); used.add(id); } };

  // 1. Topversneller
  const acc1 = s.accRank[0];
  if (s.acc[acc1] >= 2.5) { push("acc_" + acc1, 1, s.acc[acc1]); }

  // 2. Top-focus met energie
  const focMap: Record<string, string> = {
    "Bedenken/creatie": "focus_Bedenken/creatie", "Uitzoeken/onderzoek": "focus_Uitzoeken/onderzoek",
    "Doen/uitvoeren": "focus_Doen/uitvoeren", "Leren/overdragen": "focus_Leren/overdragen", Samenwerken: "focus_Samenwerken",
  };
  const foc1 = s.focRank[0];
  if (s.foc[foc1] >= 2.5) { push(focMap[foc1], 2, s.foc[foc1]); }

  // 3. Sterke interesse (RIASEC #1)
  const ria1 = s.riaRank[0];
  if (s.ria[ria1] >= 2) { push("int_" + ria1, 3, 2 + (s.ria[s.riaRank[1]] === 2 ? 0.3 : 0)); }

  // 4. Driver ALS GASPEDAAL (top-driver, sterkte >= 3, energie >= 0).
  const drv1 = s.drvRank[0];
  if (s.drv[drv1] >= 3) {
    const e1 = s.drvEnergy[drv1];
    if (e1 === null || e1 >= 0) { push(s.drvDriverKey[drv1], 4, s.drv[drv1]); }
  }

  // 5. Volle batterij
  if (s.battery !== null && s.battery >= 7) { push("energy_full", 5, s.battery); }

  // 6. tweede versneller of focus (opvulling)
  const acc2 = s.accRank[1];
  if (s.acc[acc2] >= 2.5) { push("acc_" + acc2, 6, s.acc[acc2]); }
  const ria2 = s.riaRank[1];
  if (s.ria[ria2] >= 2) { push("int_" + ria2, 7, 2); }
  const foc2 = s.focRank[1];
  if (s.foc[foc2] >= 2.0) { push(focMap[foc2], 8, s.foc[foc2]); }

  // 7. betekenisspoor (B1)
  if ("B1" in s.answers) { push("meaning", 9, 1); }

  // Sorteer op prio, dan sterkte
  picks.sort((a, b) => a.prio - b.prio || b.strength - a.strength);
  let chosen = picks.slice(0, 5).map((p) => p.id);

  // Te dun? minstens iets tonen + groei-boodschap
  if (chosen.length < 2) {
    if (!chosen.includes("meaning") && "B1" in s.answers) chosen.push("meaning");
    chosen.push("growth_thin");
  }

  // 'meaning' liefst als voorlaatste; contextsignaal ALTIJD als laatste, warme kaart.
  chosen = chosen.filter((c) => c !== "meaning" && c !== "context_brake");
  const tail: string[] = [];
  if (used.has("meaning")) tail.push("meaning");

  if (s.contextBrake) {
    chosen = chosen.concat(tail);
    if (chosen.length >= 5) chosen = chosen.slice(0, 4);
    chosen.push("context_brake");
    return chosen.slice(0, 5);
  }

  chosen = chosen.concat(tail);
  return chosen.slice(0, 5);
}
