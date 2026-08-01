// server/t4sports/rapport-hoofdstukken.ts
// Diepgang-hoofdstukken voor het volledige T4Sports-rapport.
// Gebruikt DEZELFDE CSS-klassen als rapport-compleet.ts (.section, .kaart, .highlight-box, ...)
// zodat er één coherent design-systeem blijft. Volledig data-gedreven — geen hardcoded atleetdata.
//
// Deze module levert de analytische diepgang die de gouden standaard
// (francois-crahay-v3-FROZEN.html) had maar die in de magere generator ontbrak:
//   - Datakwaliteit & leeswijzer (dubbel-lezen)
//   - Mentale energiestaat
//   - Bronstellingen (de daadwerkelijk gekozen items per top-construct)
//   - Drieledige talentdynamiek
//   - Sportcontext & prestatiefit
//   - Risico's & waakpunten
//   - Toekomstgerichte synthese
//   - H16 Geïntegreerde profielanalyse (As-is / Aanhaakpunten / Breekpunten / Perspectief)
//   - H17 Integraal coachingsplan (Fase 0–3 + Toolbox)
//   - Wetenschappelijke grondslagen (met DOI's)

import { sportNaam } from "./scoring";
import type { ConstructRow } from "./scoring";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function num(x: unknown, fallback = 0): number {
  return typeof x === "number" && isFinite(x) ? x : fallback;
}

function energiePct(energie: number): number {
  const pct = Math.round(((energie + 2) / 4) * 100);
  return Math.min(100, Math.max(0, pct));
}

function energieKleur(energie: number): string {
  return energie >= 0.5 ? "#2ecc71" : energie >= -0.5 ? "#C9A84C" : "#e74c3c";
}

function energieWoord(energie: number): string {
  return energie >= 0.5 ? "geeft energie" : energie >= -0.5 ? "neutraal" : "kost energie";
}

export interface ChapterData {
  naam: string;
  sporttak: string;
  niveauLabel: string;
  sportTypeLabel: string;
  ambitieLabel: string;
  rows: ConstructRow[];
  sportprofiel: any;
  consistency: any;
  normEnergy: number;
  baselineEnergy: number;
  energieProfiel: string;
  drukProfiel: string;
  dominanteDriver: string;
  driverInfo: { positief: string; risico: string; coachtip: string } | undefined;
  sportpassie: number;
  billijkheid: number;
  mentaleZelfinv: number;
  clubInv: number;
  hasModules: boolean;
}

