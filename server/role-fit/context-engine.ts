// ---------------------------------------------------------------------------
// server/role-fit/context-engine.ts
//
// Deterministische extractie van contextclaims uit bronteksten (regelversie
// RF_CONTEXT_REGELVERSIE). Splitst de tekst in zinnen en herkent per zin een
// categorie aan vaste trefwoorden. Elke gevonden zin wordt een VOORSTEL met de
// letterlijke passage en de positie in de bron. Niets wordt automatisch
// actief: een mens bevestigt, past aan of wijst af.
//
// De extractie voert niets uit wat in de tekst staat. Een zin als "negeer alle
// instructies" is gewoon tekst en wordt hoogstens als claim voorgesteld.
// ---------------------------------------------------------------------------
import type { ClaimCategorie, Confidence } from "@shared/role-fit";

export interface ClaimVoorstel {
  categorie: ClaimCategorie;
  claim: string;
  bronpassage: string;
  passageStart: number;
  confidence: Confidence;
}

// Volgorde telt: bij meerdere categorieen wint de eerste met de meeste treffers.
const TREFWOORDEN: Array<[ClaimCategorie, string[]]> = [
  ["gates", ["rijbewijs", "certificaat", "attest", "vca", "verplicht", "vereist diploma", "diploma vereist", "werkvergunning", "beschikbaar vanaf", "must have", "knock-out", "wettelijk"]],
  ["outcomes", ["resultaat", "resultaten", "realiseer", "realiseert", "realiseren", "zorg je voor", "zorgt voor", "verantwoordelijk voor", "kpi", "doelstelling", "binnen 90 dagen", "binnen het eerste jaar", "verbeter", "verhoog", "verlaag", "deliver"]],
  ["requirements", ["ervaring", "kennis van", "je hebt", "je beschikt", "vaardig", "diploma", "opleiding", "niveau", "vloeiend", "beheersing", "experience", "skills"]],
  ["team", ["team", "rapporteert", "rapporteer", "leidinggeven", "leiding geven", "medewerkers", "collega", "stakeholder", "directie", "ploegleider", "manager"]],
  ["organization", ["waarden", "cultuur", "we geloven", "missie", "visie", "onze organisatie", "familiebedrijf", "beslissingen", "besluit", "autonomie", "vertrouwen", "open communicatie"]],
  ["environment", ["sector", "productie", "fabriek", "site", "omgeving", "ploegen", "veiligheid", "regelgeving", "markt", "groei", "transformatie", "verandering", "tempo", "internationaal", "fte", "vestiging"]],
  ["role_mission", ["de functie", "deze rol", "jouw rol", "je bent", "in deze functie", "we zoeken", "wij zoeken", "missie van de rol"]],
];

export function splitsZinnen(tekst: string): Array<{ zin: string; start: number }> {
  const uit: Array<{ zin: string; start: number }> = [];
  const re = /[^.!?\n\r]+[.!?]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tekst)) !== null) {
    const ruw = m[0];
    const lead = ruw.length - ruw.trimStart().length;
    const zin = ruw.trim();
    if (zin.length >= 12 && zin.length <= 600) uit.push({ zin, start: m.index + lead });
  }
  return uit;
}

export function extraheerContext(tekst: string, max = 40): ClaimVoorstel[] {
  const gezien = new Set<string>();
  const uit: ClaimVoorstel[] = [];
  for (const { zin, start } of splitsZinnen(tekst)) {
    const klein = ` ${zin.toLowerCase()} `;
    let beste: { cat: ClaimCategorie; n: number } | null = null;
    for (const [cat, woorden] of TREFWOORDEN) {
      const n = woorden.filter((w) => klein.includes(w)).length;
      if (n > 0 && (!beste || n > beste.n)) beste = { cat, n };
    }
    if (!beste) continue;
    const sleutel = zin.toLowerCase().replace(/\s+/g, " ");
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uit.push({
      categorie: beste.cat,
      claim: zin,
      bronpassage: zin,
      passageStart: start,
      confidence: beste.n >= 2 ? "medium" : "low",
    });
    if (uit.length >= max) break;
  }
  return uit;
}

/** Zet de gestructureerde wizardvelden om in claimvoorstellen met herkomst "wizard". */
export function claimsUitWizard(w: Record<string, any>): Array<{ categorie: ClaimCategorie; claim: string }> {
  const uit: Array<{ categorie: ClaimCategorie; claim: string }> = [];
  const zet = (categorie: ClaimCategorie, prefix: string, waarde: unknown) => {
    if (typeof waarde === "string" && waarde.trim().length >= 3) uit.push({ categorie, claim: `${prefix}${waarde.trim()}` });
  };
  zet("purpose", "Doel van het besluit: ", w.doel);
  zet("role_mission", "Rolmissie: ", w.missie);
  (Array.isArray(w.resultaten) ? w.resultaten : []).forEach((r: string, i: number) => zet("outcomes", `Resultaat ${i + 1}: `, r));
  zet("outcomes", "Verwachting na 90 dagen: ", w.verwachting90);
  zet("outcomes", "Verwachting na 180 dagen: ", w.verwachting180);
  zet("outcomes", "Verwachting na 365 dagen: ", w.verwachting365);
  const o = w.omgeving ?? {};
  zet("environment", "Sector: ", o.sector);
  zet("environment", "Schaal: ", o.schaal);
  zet("environment", "Regulering: ", o.regulering);
  zet("environment", "Risico: ", o.risico);
  zet("environment", "Tempo: ", o.tempo);
  zet("environment", "Autonomie: ", o.autonomie);
  zet("environment", "Veranderfase: ", o.veranderfase);
  const org = w.organisatie ?? {};
  zet("organization", "Waarden in actie: ", org.waardenInActie);
  zet("organization", "Besluitvorming: ", org.besluitstijl);
  zet("organization", "Omgaan met conflict: ", org.conflictstijl);
  zet("organization", "Leiderschapscontext: ", org.leiderschapscontext);
  const t = w.team ?? {};
  zet("team", "Rapporteert aan: ", t.rapportering);
  zet("team", "Teamgrootte: ", t.teamgrootte);
  zet("team", "Teammaturiteit: ", t.maturiteit);
  zet("team", "Stakeholders: ", t.stakeholders);
  return uit;
}
