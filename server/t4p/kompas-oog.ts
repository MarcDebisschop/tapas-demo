// ---------------------------------------------------------------------------
// server/t4p/kompas-oog.ts
//
// Het Tapas-oog als onderdeel van het T4P Business Kompas. De regels en de
// meetkunde staan in shared/tapas-oog.ts; hier wordt die tekening omgezet naar
// SVG en in de kaart gezet die de layout op het blad drukt.
//
// Er wordt hier niets gerekend en niets bijgemaakt: de constructen komen met hun
// rangorde, hun energiestatus en hun kleur uit het contract binnen.
// ---------------------------------------------------------------------------

import {
  oogStatuswoord,
  oogTekening,
  type OogConstruct,
  type OogTekening,
} from "../../shared/tapas-oog";

/** Het onderdeel zoals het in het contract staat. */
export interface OogOnderdeel {
  type: "tapasoog";
  kop?: string;
  foci: OogConstruct[];
  versnellers: OogConstruct[];
  drivers: OogConstruct[];
  /** Eén regel onder de kaart, bijvoorbeeld waar de lezer verder moet lezen. */
  noot?: string | null;
}

/**
 * De identiteitskleur per construct, zoals zij in het bestaande Tapas-oog van
 * het profielrapport staat. De kleuren zijn overgenomen uit dat beeld en horen
 * bij het construct, niet bij de energie: de energie verandert enkel de
 * helderheid van de vulling (zie oogVulling in shared/tapas-oog.ts).
 */
export const OOG_KLEUR_T4P: Record<string, string> = {
  Innovatie: "#f7d007",
  Operationeel: "#ed111a",
  "Inter-relationeel": "#43bb50",
  Strategie: "#4697b8",
  "Constructief onderscheidend": "#f59c09",
  Analyse: "#5e6da0",
  Coaching: "#44bb5a",
  Impact: "#b4dd21",
  Faciliteren: "#45b996",
  Resultaatgericht: "#c83667",
};

/** De kleur van een construct, met een rustige terugval voor een construct dat
 * hier nog niet staat: liever een neutrale tint dan een verzonnen kleur. */
export function oogKleurT4P(construct: string): string {
  return OOG_KLEUR_T4P[construct] ?? "#9a968c";
}

const NIVEAUKLEUR: Record<number, string> = {
  3: "#437a22",
  2: "#b8860b",
  1: "#a0522d",
  0: "#8a2e2e",
};

