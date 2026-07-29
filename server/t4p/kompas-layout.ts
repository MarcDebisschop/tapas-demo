// kompas-layout.ts — 1:1-port van de Python Kompas-renderer (v8.0) naar
// TypeScript. Samengevoegd uit:
//
//   kompas_componenten.py  — alle componentrenderers, RENDERAARS,
//                            render_onderdelen, _stijl en document
//   tapas_slider_gen.py    — esc, sheet, chapter, cover, toc_blok,
//                            leeswijzer_blok (uitsluitend wat de bouwer gebruikt)
//   build_kompas.py        — bouw() met de _mintekens()-voorbewerking
//
// De <body> die renderKompasHtml() teruggeeft is teken voor teken gelijk aan die
// van de Python-renderer. De <head> zet de stylesheet inline (Chromium krijgt
// geen basis-URL mee) en iconen worden data-URI's.
//
// Er wordt hier NOOIT inhoud bijgemaakt: wat niet in het contract staat, komt
// niet in het rapport.
import { KOMPAS_CSS } from "./kompas-css";
import { KOMPAS_ICONEN } from "./kompas-iconen";

// --------------------------------------------------------------- Python-basis

// Tekens waarvoor Python str.isspace() waar is; str.strip() knipt precies deze.
const PY_WS = "\\t\\n\\v\\f\\r \\x1c\\x1d\\x1e\\x1f\\x85\\u00a0\\u1680" +
  "\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const RE_STRIP = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");
const RE_SPLIT_WS = new RegExp(`[${PY_WS}]+`);

/** Python str.strip() zonder argument. */
function strip(s: string): string {
  return s.replace(RE_STRIP, "");
}

/** Python str.split() zonder argument. */
function splitWs(s: string): string[] {
  const t = strip(s);
  return t ? t.split(RE_SPLIT_WS) : [];
}

const RE_DIGIT = /[\p{Nd}²³¹⁰-⁹₀-₉]/u;
const RE_ALNUM = /[\p{L}\p{N}]/u;

/** Python dict.get(k, d): een aanwezige sleutel met waarde null geeft null. */
function pyGet(o: any, k: string, d: any): any {
  return o != null && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : d;
}

/** Python int(v). */
function pyInt(v: any): number {
  return Math.trunc(Number(v));
}

