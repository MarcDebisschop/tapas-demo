/**
 * server/t4teens/rapport.ts — NIEUW BESTAND (Werkprotocol Regel 2)
 * -----------------------------------------------------------------------------
 * Vult `rapport-template.html` (byte-kopie van Lana's rapport.html met placeholders)
 * met de per-leerling scores/teksten. `renderT4TeensHtml()` geeft de volledige
 * HTML-string terug.
 *
 * BELANGRIJK — OPEN VRAGEN (zie t4teens-build-notes.md):
 * De 27-pagina layout is met de hand geschreven. scoreVonk levert scores/ranks,
 * maar NIET de exacte tekstkeuze/labels/balkbreedtes van die pagina's. Waar de
 * regel niet eenduidig uit de bron blijkt, gebruiken we een gedocumenteerde,
 * score-afgeleide invulling en markeren we dat als OPEN VRAAG. Niets is geraden
 * dat wél eenduidig afleidbaar was.
 *
 * Gedocumenteerde balk-schaal:
 *  - Batterij-vulling: BATTERIJ_PCT = round(battery/10*100). (Lana 6 -> 60%, exact.)
 *  - Energie-balken: width = 60 + (|energie|/2)*40  => +/-2 -> 100%, +/-1 -> 80%.
 *    (Lana's 96%/94% fijnafstelling is handwerk en niet uit de bron afleidbaar.)
 */

import fs from "node:fs";
import path from "node:path";
import {
  scoreVonk, selectVonk, VONK_MSG,
  type Answers, type Energy, type VonkScore, type VonkMsg,
} from "./scoring";

export interface Deelnemer {
  naam: string;
  leeftijd?: string | number;
  klas?: string;
  code?: string;
}

// ----------------------------------------------------------------------------
// Item-catalogus (kopie uit client DATA.items — bron van vraagteksten/labels).
// ----------------------------------------------------------------------------
interface OptionRec { value?: number; key?: string; label: string; }
interface ItemRec { id: string; text: string; options?: OptionRec[]; energy?: boolean; }

const ITEMS: Record<string, ItemRec> = {
  I1: { id: "I1", text: "Hoe graag ga je de laatste weken naar school?" },
  D1: { id: "D1", text: "Ik wil dat iets echt klopt voordat ik het loslaat — ook al kost dat meer tijd.", options: recog() },
  D2: { id: "D2", text: "Ik vind het fijn als iedereen om me heen het naar zijn zin heeft, soms zet ik mezelf daarvoor opzij.", options: recog() },
  D3: { id: "D3", text: "Er is iemand naar wie ik opkijk — als die in mij gelooft, doe ik alles om te tonen wat ik kan.", options: recog() },
  D4: { id: "D4", text: "Wachten en traag vooruitgaan vind ik lastig — het mag voor mij snel gaan.", options: recog() },
  D5: { id: "D5", text: "De groep loopt vast — wat doe jij het liefst?", options: [{ key: "a", label: "Ik pak het zelf vast en regel het." }, { key: "b", label: "Ik vraag of we het samen kunnen aanpakken." }] },
  D6: { id: "D6", text: "Je hebt iets beloofd, maar er komt iets leukers tussen.", options: [{ key: "a", label: "Ik doe wat ik beloofd had — een belofte is een belofte." }, { key: "b", label: "Ik schat in wat op dat moment het belangrijkst is." }] },
  V1: { id: "V1", text: "Ik wil eerst snappen hoe iets in elkaar zit voor ik begin.", options: recog(), energy: true },
  V2: { id: "V2", text: "Ik leer het best als ik er met iemand over kan praten of het mag uitleggen.", options: recog(), energy: true },
  V3: { id: "V3", text: "Ik help graag dat alles vlot en geordend loopt voor de groep.", options: recog(), energy: true },
  V4: { id: "V4", text: "Ik wil dat wat ik doe echt iets verandert of betekent — dan zet ik door.", options: recog(), energy: true },
  V5: { id: "V5", text: "Ik wil vooral zien wat het oplevert; ik werk graag naar een duidelijk eindresultaat toe.", options: recog(), energy: true },
  V6: { id: "V6", text: "Ik bedenk vaak een eigen, andere manier om iets aan te pakken.", options: recog(), energy: true },
  F1: { id: "F1", text: "Ik vind het leuk om nieuwe dingen te bedenken die er nog niet zijn.", options: recog(), energy: true },
  F2: { id: "F2", text: "Ik krijg er energie van om iets uit te zoeken of een probleem te ontrafelen.", options: recog(), energy: true },
  F3: { id: "F3", text: "Er moet iets concreet gemaakt of uitgevoerd worden — voel jij je daar goed bij?", options: [{ key: "a", label: "Ja, zeker met een duidelijk plan." }, { key: "b", label: "Liever niet, te veel herhaling." }] },
  F4: { id: "F4", text: "Ik vind het fijn om iemand iets te leren of uit te leggen.", options: recog(), energy: true },
  F5: { id: "F5", text: "Iets alleen of samen met anderen doen — wat geeft jou meer energie?", options: [{ key: "a", label: "Samen met anderen." }, { key: "b", label: "Liever alleen." }] },
  R1: { id: "R1", text: "Dingen maken, bouwen, herstellen of met je handen en machines werken.", options: interest() },
  R2: { id: "R2", text: "Uitzoeken hoe iets werkt: onderzoek, computers, meten of berekenen.", options: interest() },
  R3: { id: "R3", text: "Iets creatiefs doen: film, muziek, toneel, schilderen of vormgeven.", options: interest() },
  R4: { id: "R4", text: "Met en voor mensen bezig zijn: helpen, verzorgen, begeleiden.", options: interest() },
  R5: { id: "R5", text: "De leiding nemen, overtuigen, iets organiseren of ondernemen.", options: interest() },
  R6: { id: "R6", text: "Orde en overzicht houden: plannen, administratie, alles op zijn plek.", options: interest() },
  B1: { id: "B1", text: "Waar zou jij iets willen betekenen voor anderen of voor de wereld?", options: [{ key: "mensen", label: "Voor mensen dichtbij me" }, { key: "samenleving", label: "Voor de samenleving" }, { key: "natuur", label: "Voor de natuur en de planeet" }, { key: "maken", label: "Door iets moois of nuttigs te maken" }, { key: "kennis", label: "Door kennis en ontdekking" }] },
};
function recog(): OptionRec[] { return [{ value: 0, label: "Niet ik" }, { value: 1, label: "Soms ik" }, { value: 2, label: "Vaak ik" }, { value: 3, label: "Helemaal ik" }]; }
function interest(): OptionRec[] { return [{ value: 0, label: "Nee, niets voor mij" }, { value: 1, label: "Een beetje" }, { value: 2, label: "Ja, trekt me aan" }]; }

