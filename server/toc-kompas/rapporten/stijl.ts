// ---------------------------------------------------------------------------
// server/toc-kompas/rapporten/stijl.ts
//
// Gedeelde opmaak voor de rapporten van het TOC Commitmentkompas, in de
// TaPasCity-huisstijl van het Commitmentkompas zelf: Ink #111418, Terra
// #C25A34, Bone #F2EDE4, koppen in Trebuchet MS en tekst in Calibri, het
// TaPasCity-lockup op de cover en de baseline "Talent runs on Passion" als
// slotregel.
//
// Het logo wordt gelezen uit server/notulen-toc/logo.ts. Dat bestand wordt niet
// gewijzigd; deze module importeert enkel de constante.
//
// PAGINERING. Dezelfde aanpak als de Role Fit-rapporten: de inhoud staat als
// losse blokken in een stroom, een klein script verdeelt ze over A4-pagina's
// door ze te meten en splitst lange tabellen per rij met herhaalde kop. Het
// script leest geen gegevens en berekent niets.
//
// De renderers trekken zelf geen conclusies. Ze tonen wat in het contract
// staat.
// ---------------------------------------------------------------------------
import { TAPASCITY_LOCKUP_PNG_BASE64 } from "../../notulen-toc/logo";

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const KLEUR = {
  ink: "#111418",
  terra: "#C25A34",
  bone: "#F2EDE4",
  amber: "#E8912F",
  grijs: "#6E6A66",
  lijn: "#D8D2C8",
  streep: "#FAF7F2",
};

export const BASELINE = "Talent runs on Passion";

export interface Blok {
  html: string;
  nieuwePagina?: boolean;
  sectie?: string;
}

const CSS = `/* kompas-eigen-paginaformaat */
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;color:${KLEUR.ink};font-size:10pt;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
.pagina{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.pagina:last-child{page-break-after:auto;break-after:auto}
.kop{position:absolute;top:0;left:0;right:0;height:15mm;padding:6mm 17mm 0;display:flex;justify-content:space-between;font-size:8pt;color:${KLEUR.grijs};border-bottom:0.3mm solid ${KLEUR.lijn}}
.kop b{color:${KLEUR.terra};font-family:'Trebuchet MS',Arial,sans-serif}
.inhoud{position:absolute;top:21mm;left:17mm;right:17mm;bottom:22mm;overflow:hidden}
.voet{position:absolute;left:17mm;right:17mm;bottom:8mm;height:10mm;border-top:0.3mm solid ${KLEUR.lijn};padding-top:2mm;font-size:7.4pt;color:${KLEUR.grijs};display:flex;justify-content:space-between}
h1,h2,h3{font-family:'Trebuchet MS',Arial,sans-serif;color:${KLEUR.ink}}
h1{font-size:24pt;line-height:1.15;margin:0 0 3mm}
h2{font-size:14pt;margin:0 0 2.5mm;padding-bottom:1.2mm;border-bottom:0.6mm solid ${KLEUR.terra}}
h3{font-size:11pt;margin:3.5mm 0 1.5mm}
p{margin:0 0 2mm}
.klein{font-size:8.4pt;color:${KLEUR.grijs}}
.blok{margin-bottom:4mm}
.kader{border-left:1.2mm solid ${KLEUR.terra};background:${KLEUR.bone};padding:2.5mm 3.5mm;border-radius:0 2mm 2mm 0}
.kaarten{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.kaart{border:0.3mm solid ${KLEUR.lijn};border-top:1.2mm solid ${KLEUR.terra};border-radius:2mm;padding:3mm 3.5mm;background:${KLEUR.streep}}
.kaart .t{font-size:8pt;text-transform:uppercase;letter-spacing:.06em;color:${KLEUR.grijs};font-weight:700}
.kaart .w{font-size:12pt;font-weight:700;margin:1mm 0;font-family:'Trebuchet MS',Arial,sans-serif}
table{width:100%;border-collapse:collapse;font-size:8.8pt}
th{text-align:left;font-weight:700;color:#fff;background:${KLEUR.ink};padding:1.6mm 2mm;font-size:8.2pt}
td{padding:1.6mm 2mm;border-bottom:0.25mm solid ${KLEUR.lijn};vertical-align:top}
tr:nth-child(even) td{background:${KLEUR.streep}}
td.leeg{color:${KLEUR.grijs};font-style:normal}
.label{display:inline-block;border-radius:1.5mm;padding:0.3mm 1.8mm;font-size:7.8pt;font-weight:700;color:#fff}
ul{margin:0 0 2mm 4.5mm;padding:0}
li{margin:0 0 0.8mm}
.cover{position:absolute;inset:0;background:${KLEUR.bone};padding:28mm 22mm}
.cover img{width:62mm;height:auto}
.cover .merk{margin-top:16mm;font-size:10pt;letter-spacing:.14em;text-transform:uppercase;color:${KLEUR.terra};font-weight:700;font-family:'Trebuchet MS',Arial,sans-serif}
.cover h1{font-size:30pt;margin:4mm 0 3mm}
.cover .sub{font-size:13pt;color:${KLEUR.grijs};margin-bottom:14mm}
.cover .rij{display:flex;gap:4mm;margin:1.8mm 0;font-size:10.5pt}
.cover .rij span:first-child{width:46mm;color:${KLEUR.grijs}}
.cover .noot{position:absolute;left:22mm;right:22mm;bottom:22mm;font-size:8.8pt;color:${KLEUR.ink};border-top:0.4mm solid ${KLEUR.terra};padding-top:4mm}
.cover .baseline{margin-top:3mm;font-family:'Trebuchet MS',Arial,sans-serif;font-weight:700;color:${KLEUR.terra}}
.concept{display:inline-block;margin-top:4mm;padding:1mm 3mm;border:0.4mm solid ${KLEUR.amber};color:${KLEUR.ink};font-weight:700;font-size:9pt;border-radius:1.5mm}
.slot{margin-top:6mm;text-align:center;font-family:'Trebuchet MS',Arial,sans-serif;font-weight:700;color:${KLEUR.terra}}
.cel{display:inline-block;min-width:7mm;text-align:center;font-weight:700;border-radius:1mm;padding:0 1mm}
#stroom{display:none}
`;