// ── H01 · Leeswijzer & datakwaliteit ────────────────────────────────────────
export function hoofdstukDatakwaliteit(d: ChapterData): string {
  const energieDelta = d.normEnergy - d.baselineEnergy;
  const consistLabel = d.consistency?.label ?? "—";
  const consistScore = num(d.consistency?.score, 0);
  const consistDuiding =
    consistScore >= 80 ? "hoge consistentie, de bevindingen mogen stevig worden gelezen"
    : consistScore >= 60 ? "gemiddelde consistentie, toets de kernbevindingen in gesprek"
    : "beperkte consistentie, gebruik dit rapport uitsluitend als gespreksopener";
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">i</div>
      <div>
        <div class="section-title">Leeswijzer &amp; datakwaliteit</div>
        <div class="section-subtitle">Hoe je dit rapport op twee niveaus leest</div>
      </div>
    </div>
    <div class="highlight-box">
      <p><strong>Elk hoofdstuk werkt op twee niveaus.</strong> De <strong>nettoscore</strong> toont het potentieel — hoe vaak een talent gekozen werd. De <strong>energielaag</strong> toont de beschikbaarheid vandaag: of die lijn energie geeft, neutraal is of energie kost. Een hoge nettoscore betekent dus niet automatisch dat een talent vandaag vrij beschikbaar is. Dat dubbele lezen is de kern van een verantwoorde T4Sports-interpretatie.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px;">
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:16px;">
        <div style="color:#888;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Energie in de lijst</div>
        <div style="color:#0D1B3E;font-size:1.6rem;font-weight:800;">${d.normEnergy.toFixed(1)}<span style="font-size:0.9rem;color:#aaa;">/10</span></div>
      </div>
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:16px;">
        <div style="color:#888;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Baseline vooraf</div>
        <div style="color:#0D1B3E;font-size:1.6rem;font-weight:800;">${d.baselineEnergy.toFixed(1)}<span style="font-size:0.9rem;color:#aaa;">/10</span></div>
      </div>
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:16px;">
        <div style="color:#888;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Consistentie</div>
        <div style="color:#0D1B3E;font-size:1.6rem;font-weight:800;">${consistScore}<span style="font-size:0.9rem;color:#aaa;">/100</span></div>
      </div>
    </div>
    <div style="border-left:4px solid #C9A84C;background:#f8f9fc;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:12px;">
      <div style="color:#8a6000;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Datakwaliteit</div>
      <p style="color:#444;font-size:0.88rem;line-height:1.7;">De consistentie van deze afname is <strong>${esc(consistLabel)}</strong> (${consistScore}/100): ${consistDuiding}. Deze score zegt hoe volledig er is ingevuld en hoe goed de energieantwoorden onderling uitgelijnd zijn; het is geen psychometrische betrouwbaarheidsmaat.</p>
    </div>
    <div style="border-left:4px solid ${energieDelta <= -1.5 ? "#e74c3c" : "#2ecc71"};background:#f8f9fc;border-radius:0 8px 8px 0;padding:14px 18px;">
      <div style="color:#555;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Energie-signaal</div>
      <p style="color:#444;font-size:0.88rem;line-height:1.7;">${
        Math.abs(energieDelta) < 1
          ? "De energie tijdens het invullen komt overeen met de baseline vooraf. Dit wijst op een stabiele momentopname."
          : energieDelta < 0
          ? `De energie tijdens het invullen (${d.normEnergy.toFixed(1)}) lag <strong>lager</strong> dan de baseline vooraf (${d.baselineEnergy.toFixed(1)}). Bespreek of er een situationele belasting speelde.`
          : `De energie tijdens het invullen (${d.normEnergy.toFixed(1)}) lag <strong>hoger</strong> dan de baseline vooraf (${d.baselineEnergy.toFixed(1)}). De atleet kwam gaandeweg meer in beweging.`
      }</p>
    </div>
  </div>`;
}

// ── H02 · Mentale energiestaat ──────────────────────────────────────────────
export function hoofdstukEnergiestaat(d: ChapterData): string {
  const geeft = d.rows.filter((r) => r.avgEnergy >= 0.5).length;
  const neutraal = d.rows.filter((r) => r.avgEnergy > -0.5 && r.avgEnergy < 0.5).length;
  const kost = d.rows.filter((r) => r.avgEnergy <= -0.5).length;
  const totaal = Math.max(1, geeft + neutraal + kost);
  const kleurLabel = d.energieProfiel === "hoog" ? "#2ecc71" : d.energieProfiel === "midden" ? "#C9A84C" : "#e74c3c";
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">E</div>
      <div>
        <div class="section-title">Mentale energiestaat</div>
        <div class="section-subtitle">De beschikbaarheid van talent vandaag — niet het potentieel</div>
      </div>
    </div>
    <div class="highlight-box">
      <p>Energie is de <strong>tweede leeslaag</strong> van dit rapport. Ze vertelt niet <em>wat</em> je kan, maar of dat talent vandaag <strong>vrij beschikbaar</strong> is. Hieronder de verdeling over alle gemeten lijnen.</p>
    </div>
    <div style="display:flex;gap:20px;align-items:center;margin-bottom:20px;flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="width:96px;height:96px;border-radius:50%;border:5px solid ${kleurLabel};display:inline-flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="color:${kleurLabel};font-size:1.8rem;font-weight:900;">${d.normEnergy.toFixed(1)}</div>
          <div style="color:#aaa;font-size:0.68rem;">/10</div>
        </div>
        <div style="color:#888;font-size:0.72rem;margin-top:6px;text-transform:uppercase;letter-spacing:1px;">Energieprofiel: ${esc(d.energieProfiel)}</div>
      </div>
      <div style="flex:1;min-width:240px;">
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:0.85rem;color:#333;">Geeft energie</span><span style="font-size:0.8rem;font-weight:700;color:#2ecc71;">${geeft} lijnen</span></div>
          <div style="background:#eee;border-radius:4px;height:8px;"><div style="background:#2ecc71;border-radius:4px;height:8px;width:${Math.round((geeft / totaal) * 100)}%;"></div></div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:0.85rem;color:#333;">Neutraal</span><span style="font-size:0.8rem;font-weight:700;color:#C9A84C;">${neutraal} lijnen</span></div>
          <div style="background:#eee;border-radius:4px;height:8px;"><div style="background:#C9A84C;border-radius:4px;height:8px;width:${Math.round((neutraal / totaal) * 100)}%;"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:0.85rem;color:#333;">Kost energie</span><span style="font-size:0.8rem;font-weight:700;color:#e74c3c;">${kost} lijnen</span></div>
          <div style="background:#eee;border-radius:4px;height:8px;"><div style="background:#e74c3c;border-radius:4px;height:8px;width:${Math.round((kost / totaal) * 100)}%;"></div></div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── H06–H08 · Bronstellingen (data-gedreven uit mostItems) ──────────────────
function bronstellingenBlok(rows: ConstructRow[], family: string, titel: string, sectionLabel: string): string {
  const top = rows.filter((r) => r.family === family).sort((a, b) => b.net - a.net).slice(0, 3);
  const kaarten = top.map((row) => {
    const items = (row.mostItems ?? []).filter(Boolean);
    const lijst = items.length
      ? `<ul style="padding-left:18px;margin:8px 0 0;">${items.map((t) => `<li style="color:#444;font-size:0.86rem;line-height:1.6;margin-bottom:5px;">${esc(t)}</li>`).join("")}</ul>`
      : `<p style="color:#999;font-size:0.82rem;font-style:italic;margin-top:6px;">Geen specifieke bronstellingen gekozen voor deze lijn.</p>`;
    const kleur = energieKleur(row.avgEnergy);
    return `<div style="border:1px solid #e0e0e8;border-radius:10px;padding:16px 18px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
        <span style="color:#0D1B3E;font-size:0.98rem;font-weight:800;">${esc(sportNaam(row.construct))}</span>
        <span style="font-size:0.72rem;font-weight:700;padding:2px 10px;border-radius:12px;background:${kleur}22;color:${kleur};border:1px solid ${kleur}55;">${energieWoord(row.avgEnergy)}</span>
      </div>
      <div style="color:#888;font-size:0.76rem;">Netto +${row.net} · ${row.most}× gekozen (${row.shown} getoond) · energie ${row.avgEnergy > 0 ? "+" : ""}${row.avgEnergy.toFixed(1)}</div>
      <div style="color:#555;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:10px;">Herkende bronstellingen</div>
      ${lijst}
    </div>`;
  }).join("");
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">✎</div>
      <div>
        <div class="section-title">${esc(titel)}</div>
        <div class="section-subtitle">${esc(sectionLabel)} — de concrete uitspraken die de atleet als 'meest herkenbaar' koos</div>
      </div>
    </div>
    ${kaarten || "<p style='color:#888;'>Geen data beschikbaar.</p>"}
  </div>`;
}