// ----------------------------------------------------------------------------
// Display-maps (labels 1-op-1 uit rapport.html / driver-gids overgenomen).
// ----------------------------------------------------------------------------
const ENERGY_LABEL: Record<string, { label: string; icon: string }> = {
  F1: { label: "Nieuwe dingen bedenken", icon: "&#9889;" },
  F2: { label: "Dingen uitzoeken", icon: "&#128269;" },
  F4: { label: "Iemand iets aanleren", icon: "&#128172;" },
  V1: { label: "Eerst snappen hoe iets zit", icon: "&#128161;" },
  V2: { label: "Samen leren &amp; uitleggen", icon: "&#128172;" },
  V3: { label: "Orde &amp; overzicht brengen", icon: "&#129309;" },
  V4: { label: "Betekenisvol werk", icon: "&#10024;" },
  V5: { label: "Naar een resultaat werken", icon: "&#127919;" },
  V6: { label: "Je eigen versie maken", icon: "&#10024;" },
};

const FOCUS_TAG: Record<string, { label: string; e: string }> = {
  "Bedenken/creatie": { label: "Nieuwe dingen bedenken &amp; maken", e: "&#128161;" },
  "Uitzoeken/onderzoek": { label: "Uitzoeken hoe iets zit", e: "&#128269;" },
  "Doen/uitvoeren": { label: "In actie komen &amp; uitvoeren", e: "&#9889;" },
  "Leren/overdragen": { label: "Iets aan anderen doorgeven", e: "&#128218;" },
  Samenwerken: { label: "Samen met anderen", e: "&#129309;" },
};

const ACC_LABEL: Record<string, string> = {
  Coaching: "Samen leren &amp; uitleggen",
  "Constructief onderscheidend": "Er je eigen versie van maken",
  Facilitatie: "Mee orde &amp; overzicht brengen",
  Analyse: "Eerst snappen hoe iets zit",
  Resultaat: "Naar een duidelijk resultaat werken",
};

const KUNDE_MAP: Record<string, { icon: string; title: string; desc: string }> = {
  Coaching: { icon: "&#128218;", title: "Iemand iets aanleren", desc: "Uitleggen of voordoen, zeker wat je zelf goed snapt." },
  "Constructief onderscheidend": { icon: "&#10024;", title: "Je eigen versie maken", desc: "Iets hertekenen tot iets van jezelf." },
  Facilitatie: { icon: "&#129309;", title: "Een groep meekrijgen", desc: "Zorgen dat het samen vlot en geordend loopt." },
  Analyse: { icon: "&#128161;", title: "Eerst uitpluizen", desc: "Snappen hoe iets in elkaar zit voor je begint." },
  Resultaat: { icon: "&#127919;", title: "Naar een resultaat werken", desc: "Het eindplaatje zien en er gericht naartoe werken." },
};

// driver internal key -> gaspedaal-titel + rem-titel + gidsnaam (uit rapport.html)
const DRIVER_DISP: Record<string, { gas: string; brake: string; name: string; msg: string }> = {
  "Be Perfect": { gas: "Je wil dingen graag goed doen", brake: "Je legt de lat soms te hoog", name: "Dingen zo juist mogelijk willen doen", msg: "driver_BePerfect" },
  "Please Others": { gas: "Je maakt het graag goed voor anderen", brake: "Je wil het voor anderen goed maken", name: "Het goed willen maken voor anderen", msg: "driver_PleaseOthers" },
  "Try Hard": { gas: "Je gaat ver voor wie in je gelooft", brake: "Je zoekt soms te hard naar bevestiging", name: "Willen schitteren voor iemand die je vertrouwt", msg: "driver_TryHard" },
  "Hurry Up": { gas: "Je pakt graag veel tegelijk aan", brake: "Je jaagt jezelf soms te hard op", name: "Veel tegelijk willen en snel resultaat", msg: "driver_HurryUp" },
  "Be Strong": { gas: "Je neemt zelf verantwoordelijkheid", brake: "Je sluit je soms te veel af", name: "Zelf de verantwoordelijkheid willen nemen", msg: "driver_BeStrong" },
};

