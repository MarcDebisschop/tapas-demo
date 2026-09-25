// ---------------------------------------------------------------------------
// server/role-fit/reports/svg.ts
//
// Inline SVG-grafieken voor de rapporten. Elke grafiek tekent enkel wat in het
// contract staat: ordinale labels, geen totaalscores en geen percentages.
// ---------------------------------------------------------------------------
import { FIT_INDICATIE_LABEL, FIT_INDICATIES, KRITICITEIT_LABEL } from "@shared/role-fit";
import { esc, INDICATIE_KLEUR, INTEGRATIE_KLEUR, KLEUR } from "./stijl";

function kort(t: string, n: number): string {
  return t.length > n ? `${t.slice(0, n - 3)}...` : t;
}

const CONF_PUNTEN: Record<string, number> = { low: 1, medium: 2, high: 3 };

/** Fitkaart met betrouwbaarheidsoverlay: een rij per vereiste. */
export function fitKaart(rijen: Array<{ vereiste: string; indicatie: string; indicatieLabel: string; confidence: string; kriticiteitLabel: string }>): string {
  const h = 9;
  const b = 640;
  const hoogte = 22 + rijen.length * h * 2.2;
  const regels = rijen
    .map((r, i) => {
      const y = 22 + i * h * 2.2;
      const punten = [0, 1, 2]
        .map((k) => `<circle cx="${560 + k * 14}" cy="${y + h / 2 + 2}" r="4.2" fill="${k < (CONF_PUNTEN[r.confidence] ?? 0) ? KLEUR.navy : "#fff"}" stroke="${KLEUR.navy}" stroke-width="1"/>`)
        .join("");
      return `<text x="0" y="${y + h}" font-size="9" fill="${KLEUR.navy}">${esc(kort(r.vereiste, 58))}</text>
<text x="300" y="${y + h}" font-size="8" fill="${KLEUR.grijs}">${esc(r.kriticiteitLabel)}</text>
<rect x="370" y="${y - 1}" width="170" height="${h + 6}" rx="3" fill="${INDICATIE_KLEUR[r.indicatie] ?? KLEUR.nb}"/>
<text x="378" y="${y + h}" font-size="8.4" fill="${KLEUR.navy}" font-weight="700">${esc(r.indicatieLabel)}</text>${punten}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${b} ${hoogte}" width="100%" role="img" aria-label="Fitkaart met betrouwbaarheid">
<text x="0" y="10" font-size="8" fill="${KLEUR.grijs}" font-weight="700">VEREISTE</text><text x="300" y="10" font-size="8" fill="${KLEUR.grijs}" font-weight="700">KRITICITEIT</text><text x="370" y="10" font-size="8" fill="${KLEUR.grijs}" font-weight="700">FIT-INDICATIE</text><text x="555" y="10" font-size="8" fill="${KLEUR.grijs}" font-weight="700">BETROUWBAARHEID</text>
${regels}</svg>`;
}

/** Rol- en contextmatrix: kriticiteit tegenover fit-indicatie, met aantallen. */
export function rolContextMatrix(rijen: Array<{ kriticiteit: string; indicatie: string; gate: boolean }>): string {
  const krit = ["critical", "important", "supporting"] as const;
  const cw = 92;
  const ch = 34;
  const x0 = 110;
  const y0 = 40;
  let cellen = "";
  krit.forEach((k, ri) => {
    cellen += `<text x="0" y="${y0 + ri * ch + ch / 2 + 3}" font-size="9" fill="${KLEUR.navy}" font-weight="700">${esc(KRITICITEIT_LABEL[k])}</text>`;
    FIT_INDICATIES.forEach((ind, ci) => {
      const n = rijen.filter((r) => !r.gate && r.kriticiteit === k && r.indicatie === ind).length;
      const x = x0 + ci * cw;
      const y = y0 + ri * ch;
      cellen += `<rect x="${x}" y="${y}" width="${cw - 4}" height="${ch - 4}" rx="4" fill="${n ? INDICATIE_KLEUR[ind] : "#f1f5f9"}" opacity="${n ? 1 : 0.8}"/>`;
      cellen += `<text x="${x + (cw - 4) / 2}" y="${y + (ch - 4) / 2 + 4}" font-size="11" text-anchor="middle" fill="${KLEUR.navy}" font-weight="700">${n || ""}</text>`;
    });
  });
  const koppen = FIT_INDICATIES.map(
    (ind, ci) => `<text x="${x0 + ci * cw + (cw - 4) / 2}" y="${y0 - 8}" font-size="7.6" text-anchor="middle" fill="${KLEUR.grijs}">${esc(kort(FIT_INDICATIE_LABEL[ind], 22))}</text>`,
  ).join("");
  return `<svg viewBox="0 0 ${x0 + 5 * cw} ${y0 + 3 * ch + 6}" width="100%" role="img" aria-label="Rol- en contextmatrix">${koppen}${cellen}</svg>`;
}

/** Organisatiefit in vier delen. */
export function orgFitKaart(delen: Array<{ titel: string; rijen: Array<{ indicatie: string }> }>): string {
  const w = 310;
  const h = 96;
  const vakken = delen
    .map((d, i) => {
      const x = (i % 2) * (w + 10);
      const y = Math.floor(i / 2) * (h + 10);
      const tel = FIT_INDICATIES.map((ind) => ({ ind, n: d.rijen.filter((r) => r.indicatie === ind).length }));
      const totaal = d.rijen.length;
      let bx = x + 12;
      const balk = totaal
        ? tel
            .filter((t) => t.n)
            .map((t) => {
              const bw = ((w - 24) * t.n) / totaal;
              const r = `<rect x="${bx}" y="${y + 50}" width="${bw}" height="16" fill="${INDICATIE_KLEUR[t.ind]}"/>`;
              bx += bw;
              return r;
            })
            .join("")
        : `<rect x="${x + 12}" y="${y + 50}" width="${w - 24}" height="16" fill="#f1f5f9"/><text x="${x + 18}" y="${y + 62}" font-size="8" fill="${KLEUR.grijs}">Geen vereisten van dit type</text>`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${KLEUR.achtergrond}" stroke="${KLEUR.lijn}"/>
<text x="${x + 12}" y="${y + 20}" font-size="10" font-weight="700" fill="${KLEUR.navy}">${esc(d.titel)}</text>
<text x="${x + 12}" y="${y + 36}" font-size="8" fill="${KLEUR.grijs}">${totaal} vereiste(n)</text>${balk}
<text x="${x + 12}" y="${y + 84}" font-size="7.6" fill="${KLEUR.grijs}">Aandeel per fit-indicatie binnen dit deel, geen score</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${2 * w + 10} ${2 * h + 10}" width="100%" role="img" aria-label="Organisatiefit in vier delen">${vakken}</svg>`;
}

const AFSTAND_BREEDTE: Record<string, number> = { short: 1, medium: 2, long: 3, unknown: 0 };

/** Groeibaan: ontwikkelafstand per ontwikkelbare vereiste. */
export function groeibaan(rijen: Array<{ vereiste: string; afstand: string; afstandLabel: string }>): string {
  if (!rijen.length) return `<p class="klein">Er zijn geen ontwikkelbare vereisten vastgelegd.</p>`;
  const rh = 22;
  const x0 = 300;
  const stap = 100;
  const body = rijen
    .map((r, i) => {
      const y = 24 + i * rh;
      const n = AFSTAND_BREEDTE[r.afstand] ?? 0;
      const balk = n
        ? `<rect x="${x0}" y="${y}" width="${n * stap}" height="12" rx="6" fill="${KLEUR.teal}" opacity="${0.45 + n * 0.18}"/>`
        : `<rect x="${x0}" y="${y}" width="${3 * stap}" height="12" rx="6" fill="none" stroke="${KLEUR.nb}" stroke-dasharray="4 3"/>`;
      return `<text x="0" y="${y + 10}" font-size="9" fill="${KLEUR.navy}">${esc(kort(r.vereiste, 56))}</text>${balk}<text x="${x0 + 3 * stap + 8}" y="${y + 10}" font-size="8.4" fill="${KLEUR.grijs}">${esc(r.afstandLabel)}</text>`;
    })
    .join("");
  const as = ["Kort", "Middel", "Lang"].map((t, i) => `<text x="${x0 + i * stap + stap / 2}" y="12" font-size="8" text-anchor="middle" fill="${KLEUR.grijs}">${t}</text>`).join("");
  return `<svg viewBox="0 0 ${x0 + 3 * stap + 70} ${30 + rijen.length * rh}" width="100%" role="img" aria-label="Groeibaan">${as}${body}</svg>`;
}

const SCORE_KLEUR: Record<string, string> = { "5": KLEUR.sterk, "3": KLEUR.gemengd, "1": KLEUR.frictie };
const RICHTING_KLEUR: Record<string, string> = { ondersteunend: KLEUR.waarschijnlijk, gemengd: KLEUR.gemengd, spanning: KLEUR.frictie, onbekend: KLEUR.nb };

/** Convergentiematrix: profielrichting, twee observatoren en integratiestatus per hypothese. */
export function convergentieMatrix(rijen: Array<{ dimensie: string; profielRichting: string; scores: { recruiter: number | null; hiring_manager: number | null }; status: string; statusLabel: string }>): string {
  const rh = 26;
  const kol = [250, 350, 430, 510];
  const body = rijen
    .map((r, i) => {
      const y = 26 + i * rh;
      const cel = (x: number, w: number, kleur: string, tekst: string) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${rh - 6}" rx="4" fill="${kleur}"/><text x="${x + w / 2}" y="${y + 13}" font-size="8.4" text-anchor="middle" fill="${KLEUR.navy}" font-weight="700">${esc(tekst)}</text>`;
      const s = (v: number | null) => (v === null ? "geen" : String(v));
      return `<text x="0" y="${y + 13}" font-size="9" fill="${KLEUR.navy}">${esc(kort(r.dimensie, 44))}</text>
${cel(kol[0], 90, RICHTING_KLEUR[r.profielRichting] ?? KLEUR.nb, r.profielRichting)}
${cel(kol[1], 70, SCORE_KLEUR[String(r.scores.recruiter)] ?? KLEUR.nb, s(r.scores.recruiter))}
${cel(kol[2], 70, SCORE_KLEUR[String(r.scores.hiring_manager)] ?? KLEUR.nb, s(r.scores.hiring_manager))}
${cel(kol[3], 150, INTEGRATIE_KLEUR[r.status] ?? KLEUR.nb, kort(r.statusLabel, 30))}`;
    })
    .join("");
  const kop = ["Profiel", "Recruiter", "Hiring manager", "Integratie"]
    .map((t, i) => `<text x="${kol[i]}" y="14" font-size="8" fill="${KLEUR.grijs}" font-weight="700">${t.toUpperCase()}</text>`)
    .join("");
  return `<svg viewBox="0 0 670 ${32 + rijen.length * rh}" width="100%" role="img" aria-label="Convergentiematrix"><text x="0" y="14" font-size="8" fill="${KLEUR.grijs}" font-weight="700">HYPOTHESE</text>${kop}${body}</svg>`;
}
