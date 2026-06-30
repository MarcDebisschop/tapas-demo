// server/t4sports/chat.ts
// Chat profiel builder voor T4Sports — Mental Talent Profiel.
// Bouwt een gestructureerd tekst-profiel voor gebruik in de AI chat-sidecar.

import { sportNaam } from "./scoring";

interface ConstructRow {
  construct: string;
  family: string;
  net: number;
  avgEnergy: number;
}

function parseContract(raw: unknown): any | null {
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;
  return obj?.contract ?? obj;
}

export function bouwT4SportsChatProfiel(
  contractRaw: unknown,
  taal: string = "nl",
  naam?: string
): string {
  const contract = parseContract(contractRaw);
  if (!contract) return "Geen T4Sports profiel beschikbaar.";

  const n = naam ?? contract.name ?? "de atleet";
  const sporttak = contract.sporttak ?? "onbekende sport";
  const ploeg = contract.ploeg ?? null;
  const rol = contract.rol ?? null;

  const sections = contract.sections ?? {};
  const main = sections.main ?? {};
  const meta = sections.meta ?? {};
  const conn = sections.connection ?? {};

  const rows: ConstructRow[] = Array.isArray(main.constructRows) ? main.constructRows : [];
  const sportprofiel = meta.sportprofiel ?? {};
  const consistency = meta.consistency ?? {};

  const topFoci = rows.filter((r) => r.family === "Talent-foci").sort((a, b) => b.net - a.net).slice(0, 3);
  const topVersnellers = rows.filter((r) => r.family === "Talent-versnellers").sort((a, b) => b.net - a.net).slice(0, 2);
  const topDriver = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net)[0];

  const normEnergy = meta.normalizedQuestionnaireEnergy ?? "n/b";
  const baseline = meta.baselineAthleetEnergy ?? "n/b";
  const drukProfiel = sportprofiel.drukProfiel ?? "wisselvallig";
  const consScore = consistency.score ?? "n/b";

  const connAnswers = conn.answers ?? {};
  const sportpassie = conn.sportpassie ?? connAnswers.q1 ?? "n/b";
  const billijkheid = conn.billijkheid ?? connAnswers.q2 ?? "n/b";
  const mentaleZelfinv = conn.mentaleZelfinvestering ?? connAnswers.q3 ?? "n/b";
  const clubInv = conn.clubInvestering ?? connAnswers.q4 ?? "n/b";

  const fociLijst = topFoci.map((r) => `${sportNaam(r.construct)} (${r.construct}, energie: ${r.avgEnergy.toFixed(1)})`).join(", ");
  const versnellersLijst = topVersnellers.map((r) => `${sportNaam(r.construct)} (${r.construct})`).join(", ");
  const driverNaam = topDriver?.construct ?? "—";

  return `Je bent een mental coaching assistent voor atleten. Je gebruikt het T4Sports Mental Talent Profiel van ${n} als basis voor het gesprek.

## Atleetprofiel: ${n}
- Sport: ${sporttak}${ploeg ? ` — ${ploeg}` : ""}${rol ? ` (${rol})` : ""}

## Mental talent profiel (T4Sports v1.0.0)

**Talent-foci (top 3 — De Motor):**
${fociLijst || "—"}

**Talent-versnellers (top 2 — De Versnellingsbak):**
${versnellersLijst || "—"}

**Dominant Driver (De Stuurkracht):**
${driverNaam}

**Drukprofiel:**
${drukProfiel === "gaspedaal" ? "GASPEDAAL — presteert beter onder druk" : drukProfiel === "rem" ? "REM — dreigt te blokkeren onder druk" : "WISSELVALLIG — afhankelijk van de situatie"}

**Energieprofiel:**
- Mentale energie (vragenlijst): ${normEnergy}/10
- Baseline energie (zelf-ingeschat): ${baseline}/10
- Consistentiescore: ${consScore}/100

**Sportverbondenheid:**
- Sportpassie: ${sportpassie}/10
- Billijkheid (behandeling door trainer/club): ${billijkheid}/10
- Mentale zelfinvestering: ${mentaleZelfinv}/10
- Club-investering in atleet als persoon: ${clubInv}/10

## Instructies voor de coach-assistent
- Spreek de atleet aan in de tweede persoon ("jij"/"je") tenzij gevraagd anders.
- Gebruik de sport-hertaling van constructen: zeg "De Strateeg" i.p.v. "Complexiteit/Conceptueel".
- Maak GEEN diagnose, selectie-advies of psychologische beoordeling.
- Verwijs naar de sport-context (${sporttak}) wanneer relevant.
- Wees warm, nieuwsgierig en coachend — geen oordeel, geen preek.
- Als vragen buiten het profiel gaan: "Dat is iets om met je mental coach persoonlijk te bespreken."
- De term "Driver" is een vakterm (naar Taibi Kahler) en wordt niet vertaald.`;
}