// Per driver: de controle-vraag die de motor onbewust aan de omgeving stelt,
// + korte duiding wanneer hij voortstuwt (gas) en wanneer hij remt.
// 1-op-1 afgeleid uit de bron-teksten (Lana rapport.html ck-ctrl + driver-gids);
// niets zelf verzonnen buiten de bestaande formuleringen om.
const DRIVER_CONTROL: Record<string, { vraag: string; gas: string; rem: string }> = {
  "Please Others": {
    vraag: "Voelt het hier veilig genoeg, en is er een beetje harmonie om me heen?",
    gas: "Deze motor stuwt je voort in een sfeer waar je je veilig en gewaardeerd voelt.",
    rem: "Deze motor stuwt je voort in een sfeer waar je je veilig en gewaardeerd voelt. Voel je spanning of moet je het iedereen naar de zin maken, dan cijfer je jezelf weg &mdash; en gaat hij remmen.",
  },
  "Be Perfect": {
    vraag: "Is dit een plek waar ik de tijd en ruimte krijg om iets echt goed te doen?",
    gas: "Deze motor stuwt je voort als je mag uitblinken in kwaliteit.",
    rem: "Deze motor stuwt je voort als je mag uitblinken in kwaliteit. Krijg je daar geen ruimte voor &mdash; alles snel-snel, geen tijd om het kloppend te maken &mdash; dan gaat hij remmen.",
  },
  "Try Hard": {
    vraag: "Is er iemand die in mij gelooft en voor wie ik mag tonen wat ik kan?",
    gas: "Deze motor stuwt je voort als iemand die je vertrouwt in je gelooft.",
    rem: "Deze motor stuwt je voort als iemand die je vertrouwt in je gelooft. Mis je die bevestiging, of moet je het alleen doen, dan gaat hij remmen.",
  },
  "Hurry Up": {
    vraag: "Krijg ik hier vaart en mag ik veel tegelijk aanpakken?",
    gas: "Deze motor stuwt je voort als er tempo in zit en je vooruit mag.",
    rem: "Deze motor stuwt je voort als er tempo in zit en je vooruit mag. Moet alles traag of stap voor stap, of jaag je jezelf te hard op, dan gaat hij remmen.",
  },
  "Be Strong": {
    vraag: "Krijg ik hier zelf genoeg grip en verantwoordelijkheid?",
    gas: "Deze motor stuwt je voort als je zelf het heft in handen mag nemen.",
    rem: "Deze motor stuwt je voort als je zelf het heft in handen mag nemen. Voel je dat je geen grip hebt, dan sluit je je af &mdash; en gaat hij remmen.",
  },
};

const RIA_TRACK: Record<string, { cls: string; ic: string; title: string; clusters: string; style: string }> = {
  Artistiek: { cls: "t-creatief", ic: "&#127912;", title: "Iets eigens maken", clusters: "Kunst, vormgeving, media, architectuur, talen &amp; cultuur &mdash; omgevingen waar je iets nieuws of eigens mag maken.", style: "je verzint graag iets nieuws en maakt er je eigen versie van." },
  Sociaal: { cls: "t-sociaal", ic: "&#128172;", title: "Iets betekenen voor mensen", clusters: "Onderwijs, communicatie, begeleiding, zorg &amp; welzijn &mdash; omgevingen waar je anderen iets aanleert of helpt.", style: "je legt graag uit en leert samen met anderen." },
  Investigative: { cls: "t-sociaal", ic: "&#128269;", title: "Uitzoeken hoe iets zit", clusters: "Onderzoek, wetenschap, techniek, ICT &mdash; omgevingen waar je dingen mag uitpluizen.", style: "je wil snappen hoe iets echt werkt." },
  Realistisch: { cls: "t-creatief", ic: "&#128295;", title: "Met je handen iets maken", clusters: "Techniek, bouw, ambacht, natuur &mdash; omgevingen waar je concreet bezig bent.", style: "je bent graag concreet en praktisch bezig." },
  Ondernemend: { cls: "t-sociaal", ic: "&#128640;", title: "Dingen op gang trekken", clusters: "Ondernemen, organisatie, handel, communicatie &mdash; omgevingen waar je initiatief neemt.", style: "je neemt graag initiatief en krijgt anderen mee." },
  Conventioneel: { cls: "t-verbredend", ic: "&#128203;", title: "Orde &amp; overzicht brengen", clusters: "Administratie, planning, logistiek, financiën &mdash; omgevingen met structuur en overzicht.", style: "je houdt van structuur en overzicht." },
};

// ----------------------------------------------------------------------------
function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
function barPct(mag: number): number {
  // gedocumenteerde schaal: 60 + (|e|/2)*40  => 2->100, 1->80
  return Math.round(60 + (Math.abs(mag) / 2) * 40);
}
function recogPhrase(v: number): string {
  return v >= 3 ? "helemaal ik" : v === 2 ? "vaak ik" : v === 1 ? "soms ik" : "niet ik";
}
function energyPhrase(e: number): string {
  if (e >= 2) return "veel energie";
  if (e === 1) return "geeft energie";
  if (e <= -2) return "kost veel energie";
  if (e === -1) return "kost energie";
  return "neutraal";
}
function saidClass(recogVal: number | null, e: number | null): string {
  if (typeof e === "number" && e < 0) return "neg";
  if (typeof e === "number" && e > 0) return "pos";
  if (typeof recogVal === "number" && recogVal >= 2) return "pos";
  return "neu";
}

// Bouw een said-item / ow-row uit een item-id + antwoord.
function labelFor(id: string, answers: Answers): string {
  const it = ITEMS[id];
  if (!it || !it.options) return "";
  const a = answers[id];
  if (typeof a === "number") { const o = it.options.find((x) => x.value === a); return o ? o.label : String(a); }
  const o = it.options.find((x) => x.key === a); return o ? o.label : String(a ?? "");
}

function saidItem(id: string, answers: Answers, energy: Energy): string {
  const it = ITEMS[id];
  if (!it) return "";
  const a = answers[id];
  const e = energy[id];
  let cls: string;
  let atxt: string;
  if (typeof a === "string") {
    cls = "pick";
    atxt = "&ldquo;" + esc(labelFor(id, answers)) + "&rdquo;";
  } else if (it.energy) {
    cls = saidClass(typeof a === "number" ? a : null, typeof e === "number" ? e : null);
    atxt = esc(recogPhrase(a as number)) + (typeof e === "number" ? " &middot; " + esc(energyPhrase(e)) : "");
  } else {
    cls = saidClass(typeof a === "number" ? a : null, null);
    atxt = esc(recogPhrase(a as number));
  }
  return `      <div class="said-item"><div class="said-q">&ldquo;${esc(it.text)}&rdquo;</div><div class="said-a ${cls}">${atxt}</div></div>`;
}

