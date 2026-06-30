// server/t4sports/rapport.ts
// HTML rapport generator voor T4Sports — Mental Talent Profiel.
// Standalone HTML (inline CSS, geen externe dependencies).
// Kleurstijl: donker navy #0D1B3E + goud #C9A84C + wit.

import { sportNaam } from "./scoring";
import type { ConstructRow } from "./scoring";

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && isFinite(x) ? x : fallback;
}

function parseContract(raw: unknown): any | null {
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (!obj || typeof obj !== "object") return null;
  // Support both top-level contract and wrapped contract
  return obj?.contract ?? obj;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

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
    risico: "Wanneer perfectie een eis wordt in plaats van een streven, dreigt zelfkritiek jou te blokkeren. Een 'bijna perfect' prestatie verdient ook waardering.",
    coachtip: "Help de atleet onderscheid te maken tussen gezonde kwaliteitsstandaarden en belemmerende perfectionisme. Bouw in bewuste 'goed genoeg'-momenten.",
  },
  "Be Strong": {
    positief: "Jouw kracht en doorzettingsvermogen zijn een anker voor het team. Je toont nooit kwetsbaarheid wanneer het erop aankomt.",
    risico: "Kwetsbaarheid verbergen kost energie. Wanneer je nooit om hulp vraagt, draag je een last die je prestatie op termijn afremmer.",
    coachtip: "Creëer veilige ruimte voor kwetsbaarheid. Laat zien dat steun vragen kracht is, niet zwakte.",
  },
  "Hurry Up": {
    positief: "Je reageert snel en neemt beslissingen in het moment. Dat is een echte meerwaarde in dynamische sportsituaties.",
    risico: "Haast kan leiden tot overhaaste keuzes of een snel opgebrand energieniveau. Geduld is ook een vaardigheid.",
    coachtip: "Bouw rustmomenten in. Train bewust vertragen zodat de snelheid een keuze wordt, niet een reflex.",
  },
  "Please Others": {
    positief: "Je bent sterk afgestemd op je omgeving. Die sociale antenne maakt je een waardevolle ploeggenoot.",
    risico: "Prestaties afhankelijk maken van de goedkeuring van anderen maakt je kwetsbaar. Bouw interne validatie op.",
    coachtip: "Werk aan interne motivatiebronnen. Leer de atleet presteren vanuit intrinsieke overtuiging, onafhankelijk van externe reacties.",
  },
  "Try Hard": {
    positief: "Je doorzettingsvermogen is grenzeloos als er iemand op je rekent die je dierbaar is. Die loyaliteit is een enorme kracht.",
    risico: "Je prestatiemotivatie is afhankelijk van externe personen. Wanneer die er niet zijn, kan de brandstof ontbreken.",
    coachtip: "Help de atleet die kracht te internaliseren. De persoon die hem/haar inspireert, kan ook intern worden gedragen als innerlijke stem.",
  },
};

function topRows(rows: ConstructRow[], family: string, n: number): ConstructRow[] {
  return rows.filter((r) => r.family === family).sort((a, b) => b.net - a.net).slice(0, n);
}

function energieBalk(energy: number): string {
  const pct = Math.round(((energy + 2) / 4) * 100);
  const color = energy >= 0.5 ? "#C9A84C" : energy >= -0.5 ? "#888" : "#c0392b";
  return `<div style="background:#1a2a4a;border-radius:4px;height:10px;width:100%;margin-top:4px;">
    <div style="background:${color};border-radius:4px;height:10px;width:${pct}%;"></div>
  </div>`;
}