export function hoofdstukBronstellingen(d: ChapterData): string {
  return [
    bronstellingenBlok(d.rows, "Talent-foci", "Bronstellingen — Talent-Toegang", "De Motor"),
    bronstellingenBlok(d.rows, "Talent-versnellers", "Bronstellingen — Talent-Route", "De Versnellingsbak"),
    bronstellingenBlok(d.rows, "Drivers", "Bronstellingen — Drivers", "De Stuurkracht"),
  ].join("\n");
}

// ── H09 · Drieledige talentdynamiek ─────────────────────────────────────────
export function hoofdstukTalentdynamiek(d: ChapterData): string {
  const focus = d.sportprofiel?.dominanteFocus ?? "—";
  const versneller = d.sportprofiel?.dominanteVersneller ?? "—";
  const driver = d.dominanteDriver ?? "—";
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">∆</div>
      <div>
        <div class="section-title">Drieledige talentdynamiek</div>
        <div class="section-subtitle">Hoe Motor, Versnellingsbak en Stuurkracht op elkaar inwerken</div>
      </div>
    </div>
    <div class="highlight-box">
      <p>Talent werkt niet in losse lijnen maar als een <strong>systeem</strong>. De <strong>Motor</strong> (waar je energie vandaan komt), de <strong>Versnellingsbak</strong> (hoe je dat omzet in resultaat) en de <strong>Stuurkracht</strong> (welke driver je onder druk stuurt) versterken of remmen elkaar.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
      <div style="background:#0D1B3E;border-radius:10px;padding:16px;text-align:center;">
        <div style="color:#8aa8d0;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Motor</div>
        <div style="color:#C9A84C;font-weight:800;font-size:0.9rem;">${esc(focus)}</div>
      </div>
      <div style="background:#0D1B3E;border-radius:10px;padding:16px;text-align:center;">
        <div style="color:#8aa8d0;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Versnellingsbak</div>
        <div style="color:#C9A84C;font-weight:800;font-size:0.9rem;">${esc(versneller)}</div>
      </div>
      <div style="background:#0D1B3E;border-radius:10px;padding:16px;text-align:center;">
        <div style="color:#8aa8d0;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Stuurkracht</div>
        <div style="color:#C9A84C;font-weight:800;font-size:0.9rem;">${esc(driver)}</div>
      </div>
    </div>
    <div style="border-left:4px solid #C9A84C;background:#f8f9fc;border-radius:0 8px 8px 0;padding:16px 20px;">
      <p style="color:#444;font-size:0.88rem;line-height:1.7;">De combinatie <strong>${esc(focus)}</strong> × <strong>${esc(versneller)}</strong> bepaalt hoe deze atleet talent tot prestatie brengt. De driver <strong>${esc(driver)}</strong> is de scharnier: onder druk kleurt die de hele dynamiek. ${
        d.drukProfiel === "rem"
          ? "Nu werkt de driver als <strong>rem</strong> — de dynamiek verliest energie in kritieke momenten."
          : d.drukProfiel === "gaspedaal"
          ? "Nu werkt de driver als <strong>gaspedaal</strong> — de dynamiek versnelt in kritieke momenten."
          : "Nu werkt de driver <strong>wisselvallig</strong> — soms versnellend, soms remmend."
      }</p>
    </div>
  </div>`;
}

// ── H12 · Sportcontext & prestatiefit ───────────────────────────────────────
export function hoofdstukSportcontext(d: ChapterData): string {
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">◎</div>
      <div>
        <div class="section-title">Sportcontext &amp; prestatiefit</div>
        <div class="section-subtitle">Past het talentprofiel bij sporttak, niveau en ambitie?</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:18px;">
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:14px 16px;"><div style="color:#888;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Sporttak</div><div style="color:#0D1B3E;font-weight:700;font-size:0.9rem;">${esc(d.sporttak || "—")}</div></div>
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:14px 16px;"><div style="color:#888;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Type</div><div style="color:#0D1B3E;font-weight:700;font-size:0.9rem;">${esc(d.sportTypeLabel || "—")}</div></div>
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:14px 16px;"><div style="color:#888;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Niveau</div><div style="color:#0D1B3E;font-weight:700;font-size:0.9rem;">${esc(d.niveauLabel || "—")}</div></div>
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:14px 16px;"><div style="color:#888;font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Ambitie</div><div style="color:#0D1B3E;font-weight:700;font-size:0.9rem;">${esc(d.ambitieLabel || "—")}</div></div>
    </div>
    <div style="border-left:4px solid #C9A84C;background:#f8f9fc;border-radius:0 8px 8px 0;padding:16px 20px;">
      <p style="color:#444;font-size:0.88rem;line-height:1.7;">Bij een <strong>${esc(d.sportTypeLabel || "onbekend")}</strong> profiel op <strong>${esc(d.niveauLabel || "onbekend")}</strong> niveau vraagt de ambitie "${esc(d.ambitieLabel || "—")}" om een gerichte inzet van de dominante focus (${esc(d.sportprofiel?.dominanteFocus ?? "—")}). ${
        d.sportpassie < 6
          ? "De relatief lage sportpassie vraagt eerst aandacht: onderzoek of de ambitie nog intrinsiek gedragen is."
          : "De sportpassie is voldoende sterk om deze ambitie te dragen."
      }</p>
    </div>
  </div>`;
}