function owRow(id: string, answers: Answers, energy: Energy): string {
  const it = ITEMS[id];
  if (!it) return "";
  const a = answers[id];
  const e = energy[id];
  let cls: string;
  let atxt: string;
  if (typeof a === "string") {
    cls = "pick";
    atxt = it.options && it.options.length === 2 ? esc(labelFor(id, answers)) : "&ldquo;" + esc(labelFor(id, answers)) + "&rdquo;";
    if (id === "B1") { cls = "pick"; atxt = esc(labelFor(id, answers)); }
  } else if (it.energy) {
    cls = saidClass(typeof a === "number" ? a : null, typeof e === "number" ? e : null);
    atxt = esc(recogPhrase(a as number)) + (typeof e === "number" && e !== 0 ? " &middot; " + esc(energyPhrase(e)) : (typeof e === "number" ? " &middot; neutraal" : ""));
  } else {
    cls = saidClass(typeof a === "number" ? a : null, null);
    atxt = esc(recogPhrase(a as number));
  }
  return `        <div class="ow-row"><div class="ow-q">&ldquo;${esc(it.text)}&rdquo;</div><div class="ow-a ${cls}">${atxt}</div></div>`;
}

// ----------------------------------------------------------------------------
// Motor-duiding per leerling op basis van de driver-RANKING (#1 en #2).
// Regels (input Marc):
//  - #1 rem  -> tonen + dubbele duiding: (a) talent-potentieel minder inzetbaar,
//               (b) keuzestress: durft eigen keuze niet, beweegt mee met de
//               (vermoede) keuze van de ouders.
//  - #1 + #2 rem -> sterke alert (beide motoren remmen).
//  - #1 + #2 gaspedaal -> positief: durft voluit gaan, zet potentieel maximaal in.
// Een driver is 'rem' als sterkte>=3 en moeite-energie<0; 'gas' als sterkte>=3 en
// energie>=0 (of niet ingevuld => voordeel van de twijfel); anders 'neutraal'.
type PedalState = "rem" | "gas" | "neutraal";
function pedalState(scores: VonkScore, d: string): PedalState {
  if (!d) return "neutraal";
  const sterk = scores.drv[d] >= 3;
  const e = scores.drvEnergy[d];
  if (!sterk) return "neutraal";
  if (typeof e === "number" && e < 0) return "rem";
  return "gas"; // e>=0 of null (geen moeite-signaal) => voortstuwend
}

interface MotorDuiding {
  MOTOR_SIGNAL: string;
  CK_CONTROL_INTRO: string;
  CK_CONTROL_GRID: string;
  CK_CASE: string;
}