function constructKaart(row: ConstructRow, beschrijvingen: Record<string, string>): string {
  const naam = sportNaam(row.construct);
  const beschr = beschrijvingen[row.construct] ?? "";
  const energie = row.avgEnergy;
  const pct = Math.round(((energie + 2) / 4) * 100);
  const color = energie >= 0.5 ? "#C9A84C" : energie >= -0.5 ? "#888" : "#c0392b";
  return `<div style="background:#111f3a;border:1px solid #C9A84C33;border-radius:8px;padding:16px 20px;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="color:#C9A84C;font-weight:700;font-size:1.05rem;">${escHtml(naam)}</span>
      <span style="color:#aaa;font-size:0.8rem;">${row.most}× gekozen</span>
    </div>
    <p style="color:#ccd6e8;font-size:0.9rem;margin:0 0 10px 0;">${escHtml(beschr)}</p>
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="color:#aaa;font-size:0.75rem;min-width:60px;">Energie</span>
      <div style="flex:1;background:#1a2a4a;border-radius:4px;height:8px;">
        <div style="background:${color};border-radius:4px;height:8px;width:${pct}%;"></div>
      </div>
      <span style="color:#aaa;font-size:0.75rem;min-width:30px;">${energie > 0 ? "+" : ""}${energie.toFixed(1)}</span>
    </div>
  </div>`;
}