function esc(t: unknown): string {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** De tekening als SVG-fragment, klaar om in de kaart te zetten. */
export function oogSvg(tek: OogTekening): string {
  const s: string[] = [];
  s.push(
    `<svg class="oog-svg" xmlns="http://www.w3.org/2000/svg" width="${tek.breedte}" height="${tek.hoogte}" ` +
      `viewBox="0 0 ${tek.breedte} ${tek.hoogte}">`,
  );
  s.push(
    '<defs><radialGradient id="oogGloed">' +
      '<stop offset="0%" stop-color="#ffc553" stop-opacity="0.9"/>' +
      '<stop offset="100%" stop-color="#ffc553" stop-opacity="0"/>' +
      "</radialGradient>" +
      `<clipPath id="oogLid"><path d="${tek.lidPad}"/></clipPath></defs>`,
  );
  s.push(
    `<path d="${tek.lidPad}" fill="#ffffff" stroke="${tek.lidKleur}" ` +
      `stroke-width="${tek.lidBreedte.toFixed(1)}" stroke-linejoin="round"/>`,
  );

  const vormen = (lijst: typeof tek.binnen): string => {
    const uit: string[] = [];
    for (const v of lijst) {
      if (v.soort === "gloed") {
        uit.push(
          `<circle cx="${v.cx.toFixed(1)}" cy="${v.cy.toFixed(1)}" r="${v.r.toFixed(1)}" ` +
            `fill="url(#oogGloed)" opacity="${v.dekking.toFixed(3)}"/>`,
        );
      } else if (v.soort === "lijn") {
        uit.push(
          `<line x1="${v.x1.toFixed(1)}" y1="${v.y1.toFixed(1)}" x2="${v.x2.toFixed(1)}" ` +
            `y2="${v.y2.toFixed(1)}" stroke="${v.kleur}" stroke-width="${v.breedte.toFixed(2)}" ` +
            `stroke-linecap="round" opacity="${v.dekking.toFixed(2)}"/>`,
        );
      } else if (v.soort === "pad") {
        uit.push(
          `<path d="${v.d}" fill="${v.vul ?? "none"}" stroke="${v.rand ?? "none"}" ` +
            `stroke-width="${v.randbreedte.toFixed(2)}"` +
            (v.dekking === undefined ? "" : ` opacity="${v.dekking.toFixed(2)}"`) +
            "/>",
        );
      } else if (v.soort === "cirkel") {
        uit.push(
          `<circle cx="${v.cx.toFixed(1)}" cy="${v.cy.toFixed(1)}" r="${v.r.toFixed(1)}" ` +
            `fill="${v.vul ?? "none"}" stroke="${v.rand ?? "none"}" stroke-width="${v.randbreedte.toFixed(2)}"/>`,
        );
      } else {
        uit.push(
          `<text x="${v.x.toFixed(1)}" y="${(v.y + v.grootte * 0.35).toFixed(1)}" text-anchor="middle" ` +
            `font-family="Noto Sans" font-size="${v.grootte.toFixed(1)}" ` +
            `font-weight="${v.vet ? 700 : 400}" fill="${v.kleur}">${esc(v.tekst)}</text>`,
        );
      }
    }
    return uit.join("");
  };

  s.push(`<g clip-path="url(#oogLid)">${vormen(tek.binnen)}</g>`);
  s.push(vormen(tek.voor));
  if (tek.gordijn.length) s.push(`<g clip-path="url(#oogLid)">${vormen(tek.gordijn)}</g>`);
  if (tek.naGordijn.length)
    s.push(`<g clip-path="url(#oogLid)">${vormen(tek.naGordijn)}</g>`);
  s.push("</svg>");
  return s.join("");
}

/** Het volledige onderdeel: tekening, legende en de alertbalk. */
export function tapasoog(o: OogOnderdeel): string {
  const tek = oogTekening(
    { foci: o.foci ?? [], versnellers: o.versnellers ?? [], drivers: o.drivers ?? [] },
    268,
    192,
  );
  const u = tek.uitkomst;

  const groep = (letter: string, kop: string): string => {
    const regels = tek.legende
      .filter((l) => l.nummer.startsWith(letter))
      .map(
        (l) =>
          `<div class="oog-lg-regel"><span class="oog-lg-nr">${esc(l.nummer)}</span>` +
          `<span class="oog-lg-stip" style="background:${esc(l.kleur)}"></span>` +
          `<span class="oog-lg-naam">${esc(l.naam)}</span>` +
          `<span class="oog-lg-st">${esc(oogStatuswoord(l.status))}</span></div>`,
      )
      .join("");
    return `<div class="oog-lg-groep"><div class="oog-lg-kop">${esc(kop)}</div>${regels}</div>`;
  };

  const kop = o.kop ?? "Het Tapas-oog";
  const legende =
    '<div class="oog-legende">' +
    groep("F", "Talentfoci, binnenring") +
    groep("V", "Talentversnellers, buitenring") +
    groep("D", "Drivers, de pupil") +
    "</div>";

  const balk =
    `<div class="oog-alert" style="border-left-color:${NIVEAUKLEUR[u.niveau]}">` +
    `<div class="oog-alert-kop"><span class="oog-niveau" style="color:${NIVEAUKLEUR[u.niveau]}">` +
    `${esc(u.niveauNaam)}</span> · ${esc(u.alertKop)}</div>` +
    `<div class="oog-alert-txt">${esc(u.alertTekst)}</div>` +
    "</div>";

  const noten = [
    "De ringen tonen wat aanwezig is, in de rangorde waarin het naar voren komt. " +
      "De straling zegt niets over de omvang of de waarde van het talent, enkel over de energie waarmee het vandaag beschikbaar is.",
    ...u.meldingen,
    ...(o.noot ? [String(o.noot)] : []),
  ];

  return (
    '<div class="oog-kaart">' +
    `<div class="oog-titel">${esc(kop)}</div>` +
    `<div class="oog-rij"><div class="oog-beeld">${oogSvg(tek)}</div>${legende}</div>` +
    balk +
    noten.map((n) => `<div class="oog-noot">${esc(n)}</div>`).join("") +
    "</div>"
  );
}

/** De stijl van de kaart. Komt ná KOMPAS_CSS in de kop van het document en
 * raakt geen enkele bestaande klasse aan: alle namen beginnen met "oog-". */
export const OOG_CSS = `
.oog-kaart{border:0.6pt solid #d9d6cf;background:#fcfbf8;padding:8pt 9pt 7pt 9pt;margin:0 0 8pt 0;break-inside:avoid}
.oog-titel{font-size:7.4pt;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#134542;margin:0 0 5pt 0}
.oog-rij{display:flex;align-items:flex-start;gap:10pt}
.oog-beeld{flex:0 0 auto}
.oog-svg{display:block}
.oog-legende{flex:1 1 auto;display:flex;flex-direction:column;gap:4pt;padding-top:1pt}
.oog-lg-kop{font-size:6.6pt;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#6e6a62;margin:0 0 1.4pt 0}
.oog-lg-regel{display:flex;align-items:baseline;gap:3.4pt;font-size:7.6pt;line-height:1.34;color:#23211d}
.oog-lg-nr{flex:0 0 13pt;font-weight:700;color:#134542}
.oog-lg-stip{flex:0 0 5pt;height:5pt;border-radius:2.5pt;border:0.4pt solid #d9d6cf}
.oog-lg-naam{flex:1 1 auto}
.oog-lg-st{flex:0 0 auto;color:#6e6a62;font-size:7pt}
.oog-alert{border-left:2.4pt solid #437a22;background:#eef2f0;padding:5pt 7pt;margin:6pt 0 0 0}
.oog-alert-kop{font-size:8pt;font-weight:700;color:#23211d;margin:0 0 2pt 0}
.oog-niveau{text-transform:uppercase;letter-spacing:0.06em;font-size:7.4pt}
.oog-alert-txt{font-size:7.8pt;line-height:1.4;color:#4a463f}
.oog-noot{font-size:6.9pt;line-height:1.36;color:#6e6a62;margin:4pt 0 0 0}
`;