/** Python float(s) op een string: strikt, of null bij ValueError. */
function pyFloatStr(s: string): number | null {
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Python round(x) naar int: half naar even, niet half omhoog. */
function pyRoundInt(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function esc(t: any): string {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Tekstveld: bewust toegelaten HTML (<b>, <i>) blijft staan.
 *
 * Regels die met een opsommingsteken beginnen worden — exact zoals de
 * standaardreferentie — als echte lijstitems gezet: bolletje op x 70, tekst op
 * x 85 (hangende indent van 15pt). Overige regelovergangen worden harde
 * regeleindes.
 */
function _t(v: any): string {
  if (v === null || v === undefined) return "";
  const t = String(v);
  if (!t.includes("\n")) return t;
  const ruw = t.split("\n").map(strip);
  const regels = ruw.filter((r) => r);
  const bol = (r: string) =>
    r.startsWith("•") || r.startsWith("-") || r.startsWith("–");
  if (regels.length && regels.every(bol)) {
    const items = regels
      .map((r) => `<li>${strip(r.replace(/^[•\-– ]+/, ""))}</li>`)
      .join("");
    return `<ul class="blijst">${items}</ul>`;
  }
  // Gemeten op referentiepagina 33: een blanco regel blijft een lege regel
  // (dubbele <br>), ze wordt niet weggefilterd.
  while (ruw.length && !ruw[0]) ruw.shift();
  while (ruw.length && !ruw[ruw.length - 1]) ruw.pop();
  return ruw.join("<br>");
}

function _icoon(naam: any): string {
  if (!naam) return "";
  return `<img src="${KOMPAS_ICONEN[String(naam)]}" alt="">`;
}

function _energieklasse(e: any): string {
  const s = strip(e ? String(e) : "").toLowerCase();
  return s === "geeft" || s === "kost" || s === "neutraal" ? s : "neutraal";
}

/** '−0,83' / '+4' / -0.83 -> getal, of null. */
function _getal(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  let s = strip(String(v)).replace(/−/g, "-").replace(/,/g, ".");
  s = s.replace(/\+/g, "").replace(/ /g, "");
  return pyFloatStr(s);
}

// ---------------------------------------------------------------- componenten

function kpis(o: any): string {
  let tg = "";
  for (const t of o.tegels) {
    const w = _t(t.waarde);
    const kwal = RE_DIGIT.test(w) ? "" : " kwal";
    tg += `<div class="kpi${kwal}"><div class="k-waarde">${w}</div>` +
      `<div class="k-lbl">${_t(t.label)}</div></div>`;
  }
  return `<div class="kpi-grid">${tg}</div>`;
}

function statement(o: any): string {
  return `<div class="stelling">${_t(o.tekst)}</div>`;
}

function paragraaf(o: any): string {
  const kl = o.variant === "intro" ? "alinea intro" : "alinea";
  return `<div class="${kl}">${_t(o.tekst)}</div>`;
}

function regel(o: any): string {
  const kl = o.variant === "conclusie" ? "regel conclusie" : "regel";
  return `<div class="${kl}">${_t(o.tekst)}</div>`;
}

function subkop(o: any): string {
  return `<div class="subkop">${_t(o.tekst)}</div>`;
}

/** Tekstblok = KAART, exact zoals de standaardreferentie (p24 gemeten):
 * x 52,0-543,3, 1pt rand #d9d6cf, gekleurde linkerbalk, tint-achtergrond en een
 * kop in dezelfde accentkleur. De accenten wisselen per tekstblok binnen een
 * hoofdstuk (teal -> oker -> groen); `variant` in het contract overschrijft dat
 * expliciet.
 */
function tekstblok(o: any): string {
  const v = pyGet(o, "variant", null) || `a${(pyGet(o, "_i", 0) % 3) + 1}`;
  return `<div class="tekstblok tb-${esc(v)}">` +
    `<div class="tb-kop">${_t(o.kop)}</div>` +
    `<div class="tb-txt">${_t(o.tekst)}</div></div>`;
}

const _VARIANT: Record<string, string> = {
  "": "",
  risico: " risico",
  actie: " actie",
};

function _variantKlasse(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return Object.prototype.hasOwnProperty.call(_VARIANT, s) ? _VARIANT[s] : "";
}

function lijst(o: any): string {
  const items = o.items
    .map((i: any) => `<li><b>${_t(i.vet)}</b>${_t(pyGet(i, "tekst", ""))}</li>`)
    .join("");
  const kl = "laag" + _variantKlasse(pyGet(o, "variant", ""));
  return `<div class="${kl}"><div class="l-lbl">${_t(o.kop)}</div>` +
    `<ul class="klijst">${items}</ul></div>`;
}

function lagen(o: any): string {
  let uit = "";
  for (const b of o.blokken) {
    const kl = "laag" + _variantKlasse(pyGet(b, "variant", ""));
    uit += `<div class="${kl}"><div class="l-lbl">${_t(b.kop)}</div>` +
      `<div class="l-txt">${_t(b.tekst)}</div></div>`;
  }
  return uit;
}

function staafmeters(o: any): string {
  let rijen = "";
  for (const r of o.rijen) {
    const n = pyInt(pyGet(r, "gevuld", 0));
    const tot = pyInt(pyGet(r, "totaal", 10));
    const kl = _energieklasse(pyGet(r, "kleur", null)) === "kost"
      ? "meter kost"
      : "meter";
    let cel = "";
    for (let i = 0; i < tot; i++) {
      cel += `<div class="m-cel${i < n ? " aan" : ""}"></div>`;
    }
    rijen += `<div class="${kl}"><div class="m-lbl">${_t(r.label)}</div>` +
      `<div class="m-bar">${cel}</div>` +
      `<div class="m-wrd">${_t(r.waarde)}</div></div>`;
  }
  return `<div class="meters">${rijen}</div>`;
}

/** Bipolaire energiebatterij: 10 cellen, nulpunt tussen cel 5 en 6.
 * Gemeten schaal: één cel per 0,20 energiepunt, maximaal 5 cellen per kant.
 */
function _batterij(waarde: any, energie: any): string {
  const v = _getal(waarde);
  let kl = _energieklasse(energie);
  if (v) kl = v < 0 ? "kost" : "geeft";
  const aan = new Set<number>();
  if (v) {
    const n = Math.min(5, Math.max(1, pyRoundInt(Math.abs(v) / 0.2)));
    if (v < 0) for (let i = 5 - n; i < 5; i++) aan.add(i);
    else for (let i = 5; i < 5 + n; i++) aan.add(i);
  }
  let cellen = "";
  for (let i = 0; i < 10; i++) {
    cellen += `<span class="cel${aan.has(i) ? " aan " + kl : ""}"></span>`;
  }
  const w = _t(waarde);
  return `<span class="bat">${cellen}</span>` +
    `<span class="bat-wrd ${_energieklasse(energie)}">${w}</span>`;
}

function _saldoklasse(waarde: any): string {
  const v = _getal(waarde);
  if (v === null || Math.abs(v) < 1e-9) return "neu";
  return v < 0 ? "neg" : "";
}

/** Energiesaldo-kopbalk, gemeten op referentiepagina 9: kaart 52,0-543,3 met
 * hoogte 42,0pt, batterij-icoon op x 69,0 (19,6 x 21,1pt), label 8,6pt en
 * toelichting 8,4pt gestapeld op x 102,0 (rijafstand 13,9pt) en de waarde
 * 13,0pt rechts uitgelijnd. Het aantal batterijcellen volgt de legende:
 * geeft = 3, neutraal = 2, kost = 1.
 */
function _saldobalk_html(label: any, waarde: any, toelichting: any): string {
  const kl = _saldoklasse(waarde);
  const aantal = ({ "": 3, neg: 1, neu: 2 } as Record<string, number>)[kl] ?? 3;
  let cellen = "";
  for (let i = 0; i < aantal; i++) cellen += '<span class="bl-cel"></span>';
  const batt = `<span class="bl-bat"><span class="bl-cellen">${cellen}</span></span>`;
  return `<div class="saldo ${kl}">${batt}` +
    `<span class="s-txt"><span class="s-lbl">${_t(label)}</span>` +
    `<span class="s-toe">${_t(toelichting)}</span></span>` +
    `<span class="s-wrd">${_t(waarde)}</span></div>`;
}

function saldobalk(o: any): string {
  return _saldobalk_html(o.label, o.waarde, pyGet(o, "toelichting", ""));
}

function constructtabel(o: any): string {
  let uit = "";
  const s = pyGet(o, "saldo", null);
  if (s) uit += _saldobalk_html(s.label, s.waarde, pyGet(s, "toelichting", ""));
  const kop = `<tr><th>${esc(o.kolomkop)}</th><th>Net</th><th>Energie</th>` +
    "<th>Status</th><th>Lezing</th></tr>";
  let rijen = "";
  for (const r of o.rijen) {
    const kl = _energieklasse(pyGet(r, "energie", null));
    rijen += "<tr>" +
      `<td class="c-naam">${_icoon(pyGet(r, "icoon", null))}${_t(r.naam)}</td>` +
      `<td class="c-net">${_t(pyGet(r, "net", ""))}</td>` +
      `<td class="c-energie">${_batterij(pyGet(r, "energiewaarde", null), kl)}</td>` +
      `<td><span class="pil ${kl}">${kl}</span></td>` +
      `<td class="c-lezing">${_t(pyGet(r, "lezing", ""))}</td>` +
      "</tr>";
  }
  // Gemeten op de referentie: elke dimensietabel heeft eigen kolombreedtes
  // (de naamkolom is 75,7 / 92,9 / 130,8 / 73,8 / 106,5pt breed). Die komen
  // daarom uit het contract en worden als colgroup meegegeven.
  const bw = pyGet(o, "kolombreedtes", null);
  const cols = bw
    ? "<colgroup>" +
      bw.map((w: any) => `<col style="width:${w}pt">`).join("") +
      "</colgroup>"
    : "";
  return uit + `<table class="ct dim">${cols}<thead>${kop}</thead>` +
    `<tbody>${rijen}</tbody></table>`;
}

/** Kolombreedtes uit het contract (gemeten op de referentie) als colgroup. */
function _cols(o: any): string {
  const bw = pyGet(o, "kolombreedtes", null);
  return bw
    ? "<colgroup>" +
      bw.map((w: any) => `<col style="width:${w}pt">`).join("") +
      "</colgroup>"
    : "";
}

function metingtabel(o: any): string {
  const kop = o.kolommen.map((k: any) => `<th>${esc(k)}</th>`).join("");
  const rijen = o.rijen
    .map((r: any[]) =>
      "<tr>" + r.map((c) => `<td>${_t(c)}</td>`).join("") + "</tr>")
    .join("");
  const cols = _cols(o);
  return `<table class="ct meting">${cols}<thead><tr>${kop}</tr></thead>` +
    `<tbody>${rijen}</tbody></table>`;
}

function vrijetabel(o: any): string {
  const kop = o.kolommen.map((k: any) => `<th>${esc(k)}</th>`).join("");
  const rijen = o.rijen
    .map((r: any[]) =>
      "<tr>" + r.map((c) => `<td>${_t(c)}</td>`).join("") + "</tr>")
    .join("");
  const voor = pyGet(o, "kop", null)
    ? `<div class="tabelkop">${_t(o.kop)}</div>`
    : "";
  return voor +
    `<table class="ct vrij">${_cols(o)}<thead><tr>${kop}</tr></thead>` +
    `<tbody>${rijen}</tbody></table>`;
}

function orientatiestrip(o: any): string {
  let rijen = "";
  for (const rij of o.rijen) {
    const naam = rij[0], code = rij[1], tekst = rij[2];
    const m: Record<string, string> = { E: "", H: "h", "E+H": "eh" };
    const sleutel = String(code).toUpperCase();
    const c = Object.prototype.hasOwnProperty.call(m, sleutel) ? m[sleutel] : "";
    rijen += `<div class="ori-row"><div class="ori-naam">${_t(naam)}</div>` +
      `<div class="ori-badge ${c}">${esc(code)}</div>` +
      `<div class="ori-tekst">${_t(tekst)}</div></div>`;
  }
  const titel = pyGet(o, "titel", null)
    ? `<div class="subkop">${_t(o.titel)}</div>`
    : "";
  const noot = '<div class="ori-noot">E = expertise-/functiegericht · ' +
    "H = mensgericht · E+H = beide.</div>";
  return `<div class="orientatie">${titel}${rijen}${noot}</div>`;
}

function paar(o: any): string {
  let kaarten = "";
  for (const k of o.kaarten) {
    // De Python-bron sluit hier af op `... and False`, waardoor de tweede
    // kaart nooit een tint erft: zonder expliciete `tint` blijft het "pk ".
    const kl = "pk " + (pyGet(k, "tint", null) || "");
    kaarten += `<div class="${kl}"><div class="pk-kop">${_t(k.kop)}</div>` +
      `<div class="pk-txt">${_t(k.tekst)}</div></div>`;
  }
  return `<div class="paar">${kaarten}</div>`;
}

function congruentie(o: any): string {
  const cellen = o.cellen
    .map((c: any) =>
      `<div class="cong-cel"><div class="cc-kop">${_t(c.kop)}</div>` +
      `<div class="cc-txt">${_t(c.tekst)}</div></div>`)
    .join("");
  const lbl = pyGet(o, "kop", null)
    ? `<div class="cong-lbl">${_t(o.kop)}</div>`
    : "";
  const intro = pyGet(o, "intro", null)
    ? `<div class="cong-intro">${_t(o.intro)}</div>`
    : "";
  return `<div class="cong">${lbl}${intro}` +
    `<div class="cong-raster">${cellen}</div></div>`;
}

function _cit_items(items: any[], groot = true): string {
  if (groot) {
    return items.map((i) => `<li><span class="q">“</span>${_t(i)}</li>`)
      .join("");
  }
  return items.map((i) => `<li><span class="q">“</span>${_t(i)}</li>`)
    .join("");
}

function citatenkaarten(o: any): string {
  if (pyGet(o, "variant", null) === "compact") {
    const blok = `<div class="c1-kol"><div class="c1-kop">${_t(o.kop_meest)}` +
      `</div><ul>${_cit_items(o.meest, false)}</ul></div>` +
      `<div class="c1-kol minst"><div class="c1-kop">` +
      `${_t(o.kop_minst)}</div>` +
      `<ul>${_cit_items(o.minst, false)}</ul></div>`;
    const intro = pyGet(o, "intro", null)
      ? `<div class="c1-intro">${_t(o.intro)}</div>`
      : "";
    return `<div class="cit1">${intro}<div class="c1-raster">${blok}` +
      "</div></div>";
  }
  const kl = Number(pyGet(o, "pt", 11.0)) < 10 ? "cit2 klein" : "cit2";
  return `<div class="${kl}"><div class="citk"><div class="ck-kop">` +
    `${_t(o.kop_meest)}</div><ul>${_cit_items(o.meest)}</ul></div>` +
    `<div class="citk minst"><div class="ck-kop">${_t(o.kop_minst)}` +
    `</div><ul>${_cit_items(o.minst)}</ul></div></div>`;
}

const _BK_KL = ["", " rust", " groen"];

function bronkaarten(o: any): string {
  let uit = "";
  for (let i = 0; i < o.kaarten.length; i++) {
    const k = o.kaarten[i];
    let kl = pyGet(k, "variant", null) || strip(_BK_KL[i % 3]);
    kl = strip("bronkaart " + kl);
    let rub = "";
    for (const rij of pyGet(k, "rubrieken", [])) {
      const lbl = rij[0], txt = rij[1];
      const laag = String(lbl).toLowerCase();
      const cit = laag.startsWith("kernzin") || laag.startsWith("citaat")
        ? " citaat"
        : "";
      rub += `<div class="bk-rubriek">${_t(lbl)}</div>` +
        `<div class="bk-body${cit}">${_t(txt)}</div>`;
    }
    const vo = pyGet(k, "volgorde", null)
      ? `<div class="bk-volgorde">${_t(k.volgorde)}</div>`
      : "";
    uit += `<div class="${kl}"><div class="bk-titel">${_t(k.titel)}</div>` +
      `${vo}${rub}</div>`;
  }
  return uit;
}

const _MOTOR_KL = ["motor", "motor p2", "motor p3"];

function motorpanelen(o: any): string {
  let uit = "";
  for (let i = 0; i < o.panelen.length; i++) {
    const p = o.panelen[i];
    let items = "";
    for (const it of p.items) {
      const kl = _energieklasse(pyGet(it, "status", null));
      items += `<div class="mt-item">${_icoon(pyGet(it, "icoon", null))}` +
        `<span class="mi-naam">${_t(it.naam)}</span>` +
        `<span class="pil ${kl}">${kl}</span></div>`;
    }
    const noot = pyGet(p, "noot", null)
      ? `<div class="mt-noot">${_t(p.noot)}</div>`
      : "";
    uit += `<div class="${_MOTOR_KL[i % 3]}">` +
      `<div class="mt-kop">${_t(p.nummer)}. ${_t(p.titel)}` +
      (pyGet(p, "vraag", null)
        ? ` <span class="mt-vraag">· ${_t(p.vraag)}</span>`
        : "") + "</div>" +
      `${noot}<div class="mt-items">${items}</div></div>`;
  }
  return uit;
}

const _ROUTE_KL = ["route", "route teal", "route rust"];

function routekaarten(o: any): string {
  let kaarten = "";
  for (let i = 0; i < o.kaarten.length; i++) {
    const k = o.kaarten[i];
    kaarten += `<div class="${_ROUTE_KL[i % 3]}">` +
      `<div class="rt-lbl">${_t(k.kop)}</div>` +
      `<div class="rt-txt">${_t(k.tekst)}</div></div>`;
  }
  const kop = pyGet(o, "kop", null)
    ? `<div class="subkop">${_t(o.kop)}</div>`
    : "";
  return kop + `<div class="routes">${kaarten}</div>`;
}

const _RK_KL = ["rk", "rk oker", "rk rust", "rk teal"];

function rasterkaarten(o: any): string {
  let cellen = "";
  for (let i = 0; i < o.kaarten.length; i++) {
    const k = o.kaarten[i];
    const kl = pyGet(k, "variant", null)
      ? strip(`rk ${k.variant}`)
      : _RK_KL[i % 4];
    cellen += `<div class="${kl}"><div class="rk-kop">${_t(k.titel)}</div>` +
      `<div class="rk-txt">${_t(k.tekst)}</div></div>`;
  }
  return `<div class="raster">${cellen}</div>`;
}

function waakpunten(o: any): string {
  let uit = "";
  for (const k of o.kaarten) {
    uit += `<div class="waak"><div class="wk-lbl">Waakpunt ${_t(k.num)}` +
      `</div><div class="wk-titel">${_t(k.titel)}</div>` +
      `<div class="wk-txt">${_t(k.tekst)}</div></div>`;
  }
  return uit;
}

function pistes(o: any): string {
  let uit = "";
  for (const k of o.kaarten) {
    uit += '<div class="piste">' +
      `<div class="p-kop"><span class="p-num">${_t(k.num)}</span>` +
      `${_t(k.kop)}</div>` +
      '<div class="p-rij"><div class="p-lbl">Waarom dit rendeert</div>' +
      `<div class="p-txt">${_t(k.rendeert)}</div></div>` +
      '<div class="p-rij p-ontwikkel"><div class="p-lbl">' +
      "Wat dit vraagt om te activeren</div>" +
      `<div class="p-txt">${_t(k.ontwikkelen)}</div></div>` +
      '<div class="reflectie"><div class="r-lbl">Reflectievraag</div>' +
      `<div class="r-vraag">${_t(k.vraag)}</div></div>` +
      "</div>";
  }
  return uit;
}

/** Losse reflectiebalk (label 7,2pt gespatieerd + vraag 10,6pt cursief), zoals
 * de referentie die na het afsluitende lagenblok van hoofdstuk 19 zet.
 */
function reflectie(o: any): string {
  return '<div class="reflectie los"><div class="r-lbl">Reflectievraag</div>' +
    `<div class="r-vraag">${_t(o.tekst)}</div></div>`;
}

/** Legendakaart van de energiebatterij, exact zoals gemeten op
 * referentiepagina 6: kaart 52,0-543,3 op #eef2f0 met rand #d9d6cf, titel
 * 7,4pt gespatieerd op x 65,8, drie rijen met batterij-icoon (19,6 x 21,2pt)
 * en tekst 8,8pt op x 95,8 met een rijafstand van 24,65pt, en een afsluitende
 * noot van 8,0pt.
 */
function batterijlegende(o?: any): string {
  o = o || {};
  const standaard: [string, number, string][] = [
    ["geeft", 3, "geeft — zet talent in beweging (gaspedaal)"],
    ["neutraal", 2,
      "neutraal — beschikbaar, maar niet vanzelf energiserend"],
    ["kost", 1, "kost — vraagt vandaag energie (rem)"],
  ];
  const rijen = pyGet(o, "rijen", null) || standaard;
  const titel = pyGet(o, "titel", "Energiebatterij — hoe je ze leest");
  const noot = pyGet(o, "noot",
    "De batterij toont energetische beschikbaarheid, niet " +
    "belangrijkheid. Een lijn kan hoog scoren én energie " +
    "kosten, of laag scoren én toch energie geven.");
  let uit = "";
  for (const rij of rijen) {
    const kl = rij[0], aantal = rij[1], tekst = rij[2];
    let cellen = "";
    for (let i = 0; i < aantal; i++) cellen += '<span class="bl-cel"></span>';
    uit += `<div class="bl-rij ${esc(kl)}"><span class="bl-bat">` +
      `<span class="bl-cellen">${cellen}</span></span>` +
      `<span class="bl-txt">${_t(tekst)}</span></div>`;
  }
  return `<div class="bl-kaart"><div class="bl-titel">${_t(titel)}</div>` +
    `${uit}<div class="bl-noot">${_t(noot)}</div></div>`;
}

const RENDERAARS: Record<string, (o: any) => string> = {
  kpis,
  statement,
  paragraaf,
  regel,
  subkop,
  tekstblok,
  lijst,
  lagen,
  staafmeters,
  saldobalk,
  constructtabel,
  metingtabel,
  vrijetabel,
  orientatiestrip,
  paar,
  congruentie,
  citatenkaarten,
  bronkaarten,
  motorpanelen,
  routekaarten,
  rasterkaarten,
  waakpunten,
  pistes,
  batterijlegende,
  reflectie,
};

/** Optionele, per onderdeel gemeten lettergroottes: `pt` (body) en `kop`
 * (kopregel). Zonder deze velden gelden de standaardmaten.
 *
 * De waarden worden letterlijk overgenomen zoals ze in het contract staan; een
 * gemeten float 10.0 hoort dus "10.0pt" te geven en een int 186 "186pt". Zie
 * parseKompasContract().
 */
function _stijl(o: any): string {
  const d: string[] = [];
  if (pyGet(o, "pt", null)) d.push(`--pt:${o.pt}pt`);
  if (pyGet(o, "kop_pt", null)) d.push(`--kop:${o.kop_pt}pt`);
  return d.length ? ` style="${d.join(";")}"` : "";
}

function render_onderdelen(onderdelen: any[]): string {
  let uit = "";
  const tellers: Record<string, number> = {};
  for (const o of onderdelen) {
    const t = pyGet(o, "type", null);
    o._i = tellers[t] ?? 0;
    tellers[t] = o._i + 1;
    if (!Object.prototype.hasOwnProperty.call(RENDERAARS, t)) {
      throw new Error(`onbekend componenttype: ${JSON.stringify(t)}`);
    }
    const html = RENDERAARS[t](o);
    const st = _stijl(o);
    uit += st ? `<div class="ond"${st}>${html}</div>` : html;
  }
  return uit;
}

// ------------------------------------------------------------------- document

/** Motorcorrectie voor Chromium, gemeten tegen de 33-pagina-referentie.
 *
 * 1. Kopregel rechtsboven. De absoluut gepositioneerde `.runhead` in het blad
 *    komt in Chromium 5,3pt te laag én ontbreekt op vervolgpagina's van een
 *    hoofdstuk, terwijl WeasyPrint hem op elk fragment zet. Gemeten
 *    alternatieven: `transform:translateY(-5.3pt)` zet hem exact goed maar
 *    schrijft een tweede, afgekapte kopie onderaan elke pagina; een
 *    negatievere `top` verplaatst het element naar de vorige pagina;
 *    `line-height:1` haalt 50,5pt maar herstelt de vervolgpagina's niet.
 *    De oplossing is een @page-margeblok: `@top-right` op een benoemde pagina
 *    `kop`, die via `:has(.runhead)` precies die bladen treft die in de
 *    Python-renderer een kopregel dragen. Gemeten: rechterrand 542,5pt
 *    (referentie 542,4) en de kopregel staat op exact dezelfde pagina's als de
 *    referentie — inclusief de vervolgpagina's 6, 23 en 31.
 *    `padding-top:46.7pt` legt de kopregel op de referentiehoogte, maar op een
 *    vervolgpagina begint het eerste inhoudsblok in Chromium op 51,8pt (in de
 *    referentie op 56,0pt) en dekt het dan de onderkant van de letters af.
 *    Daarom staat de kopregel op 43,0pt: 3,7pt boven de referentie, maar
 *    volledig leesbaar op elke pagina, met dezelfde aansluiting op het eerste
 *    blok als in de referentie.
 *    De in-flow `.runhead` wordt daarbij verborgen, zodat er geen dubbele
 *    kopregel staat. De HTML-body blijft ongewijzigd.
 * 2. Verweesde kop. Chromium splitst een tabel minder gretig dan WeasyPrint:
 *    waar WeasyPrint de kop plus de eerste tabelrij nog onderaan de pagina
 *    zet, duwt Chromium de hele tabel door en blijft de kop als wees achter
 *    (gemeten op hoofdstuk 17, pagina 22). `break-after:avoid` laat de kop
 *    meeschuiven met zijn tabel. Gemeten: verweesde koppen 1 -> 0, 33
 *    pagina's blijven 33, alle 24 hoofdstukstarts ongewijzigd.
 *
 * Deze stijl komt ná KOMPAS_CSS en uitsluitend in de Chromium-uitvoer; de
 * WeasyPrint-uitvoer blijft er onaangeroerd door, zodat beide motoren dezelfde
 * componentenlaag delen. */
export function kompasChromiumCss(runhead = ""): string {
  const tekst = cssTekenreeks(runhead);
  return "/* kompas-eigen-paginaformaat */\n" +
    ".subkop{ break-after:avoid; }\n" +
    (runhead
      ? ".runhead{ display:none; }\n" +
        ".sheet:has(.runhead){ page:kop; }\n" +
        "@page kop{ @top-right{ content:\"" + tekst + "\";" +
        " font-family:\"Noto Sans\",\"DejaVu Sans\",sans-serif;" +
        " font-size:6.8pt; font-weight:600; letter-spacing:.14em;" +
        " text-transform:uppercase; color:#6e6a62;" +
        " vertical-align:top; padding-top:42.5pt; } }"
      : ".runhead{ line-height:1; }");
}

/** Zet een tekst om in een veilige CSS-tekenreeks voor `content:`: alles
 * buiten de ASCII-basis wordt als \0000xx-escape geschreven, zodat de
 * kopregel niet van de bestandscodering afhangt. */
function cssTekenreeks(t: string): string {
  let uit = "";
  for (const ch of String(t)) {
    const code = ch.codePointAt(0) as number;
    if (ch === "\\" || ch === '"') uit += "\\" + ch;
    else if (code < 32 || code > 126) uit += "\\" + code.toString(16) + " ";
    else uit += ch;
  }
  return uit;
}

/** Behouden voor bestaande imports: de correctie zonder kopregeltekst. */
export const KOMPAS_CHROMIUM_CSS: string = kompasChromiumCss();

/** Merkstring waaraan rapport-pdf.ts een Kompas-document herkent. Zo'n
 * document brengt zijn eigen @page-formaat mee en mag GEEN Playwright-marges
 * of `format:"A4"` krijgen — dat verschuift de hele gemeten layout. */
export const KOMPAS_PAGINAFORMAAT_MERK = "/* kompas-eigen-paginaformaat */";

function document(paginas: string[], titel = "T4P Business Kompas",
  chromium = true, runhead = ""): string {
  const correctie = chromium
    ? `<style>${kompasChromiumCss(runhead)}</style>`
    : "";
  return '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
    `<title>${esc(titel)}</title>` +
    `<style>${KOMPAS_CSS}</style>` + correctie +
    "</head><body>" + paginas.join("") + "</body></html>";
}

// ------------------------------------------------------------ pagina-omhulsels

/** Eén A4-pagina. De inhoud staat rechtstreeks op het blad binnen de
 * @page-marges; de referentie kent geen zwevende kaart.
 *
 * `omslag=true` zet de pagina op de @page-benoemde omslagpagina: ruimere marge
 * (64pt) en geen voettekst of paginanummer.
 */
function sheet(inner_html: string, runhead = "", compact = false,
  omslag = false): string {
  const rh = runhead ? `<div class="runhead">${esc(runhead)}</div>` : "";
  const kl = compact ? "card compact" : "card";
  const sk = omslag ? "sheet omslag" : "sheet";
  return `<section class="${sk}"><div class="${kl}">${rh}${inner_html}</div></section>`;
}

/** Volledig hoofdstuk als eigen pagina.
 *
 * titelregels : 1 of 2 — hoeveel regels de titel in de referentie beslaat; bij
 * 2 compenseert de kop de extra regelhoogte zodat de titelfilet op dezelfde
 * hoogte blijft staan.
 */
function chapter(num: any, titel: any, subtitel = "", body = "", runhead = "",
  compact = false, titelregels = 1): string {
  const sub = subtitel ? `<div class="chap-sub">${subtitel}</div>` : "";
  const kop = '<div class="chap-head">' +
    `<span class="chap-num">${esc(num)}</span>` +
    `<span class="chap-title${titelregels === 2 ? " w2" : ""}">${titel}</span>` +
    "</div>" +
    '<div class="chap-rule"></div>' +
    `${sub}`;
  return sheet(kop + body, runhead, compact);
}

const LEESWIJZER_STANDAARD =
  "Elk hoofdstuk werkt op twee niveaus. De <strong>nettoscore</strong> toont " +
  "het potentieel; de <strong>energie- en duidingslaag</strong> toont de " +
  "beschikbaarheid vandaag: of die lijn energie geeft, neutraal is of energie " +
  "kost. Een hoge nettoscore betekent dus niet automatisch dat een talent " +
  "vandaag vrij beschikbaar is — dat dubbele lezen is de kern van een " +
  "verantwoorde T4P-interpretatie.";

/** Het leeskader zoals gemeten op de standaardreferentie (pagina 3). */
function leeswijzer_blok(tekst: any = null,
  label = "Hoe je dit rapport leest"): string {
  return '<div class="readbox">' +
    `<div class="lab">${esc(label)}</div>` +
    `<p>${tekst || LEESWIJZER_STANDAARD}</p>` +
    "</div>";
}

/** Inhoudsopgave. `inhoud` = lijst van (nummer, titel). */
function toc_blok(inhoud: any[], compact = true, leeswijzer: any = null,
  titel: any = "Inhoud"): string {
  const rijen = inhoud
    .map(([n, t]) =>
      `<div class="toc-row"><span class="num">${esc(n)}</span>` +
      `<span class="ttl">${t}</span></div>`)
    .join("");
  const kl = compact ? "toc compact" : "toc";
  let rb = "";
  if (leeswijzer) {
    const lbl = leeswijzer[0], txt = leeswijzer[1];
    rb = `<div class="readbox"><div class="rb-lbl">${esc(lbl)}</div>` +
      `<p>${txt}</p></div>`;
  }
  let kop = "";
  if (titel) {
    kop = `<h2 class="toc-title">${esc(titel)}</h2>` +
      '<div class="toc-rule"></div>';
  }
  return `<div class="${kl}">${kop}${rijen}${rb}</div>`;
}

/** Omslag plus, als `inhoud` is meegegeven, de inhoudsopgave als EIGEN pagina 2.
 *
 * `velden` = lijst van (label, waarde), in één kolom label/waarde gezet zoals de
 * standaardreferentie: label 7,6pt op x 64, waarde 11,5pt op x 198, met een
 * rijafstand van 28,25pt. De referentie heeft vijf velden — Deelnemer, Bedrijf,
 * Rol, Rapportdatum, Databronnen — en GEEN CODE-veld.
 *
 * HARDE REGEL, gemeten op de standaardreferentie: op de omslag staat GEEN
 * inhoudsopgave. Pagina 1 is uitsluitend de omslag; de inhoudsopgave staat
 * volledig alleen op pagina 2.
 */
function cover(titel: any, claim: any, velden: [any, any][],
  merk = "TaPasCity", eyebrow = "T 4 P",
  confidentieel = "Vertrouwelijk profielrapport", inhoud: any[] | null = null,
  compact_toc = true, leeswijzer: any = null): string {
  // Label en waarde zijn RECHTSTREEKSE grid-kinderen. Geen omhullende div met
  // display:contents: WeasyPrint ondersteunt display:contents niet, en dan
  // klapt de eenkolomsopbouw van de referentie terug naar twee kolommen.
  const cellen = velden
    .map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${v}</div>`)
    .join("");
  const blok = `<div class="cover-brand">${esc(merk)}</div>` +
    '<div class="cover-brand-rule"></div>' +
    `<div class="cover-eyebrow">${esc(eyebrow)}</div>` +
    `<h1 class="cover-title">${titel}</h1>` +
    `<div class="cover-claim">${claim}</div>` +
    `<div class="cover-grid">${cellen}</div>` +
    `<div class="cover-conf">${esc(confidentieel)}</div>`;
  let paginas = sheet(blok, "", false, true);
  if (!inhoud || !inhoud.length) return paginas;

  // De inhoudsopgave is een eigen pagina, direct na de omslag. Alle 24 rijen
  // passen op één blad: 24 x 26,8pt = 643,2pt, van y 118 tot y 761,2.
  paginas += sheet(toc_blok(inhoud, compact_toc));
  // Gemeten op de standaardreferentie: de leeswijzer is een EIGEN pagina 3, met
  // uitsluitend het leeskader (mintvlak x 52 -> 543,3, y 62 -> 154) en de
  // voettekst. Geen kopregel, geen hoofdstukkop, verder een lege pagina.
  if (leeswijzer) {
    // leeswijzer=true -> de gemeten standaardtekst; een string -> eigen tekst.
    paginas += sheet(leeswijzer_blok(leeswijzer === true ? null : leeswijzer));
  }
  return paginas;
}

// ---------------------------------------------------------------------- bouwer

/** Alle streepjes voor getallen als echt minteken U+2212. */
function _mintekens(s: any): any {
  if (typeof s === "string") {
    const out: string[] = [];
    const n = s.length;
    for (let i = 0; i < n; i++) {
      const ch = s[i];
      if (ch === "-" && i + 1 < n && RE_DIGIT.test(s[i + 1])) {
        const vorige = i ? s[i - 1] : " ";
        if (!RE_ALNUM.test(vorige)) {
          out.push("−");
          continue;
        }
      }
      out.push(ch);
    }
    return out.join("");
  }
  if (Array.isArray(s)) return s.map(_mintekens);
  if (s !== null && typeof s === "object") {
    const uit: Record<string, any> = {};
    for (const k of Object.keys(s)) uit[k] = _mintekens(s[k]);
    return uit;
  }
  return s;
}

/** Python repr() van een float: altijd met punt of exponent, dus 122.0 blijft
 * "122.0" waar JS er "122" van maakt. */
function pyFloatRepr(v: number): string {
  const s = String(v);
  return /[.eE]/.test(s) || /[a-zA-Z]/.test(s) ? s : s + ".0";
}

/**
 * Leest een contract-JSON met behoud van het onderscheid tussen een int- en een
 * float-literal, want de Python-renderer neemt die weergave letterlijk over:
 * `"kolombreedtes": [186, 234.0]` geeft "186pt" en "234.0pt". JSON.parse() maakt
 * van beide een gewoon JS-getal en dan is dat verschil onherstelbaar weg. Een
 * float-literal komt hier daarom door als string met zijn Python-weergave; elk
 * gebruik in de componentenlaag (interpolatie, _getal(), int(), float()) neemt
 * die string net zo aan als een getal.
 *
 * Let op: een NEGATIEVE float-literal wordt zo wel door _mintekens() gezien en
 * krijgt een echt minteken (U+2212) waar Python bij een float het gewone
 * koppelteken zou laten staan. In de gemeten contracten staan negatieve
 * energiewaarden al als tekst, dus dat verschil komt daar niet voor.
 */
export function parseKompasContract(json: string): any {
  let i = 0;

  function fout(m: string): never {
    throw new Error(`parseKompasContract: ${m} op positie ${i}`);
  }
  function ws(): void {
    while (i < json.length && (json[i] === " " || json[i] === "\t" ||
      json[i] === "\n" || json[i] === "\r")) i++;
  }
  function verwacht(ch: string): void {
    if (json[i] !== ch) fout(`'${ch}' verwacht`);
    i++;
  }
  function tekst(): string {
    verwacht('"');
    let uit = "";
    while (true) {
      const ch = json[i];
      if (ch === undefined) fout("onafgesloten string");
      if (ch === '"') { i++; return uit; }
      if (ch !== "\\") { uit += ch; i++; continue; }
      i++;
      const e = json[i++];
      if (e === "u") {
        uit += String.fromCharCode(parseInt(json.slice(i, i + 4), 16));
        i += 4;
      } else if (e === "n") uit += "\n";
      else if (e === "t") uit += "\t";
      else if (e === "r") uit += "\r";
      else if (e === "b") uit += "\b";
      else if (e === "f") uit += "\f";
      else if (e === '"' || e === "\\" || e === "/") uit += e;
      else fout(`onbekende escape \\${e}`);
    }
  }
  function getal(): number | string {
    const m = /^-?(?:0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(json.slice(i));
    if (!m) fout("geen geldig getal");
    i += m[0].length;
    // Een punt of exponent in de bron betekent: Python-float.
    return m[1] || m[2] ? pyFloatRepr(Number(m[0])) : Number(m[0]);
  }
  function lijstwaarde(): any[] {
    verwacht("[");
    const uit: any[] = [];
    ws();
    if (json[i] === "]") { i++; return uit; }
    while (true) {
      uit.push(waarde());
      ws();
      if (json[i] === ",") { i++; continue; }
      verwacht("]");
      return uit;
    }
  }
  function objectwaarde(): Record<string, any> {
    verwacht("{");
    const uit: Record<string, any> = {};
    ws();
    if (json[i] === "}") { i++; return uit; }
    while (true) {
      ws();
      const k = tekst();
      ws();
      verwacht(":");
      uit[k] = waarde();
      ws();
      if (json[i] === ",") { i++; continue; }
      verwacht("}");
      return uit;
    }
  }
  function waarde(): any {
    ws();
    const ch = json[i];
    if (ch === "{") return objectwaarde();
    if (ch === "[") return lijstwaarde();
    if (ch === '"') return tekst();
    if (json.startsWith("true", i)) { i += 4; return true; }
    if (json.startsWith("false", i)) { i += 5; return false; }
    if (json.startsWith("null", i)) { i += 4; return null; }
    return getal();
  }

  const uit = waarde();
  ws();
  if (i !== json.length) fout("onverwachte tekens na het contract");
  return uit;
}

export interface KompasOpties {
  /** "chromium" (standaard) voegt KOMPAS_CHROMIUM_CSS toe; "weasyprint" niet. */
  engine?: "chromium" | "weasyprint";
}

/**
 * Rendert het volledige Kompas-rapport als HTML-document. Equivalent van
 * build_kompas.bouw(), maar geeft de HTML terug in plaats van een PDF te
 * schrijven: de <body> is teken voor teken gelijk aan die van de
 * Python-renderer.
 */
export function renderKompasHtml(contract: any,
  opties: KompasOpties = {}): string {
  const c = _mintekens(contract);
  const r = c.respondent;
  const naam = r.naam;
  const runhead = splitWs(String(naam).toUpperCase()).join(" · ");

  const inhoud: [any, any][] = c.secties.map(
    (s: any) => [s.nummer, s.titel] as [any, any]);
  const paginas: string[] = [cover(
    pyGet(c, "titel", "T4P Business Kompas"),
    pyGet(c, "ondertitel", ""),
    [["Deelnemer", naam],
      ["Bedrijf", pyGet(r, "organisatie", "")],
      ["Rol", pyGet(r, "functie", "")],
      ["Rapportdatum", pyGet(c, "rapportdatum", "")],
      ["Databronnen", pyGet(c, "databronnen", "")]],
    "TaPasCity", "T 4 P", "Vertrouwelijk profielrapport",
    inhoud, true,
    pyGet(c, "leeswijzer", null) || true,
  )];

  for (const s of c.secties) {
    const body = render_onderdelen(s.onderdelen);
    paginas.push(chapter(
      s.nummer, s.titel, pyGet(s, "ondertitel", ""), body,
      runhead, Boolean(pyGet(s, "compact", null)),
      pyInt(pyGet(s, "titelregels", 1)),
    ));
  }

  return document(paginas, "T4P Business Kompas",
    (opties.engine ?? "chromium") === "chromium", runhead);
}