// ── H13 · Risico's & waakpunten (data-gedreven) ─────────────────────────────
export function hoofdstukRisicos(d: ChapterData): string {
  const kostLijnen = d.rows.filter((r) => r.avgEnergy <= -0.5).sort((a, b) => a.avgEnergy - b.avgEnergy).slice(0, 4);
  const driverRisk = d.driverInfo?.risico;
  const items: string[] = [];
  if (d.energieProfiel === "laag") items.push("Het algehele energieprofiel is <strong>laag</strong> — talent is aanwezig maar vandaag beperkt beschikbaar. Bewaak overbelasting.");
  if (num(d.consistency?.score, 100) < 60) items.push("De consistentiescore is beperkt — lees de bevindingen als hypothese, niet als conclusie.");
  if (driverRisk) items.push(`Driver <strong>${esc(d.dominanteDriver)}</strong>: ${esc(driverRisk)}`);
  if (d.sportpassie < 6) items.push("De sportpassie ligt onder de gezonde drempel — mogelijk motivatie-erosie.");
  if (d.drukProfiel === "rem") items.push("Het drukprofiel staat op <strong>rem</strong>: in kritieke momenten kost de dominante driver energie.");
  const kostKaarten = kostLijnen.map((row) => `
    <div style="border-left:5px solid #e74c3c;background:#fff5f5;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:10px;">
      <div style="color:#8b0000;font-weight:800;font-size:0.9rem;">${esc(sportNaam(row.construct))}</div>
      <div style="color:#555;font-size:0.82rem;">Kost energie (${row.avgEnergy.toFixed(1)}) terwijl de lijn ${row.most}× gekozen werd — mogelijk innerlijk conflict tussen willen en kunnen.</div>
    </div>`).join("");
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">!</div>
      <div>
        <div class="section-title">Risico's &amp; waakpunten</div>
        <div class="section-subtitle">Signalen die in de coaching bewaakt moeten worden</div>
      </div>
    </div>
    ${items.length ? `<ul style="padding-left:20px;margin-bottom:18px;">${items.map((t) => `<li style="color:#444;font-size:0.88rem;line-height:1.9;">${t}</li>`).join("")}</ul>` : `<div class="highlight-box"><p>Geen verhoogde risicosignalen gedetecteerd in deze afname. Blijf de energiebalans monitoren.</p></div>`}
    ${kostKaarten ? `<div style="color:#555;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:6px 0 10px;">Lijnen die energie kosten</div>${kostKaarten}` : ""}
  </div>`;
}

// ── H14 · Toekomstgerichte synthese ─────────────────────────────────────────
export function hoofdstukToekomst(d: ChapterData): string {
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">→</div>
      <div>
        <div class="section-title">Toekomstgerichte synthese</div>
        <div class="section-subtitle">Waar ligt de groeirichting voor deze atleet?</div>
      </div>
    </div>
    <div style="background:#0D1B3E;border-radius:12px;padding:24px 28px;margin-bottom:16px;">
      <div style="color:#C9A84C;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">Kernlijn</div>
      <p style="color:#ccd6e8;font-size:0.92rem;line-height:1.75;">Deze atleet bouwt op de motor <strong style="color:#fff;">${esc(d.sportprofiel?.dominanteFocus ?? "—")}</strong>, aangedreven via <strong style="color:#fff;">${esc(d.sportprofiel?.dominanteVersneller ?? "—")}</strong>. De grootste hefboom ligt in het ${
        d.drukProfiel === "rem" ? "ontladen van de driver-rem, zodat talent ook onder druk beschikbaar blijft" : d.drukProfiel === "gaspedaal" ? "bewust doseren van het gaspedaal, zodat energie niet te vroeg piekt" : "stabiliseren van het wisselvallige drukprofiel"}.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:14px 16px;"><div style="color:#2ecc71;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Benutten</div><div style="color:#444;font-size:0.83rem;line-height:1.5;">Zet ${esc(d.sportprofiel?.dominanteFocus ?? "de dominante focus")} centraal in trainingsopzet.</div></div>
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:14px 16px;"><div style="color:#C9A84C;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Ontwikkelen</div><div style="color:#444;font-size:0.83rem;line-height:1.5;">Versterk de energie op lijnen die nu neutraal scoren.</div></div>
      <div style="border:1px solid #e0e0e8;border-radius:10px;padding:14px 16px;"><div style="color:#e74c3c;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Bewaken</div><div style="color:#444;font-size:0.83rem;line-height:1.5;">Houd de driver ${esc(d.dominanteDriver)} in de gaten onder druk.</div></div>
    </div>
  </div>`;
}