function bouwMotorDuiding(scores: VonkScore, naam: string): MotorDuiding {
  const d1 = scores.drvRank[0];
  const d2 = scores.drvRank[1];
  const s1 = pedalState(scores, d1);
  const s2 = pedalState(scores, d2);
  const nm = esc(naam || "jij");

  const nameOf = (d: string) => DRIVER_DISP[d]?.name || d;
  const ctrlOf = (d: string) => DRIVER_CONTROL[d];

  // ---- ck-ctrl grid: één kaart per top-2 driver, met eigen rem/gas-tag ----
  const gridItem = (d: string, st: PedalState) => {
    const C = ctrlOf(d);
    if (!C) return "";
    const tagCls = st === "rem" ? "rem-tag" : "gas-tag";
    const tagTxt = st === "rem" ? "vandaag op de rem" : "vandaag voortstuwend";
    const desc = st === "rem" ? C.rem : C.gas;
    return `        <div class="ck-ctrl-item">
          <span class="cc-tag ${tagCls}">${tagTxt}</span>
          <h5>${esc(nameOf(d))}</h5>
          <p class="cc-q">&ldquo;${esc(C.vraag)}&rdquo;</p>
          <p class="cc-d">${desc}</p>
        </div>`;
  };
  const CK_CONTROL_GRID = [gridItem(d1, s1), gridItem(d2, s2)].filter(Boolean).join("\n");
  const CK_CONTROL_INTRO =
    "Daarom remt niet iedereen in dezelfde situatie. Het hangt ervan af wat j&oacute;uw motor nodig heeft. Bij jou spelen er vandaag twee &mdash; en elk stelt onbewust een eigen vraag aan je omgeving:";

  // ---- MOTOR_SIGNAL (het zachte signaal onder de pedalen) ----
  let MOTOR_SIGNAL: string;
  if (s1 === "rem" && s2 === "rem") {
    MOTOR_SIGNAL = `    <div class="signal" style="margin-top:24px">
      <div class="star">&#10024;</div>
      <div>
        <h3>Een belangrijk signaal om samen te bekijken</h3>
        <p>Je twee sterkste motoren &mdash; <strong>${esc(nameOf(d1))}</strong> en <strong>${esc(nameOf(d2))}</strong> &mdash; staan vandaag allebei een beetje op de rem. Dat betekent niet dat er iets mis is met j&oacute;u. Het is vaak een teken dat je omgeving je op dit moment net niet geeft wat deze motoren nodig hebben. Juist omdat het je twee sterkste motoren zijn, is dit iets om samen goed te bekijken. De volgende pagina laat zien wat ze precies nodig hebben &mdash; en wat je eraan kan doen.</p>
      </div>
    </div>`;
  } else if (s1 === "rem") {
    MOTOR_SIGNAL = `    <div class="signal" style="margin-top:24px">
      <div class="star">&#10024;</div>
      <div>
        <h3>Een zacht signaal, geen waarschuwing</h3>
        <p>Je sterkste motor &mdash; <strong>${esc(nameOf(d1))}</strong> &mdash; staat vandaag een beetje op de rem. Dat betekent niet dat er iets mis is met j&oacute;u. Het is vaak een teken dat je omgeving je op dit moment net niet geeft wat deze motor nodig heeft. De volgende pagina laat zien wat dat precies is &mdash; en wat je eraan kan doen.</p>
      </div>
    </div>`;
  } else if (s1 === "gas" && s2 === "gas") {
    MOTOR_SIGNAL = `    <div class="signal signal-gas" style="margin-top:24px">
      <div class="star">&#9889;</div>
      <div>
        <h3>Allebei je motoren staan op groen</h3>
        <p>Je twee sterkste motoren &mdash; <strong>${esc(nameOf(d1))}</strong> en <strong>${esc(nameOf(d2))}</strong> &mdash; werken vandaag allebei als een gaspedaal. Ze stuwen je voort in plaats van je af te remmen. Dat is mooi nieuws: je durft voluit gaan voor je eigen keuze en kan je talenten maximaal inzetten. De volgende pagina laat zien wat elke motor nodig heeft om dat zo te houden.</p>
      </div>
    </div>`;
  } else {
    MOTOR_SIGNAL = `    <div class="signal signal-gas" style="margin-top:24px">
      <div class="star">&#9889;</div>
      <div>
        <h3>Je motor stuwt je vandaag voort</h3>
        <p>Je sterkste motor &mdash; <strong>${esc(nameOf(d1))}</strong> &mdash; werkt vandaag als een gaspedaal. Hij helpt je vooruit in plaats van je af te remmen, z&oacute;dat je je talenten volop kan inzetten. De volgende pagina laat zien wat je motor nodig heeft om dat zo te houden.</p>
      </div>
    </div>`;
  }

  // ---- CK_CASE ("Wat dit voor jou betekent, NAAM") ----
  let CK_CASE: string;
  if (s1 === "rem" && s2 === "rem") {
    CK_CASE = `    <div class="ck-case">
      <h3>Wat dit voor jou betekent, ${nm}</h3>
      <p>Jouw twee sterkste motoren &mdash; <strong>${esc(nameOf(d1))}</strong> en <strong>${esc(nameOf(d2))}</strong> &mdash; staan vandaag allebei een beetje op de rem. Dat is geen fout en niets om je zorgen over te maken. Maar juist omdat het je twee sterkste motoren zijn, is dit een belangrijk signaal om te kennen.</p>
      <p>Als je sterkste motoren remmen, kan je <em>je eigen talent-potentieel vandaag minder inzetten</em> dan wat er echt in je zit. En er speelt nog iets: er kan <em>keuzestress</em> ontstaan. Dan durf je niet echt te kiezen voor de keuze die jij voor jezelf zou maken, maar beweeg je mee met de keuze waarvan je denkt dat je ouders (of anderen die je graag ziet) ze willen. Dat is precies waar deze twee motoren je vandaag kwetsbaar maken.</p>
      <div class="ck-q">
        <div class="qi">&#128173;</div>
        <p>&ldquo;Is deze keuze echt van m&iacute;j &mdash; of kies ik vooral wat ik denk dat mijn ouders willen?&rdquo;</p>
      </div>
    </div>`;
  } else if (s1 === "rem") {
    CK_CASE = `    <div class="ck-case">
      <h3>Wat dit voor jou betekent, ${nm}</h3>
      <p>Jouw sterkste motor is vandaag <strong>${esc(nameOf(d1))}</strong> &mdash; en die staat nu een beetje op de rem. Dat is geen fout en niets om je zorgen over te maken. Maar het is wel iets om te kennen.</p>
      <p>Als je sterkste motor remt, kan je <em>je eigen talent-potentieel vandaag minder inzetten</em> dan wat er echt in je zit. En er speelt mogelijk nog iets: <em>keuzestress</em>. Dan durf je niet echt te kiezen voor de keuze die jij voor jezelf zou maken, maar beweeg je mee met de keuze waarvan je denkt dat je ouders (of anderen die je graag ziet) ze willen. Dat is precies waar deze motor je vandaag kwetsbaar maakt.</p>
      <div class="ck-q">
        <div class="qi">&#128173;</div>
        <p>&ldquo;Is deze keuze echt van m&iacute;j &mdash; of kies ik vooral wat ik denk dat mijn ouders willen?&rdquo;</p>
      </div>
    </div>`;
  } else if (s1 === "gas" && s2 === "gas") {
    CK_CASE = `    <div class="ck-case">
      <h3>Wat dit voor jou betekent, ${nm}</h3>
      <p>Jouw twee sterkste motoren &mdash; <strong>${esc(nameOf(d1))}</strong> en <strong>${esc(nameOf(d2))}</strong> &mdash; werken vandaag allebei als een gaspedaal. Ze stuwen je voort in plaats van je af te remmen.</p>
      <p>Dat is mooi nieuws. Het betekent dat je <em>voluit durft gaan voor je eigen keuze</em> en dat je je talent-potentieel vandaag maximaal kan inzetten. Je hoeft je keuze niet te laten afhangen van wat anderen van je verwachten &mdash; je motor helpt je om te kiezen vanuit wat &eacute;cht bij jou past.</p>
      <div class="ck-q">
        <div class="qi">&#128173;</div>
        <p>&ldquo;Wat wil &iacute;k echt &mdash; en hoe zet ik deze energie zo goed mogelijk in?&rdquo;</p>
      </div>
    </div>`;
  } else {
    CK_CASE = `    <div class="ck-case">
      <h3>Wat dit voor jou betekent, ${nm}</h3>
      <p>Jouw sterkste motor is vandaag <strong>${esc(nameOf(d1))}</strong> &mdash; en die werkt nu als een gaspedaal. Hij helpt je vooruit in plaats van je af te remmen.</p>
      <p>Dat is mooi: je kan je talent-potentieel vandaag goed inzetten en je durft vanuit jezelf kiezen. Blijf wel voelen wat &iacute;j echt wil &mdash; zodat je keuze van jou blijft en niet stilletjes die van iemand anders wordt.</p>
      <div class="ck-q">
        <div class="qi">&#128173;</div>
        <p>&ldquo;Kies ik dit echt vanuit mezelf &mdash; en zet ik deze energie in voor wat bij mij past?&rdquo;</p>
      </div>
    </div>`;
  }

  return { MOTOR_SIGNAL, CK_CONTROL_INTRO, CK_CONTROL_GRID, CK_CASE };
}