const SCRIPT = `(function(){
var stroom=document.getElementById('stroom');var sjabloon=document.getElementById('sjabloon');
if(!stroom||!sjabloon)return;
var doc=document.getElementById('document');var blokken=Array.prototype.slice.call(stroom.children);
var huidig=null,sectie='';
function nieuwe(){var p=sjabloon.content.firstElementChild.cloneNode(true);p.querySelector('.sectie').textContent=sectie;doc.appendChild(p);huidig=p.querySelector('.inhoud');return huidig;}
function past(){return huidig.scrollHeight<=huidig.clientHeight+1;}
blokken.forEach(function(b){
 if(b.getAttribute('data-sectie')){sectie=b.getAttribute('data-sectie');}
 if(!huidig||b.getAttribute('data-nieuwe-pagina')==='1'){nieuwe();}
 huidig.appendChild(b);
 if(past())return;
 var tabel=b.querySelector('table.splits');
 if(huidig.children.length>1&&!tabel){huidig.removeChild(b);nieuwe();huidig.appendChild(b);return;}
 if(!tabel){return;}
 var rijen=Array.prototype.slice.call(tabel.tBodies[0].rows);
 rijen.forEach(function(r){tabel.tBodies[0].removeChild(r);});
 if(!past()){huidig.removeChild(b);nieuwe();huidig.appendChild(b);}
 var doel=tabel;
 rijen.forEach(function(r){doel.tBodies[0].appendChild(r);
  if(!past()&&doel.tBodies[0].rows.length>1){doel.tBodies[0].removeChild(r);
   var kopie=b.cloneNode(true);var kt=kopie.querySelector('table.splits');while(kt.tBodies[0].rows.length)kt.tBodies[0].deleteRow(0);
   var voor=kopie.querySelectorAll('.alleen-eerste');for(var i=0;i<voor.length;i++)voor[i].parentNode.removeChild(voor[i]);
   nieuwe();huidig.appendChild(kopie);doel=kt;doel.tBodies[0].appendChild(r);}
 });
});
var paginas=doc.querySelectorAll('.pagina');for(var i=0;i<paginas.length;i++){var n=paginas[i].querySelector('.paginanr');if(n)n.textContent='Pagina '+(i+1)+' van '+paginas.length;}
stroom.parentNode.removeChild(stroom);
})();`;

export interface DocumentOpts {
  titel: string;
  documentLabel: string;
  kenmerk: string;
  voetMeta: string;
  cover: string;
  blokken: Blok[];
}

export function bouwDocument(o: DocumentOpts): string {
  const stroom = o.blokken
    .map((b) => `<div class="blok"${b.nieuwePagina ? ' data-nieuwe-pagina="1"' : ""}${b.sectie ? ` data-sectie="${esc(b.sectie)}"` : ""}>${b.html}</div>`)
    .join("\n");
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>${esc(o.titel)}</title><style>${CSS}</style></head><body>
<div id="document"><section class="pagina"><div class="cover">${o.cover}</div></section></div>
<template id="sjabloon"><section class="pagina"><div class="kop"><span><b>TaPas</b> &middot; ${esc(o.documentLabel)} &middot; <span class="sectie"></span></span><span>${esc(o.kenmerk)}</span></div><div class="inhoud"></div><div class="voet"><span>${esc(o.voetMeta)}</span><span class="paginanr"></span></div></section></template>
<div id="stroom">${stroom}</div>
<script>${SCRIPT}</script>
</body></html>`;
}

export function coverHtml(o: { merk: string; titel: string; sub: string; rijen: Array<[string, string]>; noot: string; concept?: string }): string {
  return `<img alt="TaPasCity" src="data:image/png;base64,${TAPASCITY_LOCKUP_PNG_BASE64}"><div class="merk">${esc(o.merk)}</div><h1>${esc(o.titel)}</h1><div class="sub">${esc(o.sub)}</div>
${o.rijen.map(([k, v]) => `<div class="rij"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}
${o.concept ? `<div class="concept">${esc(o.concept)}</div>` : ""}
<div class="noot">${esc(o.noot)}<div class="baseline">${esc(BASELINE)}</div></div>`;
}

export function label(tekst: string, kleur: string, tekstkleur = "#fff"): string {
  return `<span class="label" style="background:${kleur};color:${tekstkleur}">${esc(tekst)}</span>`;
}

export function lijst(items: readonly string[]): string {
  if (!items.length) return `<p class="klein">Geen.</p>`;
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

/** Een tekstwaarde, of een zichtbaar "niet ingevuld". */
export function waarde(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s ? esc(s) : `<span class="klein">niet ingevuld</span>`;
}

export function slot(): string {
  return `<div class="slot">${esc(BASELINE)}</div>`;
}

export function datum(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("nl-BE", { timeZone: "Europe/Brussels", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
