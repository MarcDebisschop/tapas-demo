import { interpretatie } from "./scoring";
import type { IndividueelResultaat, TeamResultaat, PijlerResultaat, GapItem } from "./scoring";

/**
 * TaPas Teamscan — HTML-rapportgenerator.
 * ------------------------------------------------------------------
 * Genereert het individuele rapport en het teamrapport als zelfstandige
 * HTML-pagina (HTML-eerst; PDF later). De piramide wordt als inline-SVG
 * getekend met labels NAAST de lagen (goedgekeurd ontwerp): échte gladde
 * driehoek, verbindingslijn + niveau-stip + niveau-badge, en een aarde-tint
 * voor de onderste fundamentlaag.
 */

const TEXTC = "#16384a";
const MUTED = "#5b6b73";

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function fmt(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

const niveauLabel: Record<string, string> = interpretatie.niveauLabels;

// --- Piramide-SVG (labels naast de lagen) -----------------------------------

function pyramideSvg(lagen: PijlerResultaat[], breedte = 760): string {
  // lagen aangeleverd van niveau 1 (fundament) .. 6 (resultaten);
  // teken van BOVEN (resultaten) naar ONDER (fundament).
  const vanBoven = [...lagen].sort((a, b) => b.niveau - a.niveau);
  const n = vanBoven.length;

  const W = breedte;
  const H = 460;
  const apexX = 250;
  const apexY = 30;
  const baseY = 410;
  const baseHalf = 210;
  const bandH = (baseY - apexY) / n;
  const labelX = apexX + baseHalf + 30;

  const halfAt = (y: number) => baseHalf * ((y - apexY) / (baseY - apexY));

  let polys = "";
  let labels = "";
  for (let i = 0; i < n; i++) {
    const laag = vanBoven[i];
    const yt = apexY + i * bandH;
    const yb = apexY + (i + 1) * bandH;
    const ht = halfAt(yt);
    const hb = halfAt(yb);
    let pts: string;
    if (i === 0) {
      pts = `${apexX},${yt} ${apexX + hb},${yb} ${apexX - hb},${yb}`;
    } else {
      pts = `${apexX - ht},${yt} ${apexX + ht},${yt} ${apexX + hb},${yb} ${apexX - hb},${yb}`;
    }
    polys += `<polygon points="${pts}" fill="${laag.kleur}" stroke="#ffffff" stroke-width="2.5"/>`;

    const ymid = (yt + yb) / 2;
    const edgeX = apexX + hb;
    labels += `<line x1="${edgeX + 2}" y1="${ymid}" x2="${labelX - 14}" y2="${ymid}" stroke="#cbd3d8" stroke-width="1.2"/>`;
    labels += `<circle cx="${labelX - 8}" cy="${ymid}" r="5" fill="${laag.kleur}" stroke="#ffffff" stroke-width="1.5"/>`;
    labels += `<text x="${labelX + 4}" y="${ymid - 6}" fill="${TEXTC}" font-size="15" font-weight="700">${esc(laag.naam)}</text>`;
    labels += `<text x="${labelX + 4}" y="${ymid + 12}" fill="${MUTED}" font-size="11">gemiddelde ${fmt(laag.gemiddelde)} · ${(niveauLabel[laag.niveauLabel] ?? laag.niveauLabel).toUpperCase()}</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px" role="img" aria-label="Teamscan-piramide">${polys}${labels}</svg>`;
}

// --- Gap-matrix (2x2) -------------------------------------------------------

function gapMatrixHtml(gap: GapItem[]): string {
  const dui = interpretatie.vertrouwensanatomieDuiding.gapMatrix;
  const kleurVan: Record<string, string> = {
    kritiekPijnpunt: "#c0473f",
    bewaken: "#3f8f5b",
    lageprioriteit: "#9c6b3f",
    neutraal: "#5b6b73",
  };
  const rijen = [...gap]
    .sort((a, b) => a.rang - b.rang)
    .map((g) => {
      const cat = dui[g.categorie];
      return `<tr>
        <td style="font-weight:600">${esc(g.naam)}</td>
        <td style="text-align:center">${g.rang}</td>
        <td style="text-align:center">${fmt(g.prestatie)}</td>
        <td><span style="display:inline-block;padding:2px 9px;border-radius:10px;font-size:12px;font-weight:600;color:#fff;background:${kleurVan[g.categorie]}">${esc(cat.label)}</span></td>
      </tr>`;
    })
    .join("");
  return `<table class="gap">
    <thead><tr><th>Vertrouwenselement</th><th>Belang (rang)</th><th>Prestatie</th><th>Duiding</th></tr></thead>
    <tbody>${rijen}</tbody>
  </table>`;
}

// --- Gedeelde stijl ---------------------------------------------------------

function pagina(titel: string, inhoud: string): string {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<style>
  :root { --tekst:${TEXTC}; --muted:${MUTED}; --primary:#16384a; }
  * { box-sizing:border-box; }
  body { font-family:'Source Serif 4', Georgia, serif; color:var(--tekst); margin:0; background:#f7f8f9; line-height:1.55; }
  .wrap { max-width:880px; margin:0 auto; padding:48px 32px 80px; background:#fff; }
  h1 { font-size:30px; margin:0 0 4px; }
  h2 { font-size:21px; margin:38px 0 12px; border-bottom:2px solid #eef1f2; padding-bottom:6px; }
  h3 { font-size:16px; margin:20px 0 6px; }
  .eyebrow { color:var(--muted); font-size:13px; letter-spacing:.04em; text-transform:uppercase; margin-bottom:10px; }
  .disclaimer { background:#f1f5f7; border-left:4px solid #16384a; padding:12px 16px; font-size:13px; color:var(--muted); margin:18px 0; border-radius:0 6px 6px 0; }
  table { width:100%; border-collapse:collapse; margin:12px 0; font-family:system-ui, sans-serif; font-size:14px; }
  th, td { padding:8px 10px; border-bottom:1px solid #eef1f2; text-align:left; }
  th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
  .badge { display:inline-block; padding:2px 10px; border-radius:11px; font-size:12px; font-weight:700; color:#fff; }
  .card { background:#fbfcfc; border:1px solid #eef1f2; border-radius:10px; padding:16px 18px; margin:12px 0; }
  .card h3 { margin-top:0; }
  .pyramide { text-align:center; margin:18px 0; }
  .label-pair { display:flex; gap:24px; flex-wrap:wrap; }
  .label-pair > div { flex:1; min-width:220px; }
  ul { padding-left:20px; }
  .muted { color:var(--muted); }
  footer { margin-top:46px; padding-top:16px; border-top:1px solid #eef1f2; font-size:12px; color:var(--muted); }
</style></head><body><div class="wrap">${inhoud}</div></body></html>`;
}

function profielCard(p: { titel: string; beschrijving: string; watGoed: string; waarBangVoor: string; hoeVerbeteren: string }): string {
  return `<div class="card">
    <h3>${esc(p.titel)}</h3>
    <p>${esc(p.beschrijving)}</p>
    <p><strong>Wat het team goed doet:</strong> ${esc(p.watGoed)}</p>
    <p><strong>Waar het team voor moet waken:</strong> ${esc(p.waarBangVoor)}</p>
    <p><strong>Hoe verbeteren:</strong> ${esc(p.hoeVerbeteren)}</p>
  </div>`;
}

// --- Individueel rapport ----------------------------------------------------

export function renderIndividueelRapport(r: IndividueelResultaat, label: string): string {
  const alleLagen: PijlerResultaat[] = [r.fundament, ...r.pijlers];

  const scoreTabel = alleLagen
    .sort((a, b) => a.niveau - b.niveau)
    .map(
      (l) => `<tr>
        <td><span class="badge" style="background:${l.kleur}">${(niveauLabel[l.niveauLabel] ?? l.niveauLabel).toUpperCase()}</span></td>
        <td style="font-weight:600">${esc(l.naam)}</td>
        <td style="text-align:right">${fmt(l.gemiddelde)}</td>
        <td class="muted" style="font-size:13px">${esc(l.korteUitleg)}</td>
      </tr>`,
    )
    .join("");

  const reflectie = interpretatie.reflectievragen.individueel.map((v: string) => `<li>${esc(v)}</li>`).join("");

  const inhoud = `
    <div class="eyebrow">TaPas Teamscan · Individueel reflectierapport</div>
    <h1>Hoe jij dit team ervaart</h1>
    ${label ? `<p class="muted">${esc(label)}</p>` : ""}
    <div class="disclaimer">${esc(interpretatie.disclaimer)}</div>

    <h2>Je teampiramide in één oogopslag</h2>
    <div class="pyramide">${pyramideSvg(alleLagen)}</div>

    <h2>Je scores per laag</h2>
    <table><thead><tr><th>Niveau</th><th>Laag</th><th style="text-align:right">Gem.</th><th>Toelichting</th></tr></thead><tbody>${scoreTabel}</tbody></table>

    <h2>Patroon dat jij ziet</h2>
    ${r.patroon.fundamentEerst ? `<div class="disclaimer">Vóór aan vertrouwen te werken, verdient eerst de gedeelde waardenbasis (het fundament) aandacht.</div>` : ""}
    ${profielCard(r.patroon)}

    <h2>Jouw vertrouwensanatomie</h2>
    <p class="muted">Vertrouwen bestaat uit vijf elementen. Hieronder zie je hoe belangrijk jij elk element vindt (rang) tegenover hoe sterk je team er volgens jou op presteert.</p>
    ${gapMatrixHtml(r.vertrouwen.gap)}

    <h2>Reflectievragen</h2>
    <ul>${reflectie}</ul>

    <footer>TaPas Teamscan — reflectie- en ontwikkelinstrument. ${esc(interpretatie.disclaimer)}</footer>
  `;
  return pagina("TaPas Teamscan — Individueel rapport", inhoud);
}

// --- Teamrapport ------------------------------------------------------------

export function renderTeamRapport(team: TeamResultaat, teamNaam: string): string {
  const alleLagen: PijlerResultaat[] = [team.fundament, ...team.pijlers];

  const scoreTabel = [...alleLagen]
    .sort((a, b) => a.niveau - b.niveau)
    .map((l: any) => {
      const spreidingTekst = l.spreiding >= 0.75 ? "verdeeld" : "eensgezind";
      return `<tr>
        <td><span class="badge" style="background:${l.kleur}">${(niveauLabel[l.niveauLabel] ?? l.niveauLabel).toUpperCase()}</span></td>
        <td style="font-weight:600">${esc(l.naam)}</td>
        <td style="text-align:right">${fmt(l.gemiddelde)}</td>
        <td style="text-align:center" class="muted">±${fmt(l.spreiding)}</td>
        <td class="muted" style="font-size:13px">${spreidingTekst}</td>
      </tr>`;
    })
    .join("");

  // Fundament-analyse
  const fdui = interpretatie.fundamentDuiding[team.fundament.niveauLabel];

  // Pijler-duiding voor de zwakste laag
  const gedeeldeRanking = team.vertrouwen.gedeeldeRanking
    .map((g, i) => `<tr><td style="text-align:center">${i + 1}</td><td style="font-weight:600">${esc(g.naam)}</td><td style="text-align:right">${fmt(g.gemiddeldeRang)}</td><td style="text-align:right">${fmt(team.vertrouwen.gemiddeldePrestatie[g.id])}</td></tr>`)
    .join("");

  const inhoud = `
    <div class="eyebrow">TaPas Teamscan · Teamrapport</div>
    <h1>${esc(teamNaam)}</h1>
    <p class="muted">Gebaseerd op ${team.aantalDeelnemers} afgeronde invullingen.</p>
    <div class="disclaimer">${esc(interpretatie.disclaimer)}</div>

    <h2>Samenvatting</h2>
    <div class="pyramide">${pyramideSvg(alleLagen)}</div>
    ${team.patroon.fundamentEerst ? `<div class="disclaimer"><strong>Eerste aangrijpingspunt:</strong> vóór jullie aan vertrouwen werken, eerst de gedeelde waardenbasis (het fundament) adresseren.</div>` : ""}
    ${profielCard(team.patroon)}

    <h2>Scores per laag</h2>
    <table><thead><tr><th>Niveau</th><th>Laag</th><th style="text-align:right">Gem.</th><th style="text-align:center">Spreiding</th><th>Mate van eensgezindheid</th></tr></thead><tbody>${scoreTabel}</tbody></table>
    <p class="muted" style="font-size:13px">Een grotere spreiding (±) betekent dat teamleden de laag verschillend ervaren — dat is op zich al een gespreksonderwerp.</p>

    <h2>Het fundament: waarden- &amp; normenfit</h2>
    <div class="card">
      <h3>${esc(fdui.beschrijving)}</h3>
      <p><strong>Wat het team goed doet:</strong> ${esc(fdui.watGoed)}</p>
      <p><strong>Waar het team voor moet waken:</strong> ${esc(fdui.waarBangVoor)}</p>
      <p><strong>Hoe verbeteren:</strong> ${esc(fdui.hoeVerbeteren)}</p>
    </div>

    <h2>Vertrouwensanatomie van het team</h2>
    <p class="muted">${esc(interpretatie.vertrouwensanatomieDuiding.intro)}</p>
    <h3>Gedeeld vertrouwensprofiel (belangrijkste eerst)</h3>
    <table><thead><tr><th style="text-align:center">#</th><th>Element</th><th style="text-align:right">Gem. rang</th><th style="text-align:right">Gem. prestatie</th></tr></thead><tbody>${gedeeldeRanking}</tbody></table>
    <h3>Belang versus prestatie</h3>
    ${gapMatrixHtml(team.vertrouwen.gap)}

    <h2>Actiepunten</h2>
    <div class="card">
      <p>${esc(team.patroon.hoeVerbeteren)}</p>
      <ul>
        <li>Bespreek dit rapport samen als team; deel waar ieders beeld overeenkomt en verschilt.</li>
        <li>Kies de laagste laag in de piramide als startpunt — bouw van onderaf op.</li>
        <li>Pak het kritieke pijnpunt uit de vertrouwensanatomie als eerste concrete onderwerp.</li>
      </ul>
    </div>

    <footer>TaPas Teamscan — reflectie- en ontwikkelinstrument op basis van het model van Patrick Lencioni, uitgebreid met een fundamentlaag en vertrouwensanatomie. ${esc(interpretatie.disclaimer)}</footer>
  `;
  return pagina("TaPas Teamscan — Teamrapport", inhoud);
}