// ----------------------------------------------------------------------------
export interface T4TeensTemplateData extends Record<string, string> {}

export function bouwT4TeensRapport(scores: VonkScore, deelnemer: Deelnemer): T4TeensTemplateData {
  const answers = scores.answers;
  const energy = scores.energy;

  const battery = scores.battery ?? 0;
  const battPct = Math.round((battery / 10) * 100);

  // ---- energie geeft / kost ----
  const energyItems = Object.keys(ENERGY_LABEL)
    .filter((id) => typeof energy[id] === "number" && energy[id] !== 0)
    .map((id) => ({ id, e: energy[id] }));
  const give = energyItems.filter((x) => x.e > 0).sort((a, b) => b.e - a.e).slice(0, 4);
  const cost = energyItems.filter((x) => x.e < 0).sort((a, b) => a.e - b.e).slice(0, 3);

  const ENERGY_GIVE = give.map((x) => {
    const L = ENERGY_LABEL[x.id];
    return `          <div class="energy-item give"><div class="energy-ic">${L.icon}</div><div class="energy-label">${L.label}</div><div class="energy-tag">${esc(energyPhrase(x.e))}</div><div class="energy-bar-wrap"><div class="energy-bar" style="width:${barPct(x.e)}%"></div></div></div>`;
  }).join("\n") || `          <div class="energy-item give"><div class="energy-ic">&#9889;</div><div class="energy-label">Nog niet duidelijk vandaag</div><div class="energy-tag">neutraal</div><div class="energy-bar-wrap"><div class="energy-bar" style="width:60%"></div></div></div>`;

  const ENERGY_COST = cost.map((x) => {
    const L = ENERGY_LABEL[x.id];
    return `          <div class="energy-item cost"><div class="energy-ic">${L.icon}</div><div class="energy-label">${L.label}</div><div class="energy-tag">${esc(energyPhrase(x.e))}</div><div class="energy-bar-wrap"><div class="energy-bar" style="width:${barPct(x.e)}%"></div></div></div>`;
  }).join("\n") || `          <div class="energy-item cost"><div class="energy-ic">&#128259;</div><div class="energy-label">Vandaag niets dat je echt leegtrekt</div><div class="energy-tag">kost weinig</div><div class="energy-bar-wrap"><div class="energy-bar" style="width:60%"></div></div></div>`;

  // ---- focus tags (top-2 focRank) ----
  const topFoci = scores.focRank.slice(0, 2);
  const FOCUS_TAGS = topFoci.map((f) => {
    const T = FOCUS_TAG[f];
    return `      <span class="bigtag shared"><span class="e">${T.e}</span>${T.label}</span>`;
  }).join("\n");

  // ---- kunde grid (top-4 accRank) ----
  const KUNDE_ITEMS = scores.accRank.slice(0, 4).map((c) => {
    const K = KUNDE_MAP[c];
    return `        <div class="kunde-item"><span class="ki">${K.icon}</span><div><div class="kt">${K.title}</div><div class="kd">${K.desc}</div></div></div>`;
  }).join("\n");

  // ---- motor pedals (per RANKING: top-2 drivers, elk als gas of rem) ----
  // Coherent met de motor-duiding: een top-driver in rem-toestand toont een
  // rem-kaart, een top-driver in gas/neutrale toestand een gaspedaal-kaart.
  const pedalCard = (d: string, st: PedalState): string => {
    const DISP = DRIVER_DISP[d];
    if (!DISP) return "";
    if (st === "rem") {
      return `        <div class="pedal brake">
          <span class="badge">soms een rem</span>
          <div>
            <h3>${DISP.brake}</h3>
            <p class="sub">mooi &mdash; maar het kan je vandaag energie kosten</p>
            <p style="margin-top:8px;font-size:.95rem;color:var(--ink-soft)">Deze motor is vandaag sterk aanwezig, maar kost je nu eerder energie dan dat hij je vooruit duwt. Op de volgende pagina lees je wat hij nodig heeft om weer voort te stuwen.</p>
          </div>
        </div>`;
    }
    const msg = VONK_MSG[DISP.msg] as VonkMsg;
    return `        <div class="pedal gas">
          <span class="badge">gaspedaal</span>
          <div>
            <h3>${DISP.gas}</h3>
            <p class="sub">geeft je richting &middot; helpt je vooruit</p>
            <p style="margin-top:8px;font-size:.95rem;color:var(--ink-soft)">${esc(msg.body)}</p>
          </div>
        </div>`;
  };
  const pd1 = scores.drvRank[0];
  const pd2 = scores.drvRank[1];
  const ps1 = pedalState(scores, pd1);
  const ps2 = pedalState(scores, pd2);
  // Toon steeds de #1-motor; toon #2 erbij wanneer die sterk genoeg is (>=3),
  // zodat de dubbele-rem- en dubbele-gaspedaal-situatie zichtbaar wordt.
  const pedalCards = [pedalCard(pd1, ps1)];
  if (pd2 && scores.drv[pd2] >= 3) pedalCards.push(pedalCard(pd2, ps2));
  const motorPedals = pedalCards.filter(Boolean).join("\n");

  // ---- versneller-rangorde (top-3 accRank) ----
  const top3 = scores.accRank.slice(0, 3);
  const VERSNELLER_RANK = top3.map((c, i) => {
    const label = ACC_LABEL[c] || esc(c);
    if (i === 0) {
      return `      <div class="rank-item top">
        <div class="rank-pos">1</div>
        <div class="rank-body">
          <div class="t">${label}</div>
          <div class="d">Dit springt vandaag duidelijk vooraan uit.</div>
        </div>
        <span class="chip bal">geeft energie</span>
      </div>`;
    }
    const chip = i === 1 ? '<span class="chip tied">ongeveer gelijk</span>' : '<span class="chip lat">latent</span>';
    const d = i === 1 ? "Ongeveer even sterk als #3 &mdash; samen een middengroep." : "Nog wat op de achtergrond vandaag.";
    return `      <div class="rank-item">
        <div class="rank-pos">${i + 1}</div>
        <div class="rank-body">
          <div class="t">${label}</div>
          <div class="d">${d}</div>
        </div>
        ${chip}
      </div>`;
  }).join("\n");

  // ---- tracks (RIASEC studieverkenning) ----
  const topRia = scores.riaRank.slice(0, 2);
  const midRia = scores.riaRank[2];
  const trackBlocks = topRia.map((r) => {
    const T = RIA_TRACK[r];
    return `      <div class="track ${T.cls}">
        <div class="track-head">
          <div class="track-ic">${T.ic}</div>
          <div>
            <h3>${T.title}</h3>
            <span class="conf bevestigd">springt duidelijk uit</span>
          </div>
        </div>
        <div class="clusters">${T.clusters}</div>
        <div class="meta-row">
          <div class="mr"><span class="ic">&#128161;</span><span><strong>Jouw stijl hierin:</strong> ${T.style}</span></div>
          <div class="mr"><span class="energy-pill geeft">&#9889; geeft je waarschijnlijk energie</span></div>
          <div class="mr"><span class="ic">&#129517;</span><span>Ontdek dit eens: kijk rond op Onderwijskiezer of praat met iemand die in zo&rsquo;n richting zit.</span></div>
        </div>
      </div>`;
  });
  let TRACKS = trackBlocks.join("\n");
  if (midRia) {
    const M = RIA_TRACK[midRia];
    TRACKS += `
      <div class="track t-verbredend" style="grid-column:1 / -1">
        <div class="track-head">
          <div class="track-ic">&#127757;</div>
          <div>
            <h3>Misschien ook interessant</h3>
            <span class="conf verbredend">verbredend &mdash; nooit afgesloten</span>
          </div>
        </div>
        <div class="clusters">Richtingen rond <strong>${M.title.toLowerCase()}</strong> zijn vandaag minder uitgesproken, maar zeker het bekijken waard. Een richting die nu niet oplicht, kan later wél bij je passen. Niets staat hier dicht.</div>
      </div>`;
  }

  // ---- said-blokken ----
  const SAID_ENERGIE = [give[0]?.id, give[1]?.id, cost[0]?.id].filter(Boolean).map((id) => saidItem(id as string, answers, energy)).join("\n");
  const SAID_FOCI = ["F1", "F4", "F2", "F5"].filter((id) => id in answers).map((id) => saidItem(id, answers, energy)).join("\n");
  const SAID_MOTOR = ["D1", "D2", "D5", "D6"].filter((id) => id in answers).map((id) => saidItem(id, answers, energy)).join("\n");
  const SAID_INTERESSE = scores.riaRank.slice(0, 3).map((r) => Object.keys({ R1: 0, R2: 0, R3: 0, R4: 0, R5: 0, R6: 0 }).find((id) => riaKeyOf(id) === r)).filter(Boolean).map((id) => saidItem(id as string, answers, energy)).join("\n");
  const SAID_STRATEGIE = ["V2", "V6", "V3"].filter((id) => id in answers).map((id) => saidItem(id, answers, energy)).join("\n");

  // ---- in jouw eigen woorden ----
  const OW_ENERGIE = `        <div class="ow-row"><div class="ow-q">&ldquo;Hoe graag ga je de laatste weken naar school?&rdquo;</div><div class="ow-a batt">${battery} / 10</div></div>`;
  const OW_FOCI = ["F1", "F4", "F2", "F3", "F5"].filter((id) => id in answers).map((id) => owRow(id, answers, energy)).join("\n");
  const OW_MOTOR = ["D1", "D2", "D3", "D4", "D5", "D6"].filter((id) => id in answers).map((id) => owRow(id, answers, energy)).join("\n");
  const OW_STRATEGIE = ["V2", "V6", "V3", "V1", "V4", "V5"].filter((id) => id in answers).map((id) => owRow(id, answers, energy)).join("\n");
  const OW_INTERESSE = ["R3", "R4", "R1", "R2", "R5", "R6"].filter((id) => id in answers).map((id) => owRow(id, answers, energy)).join("\n");
  const OW_BETEKENIS = ["B1"].filter((id) => id in answers).map((id) => owRow(id, answers, energy)).join("\n");

  // ---- schoolmotivatie-hefboom ----------------------------------------
  // De startvraag peilt hoe graag de leerling de laatste weken naar school
  // gaat (0-10). De energiegevers (wat doe je gráág) zijn de hefbomen: bij
  // een lage schoolmotivatie tonen we ze als concrete aanknopingspunten om
  // meer goesting te vinden; bij een hoge motivatie als wat die goesting
  // voedt en dus vast te houden is.
  const MOTIVATIE_HEFBOOM = bouwHefboom(battery, give);

  // ---- motor-duiding per ranking (rem/gaspedaal + keuzestress/ouders) ----
  const motor = bouwMotorDuiding(scores, deelnemer.naam);

  return {
    NAAM: esc(deelnemer.naam || "jij"),
    LEEFTIJD: esc(deelnemer.leeftijd != null ? (typeof deelnemer.leeftijd === "number" ? deelnemer.leeftijd + " jaar" : deelnemer.leeftijd) : ""),
    KLAS: esc(deelnemer.klas || ""),
    CODE: esc(deelnemer.code || ""),
    AANTAL_VRAGEN: String(scores.answered || 25),
    BATTERIJ: String(battery),
    BATTERIJ_PCT: String(battPct),
    ENERGY_GIVE, ENERGY_COST, FOCUS_TAGS, KUNDE_ITEMS,
    MOTOR_PEDALS: motorPedals, VERSNELLER_RANK, TRACKS,
    MOTOR_SIGNAL: motor.MOTOR_SIGNAL,
    CK_CONTROL_INTRO: motor.CK_CONTROL_INTRO,
    CK_CONTROL_GRID: motor.CK_CONTROL_GRID,
    CK_CASE: motor.CK_CASE,
    SAID_ENERGIE, SAID_FOCI, SAID_MOTOR, SAID_INTERESSE, SAID_STRATEGIE,
    OW_ENERGIE, OW_FOCI, OW_MOTOR, OW_STRATEGIE, OW_INTERESSE, OW_BETEKENIS,
    MOTIVATIE_HEFBOOM,
  };
}

