// ---------------------------------------------------------------------------
// server/t4p/kompas.ts — koppelstuk tussen de rapportregistry en de gemeten
// Kompas-layout.
//
// Waarom dit bestand bestaat: de registry verwacht per instrument één
// {bouw, render}-paar. `bouwKompasContract()` heeft naast het generatorcontract
// ook de respondentgegevens nodig; die zitten in het contract zelf
// (`contract.participant`). Dit bestand doet die extractie, zodat de registry
// de gewone signatuur kan blijven gebruiken.
//
// De layout zelf staat in kompas-layout.ts (1:1 port van de gemeten
// WeasyPrint-renderer) en wordt hier met engine "chromium" aangeroepen, omdat
// het platform met Playwright/Chromium rendert.
// ---------------------------------------------------------------------------

import { bouwKompasContract, type KompasDeelnemer } from "./kompas-contract";
import { renderKompasHtml } from "./kompas-layout";

/** Nederlandse datumnotatie ("5 juni 2026"), zoals de Kompas-layout verwacht. */
const MAANDEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

function nederlandseDatum(waarde?: string | Date | null): string {
  const d = waarde ? new Date(waarde) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Bestandsnaamconventie: "T4P Business Kompas - <naam> - DDMMJJJJ (confidential).pdf" */
export function kompasBestandsnaam(naam: string, rapportdatum?: string | Date | null): string {
  const d = rapportdatum ? new Date(rapportdatum) : new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const jjjj = String(d.getFullYear());
  return `T4P Business Kompas - ${naam} - ${dd}${mm}${jjjj} (confidential).pdf`;
}

function deelnemerUitContract(contract: any): KompasDeelnemer {
  const p = contract?.participant ?? {};
  return {
    naam: p.name ?? contract?.respondent?.naam ?? "",
    code: p.respondentCode ?? p.code ?? "",
    organisatie: p.company ?? p.organisation ?? "",
    functie: p.role ?? p.function ?? "",
    rapportdatum: nederlandseDatum(contract?.generatedAt ?? contract?.completedAt ?? null),
  };
}

/**
 * Bouwt het rendercontract voor het T4P Business Kompas in de gemeten
 * Kompas-structuur (24 hoofdstukken, rijke onderdelen).
 */
export function bouwT4pBusinessKompas(contract: any, _variant?: "kompas" | "coachatlas"): any {
  return bouwKompasContract(contract, deelnemerUitContract(contract));
}

/** Rendert dat contract naar de A4-printHTML met ingebedde fonts en iconen. */
export function renderT4pBusinessKompasHtml(inhoud: any): string {
  return renderKompasHtml(inhoud, { engine: "chromium" });
}