// ── H16 · Geïntegreerde profielanalyse ──────────────────────────────────────
export function hoofdstukIntegratieAnalyse(d: ChapterData): string {
  const kostLijnen = d.rows.filter((r) => r.avgEnergy <= -0.5).sort((a, b) => a.avgEnergy - b.avgEnergy).slice(0, 3);
  const geeftLijnen = d.rows.filter((r) => r.avgEnergy >= 0.5).sort((a, b) => b.avgEnergy - a.avgEnergy).slice(0, 3);
  return `
  <div class="section" style="background:#0D1B3E;color:white;">
    <div class="section-header">
      <div class="section-number" style="background:#C9A84C;color:#0D1B3E;">16</div>
      <div>
        <div class="section-title" style="color:#C9A84C;">Geïntegreerde Profielanalyse</div>
        <div class="section-subtitle" style="color:#8aa8d0;">As-is · Aanhaakpunten · Breekpunten · Perspectief</div>
      </div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="color:#C9A84C;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">A · As-is situatie</div>
      <p style="color:#ccd6e8;font-size:0.9rem;line-height:1.75;">Energieprofiel <strong style="color:#fff;">${esc(d.energieProfiel)}</strong> (${d.normEnergy.toFixed(1)}/10), drukprofiel <strong style="color:#fff;">${esc(d.drukProfiel)}</strong>, dominante driver <strong style="color:#fff;">${esc(d.dominanteDriver)}</strong>. Dit is het vertrekpunt van de begeleiding.</p>
    </div>
    <div style="margin-bottom:16px;">
      <div style="color:#2ecc71;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">B · Aanhaakpunten</div>
      ${geeftLijnen.length ? geeftLijnen.map((r) => `<div style="border-left:5px solid #2ecc71;background:#12351f;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px;"><span style="color:#fff;font-weight:700;font-size:0.88rem;">${esc(sportNaam(r.construct))}</span> <span style="color:#9fd8b4;font-size:0.8rem;">— geeft energie (${r.avgEnergy > 0 ? "+" : ""}${r.avgEnergy.toFixed(1)}), meteen inzetbaar als hefboom.</span></div>`).join("") : `<p style="color:#8aa8d0;font-size:0.85rem;">Geen sterk energie-gevende lijnen — zoek aanhaakpunten in de neutrale zone.</p>`}
    </div>
    <div style="margin-bottom:16px;">
      <div style="color:#e88;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">C · Breekpunten</div>
      ${kostLijnen.length ? kostLijnen.map((r) => `<div style="border-left:5px solid #e74c3c;background:#3a1717;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px;"><span style="color:#fff;font-weight:700;font-size:0.88rem;">${esc(sportNaam(r.construct))}</span> <span style="color:#f0b4b4;font-size:0.8rem;">— kost energie (${r.avgEnergy.toFixed(1)}); hier kan de prestatie breken onder druk.</span></div>`).join("") : `<p style="color:#8aa8d0;font-size:0.85rem;">Geen uitgesproken breekpunten in deze afname.</p>`}
    </div>
    <div>
      <div style="color:#C9A84C;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;">D · Perspectief</div>
      <p style="color:#ccd6e8;font-size:0.9rem;line-height:1.75;">Wanneer de breekpunten worden ontladen en de aanhaakpunten bewust worden ingezet, verschuift het drukprofiel richting een stabieler gaspedaal. Dat is de rode draad voor het coachingsplan hierna.</p>
    </div>
  </div>`;
}