// ----------------------------------------------------------------------------
// Schoolmotivatie-hefboom: koppelt de startscore (0-10, hoe graag naar school)
// aan de energiegevers (wat de leerling gráág doet). Laag => hefboom om meer
// goesting te vinden; hoog => bevestiging van wat die goesting voedt.
// ----------------------------------------------------------------------------
function bouwHefboom(battery: number, give: { id: string; e: number }[]): string {
  const labels = give.slice(0, 3).map((x) => ENERGY_LABEL[x.id]?.label).filter(Boolean) as string[];
  const chips = labels.length
    ? labels.map((l) => `<span class="hefboom-chip">${l}</span>`).join("")
    : `<span class="hefboom-chip">wat jij gr&aacute;&aacute;g doet</span>`;
  const opsom = labels.length
    ? (labels.length === 1 ? labels[0] : labels.slice(0, -1).join(", ") + " en " + labels[labels.length - 1])
    : "de dingen die jij graag doet";

  let toon: "laag" | "midden" | "hoog";
  if (battery <= 4) toon = "laag";
  else if (battery <= 6) toon = "midden";
  else toon = "hoog";

  let kicker: string, kop: string, tekst: string;
  if (toon === "laag") {
    kicker = "jouw hefboom";
    kop = "School voelt nu even zwaar &mdash; maar h&eacute;r, d&iacute;t doe je wel graag";
    tekst = `Je gaf aan dat je de laatste weken niet zo graag naar school gaat. Dat mag er zijn. En toch valt er iets moois op: <strong>${opsom}</strong> doe jij wel gr&aacute;&aacute;g. Precies daar zit je hefboom. De vraag is niet &ldquo;hoe hou ik vol&rdquo;, maar &ldquo;hoe krijg ik <em>meer</em> van wat ik graag doe in mijn schooldag?&rdquo; Bekijk samen met je begeleider hoe je hier vaker op kan inzetten &mdash; dat is vaak net wat je liever naar school doet gaan.`;
  } else if (toon === "midden") {
    kicker = "jouw hefboom";
    kop = "Je goesting voor school wisselt &mdash; dit kan ze omhoog trekken";
    tekst = `Je gaat de laatste weken soms wel, soms minder graag naar school. Goed nieuws: je hebt een duidelijke hefboom. <strong>${opsom}</strong> geeft jou energie. Hoe meer daarvan in je schooldag zit, hoe groter de kans dat je goesting stijgt. Zoek samen met je begeleider waar je hier meer op kan inzetten.`;
  } else {
    kicker = "hou dit vast";
    kop = "Je gaat graag naar school &mdash; d&iacute;t voedt die goesting";
    tekst = `Mooi: de laatste weken ga je graag naar school. Dat komt niet vanzelf. Wat die goesting voedt, zijn de dingen die jou energie geven: <strong>${opsom}</strong>. Blijf daarop inzetten &mdash; het is precies wat je liever naar school laat gaan. Zo hou je die motor draaiende.`;
  }

  return `      <div class="hefboom-card ${toon}">
        <span class="hefboom-kicker">&#9889; ${kicker}</span>
        <h3>${kop}</h3>
        <p>${tekst}</p>
        <div class="hefboom-chips">${chips}</div>
      </div>`;
}

