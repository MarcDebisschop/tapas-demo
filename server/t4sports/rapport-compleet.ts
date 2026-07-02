// server/t4sports/rapport-compleet.ts
// Gecombineerd HTML rapport: T4Sports basisrapport + Module-secties (M1/M2/M3).
// NIEUW BESTAND — niet gebonden aan bestaande rapport.ts.
// Stijl: Navy/Goud sportthema, afgestemd op T4Business Kompas layout.
// Wetenschappelijke bronnen inline vermeld per module.

import { sportNaam } from "./scoring";
import type { ConstructRow } from "./scoring";
import type { ModuleResultaat, SchaalResultaat } from "./module-scoring";

// ────────────────────────────────────────────────────────────────────────────
// Hulpfuncties
// ────────────────────────────────────────────────────────────────────────────

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && isFinite(x) ? x : fallback;
}

function parseContract(raw: unknown): any | null {
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;
  return obj?.contract ?? obj;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function topRows(rows: ConstructRow[], family: string, n: number): ConstructRow[] {
  return rows.filter((r) => r.family === family).sort((a, b) => b.net - a.net).slice(0, n);
}

function energiePct(energie: number): number {
  return Math.round(((energie + 2) / 4) * 100);
}

function energieKleur(energie: number): string {
  return energie >= 0.5 ? "#C9A84C" : energie >= -0.5 ? "#7A8FAA" : "#e74c3c";
}

// ────────────────────────────────────────────────────────────────────────────
// Sport-beschrijvingen (identiek aan rapport.ts maar standalone)
// ────────────────────────────────────────────────────────────────────────────

const SPORT_BESCHRIJVING: Record<string, string> = {
  "Functioneel Innovatief": "Je vindt creatieve oplossingen in het veld die buiten de gebaande paden liggen. Je aanpassingsvermogen en vindingrijkheid zijn je sterkste wapens.",
  "Artistiek Innovatief": "Sport is voor jou ook een kunstvorm. Je brengt stijl, gevoel en expressie mee op het veld, en dat geeft je prestaties een unieke kleur.",
  "Complexiteit/Conceptueel": "Je denkt strategisch en ziet het grote plaatje. Tactische diepgang en het begrijpen van het 'waarom' achter elke beweging geven jou energie.",
  "Systematisch/Uitvoerend": "Jouw kracht zit in consistentie en betrouwbaarheid. Een sterk systeem, een vaste routine en gestructureerde uitvoering brengen jou in je beste flow.",
  "Sociaal Interactief": "De verbinding met je ploeg is je energiebron. In groep presteer jij boven jezelf uit en dat is een talent dat weinig atleten bezitten.",
  "Overdrachtelijk Interactief": "Je activeert anderen. Het overdragen van kennis, enthousiasme en inzicht geeft jou net zoveel energie als je eigen prestatie.",
};

const VERSNELLER_BESCHRIJVING: Record<string, string> = {
  "Analyse": "Je verwerkt prestatie-informatie grondig en systematisch. Inzicht in patronen en fouten maakt jou scherper.",
  "Individueel ondersteunend": "Je begeleidt en motiveert anderen één-op-één. Die rol geeft jou zelf ook energie en vervulling.",
  "Groepsondersteunend": "Je bouwt aan teamflow en groepscohesie. Een team dat jij ondersteunt, presteert als één geheel.",
  "Impact": "Druk en grote momenten wekken jou op. Je beste prestaties komen wanneer er echt iets op het spel staat.",
  "Resultaat": "Je richt je op het doel en laat je niet afleiden. Die focus is een krachtige versneller richting succes.",
  "Constructief onderscheidend": "Je denkt out-of-the-box en daagt de status quo uit. Jouw eigen weg is vaak de meest vruchtbare.",
};

const DRIVER_BESCHRIJVING: Record<string, { positief: string; risico: string; coachtip: string }> = {
  "Be Perfect": {
    positief: "Je hoge standaarden drijven je naar uitzonderlijke kwaliteit. Elke detail telt voor jou.",
    risico: "Wanneer perfectie een eis wordt in plaats van een streven, dreigt zelfkritiek jou te blokkeren.",
    coachtip: "Help de atleet onderscheid te maken tussen gezonde kwaliteitsstandaarden en belemmerende perfectionisme. Bouw in bewuste 'goed genoeg'-momenten.",
  },
  "Be Strong": {
    positief: "Jouw kracht en doorzettingsvermogen zijn een anker voor het team.",
    risico: "Kwetsbaarheid verbergen kost energie. Wanneer je nooit om hulp vraagt, draag je een last die je prestatie afremmer.",
    coachtip: "Creëer veilige ruimte voor kwetsbaarheid. Laat zien dat steun vragen kracht is, niet zwakte.",
  },
  "Hurry Up": {
    positief: "Je reageert snel en neemt beslissingen in het moment.",
    risico: "Haast kan leiden tot overhaaste keuzes of snel opgebrand energieniveau.",
    coachtip: "Bouw rustmomenten in. Train bewust vertragen zodat snelheid een keuze wordt, niet een reflex.",
  },
  "Please Others": {
    positief: "Je bent sterk afgestemd op je omgeving. Die sociale antenne maakt je een waardevolle ploeggenoot.",
    risico: "Prestaties afhankelijk maken van goedkeuring maakt je kwetsbaar.",
    coachtip: "Werk aan interne motivatiebronnen. Leer de atleet presteren vanuit intrinsieke overtuiging.",
  },
  "Try Hard": {
    positief: "Je doorzettingsvermogen is grenzeloos als er iemand op je rekent.",
    risico: "Je prestatiemotivatie is afhankelijk van externe personen.",
    coachtip: "Help de atleet die kracht te internaliseren als innerlijke stem.",
  },
};

// ────────────────────────────────────────────────────────────────────────────
// HTML-generatoren voor modules
// ────────────────────────────────────────────────────────────────────────────

function radarSvg(schalen: SchaalResultaat[], maxVal: number): string {
  const n = schalen.length;
  if (n < 3) return "";
  const cx = 160, cy = 160, r = 120;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const points = schalen.map((s, i) => {
    const ratio = Math.min(s.gemiddelde / maxVal, 1);
    const a = angle(i);
    return { x: cx + r * ratio * Math.cos(a), y: cy + r * ratio * Math.sin(a), label: s.naam, kleur: s.normKleur, score: s.gemiddelde };
  });

  const gridLines = [0.25, 0.5, 0.75, 1.0].map((ratio) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const a = angle(i);
      return `${cx + r * ratio * Math.cos(a)},${cy + r * ratio * Math.sin(a)}`;
    }).join(" ");
    return `<polygon points="${pts}" fill="none" stroke="#1a2a4a" stroke-width="1"/>`;
  }).join("\n");

  const spokenLines = Array.from({ length: n }, (_, i) => {
    const a = angle(i);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="#1a2a4a" stroke-width="1"/>`;
  }).join("\n");

  const dataPolygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  const labels = points.map((p, i) => {
    const a = angle(i);
    const lx = cx + (r + 22) * Math.cos(a);
    const ly = cy + (r + 22) * Math.sin(a);
    const anchor = Math.abs(lx - cx) < 10 ? "middle" : lx > cx ? "start" : "end";
    const shortName = p.label.length > 18 ? p.label.slice(0, 16) + "…" : p.label;
    return `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" font-size="9" fill="#8aa8d0" font-family="Arial">${esc(shortName)}</text>`;
  }).join("\n");

  return `<svg viewBox="0 0 320 320" width="280" height="280" style="display:block;margin:0 auto;">
    <rect width="320" height="320" fill="#0D1B3E" rx="12"/>
    ${gridLines}
    ${spokenLines}
    <polygon points="${dataPolygon}" fill="#C9A84C33" stroke="#C9A84C" stroke-width="2"/>
    ${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${p.kleur}"/>`).join("\n")}
    ${labels}
  </svg>`;
}

function m1Sectie(r: ModuleResultaat, sectionNr: number): string {
  const bars = r.schalen.map((s) => {
    const pct = Math.round((s.score / 12) * 100);
    return `<div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="color:#ccd6e8;font-size:0.88rem;font-weight:600;">${esc(s.naam)}</span>
        <span style="font-size:0.78rem;font-weight:700;padding:2px 10px;border-radius:12px;background:${s.normKleur}22;color:${s.normKleur};border:1px solid ${s.normKleur}44;">${esc(s.normLabel)}</span>
      </div>
      <div style="background:#1a2a4a;border-radius:6px;height:10px;position:relative;overflow:hidden;">
        <div style="background:linear-gradient(90deg,${s.normKleur}88,${s.normKleur});border-radius:6px;height:10px;width:${pct}%;transition:width 0.6s;"></div>
      </div>
      <div style="color:#7A8FAA;font-size:0.73rem;margin-top:3px;">${esc(s.normOmschrijving)}</div>
    </div>`;
  }).join("");

  const coachtips = r.coachtips.map((t) =>
    `<li style="margin-bottom:10px;color:#5a4000;">${esc(t)}</li>`
  ).join("");

  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">${sectionNr}</div>
      <div>
        <div class="section-title">Resilience &amp; Coping Profiel</div>
        <div class="section-subtitle">ACSI-28 — Smith, Schutz, Smoll &amp; Ptacek (1995) · α = 0.83–0.91</div>
      </div>
    </div>
    <div class="highlight-box">
      <p><strong>Wat meet dit?</strong> Zeven psychologische copingvaardigheden die direct samenhangen met topsportprestatie. De ACSI-28 is gevalideerd in 40+ landen en geeft een betrouwbaar beeld van mentale veerkracht.</p>
    </div>
    <div style="background:#0D1B3E;border-radius:12px;padding:24px;margin-bottom:20px;">
      ${bars}
    </div>
    <div style="background:#f8f9fb;border-radius:10px;padding:18px 22px;margin-bottom:16px;">
      <div style="color:#0D1B3E;font-size:0.88rem;font-weight:700;margin-bottom:6px;">Interpretatie</div>
      <p style="color:#444;font-size:0.88rem;line-height:1.7;">${esc(r.interpretatie)}</p>
    </div>
    <div class="coachtip-box">
      <div class="coachtip-label">Coach-aanwijzingen (ACSI-28)</div>
      <ul style="padding-left:18px;margin:0;">${coachtips}</ul>
    </div>
    <div class="bron-box">
      <span class="bron-label">Bron:</span> ${esc(r.wetenschappelijkeBron)}${r.doi ? ` — <a href="https://doi.org/${esc(r.doi)}" style="color:#C9A84C;">doi: ${esc(r.doi)}</a>` : ""}
    </div>
  </div>`;
}