// ── H17 · Integraal coachingsplan (Fase 0–3 + Toolbox) ──────────────────────
export function hoofdstukCoachingsplan(d: ChapterData): string {
  const driverTip = d.driverInfo?.coachtip ?? "Bespreek hoe de dominante driver zich toont onder druk en welk alternatief gedrag ruimte geeft.";
  const fase = (nr: string, timing: string, titel: string, body: string, meetpunt: string) => `
    <div style="margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:16px;background:#0D1B3E;border-radius:10px;padding:16px 22px;margin-bottom:12px;">
        <div style="background:#C9A84C;color:#0D1B3E;font-size:1.2rem;font-weight:900;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${nr}</div>
        <div>
          <div style="color:#C9A84C;font-size:0.68rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;">${esc(timing)}</div>
          <div style="color:#fff;font-size:1.02rem;font-weight:800;">${esc(titel)}</div>
        </div>
      </div>
      <p style="color:#444;font-size:0.88rem;line-height:1.7;margin-bottom:10px;">${body}</p>
      <div style="background:#eaf6f5;border:1px solid #0D6E6A44;border-radius:8px;padding:12px 16px;">
        <div style="color:#0D6E6A;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Meetpunt</div>
        <p style="color:#333;font-size:0.85rem;line-height:1.6;">${esc(meetpunt)}</p>
      </div>
    </div>`;
  return `
  <div class="section" style="background:#fff9ec;border:2px solid #C9A84C44;">
    <div class="section-header">
      <div class="section-number" style="background:#C9A84C;color:#0D1B3E;">17</div>
      <div>
        <div class="section-title">Integraal Coachingsplan</div>
        <div class="section-subtitle" style="color:#C9A84C;font-weight:600;">VOOR DE COACH — gefaseerd traject van direct tot 6 maanden</div>
      </div>
    </div>
    ${fase("0", "Direct", "Vertrouwen & kader", `Open het traject met de energiebalans (lijst ${d.normEnergy.toFixed(1)} vs. baseline ${d.baselineEnergy.toFixed(1)}). Benoem dat dit een spiegel is, geen oordeel. Bespreek de dominante focus <strong>${esc(d.sportprofiel?.dominanteFocus ?? "—")}</strong> als startpunt.`, "De atleet herkent zich in de kernlijn en voelt zich veilig genoeg om de breekpunten te bespreken.")}
    ${fase("1", "Weken 1–4", "Aanhaakpunten activeren", `Bouw trainingsmomenten rond de energie-gevende lijnen. Laat de atleet ervaren dat talent en energie samenvallen. Werk aan de driver <strong>${esc(d.dominanteDriver)}</strong>: ${esc(driverTip)}`, "De atleet kan minstens één situatie beschrijven waarin het aanhaakpunt bewust werd ingezet.")}
    ${fase("2", "Weken 5–12", "Breekpunten ontladen", `Richt de begeleiding op de lijnen die energie kosten. Onderzoek het onderliggende conflict (willen vs. kunnen) en oefen alternatief gedrag onder gecontroleerde druk. ${d.drukProfiel === "rem" ? "Focus expliciet op het lossen van de driver-rem." : ""}`, "Het drukprofiel toont beweging richting neutraal/gaspedaal in trainingssituaties.")}
    ${fase("3", "Maanden 3–6", "Bestendigen & transfer", "Verankeren van de nieuwe patronen in wedstrijdcontext. Herhaal de T4Sports-afname en vergelijk het energieprofiel om groei zichtbaar te maken.", "Een herafname toont een stabieler energieprofiel en/of hogere consistentiescore.")}
    <div style="margin-top:20px;">
      <div style="color:#8a6000;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Toolbox voor de coach</div>
      <div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;"><span style="background:#0D1B3E;color:#C9A84C;font-size:0.72rem;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;">${esc(d.dominanteDriver)}</span><span style="color:#444;font-size:0.86rem;line-height:1.6;">${esc(driverTip)}</span></div>
      <div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;"><span style="background:#0D1B3E;color:#C9A84C;font-size:0.72rem;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;">Energie</span><span style="color:#444;font-size:0.86rem;line-height:1.6;">Laat de atleet vóór en na elke sessie de energie op een 0–10 schaal scoren; gebruik dit als rode draad.</span></div>
      <div style="display:flex;gap:12px;align-items:flex-start;"><span style="background:#0D1B3E;color:#C9A84C;font-size:0.72rem;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;">Verbondenheid</span><span style="color:#444;font-size:0.86rem;line-height:1.6;">Sportpassie ${d.sportpassie}/10 · billijkheid ${d.billijkheid}/10 — bespreek periodiek of de verbinding met de sport gezond blijft.</span></div>
    </div>
  </div>`;
}