function riaKeyOf(id: string): string {
  const m: Record<string, string> = { R1: "Realistisch", R2: "Investigative", R3: "Artistiek", R4: "Sociaal", R5: "Ondernemend", R6: "Conventioneel" };
  return m[id];
}

let cachedTemplate: string | null = null;
function loadTemplate(): string {
  if (cachedTemplate) return cachedTemplate;
  const kandidaten = [
    path.join(process.cwd(), "client/public/t4teens/afname/rapport-template.html"),
    path.join(process.cwd(), "dist/public/t4teens/afname/rapport-template.html"),
    path.join(process.cwd(), "public/t4teens/afname/rapport-template.html"),
    path.join(__dirname, "../../client/public/t4teens/afname/rapport-template.html"),
  ];
  for (const p of kandidaten) {
    try { if (fs.existsSync(p)) { cachedTemplate = fs.readFileSync(p, "utf8"); return cachedTemplate; } } catch { /* ignore */ }
  }
  throw new Error("rapport-template.html niet gevonden");
}

export function renderT4TeensHtml(answers: Answers, energy: Energy, deelnemer: Deelnemer): string {
  const scores = scoreVonk(answers, energy);
  const data = bouwT4TeensRapport(scores, deelnemer);
  let html = loadTemplate();
  for (const key of Object.keys(data)) {
    html = html.split("{{" + key + "}}").join(data[key]);
  }
  // resterende placeholders leegmaken (defensief)
  html = html.replace(/\{\{[A-Z_]+\}\}/g, "");
  return html;
}

// Handig voor de "eerste uitlezing"-kaarten indien later nodig.
export function selecteerVonkKaarten(answers: Answers, energy: Energy): string[] {
  return selectVonk(scoreVonk(answers, energy));
}