function m2Sectie(r: ModuleResultaat, sectionNr: number): string {
  const radar = radarSvg(r.schalen, 5);
  const bars = r.schalen.map((s) => {
    const pct = Math.round((s.gemiddelde / 5) * 100);
    return `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <span style="color:#ccd6e8;font-size:0.85rem;">${esc(s.naam)}</span>
        <span style="font-size:0.75rem;font-weight:700;color:${s.normKleur};">${s.gemiddelde.toFixed(1)}/5</span>
      </div>
      <div style="background:#1a2a4a;border-radius:5px;height:8px;overflow:hidden;">
        <div style="background:${s.normKleur};border-radius:5px;height:8px;width:${pct}%;"></div>
      </div>
    </div>`;
  }).join("");

  const coachtips = r.coachtips.map((t) =>
    `<li style="margin-bottom:10px;color:#5a4000;">${esc(t)}</li>`
  ).join("");

  const gem = r.totaalScore / r.schalen.reduce((a, s) => a + s.score / s.gemiddelde, 0) || 0;
  const flowPct = Math.round((r.totaalScore / r.maxScore) * 100);

  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">${sectionNr}</div>
      <div>
        <div class="section-title">Flow-State Profiel</div>
        <div class="section-subtitle">DFS-2 / FSS-2 — Jackson &amp; Eklund (2002) · α = 0.75–0.93 · CFI = 0.97</div>
      </div>
    </div>
    <div class="highlight-box">
      <p><strong>Wat meet dit?</strong> De negen dimensies van de flow-ervaring — het gevoel van volledig opgaan in de sport ('in the zone'). Flow correleert significant met sportprestatie (r = 0.44, p &lt; .001) en intrinsieke motivatie.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <div style="background:#0D1B3E;border-radius:12px;padding:20px;">
        <div style="color:#8aa8d0;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Flow-dimensies (1–5 schaal)</div>
        ${bars}
      </div>
      <div style="background:#0D1B3E;border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        ${radar}
        <div style="text-align:center;margin-top:10px;">
          <div style="color:#C9A84C;font-size:2rem;font-weight:800;">${flowPct}%</div>
          <div style="color:#8aa8d0;font-size:0.75rem;">van maximale flow-score</div>
        </div>
      </div>
    </div>
    <div style="background:#f8f9fb;border-radius:10px;padding:18px 22px;margin-bottom:16px;">
      <div style="color:#0D1B3E;font-size:0.88rem;font-weight:700;margin-bottom:6px;">Interpretatie</div>
      <p style="color:#444;font-size:0.88rem;line-height:1.7;">${esc(r.interpretatie)}</p>
    </div>
    <div class="coachtip-box">
      <div class="coachtip-label">Coach-aanwijzingen (Flow-profiel)</div>
      <ul style="padding-left:18px;margin:0;">${coachtips}</ul>
    </div>
    <div class="bron-box">
      <span class="bron-label">Bron:</span> ${esc(r.wetenschappelijkeBron)}${r.doi ? ` — <a href="https://doi.org/${esc(r.doi)}" style="color:#C9A84C;">doi: ${esc(r.doi)}</a>` : ""}
    </div>
  </div>`;
}

function m3Sectie(r: ModuleResultaat, sectionNr: number): string {
  const s = r.schalen[0];
  const totaal = r.totaalScore;
  const pct = Math.round((totaal / 49) * 100);

  // Gauge-achtige balk
  const zones = [
    { label: "Laag", max: 20, kleur: "#3498db", pct: Math.round((20 / 49) * 100) },
    { label: "Gebalanceerd", max: 31, kleur: "#2ecc71", pct: Math.round((31 / 49) * 100) },
    { label: "Sterk", max: 42, kleur: "#C9A84C", pct: Math.round((42 / 49) * 100) },
    { label: "Exclusief", max: 49, kleur: "#e74c3c", pct: 100 },
  ];

  const markerPct = pct;

  const coachtips = r.coachtips.map((t) =>
    `<li style="margin-bottom:10px;color:#5a4000;">${esc(t)}</li>`
  ).join("");

  const risicoKleur = totaal >= 43 ? "#e74c3c" : totaal >= 32 ? "#C9A84C" : totaal >= 21 ? "#2ecc71" : "#3498db";
  const risicoLabel = totaal >= 43 ? "Hoog risico" : totaal >= 32 ? "Laag risico" : totaal >= 21 ? "Kracht" : "Verkennen";

  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">${sectionNr}</div>
      <div>
        <div class="section-title">Atletische Identiteit</div>
        <div class="section-subtitle">AIMS-7 — Brewer, Van Raalte &amp; Linder (1993) · α = 0.81 · CFI = 0.97</div>
      </div>
    </div>
    <div class="highlight-box">
      <p><strong>Wat meet dit?</strong> De mate waarin de sporter zijn/haar sociale identiteit definieert via de sportrol. Een sterke atletische identiteit is een kracht voor prestatie én een risicofactor bij blessures of loopbaantransities.</p>
    </div>
    <div style="background:#0D1B3E;border-radius:12px;padding:28px;margin-bottom:20px;text-align:center;">
      <div style="color:#8aa8d0;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;">Atletische Identiteit Score (AIMS-7)</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:24px;">
        <div style="background:#1a2a4a;border-radius:50%;width:100px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:4px solid ${s.normKleur};">
          <div style="color:${s.normKleur};font-size:2rem;font-weight:800;">${totaal}</div>
          <div style="color:#8aa8d0;font-size:0.7rem;">/ 49</div>
        </div>
        <div style="text-align:left;">
          <div style="color:${s.normKleur};font-size:1.2rem;font-weight:800;margin-bottom:4px;">${esc(s.normLabel)}</div>
          <div style="color:#ccd6e8;font-size:0.85rem;max-width:220px;line-height:1.5;">${esc(s.normOmschrijving)}</div>
        </div>
      </div>
      <div style="position:relative;height:20px;border-radius:10px;overflow:hidden;background:linear-gradient(90deg,#3498db 0%,#2ecc71 41%,#C9A84C 63%,#e74c3c 86%);">
        <div style="position:absolute;top:0;left:${markerPct}%;transform:translateX(-50%);width:4px;height:20px;background:white;border-radius:2px;box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;">
        ${zones.map((z) => `<span style="color:${z.kleur};font-size:0.68rem;">${z.label}</span>`).join("")}
      </div>
      <div style="margin-top:16px;display:inline-flex;align-items:center;gap:8px;background:#1a2a4a;border-radius:20px;padding:6px 16px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${risicoKleur};"></div>
        <span style="color:${risicoKleur};font-size:0.82rem;font-weight:700;">${risicoLabel}</span>
      </div>
    </div>
    <div style="background:#f8f9fb;border-radius:10px;padding:18px 22px;margin-bottom:16px;">
      <div style="color:#0D1B3E;font-size:0.88rem;font-weight:700;margin-bottom:6px;">Interpretatie</div>
      <p style="color:#444;font-size:0.88rem;line-height:1.7;">${esc(r.interpretatie)}</p>
    </div>
    ${coachtips.length > 0 ? `<div class="coachtip-box">
      <div class="coachtip-label">Coach-aanwijzingen (Atletische Identiteit)</div>
      <ul style="padding-left:18px;margin:0;">${coachtips}</ul>
    </div>` : ""}
    <div class="bron-box">
      <span class="bron-label">Bron:</span> ${esc(r.wetenschappelijkeBron)}
    </div>
  </div>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Exportfunctie
// ────────────────────────────────────────────────────────────────────────────

export function genereerT4SportsRapportCompleet(
  contractRaw: unknown,
  moduleResultaten: ModuleResultaat[],
  _taal: string = "nl"
): string {
  const contract = parseContract(contractRaw);
  if (!contract) return "<html><body>Geen contract gevonden.</body></html>";

  const naam = esc(contract.name ?? "Atleet");
  const sporttak = esc(contract.sporttak ?? "");
  const ploeg = esc(contract.ploeg ?? "");
  const niveauLabel = esc((contract as any).niveauLabel ?? (contract as any).niveau ?? "");
  const sportTypeRaw = (contract as any).sportType ?? "";
  const sportTypeLabel = sportTypeRaw === "individueel" ? "Individueel" : sportTypeRaw === "ploeg" ? "Ploeg / Team" : "";
  const ambitieLabel = esc((contract as any).ambitieLabel ?? (contract as any).ambitie ?? "");
  const datum = formatDate(contract.generatedAt ?? new Date().toISOString());

  const sections = contract.sections ?? {};
  const meta = sections.meta ?? {};
  const main = sections.main ?? {};
  const conn = sections.connection ?? {};

  const rows: ConstructRow[] = Array.isArray(main.constructRows) ? main.constructRows : [];
  const sportprofiel = meta.sportprofiel ?? {};
  const consistency = meta.consistency ?? {};

  const normEnergy = num(meta.normalizedQuestionnaireEnergy, 5);
  const baselineEnergy = num(meta.baselineAthleetEnergy, 5);
  const energieProfiel = sportprofiel.energieProfiel ?? "midden";
  const drukProfiel = sportprofiel.drukProfiel ?? "wisselvallig";

  const topFoci = topRows(rows, "Talent-foci", 3);
  const topVersnellers = topRows(rows, "Talent-versnellers", 3);
  const topDriverRow = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net)[0];
  const dominanteDriver = topDriverRow?.construct ?? "—";
  const driverInfo = DRIVER_BESCHRIJVING[dominanteDriver];

  const connAnswers = conn.answers ?? {};
  const sportpassie = num(connAnswers.q1 ?? conn.sportpassie, 0);
  const billijkheid = num(connAnswers.q2 ?? conn.billijkheid, 0);
  const mentaleZelfinv = num(connAnswers.q3 ?? conn.mentaleZelfinvestering, 0);
  const clubInv = num(connAnswers.q4 ?? conn.clubInvestering, 0);

  const energieKleurMain = energieProfiel === "hoog" ? "#2ecc71" : energieProfiel === "midden" ? "#C9A84C" : "#e74c3c";
  const energieLabelMain = energieProfiel === "hoog" ? "Hoog" : energieProfiel === "midden" ? "Midden" : "Laag";

  const drukUitleg = drukProfiel === "gaspedaal"
    ? "Je driver werkt als een <strong>gaspedaal</strong>: het geeft je energie en accelereert je prestatie in kritieke momenten."
    : drukProfiel === "rem"
    ? "Je driver werkt op dit moment als een <strong>rem</strong>: het kost energie en kan je blokkeren in kritieke momenten."
    : "Je driver werkt <strong>wisselvallig</strong>: soms een gaspedaal, soms een rem.";

  // Bouw module-secties
  let sectionCounter = 6;
  const moduleSectiesHtml: string[] = [];
  for (const mr of moduleResultaten) {
    if (mr.moduleId === "M1") { moduleSectiesHtml.push(m1Sectie(mr, sectionCounter)); sectionCounter++; }
    else if (mr.moduleId === "M2") { moduleSectiesHtml.push(m2Sectie(mr, sectionCounter)); sectionCounter++; }
    else if (mr.moduleId === "M3") { moduleSectiesHtml.push(m3Sectie(mr, sectionCounter)); sectionCounter++; }
  }

  const hasModules = moduleSectiesHtml.length > 0;

  function connBalk(val: number, label: string): string {
    const c = val >= 7 ? "#2ecc71" : val >= 5 ? "#f39c12" : "#e74c3c";
    return `<div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:#ccd6e8;font-size:0.85rem;">${esc(label)}</span>
        <span style="color:${c};font-weight:700;">${val}/10</span>
      </div>
      <div style="background:#1a2a4a;border-radius:4px;height:8px;"><div style="background:${c};border-radius:4px;height:8px;width:${val * 10}%;"></div></div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>T4Sports Volledig Rapport — ${naam}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #1a1a2e; }

    /* ── COVER ── */
    .cover {
      background: linear-gradient(135deg, #0D1B3E 0%, #0f2252 50%, #162852 100%);
      color: white; padding: 0; position: relative; overflow: hidden; page-break-after: always;
    }
    .cover-stripe { height: 6px; background: linear-gradient(90deg, #C9A84C, #e8c87a, #C9A84C); }
    .cover-inner { padding: 56px 48px 48px; }
    .cover-badge { display: inline-flex; align-items: center; gap: 8px; background: #C9A84C22; border: 1px solid #C9A84C55; border-radius: 20px; padding: 6px 16px; margin-bottom: 32px; }
    .cover-badge-text { color: #C9A84C; font-size: 0.78rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .cover-dot { width: 6px; height: 6px; border-radius: 50%; background: #C9A84C; }
    .cover-name { font-size: 3rem; font-weight: 900; color: white; line-height: 1.1; margin-bottom: 6px; letter-spacing: -1px; }
    .cover-subtitle { font-size: 1.1rem; color: #8aa8d0; margin-bottom: 40px; }
    .cover-divider { height: 1px; background: linear-gradient(90deg, #C9A84C44, transparent); margin-bottom: 32px; }
    .cover-meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .cover-meta-item { background: #ffffff0a; border: 1px solid #ffffff12; border-radius: 10px; padding: 14px 18px; }
    .cover-meta-label { color: #8aa8d0; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 5px; }
    .cover-meta-value { color: white; font-size: 0.95rem; font-weight: 600; }
    .cover-modules-bar { background: #C9A84C11; border-top: 1px solid #C9A84C33; padding: 16px 48px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .cover-module-chip { background: #C9A84C22; border: 1px solid #C9A84C55; border-radius: 20px; padding: 5px 14px; font-size: 0.75rem; color: #C9A84C; font-weight: 600; }
    .cover-module-label { color: #8aa8d0; font-size: 0.75rem; }

    /* ── INHOUDSOPGAVE ── */
    .toc { background: #0D1B3E; color: white; padding: 40px 48px; page-break-after: always; }
    .toc-title { color: #C9A84C; font-size: 1.4rem; font-weight: 800; margin-bottom: 24px; letter-spacing: 1px; text-transform: uppercase; }
    .toc-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #1a2a4a; }
    .toc-item-name { color: #ccd6e8; font-size: 0.9rem; }
    .toc-item-nr { color: #C9A84C; font-weight: 700; font-size: 0.85rem; }
    .toc-module-item { display: flex; align-items: center; gap: 8px; padding: 8px 0 8px 16px; border-bottom: 1px solid #1a2a4a0a; }
    .toc-module-badge { background: #C9A84C22; border: 1px solid #C9A84C44; border-radius: 10px; padding: 2px 10px; font-size: 0.72rem; color: #C9A84C; font-weight: 700; }
    .toc-module-name { color: #8aa8d0; font-size: 0.85rem; }

    /* ── CONTENT ── */
    .content { max-width: 860px; margin: 0 auto; padding: 40px 24px 60px; }

    /* ── SECTIONS ── */
    .section { background: white; border-radius: 14px; padding: 36px; margin-bottom: 28px; box-shadow: 0 2px 16px rgba(0,0,0,0.07); page-break-inside: avoid; }
    .section-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 26px; }
    .section-number { background: #0D1B3E; color: #C9A84C; min-width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; flex-shrink: 0; }
    .section-title { color: #0D1B3E; font-size: 1.3rem; font-weight: 800; }
    .section-subtitle { color: #888; font-size: 0.82rem; margin-top: 3px; line-height: 1.4; }

    /* ── HIGHLIGHT / COACHTIP / BRON BOXEN ── */
    .highlight-box { background: #f8f9fc; border-left: 4px solid #C9A84C; border-radius: 0 10px 10px 0; padding: 16px 20px; margin-bottom: 22px; }
    .highlight-box p { color: #333; font-size: 0.88rem; line-height: 1.7; }
    .coachtip-box { background: #fff9ec; border: 1px solid #C9A84C55; border-radius: 10px; padding: 18px 22px; margin-top: 16px; }
    .coachtip-label { color: #8a6000; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 10px; }
    .bron-box { margin-top: 14px; background: #f0f2f5; border-radius: 8px; padding: 10px 16px; font-size: 0.74rem; color: #888; line-height: 1.6; }
    .bron-label { font-weight: 700; color: #555; }

    /* ── KAARTEN ── */
    .kaart { background: #0D1B3E; border: 1px solid #C9A84C22; border-radius: 10px; padding: 20px 24px; margin-bottom: 14px; }
    .kaart-naam { color: #C9A84C; font-weight: 700; font-size: 1rem; margin-bottom: 8px; }
    .kaart-tekst { color: #ccd6e8; font-size: 0.88rem; line-height: 1.6; margin-bottom: 10px; }
    .balk-bg { background: #1a2a4a; border-radius: 5px; height: 8px; }

    /* ── PROFIEL-GRID ── */
    .profiel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 22px; }
    .profiel-kaart { background: #0D1B3E; border-radius: 10px; padding: 16px; text-align: center; }
    .profiel-kaart-label { color: #8aa8d0; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .profiel-kaart-waarde { color: #C9A84C; font-weight: 700; font-size: 0.92rem; }

    /* ── BADGES ── */
    .druk-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; margin-bottom: 14px; }
    .gaspedaal { background: #C9A84C22; color: #C9A84C; border: 1px solid #C9A84C; }
    .rem { background: #e74c3c22; color: #e74c3c; border: 1px solid #e74c3c; }
    .wisselvallig { background: #88888822; color: #888; border: 1px solid #888; }

    /* ── DISCLAIMER ── */
    .disclaimer { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px; padding: 18px 22px; font-size: 0.76rem; color: #888; line-height: 1.7; margin-top: 28px; }

    /* ── PRINT ── */
    @media print {
      body { background: white; }
      .content { padding: 20px; }
      .section { box-shadow: none; border: 1px solid #e0e0e0; break-inside: avoid; }
      .cover, .toc { page-break-after: always; }
    }
  </style>
</head>
<body>

<!-- ══════════════════════════════ COVER ══════════════════════════════ -->
<div class="cover">
  <div class="cover-stripe"></div>
  <div class="cover-inner">
    <div class="cover-badge">
      <div class="cover-dot"></div>
      <span class="cover-badge-text">T4Sports · Mental Talent Profiel${hasModules ? " + Extra Modules" : ""}</span>
    </div>
    <div class="cover-name">${naam}</div>
    <div class="cover-subtitle">Volledig persoonlijk profiel voor atleten · TaPasCity</div>
    <div class="cover-divider"></div>
    <div class="cover-meta-grid">
      <div class="cover-meta-item"><div class="cover-meta-label">Sporttak</div><div class="cover-meta-value">${sporttak || "—"}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Type sport</div><div class="cover-meta-value">${sportTypeLabel || "—"}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Niveau</div><div class="cover-meta-value">${niveauLabel || "—"}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Ambitie</div><div class="cover-meta-value">${ambitieLabel || "—"}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Club / Ploeg</div><div class="cover-meta-value">${ploeg || "—"}</div></div>
      <div class="cover-meta-item"><div class="cover-meta-label">Datum</div><div class="cover-meta-value">${datum}</div></div>
    </div>
  </div>
  ${hasModules ? `<div class="cover-modules-bar">
    <span class="cover-module-label">Extra modules:</span>
    ${moduleResultaten.map((mr) => `<span class="cover-module-chip">${esc(mr.moduleId)} · ${esc(mr.moduleNaam)}</span>`).join("")}
  </div>` : ""}
</div>

<!-- ══════════════════════════ INHOUDSOPGAVE ══════════════════════════ -->
<div class="toc">
  <div class="toc-title">Inhoudsopgave</div>
  <div class="toc-item"><span class="toc-item-name">Sportprofiel in één oogopslag</span><span class="toc-item-nr">★</span></div>
  <div class="toc-item"><span class="toc-item-name">1 · Talentprofiel — De Motor</span><span class="toc-item-nr">1</span></div>
  <div class="toc-item"><span class="toc-item-name">2 · Versnellersprofiel — De Versnellingsbak</span><span class="toc-item-nr">2</span></div>
  <div class="toc-item"><span class="toc-item-name">3 · Driverprofiel — De Stuurkracht</span><span class="toc-item-nr">3</span></div>
  <div class="toc-item"><span class="toc-item-name">4 · Drukprofiel &amp; Sportverbondenheid</span><span class="toc-item-nr">4</span></div>
  <div class="toc-item"><span class="toc-item-name">5 · Coaching-aanwijzingen (basis)</span><span class="toc-item-nr">5</span></div>
  ${hasModules ? `<div style="margin-top:16px;color:#C9A84C;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;padding-bottom:8px;border-bottom:1px solid #1a2a4a;">Extra Modules — Wetenschappelijk Onderbouwd</div>` : ""}
  ${moduleResultaten.map((mr, i) => `
    <div class="toc-module-item">
      <span class="toc-module-badge">${esc(mr.moduleId)}</span>
      <span class="toc-module-name">${i + 6} · ${esc(mr.moduleNaam)}</span>
    </div>`).join("")}
</div>

<!-- ══════════════════════════ RAPPORT INHOUD ══════════════════════════ -->
<div class="content">

  <!-- ★ SAMENVATTING -->
  <div class="section" style="background:#0D1B3E;color:white;">
    <div class="section-header">
      <div class="section-number" style="background:#C9A84C;color:#0D1B3E;">★</div>
      <div>
        <div class="section-title" style="color:#C9A84C;">Sportprofiel in één oogopslag</div>
        <div class="section-subtitle" style="color:#8aa8d0;">Drie assen van jouw mental talent</div>
      </div>
    </div>
    <div class="profiel-grid">
      <div class="profiel-kaart"><div class="profiel-kaart-label">Dominante Focus</div><div class="profiel-kaart-waarde">${esc(sportprofiel.dominanteFocus ?? "—")}</div></div>
      <div class="profiel-kaart"><div class="profiel-kaart-label">Dominante Versneller</div><div class="profiel-kaart-waarde">${esc(sportprofiel.dominanteVersneller ?? "—")}</div></div>
      <div class="profiel-kaart"><div class="profiel-kaart-label">Dominant Driver</div><div class="profiel-kaart-waarde">${esc(dominanteDriver)}</div></div>
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
      <div style="text-align:center;">
        <div style="width:80px;height:80px;border-radius:50%;border:4px solid ${energieKleurMain};display:inline-flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="color:${energieKleurMain};font-size:1.5rem;font-weight:800;">${normEnergy.toFixed(1)}</div>
          <div style="color:#888;font-size:0.68rem;">/10</div>
        </div>
        <div style="color:#8aa8d0;font-size:0.72rem;margin-top:6px;">Mentale energie</div>
      </div>
      <div style="text-align:center;">
        <div style="width:80px;height:80px;border-radius:50%;border:4px solid #8aa8d0;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="color:#8aa8d0;font-size:1.5rem;font-weight:800;">${baselineEnergy.toFixed(1)}</div>
          <div style="color:#888;font-size:0.68rem;">/10</div>
        </div>
        <div style="color:#8aa8d0;font-size:0.72rem;margin-top:6px;">Baseline energie</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#1a2a4a;border-radius:10px;padding:14px 18px;text-align:center;">
          <div style="color:#aaa;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Consistentie</div>
          <div style="color:#C9A84C;font-size:1.5rem;font-weight:800;">${consistency.score ?? "—"}</div>
          <div style="color:#aaa;font-size:0.68rem;">/100</div>
        </div>
      </div>
    </div>
  </div>

  <!-- BLOK 1: TALENTPROFIEL -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">1</div>
      <div>
        <div class="section-title">Je Talentprofiel — De Motor</div>
        <div class="section-subtitle">Jouw top-3 talent-foci: hier zit jouw echte drijfveer als atleet</div>
      </div>
    </div>
    ${topFoci.map((row) => {
      const pct = energiePct(row.avgEnergy);
      const kleur = energieKleur(row.avgEnergy);
      return `<div class="kaart">
        <div class="kaart-naam">${esc(sportNaam(row.construct))}</div>
        <div class="kaart-tekst">${esc(SPORT_BESCHRIJVING[row.construct] ?? "")}</div>
        <div style="color:#8aa8d0;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Energielading</div>
        <div class="balk-bg"><div style="background:${kleur};border-radius:4px;height:8px;width:${pct}%;"></div></div>
        <div style="color:#7A8FAA;font-size:0.73rem;margin-top:3px;">${row.avgEnergy > 0 ? "+" : ""}${row.avgEnergy.toFixed(1)} · ${row.most}× gekozen (${row.shown} getoond)</div>
      </div>`;
    }).join("")}
    ${topFoci.length === 0 ? "<p style='color:#888;'>Geen data beschikbaar.</p>" : ""}
  </div>

  <!-- BLOK 2: VERSNELLERSPROFIEL -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">2</div>
      <div>
        <div class="section-title">Je Versnellersprofiel — De Versnellingsbak</div>
        <div class="section-subtitle">Jouw top-3 talent-versnellers: zo zet je jouw talent om in resultaat</div>
      </div>
    </div>
    ${topVersnellers.map((row) => {
      const pct = energiePct(row.avgEnergy);
      const kleur = energieKleur(row.avgEnergy);
      return `<div class="kaart">
        <div class="kaart-naam">${esc(sportNaam(row.construct))}</div>
        <div class="kaart-tekst">${esc(VERSNELLER_BESCHRIJVING[row.construct] ?? "")}</div>
        <div style="color:#8aa8d0;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Energielading</div>
        <div class="balk-bg"><div style="background:${kleur};border-radius:4px;height:8px;width:${pct}%;"></div></div>
        <div style="color:#7A8FAA;font-size:0.73rem;margin-top:3px;">${row.avgEnergy > 0 ? "+" : ""}${row.avgEnergy.toFixed(1)} · ${row.most}× gekozen</div>
      </div>`;
    }).join("")}
    ${topVersnellers.length === 0 ? "<p style='color:#888;'>Geen data beschikbaar.</p>" : ""}
  </div>

  <!-- BLOK 3: DRIVERPROFIEL -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">3</div>
      <div>
        <div class="section-title">Je Driverprofiel — De Stuurkracht</div>
        <div class="section-subtitle">Onbewuste gedragspatronen die je prestatie sturen (naar Taibi Kahler)</div>
      </div>
    </div>
    <div class="highlight-box">
      <p>De term <strong>"Driver"</strong> verwijst naar onbewuste controlemechanismen (naar Taibi Kahler) die je gedrag onder druk sturen. Ze kunnen je talent versterken of blokkeren. Dit is geen diagnose, maar een spiegel.</p>
    </div>
    ${driverInfo ? `<div style="background:#0D1B3E;border-radius:10px;padding:22px;margin-bottom:14px;">
      <div style="color:#C9A84C;font-size:1.15rem;font-weight:800;margin-bottom:10px;">${esc(dominanteDriver)}</div>
      <div style="color:#7ecfb3;font-size:0.88rem;line-height:1.6;margin-bottom:10px;">${esc(driverInfo.positief)}</div>
      <div style="color:#e8a87c;font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Let op:</div>
      <div style="color:#e8d5c4;font-size:0.88rem;line-height:1.6;">${esc(driverInfo.risico)}</div>
    </div>` : `<div style="background:#0D1B3E;border-radius:10px;padding:22px;margin-bottom:14px;color:#C9A84C;font-weight:700;">${esc(dominanteDriver)}</div>`}
    ${(() => {
      const driverRows = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net);
      return driverRows.map((row) => {
        const pct = energiePct(row.avgEnergy);
        const kleur = energieKleur(row.avgEnergy);
        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="min-width:140px;font-size:0.85rem;font-weight:600;color:#333;">${esc(row.construct)}</span>
          <div style="flex:1;background:#f0f0f0;border-radius:4px;height:8px;"><div style="background:${kleur};border-radius:4px;height:8px;width:${pct}%;"></div></div>
          <span style="min-width:50px;font-size:0.8rem;color:#666;">${row.avgEnergy > 0 ? "+" : ""}${row.avgEnergy.toFixed(1)}</span>
        </div>`;
      }).join("");
    })()}
  </div>

  <!-- BLOK 4: DRUKPROFIEL -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">4</div>
      <div>
        <div class="section-title">Drukprofiel &amp; Sportverbondenheid</div>
        <div class="section-subtitle">Wat er gebeurt in het kritische moment + connectie met de sport</div>
      </div>
    </div>
    <div class="druk-badge ${drukProfiel}">${drukProfiel === "gaspedaal" ? "⚡ Gaspedaal" : drukProfiel === "rem" ? "⛔ Rem" : "⚖ Wisselvallig"}</div>
    <div class="highlight-box"><p>${drukUitleg}</p></div>
    <div style="margin-top:16px;">
      <h4 style="color:#0D1B3E;font-size:0.88rem;font-weight:700;margin-bottom:14px;text-transform:uppercase;letter-spacing:1px;">Sportverbondenheid</h4>
      ${connBalk(sportpassie, "Sportpassie")}
      ${connBalk(billijkheid, "Billijkheid")}
      ${connBalk(mentaleZelfinv, "Mentale zelfinvestering")}
      ${connBalk(clubInv, "Club-investering in jou")}
    </div>
  </div>

  <!-- BLOK 5: COACHING (BASIS) -->
  <div class="section" style="background:#fff9ec;border:2px solid #C9A84C44;">
    <div class="section-header">
      <div class="section-number" style="background:#C9A84C;color:#0D1B3E;">5</div>
      <div>
        <div class="section-title">Coaching-aanwijzingen (basis)</div>
        <div class="section-subtitle" style="color:#C9A84C;font-weight:600;">VOOR DE COACH — Niet bedoeld voor directe communicatie aan de atleet</div>
      </div>
    </div>
    ${driverInfo ? `<div class="coachtip-box">
      <div class="coachtip-label">Coach-tip — ${esc(dominanteDriver)}</div>
      <p style="color:#5a4000;font-size:0.88rem;line-height:1.7;">${esc(driverInfo.coachtip)}</p>
    </div>` : ""}
    <div style="margin-top:16px;">
      <h4 style="color:#0D1B3E;font-size:0.88rem;font-weight:700;margin-bottom:12px;">Focuspunten voor het coaching-gesprek:</h4>
      <ul style="color:#444;font-size:0.88rem;line-height:2;padding-left:20px;">
        <li>Bespreek het verschil tussen de energiebalans in de lijst (${normEnergy.toFixed(1)}/10) en de baseline (${baselineEnergy.toFixed(1)}/10)</li>
        <li>Dominante focus "${esc(sportprofiel.dominanteFocus ?? "—")}" — benoem hoe dit concreet zichtbaar is in het gedrag</li>
        <li>Drukprofiel "${drukProfiel}" — bespreek situaties waarin dit de prestatie beïnvloedde</li>
        <li>Consistentiescore ${consistency.score ?? "—"}/100 — ${(consistency.score ?? 0) >= 80 ? "hoge betrouwbaarheid" : (consistency.score ?? 0) >= 60 ? "gemiddelde betrouwbaarheid" : "toets bevindingen in gesprek"}</li>
        <li>Sportpassie ${sportpassie}/10 — ${sportpassie < 6 ? "onderzoek of de motivatie nog intrinsiek is" : "gezonde verbinding met de sport"}</li>
      </ul>
    </div>
  </div>

  <!-- ══════ MODULE-SECTIES ══════ -->
  ${moduleSectiesHtml.join("\n")}

  <!-- DISCLAIMER -->
  <div class="disclaimer">
    <strong>Disclaimer:</strong> Dit rapport is geen diagnose, selectie-advies of psychologische beoordeling. Het is een reflectie-instrument op basis van zelfrapportage. Geen enkele uitkomst impliceert een oordeel over de kwaliteit of het potentieel van de atleet. Gebruik dit rapport enkel in een vertrouwelijk coaching-kader.${hasModules ? " De extra modules (ACSI-28, DFS-2/FSS-2, AIMS-7) zijn gevalideerde wetenschappelijke instrumenten maar worden in dit rapport gebruikt als coachingstool, niet als klinische assessment." : ""} T4Sports Mental Talent Profiel${hasModules ? " + Modules" : ""} · TaPasCity · Gegenereerd op ${datum}.
  </div>

</div>
</body>
</html>`;
}