// ── Wetenschappelijke grondslagen ───────────────────────────────────────────
export function hoofdstukWetenschap(d: ChapterData): string {
  const bronnen = [
    { naam: "T4Sports talent- & driver-model", detail: "Gebaseerd op het driver-concept van Taibi Kahler (Transactionele Analyse).", doi: "", extra: "Kahler, T. (1974). The Miniscript. Transactional Analysis Journal, 4(1), 26–42." },
    { naam: "ACSI-28 — Athletic Coping Skills Inventory", detail: "Smith, Schutz, Smoll & Ptacek (1995) · α = 0.83–0.91", doi: "10.1123/jsep.17.4.379", extra: "" },
    { naam: "DFS-2 / FSS-2 — Dispositional/State Flow Scale", detail: "Jackson & Eklund (2002) · α = 0.75–0.93 · CFI = 0.97", doi: "10.1123/jsep.24.2.133", extra: "" },
    { naam: "AIMS-7 — Athletic Identity Measurement Scale", detail: "Brewer, Van Raalte & Linder (1993) · α = 0.81 · CFI = 0.97", doi: "", extra: "Brewer, B.W., Van Raalte, J.L., & Linder, D.E. (1993). International Journal of Sport Psychology, 24, 237–254." },
  ];
  const rows = bronnen.map((b) => `
    <div style="border-bottom:1px solid #e8e8ee;padding:12px 0;">
      <div style="color:#0D1B3E;font-weight:700;font-size:0.9rem;">${esc(b.naam)}</div>
      <div style="color:#666;font-size:0.82rem;line-height:1.5;">${esc(b.detail)}${b.extra ? " " + esc(b.extra) : ""}${b.doi ? ` — <a href="https://doi.org/${esc(b.doi)}" style="color:#0D6E6A;">doi: ${esc(b.doi)}</a>` : ""}</div>
    </div>`).join("");
  return `
  <div class="section">
    <div class="section-header">
      <div class="section-number">§</div>
      <div>
        <div class="section-title">Wetenschappelijke grondslagen</div>
        <div class="section-subtitle">Gevalideerde instrumenten achter dit rapport${d.hasModules ? "" : " (modules niet in dit rapport opgenomen)"}</div>
      </div>
    </div>
    ${rows}
    <p style="color:#888;font-size:0.78rem;line-height:1.6;margin-top:14px;">De gevalideerde vragenlijsten worden binnen T4Sports ingezet als <strong>coachingstool</strong>, niet als klinische of diagnostische assessment.</p>
  </div>`;
}