export function genereerT4SportsRapport(contractRaw: unknown, taal: string = "nl"): string {
  const contract = parseContract(contractRaw);
  if (!contract) return "<html><body>Geen contract gevonden.</body></html>";

  const naam = escHtml(contract.name ?? "Atleet");
  const sporttak = escHtml(contract.sporttak ?? "");
  const ploeg = escHtml(contract.ploeg ?? "");
  const rol = escHtml(contract.rol ?? "");
  const datum = formatDate(contract.generatedAt ?? new Date().toISOString());

  const sections = contract.sections ?? {};
  const meta = sections.meta ?? {};
  const main = sections.main ?? {};
  const conn = sections.connection ?? {};

  const rows: ConstructRow[] = Array.isArray(main.constructRows) ? main.constructRows : [];
  const sportprofiel = meta.sportprofiel ?? {};
  const consistency = meta.consistency ?? {};
  const driverRisk = meta.driverRisk ?? {};

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

  function connBalk(val: number, label: string): string {
    const color = val >= 7 ? "#2ecc71" : val >= 5 ? "#f39c12" : "#e74c3c";
    return `<div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:#ccd6e8;font-size:0.85rem;">${escHtml(label)}</span>
        <span style="color:${color};font-weight:700;">${val}/10</span>
      </div>
      <div style="background:#1a2a4a;border-radius:4px;height:8px;">
        <div style="background:${color};border-radius:4px;height:8px;width:${val * 10}%;"></div>
      </div>
    </div>`;
  }

  const drukUitleg = drukProfiel === "gaspedaal"
    ? "Je driver werkt als een <strong>gaspedaal</strong>: het geeft je energie en accelereert je prestatie in kritieke momenten. Dat is een krachtig wapen — zolang je bewust omgaat met de brandstof."
    : drukProfiel === "rem"
    ? "Je driver werkt op dit moment als een <strong>rem</strong>: het kost energie en kan je blokkeren in kritieke momenten. Mental coaching kan dit ombuigen naar een neutrale of positieve kracht."
    : "Je driver werkt <strong>wisselvallig</strong>: soms een gaspedaal, soms een rem. De sleutel is bewustzijn over wanneer welke modus actief is.";

  const energieKleur = energieProfiel === "hoog" ? "#2ecc71" : energieProfiel === "midden" ? "#f39c12" : "#e74c3c";
  const energieLabel = energieProfiel === "hoog" ? "Hoog" : energieProfiel === "midden" ? "Midden" : "Laag";

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>T4Sports Mental Talent Profiel — ${naam}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8f9fa; color: #1a1a2e; }
    .cover { background: linear-gradient(135deg, #0D1B3E 0%, #162852 60%, #1a3a6e 100%); color: white; padding: 60px 40px 50px; }
    .cover-logo { color: #C9A84C; font-size: 1.1rem; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 40px; }
    .cover-title { font-size: 2.2rem; font-weight: 800; color: #C9A84C; margin-bottom: 8px; }
    .cover-subtitle { font-size: 1.1rem; color: #8aa8d0; margin-bottom: 32px; }
    .cover-meta { border-top: 1px solid #C9A84C44; padding-top: 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .cover-meta-item { }
    .cover-meta-label { color: #8aa8d0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; }
    .cover-meta-value { color: white; font-size: 0.95rem; font-weight: 600; margin-top: 2px; }
    .content { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
    .section { background: white; border-radius: 12px; padding: 32px; margin-bottom: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .section-number { background: #0D1B3E; color: #C9A84C; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; flex-shrink: 0; }
    .section-title { color: #0D1B3E; font-size: 1.25rem; font-weight: 700; }
    .section-subtitle { color: #666; font-size: 0.85rem; margin-top: 2px; }
    .kaart { background: #0D1B3E; border: 1px solid #C9A84C44; border-radius: 10px; padding: 20px 24px; margin-bottom: 14px; }
    .kaart-naam { color: #C9A84C; font-weight: 700; font-size: 1.05rem; margin-bottom: 8px; }
    .kaart-tekst { color: #ccd6e8; font-size: 0.88rem; line-height: 1.6; margin-bottom: 10px; }
    .energie-label { font-size: 0.75rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-top: 6px; }
    .balk-bg { background: #1a2a4a; border-radius: 4px; height: 8px; }
    .highlight-box { background: #f0f4ff; border-left: 4px solid #C9A84C; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 20px; }
    .highlight-box p { color: #0D1B3E; font-size: 0.9rem; line-height: 1.7; }
    .driver-box { background: #0D1B3E; border-radius: 10px; padding: 24px; margin-bottom: 16px; }
    .driver-naam { color: #C9A84C; font-size: 1.2rem; font-weight: 800; margin-bottom: 12px; }
    .driver-positief { color: #7ecfb3; font-size: 0.88rem; line-height: 1.6; margin-bottom: 10px; }
    .driver-risico-label { color: #e8a87c; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .driver-risico { color: #e8d5c4; font-size: 0.88rem; line-height: 1.6; }
    .coachtip-box { background: #1e3a5f; border-radius: 8px; padding: 16px 20px; margin-top: 16px; }
    .coachtip-label { color: #C9A84C; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 6px; }
    .coachtip-tekst { color: #b8d4f0; font-size: 0.88rem; line-height: 1.6; }
    .druk-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; margin-bottom: 14px; }
    .gaspedaal { background: #C9A84C22; color: #C9A84C; border: 1px solid #C9A84C; }
    .rem { background: #e74c3c22; color: #e74c3c; border: 1px solid #e74c3c; }
    .wisselvallig { background: #88888822; color: #888; border: 1px solid #888; }
    .profiel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
    .profiel-kaart { background: #0D1B3E; border-radius: 10px; padding: 16px; text-align: center; }
    .profiel-kaart-label { color: #8aa8d0; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .profiel-kaart-waarde { color: #C9A84C; font-weight: 700; font-size: 0.95rem; }
    .energie-score { text-align: center; margin-bottom: 20px; }
    .energie-cirkel { display: inline-flex; width: 80px; height: 80px; border-radius: 50%; border: 4px solid ${energieKleur}; align-items: center; justify-content: center; flex-direction: column; }
    .energie-getal { color: ${energieKleur}; font-size: 1.5rem; font-weight: 800; }
    .energie-max { color: #888; font-size: 0.7rem; }
    .conn-section { margin-top: 8px; }
    .disclaimer { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; font-size: 0.78rem; color: #888; line-height: 1.6; margin-top: 24px; }
    @media print {
      body { background: white; }
      .content { padding: 20px; }
      .section { box-shadow: none; border: 1px solid #e0e0e0; }
    }
  </style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-logo">T4Sports · Mental Talent Profiel</div>
  <div class="cover-title">${naam}</div>
  <div class="cover-subtitle">Persoonlijk mental talent profiel voor atleten</div>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <div class="cover-meta-label">Sporttak</div>
      <div class="cover-meta-value">${sporttak || "—"}</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Club / Ploeg</div>
      <div class="cover-meta-value">${ploeg || "—"}</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Positie / Rol</div>
      <div class="cover-meta-value">${rol || "—"}</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Datum</div>
      <div class="cover-meta-value">${datum}</div>
    </div>
  </div>
</div>

<div class="content">

  <!-- ENERGIEPROFIEL SAMENVATTING -->
  <div class="section" style="background:#0D1B3E;color:white;">
    <div class="section-header">
      <div class="section-number" style="background:#C9A84C;color:#0D1B3E;">★</div>
      <div>
        <div class="section-title" style="color:#C9A84C;">Jouw Sportprofiel in één oogopslag</div>
        <div class="section-subtitle" style="color:#8aa8d0;">Drie assen van jouw mental talent</div>
      </div>
    </div>
    <div class="profiel-grid">
      <div class="profiel-kaart">
        <div class="profiel-kaart-label">Dominante Focus</div>
        <div class="profiel-kaart-waarde">${escHtml(sportprofiel.dominanteFocus ?? "—")}</div>
      </div>
      <div class="profiel-kaart">
        <div class="profiel-kaart-label">Dominante Versneller</div>
        <div class="profiel-kaart-waarde">${escHtml(sportprofiel.dominanteVersneller ?? "—")}</div>
      </div>
      <div class="profiel-kaart">
        <div class="profiel-kaart-label">Dominant Driver</div>
        <div class="profiel-kaart-waarde">${escHtml(dominanteDriver)}</div>
      </div>
    </div>
    <div style="display:flex;gap:24px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:8px;">
      <div class="energie-score">
        <div class="energie-cirkel">
          <div class="energie-getal">${normEnergy.toFixed(1)}</div>
          <div class="energie-max">/10</div>
        </div>
        <div style="color:#8aa8d0;font-size:0.75rem;margin-top:6px;">Mentale energie (lijst)</div>
      </div>
      <div class="energie-score">
        <div class="energie-cirkel" style="border-color:#8aa8d0;">
          <div class="energie-getal" style="color:#8aa8d0;">${baselineEnergy.toFixed(1)}</div>
          <div class="energie-max">/10</div>
        </div>
        <div style="color:#8aa8d0;font-size:0.75rem;margin-top:6px;">Baseline energie (zelf)</div>
      </div>
      <div class="energie-score">
        <div style="background:#1a2a4a;border-radius:10px;padding:16px 20px;text-align:center;">
          <div style="color:#aaa;font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Consistentie</div>
          <div style="color:#C9A84C;font-size:1.5rem;font-weight:800;">${consistency.score ?? "—"}</div>
          <div style="color:#aaa;font-size:0.7rem;">/100</div>
        </div>
      </div>
    </div>
  </div>

  <!-- BLOK 1: TALENTPROFIEL — DE MOTOR -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">1</div>
      <div>
        <div class="section-title">Je Talentprofiel — De Motor</div>
        <div class="section-subtitle">Jouw top-3 talent-foci: hier zit jouw echte drijfveer als atleet</div>
      </div>
    </div>
    ${topFoci.map((row) => {
      const naam2 = sportNaam(row.construct);
      const beschr = SPORT_BESCHRIJVING[row.construct] ?? "";
      const energie = row.avgEnergy;
      const pct = Math.round(((energie + 2) / 4) * 100);
      const color = energie >= 0.5 ? "#C9A84C" : energie >= -0.5 ? "#888" : "#e74c3c";
      return `<div class="kaart">
        <div class="kaart-naam">${escHtml(naam2)} <span style="color:#aaa;font-size:0.8rem;font-weight:400;">(${escHtml(row.construct)})</span></div>
        <div class="kaart-tekst">${escHtml(beschr)}</div>
        <div class="energie-label">Energielading</div>
        <div class="balk-bg"><div style="background:${color};border-radius:4px;height:8px;width:${pct}%;"></div></div>
        <div style="color:#aaa;font-size:0.75rem;margin-top:3px;">${energie > 0 ? "+" : ""}${energie.toFixed(1)} · ${row.most}× gekozen (${row.shown} getoond)</div>
      </div>`;
    }).join("")}
    ${topFoci.length === 0 ? "<p style='color:#888;'>Geen data beschikbaar.</p>" : ""}
  </div>

  <!-- BLOK 2: VERSNELLERSPROFIEL — DE VERSNELLINGSBAK -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">2</div>
      <div>
        <div class="section-title">Je Versnellersprofiel — De Versnellingsbak</div>
        <div class="section-subtitle">Jouw top-3 talent-versnellers: zo zet je jouw talent om in resultaat</div>
      </div>
    </div>
    ${topVersnellers.map((row) => {
      const naam2 = sportNaam(row.construct);
      const beschr = VERSNELLER_BESCHRIJVING[row.construct] ?? "";
      const energie = row.avgEnergy;
      const pct = Math.round(((energie + 2) / 4) * 100);
      const color = energie >= 0.5 ? "#C9A84C" : energie >= -0.5 ? "#888" : "#e74c3c";
      return `<div class="kaart">
        <div class="kaart-naam">${escHtml(naam2)} <span style="color:#aaa;font-size:0.8rem;font-weight:400;">(${escHtml(row.construct)})</span></div>
        <div class="kaart-tekst">${escHtml(beschr)}</div>
        <div class="energie-label">Energielading</div>
        <div class="balk-bg"><div style="background:${color};border-radius:4px;height:8px;width:${pct}%;"></div></div>
        <div style="color:#aaa;font-size:0.75rem;margin-top:3px;">${energie > 0 ? "+" : ""}${energie.toFixed(1)} · ${row.most}× gekozen</div>
      </div>`;
    }).join("")}
    ${topVersnellers.length === 0 ? "<p style='color:#888;'>Geen data beschikbaar.</p>" : ""}
  </div>

  <!-- BLOK 3: DRIVERPROFIEL — DE STUURKRACHT -->
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
    ${driverInfo ? `<div class="driver-box">
      <div class="driver-naam">${escHtml(dominanteDriver)}</div>
      <div class="driver-positief">${escHtml(driverInfo.positief)}</div>
      <div class="driver-risico-label">Let op:</div>
      <div class="driver-risico">${escHtml(driverInfo.risico)}</div>
    </div>` : `<div class="driver-box"><div class="driver-naam">${escHtml(dominanteDriver)}</div></div>`}
    ${(() => {
      const driverRows = rows.filter((r) => r.family === "Drivers").sort((a, b) => b.net - a.net);
      return driverRows.map((row) => {
        const energie = row.avgEnergy;
        const pct = Math.round(((energie + 2) / 4) * 100);
        const color = energie >= 0.5 ? "#C9A84C" : energie >= -0.5 ? "#888" : "#e74c3c";
        return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="min-width:130px;font-size:0.85rem;font-weight:600;">${escHtml(row.construct)}</span>
          <div style="flex:1;background:#f0f0f0;border-radius:4px;height:8px;">
            <div style="background:${color};border-radius:4px;height:8px;width:${pct}%;"></div>
          </div>
          <span style="min-width:50px;font-size:0.8rem;color:#666;">${energie > 0 ? "+" : ""}${energie.toFixed(1)}</span>
        </div>`;
      }).join("");
    })()}
  </div>

  <!-- BLOK 4: DRUKPROFIEL -->
  <div class="section">
    <div class="section-header">
      <div class="section-number">4</div>
      <div>
        <div class="section-title">Jouw Drukprofiel</div>
        <div class="section-subtitle">Wat er gebeurt in het kritische moment</div>
      </div>
    </div>
    <div class="druk-badge ${drukProfiel}">${drukProfiel === "gaspedaal" ? "⚡ Gaspedaal" : drukProfiel === "rem" ? "⛔ Rem" : "⚖ Wisselvallig"}</div>
    <div class="highlight-box">
      <p>${drukUitleg}</p>
    </div>
    <div class="conn-section">
      <h4 style="color:#0D1B3E;font-size:0.9rem;font-weight:700;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">Sportverbondenheid</h4>
      ${connBalk(sportpassie, "Sportpassie — verbinding vanuit echte passie")}
      ${connBalk(billijkheid, "Billijkheid — eerlijk behandeld door trainer & club")}
      ${connBalk(mentaleZelfinv, "Mentale zelfinvestering — buiten de fysieke training")}
      ${connBalk(clubInv, "Club-investering in jou als persoon")}
    </div>
  </div>

  <!-- BLOK 5: COACHING-AANWIJZINGEN -->
  <div class="section" style="background:#fff9ec;border:2px solid #C9A84C44;">
    <div class="section-header">
      <div class="section-number" style="background:#C9A84C;color:#0D1B3E;">5</div>
      <div>
        <div class="section-title" style="color:#0D1B3E;">Coaching-aanwijzingen</div>
        <div class="section-subtitle" style="color:#C9A84C;font-weight:600;">VOOR DE COACH — Niet bedoeld voor directe communicatie aan de atleet</div>
      </div>
    </div>
    ${driverInfo ? `<div class="coachtip-box" style="background:#fff3d6;border:1px solid #C9A84C88;">
      <div class="coachtip-label" style="color:#8a6000;">Coach-tip — ${escHtml(dominanteDriver)}</div>
      <div class="coachtip-tekst" style="color:#5a4000;">${escHtml(driverInfo.coachtip)}</div>
    </div>` : ""}
    <div style="margin-top:16px;">
      <h4 style="color:#0D1B3E;font-size:0.88rem;font-weight:700;margin-bottom:12px;">Focuspunten voor het coaching-gesprek:</h4>
      <ul style="color:#444;font-size:0.88rem;line-height:2;padding-left:20px;">
        <li>Bespreek het verschil tussen de energiebalans in de vragenlijst (${normEnergy.toFixed(1)}/10) en de zelf-ingeschatte baseline (${baselineEnergy.toFixed(1)}/10)</li>
        <li>De dominante talent-focus is "${escHtml(sportprofiel.dominanteFocus ?? "—")}" — benoem specifiek hoe dit zichtbaar is in het gedrag</li>
        <li>Het drukprofiel is "${drukProfiel}" — bespreek concrete situaties waarin dit de prestatie beïnvloedde</li>
        <li>Consistentiescore: ${consistency.score ?? "—"}/100 — ${(consistency.score ?? 0) >= 80 ? "hoge betrouwbaarheid" : (consistency.score ?? 0) >= 60 ? "gemiddelde betrouwbaarheid" : "lage betrouwbaarheid — toets bevindingen in gesprek"}</li>
        <li>Sportpassie: ${sportpassie}/10 — ${sportpassie < 6 ? "aandacht vereist: onderzoek of de motivatie nog intrinsiek is" : "gezonde verbinding met de sport"}</li>
      </ul>
    </div>
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> Dit rapport is geen diagnose, selectie-advies of psychologische beoordeling. Het is een reflectie-instrument op basis van zelfrapportage. Geen enkele uitkomst impliceert een oordeel over de kwaliteit of het potentieel van de atleet. Gebruik dit rapport enkel in een vertrouwelijk coaching-kader. T4Sports — Mental Talent Profiel, versie 1.0.0. Gegenereerd op ${datum}.
  </div>

</div>
</body>
</html>`;
}
