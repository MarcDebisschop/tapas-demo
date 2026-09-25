// ---------------------------------------------------------------------------
// server/role-fit/reports/stijl.ts
//
// Gedeelde opmaak voor de rapporten van Recruitment & Role Fit: TaPas-huisstijl
// (DM Sans of Aptos, teal #0d9488, navy #0f2a44), A4-pagina's met een vaste
// kop en voet, en de bewijslegende op elke inhoudspagina.
//
// PAGINERING. De inhoud wordt als losse blokken in een stroom gezet. Een klein
// script in het document verdeelt de blokken over A4-pagina's door ze echt te
// meten, en splitst lange tabellen per rij met herhaalde kop. Zo loopt geen
// tekst over de rand, ook niet bij lange vereisten of bronnen. Het script leest
// geen gegevens en berekent niets; het verplaatst enkel opmaakblokken.
//
// De renderers trekken zelf geen conclusies. Ze tonen wat in het contract
// staat.
// ---------------------------------------------------------------------------
import { BEWIJSSOORT_LABEL, type Bewijssoort } from "@shared/role-fit";

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const KLEUR = {
  teal: "#0d9488",
  tealLicht: "#ccfbf1",
  navy: "#0f2a44",
  grijs: "#64748b",
  lijn: "#e2e8f0",
  achtergrond: "#f8fafc",
  sterk: "#0f766e",
  waarschijnlijk: "#5eead4",
  gemengd: "#fcd34d",
  frictie: "#fb923c",
  nb: "#cbd5e1",
};

export const INDICATIE_KLEUR: Record<string, string> = {
  strong_support: KLEUR.sterk,
  likely_support: KLEUR.waarschijnlijk,
  mixed: KLEUR.gemengd,
  likely_friction: KLEUR.frictie,
  not_assessable: KLEUR.nb,
};

export const INTEGRATIE_KLEUR: Record<string, string> = {
  convergent_support: KLEUR.sterk,
  mixed_context_dependent: KLEUR.gemengd,
  repeated_counter_indication: KLEUR.frictie,
  insufficient_evidence: KLEUR.nb,
};

const BEWIJS_KLEUR: Record<Bewijssoort, string> = {
  profiel: "#0d9488",
  context: "#0f2a44",
  observatie: "#7c3aed",
  referentie: "#2563eb",
  technisch: "#475569",
  ontbrekend: "#cbd5e1",
};

export function bewijsChips(soorten: Bewijssoort[]): string {
  return soorten
    .map((s) => `<span class="chip" style="border-color:${BEWIJS_KLEUR[s]}"><i style="background:${BEWIJS_KLEUR[s]}"></i>${esc(s)}</span>`)
    .join("");
}

function legende(): string {
  return (Object.keys(BEWIJSSOORT_LABEL) as Bewijssoort[])
    .map((s) => `<span class="leg"><i style="background:${BEWIJS_KLEUR[s]}"></i>${esc(BEWIJSSOORT_LABEL[s])}</span>`)
    .join("");
}

export interface Blok {
  html: string;
  /** Start dit blok op een nieuwe pagina? */
  nieuwePagina?: boolean;
  /** Sectietitel voor de paginakop vanaf dit blok. */
  sectie?: string;
}

const CSS = `/* kompas-eigen-paginaformaat */
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'DM Sans','Aptos','Segoe UI',system-ui,-apple-system,Arial,sans-serif;color:#0f2a44;font-size:9.6pt;line-height:1.42;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
.pagina{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.pagina:last-child{page-break-after:auto;break-after:auto}
.kop{position:absolute;top:0;left:0;right:0;height:16mm;padding:6mm 16mm 0;display:flex;justify-content:space-between;align-items:flex-start;font-size:7.8pt;color:${KLEUR.grijs};border-bottom:0.3mm solid ${KLEUR.lijn}}
.kop b{color:${KLEUR.teal};font-weight:700;letter-spacing:.02em}
.inhoud{position:absolute;top:21mm;left:16mm;right:16mm;bottom:25mm;overflow:hidden}
.voet{position:absolute;left:16mm;right:16mm;bottom:7mm;height:14mm;border-top:0.3mm solid ${KLEUR.lijn};padding-top:2mm;font-size:6.8pt;color:${KLEUR.grijs}}
.voet .legrij{display:flex;flex-wrap:wrap;gap:1mm 3.2mm}
.voet .meta{display:flex;justify-content:space-between;margin-top:1.4mm}
.leg{display:inline-flex;align-items:center;gap:1mm}
.leg i,.chip i{display:inline-block;width:2.2mm;height:2.2mm;border-radius:50%}
.chip{display:inline-flex;align-items:center;gap:1mm;border:0.25mm solid;border-radius:3mm;padding:0 1.6mm;font-size:6.8pt;margin-right:1mm;color:${KLEUR.navy}}
h1{font-size:22pt;line-height:1.15;margin:0 0 3mm;color:${KLEUR.navy};font-weight:700}
h2{font-size:13.5pt;margin:0 0 2.5mm;color:${KLEUR.navy};font-weight:700}
h2 .nr{color:${KLEUR.teal};margin-right:2mm}
h3{font-size:10.5pt;margin:3mm 0 1.5mm;color:${KLEUR.navy}}
p{margin:0 0 2mm}
.klein{font-size:8.2pt;color:${KLEUR.grijs}}
.blok{margin-bottom:4mm}
.kaarten{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.kaart{border:0.3mm solid ${KLEUR.lijn};border-top:1.2mm solid ${KLEUR.teal};border-radius:2mm;padding:3mm 3.5mm;background:${KLEUR.achtergrond}}
.kaart .t{font-size:8pt;text-transform:uppercase;letter-spacing:.06em;color:${KLEUR.grijs};font-weight:700}
.kaart .w{font-size:11pt;font-weight:700;margin:1mm 0 1.2mm;color:${KLEUR.navy}}
table{width:100%;border-collapse:collapse;font-size:8.4pt}
th{text-align:left;font-weight:700;color:#fff;background:${KLEUR.navy};padding:1.6mm 2mm;font-size:7.8pt}
td{padding:1.6mm 2mm;border-bottom:0.25mm solid ${KLEUR.lijn};vertical-align:top}
tr:nth-child(even) td{background:${KLEUR.achtergrond}}
.label{display:inline-block;border-radius:1.5mm;padding:0.3mm 1.6mm;font-size:7.6pt;font-weight:700;color:${KLEUR.navy}}
ul{margin:0 0 2mm 4.5mm;padding:0}
li{margin:0 0 0.8mm}
.cover{position:absolute;inset:0;background:${KLEUR.navy};color:#fff;padding:34mm 20mm}
.cover .merk{font-size:10pt;letter-spacing:.14em;text-transform:uppercase;color:#5eead4;font-weight:700}
.cover h1{color:#fff;font-size:28pt;margin:10mm 0 4mm}
.cover .sub{font-size:13pt;color:#ccfbf1;margin-bottom:18mm}
.cover .rij{display:flex;gap:4mm;margin:1.6mm 0;font-size:10pt}
.cover .rij span:first-child{width:44mm;color:#99f6e4}
.cover .noot{position:absolute;left:20mm;right:20mm;bottom:20mm;font-size:8.4pt;color:#ccfbf1;border-top:0.3mm solid #134e4a;padding-top:4mm}
.kader{border-left:1.2mm solid ${KLEUR.teal};background:${KLEUR.achtergrond};padding:2.5mm 3.5mm;border-radius:0 2mm 2mm 0}
.twee{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
svg text{font-family:'DM Sans','Aptos','Segoe UI',Arial,sans-serif}
#stroom{display:none}
`;

// Het pagineringsscript. Draait eenmalig bij het laden van het document.
const SCRIPT = `(function(){
var stroom=document.getElementById('stroom');var sjabloon=document.getElementById('sjabloon');
if(!stroom||!sjabloon)return;
var doc=document.getElementById('document');var blokken=Array.prototype.slice.call(stroom.children);
var huidig=null,sectie='';
function nieuwe(){var p=sjabloon.content.firstElementChild.cloneNode(true);p.querySelector('.sectie').textContent=sectie;doc.appendChild(p);huidig=p.querySelector('.inhoud');return huidig;}
function past(el){return huidig.scrollHeight<=huidig.clientHeight+1;}
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
    .map(
      (b) =>
        `<div class="blok"${b.nieuwePagina ? ' data-nieuwe-pagina="1"' : ""}${b.sectie ? ` data-sectie="${esc(b.sectie)}"` : ""}>${b.html}</div>`,
    )
    .join("\n");
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>${esc(o.titel)}</title><style>${CSS}</style></head><body>
<div id="document"><section class="pagina"><div class="cover">${o.cover}</div></section></div>
<template id="sjabloon"><section class="pagina"><div class="kop"><span><b>TaPas</b> &middot; ${esc(o.documentLabel)} &middot; <span class="sectie"></span></span><span>${esc(o.kenmerk)}</span></div><div class="inhoud"></div><div class="voet"><div class="legrij"><b style="margin-right:1mm">Bewijslegende</b>${legende()}</div><div class="meta"><span>${esc(o.voetMeta)}</span><span class="paginanr"></span></div></div></section></template>
<div id="stroom">${stroom}</div>
<script>${SCRIPT}</script>
</body></html>`;
}

export function coverHtml(opts: { merk: string; titel: string; sub: string; rijen: Array<[string, string]>; noot: string }): string {
  return `<div class="merk">${esc(opts.merk)}</div><h1>${esc(opts.titel)}</h1><div class="sub">${esc(opts.sub)}</div>
${opts.rijen.map(([k, v]) => `<div class="rij"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")}
<div class="noot">${esc(opts.noot)}</div>`;
}

export function label(tekst: string, kleur: string): string {
  return `<span class="label" style="background:${kleur}">${esc(tekst)}</span>`;
}

export function lijst(items: string[]): string {
  if (!items.length) return `<p class="klein">Geen.</p>`;
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

export function methodeBlokken(methode: { regels: string[] }, bronnen: any[], versies: Record<string, string>, extra: string[] = []): Blok[] {
  return [
    {
      nieuwePagina: true,
      sectie: "Methode, bronnen en grenzen",
      html: `<h2>Methode, bronnen en grenzen</h2><div class="kader">${lijst([...methode.regels, ...extra])}</div>`,
    },
    {
      html: `<h3>Bronnen</h3><table class="splits"><thead><tr><th>Id</th><th>Type</th><th>Titel</th><th>Inhoudshash</th></tr></thead><tbody>${
        bronnen.length
          ? bronnen.map((b) => `<tr><td>${esc(b.id)}</td><td>${esc(b.type)}</td><td>${esc(b.titel)}</td><td>${esc(b.hash)}</td></tr>`).join("")
          : `<tr><td colspan="4">Geen externe bronnen; enkel wizardinvoer.</td></tr>`
      }</tbody></table>`,
    },
    {
      html: `<h3>Versies</h3><table><tbody>${Object.entries(versies)
        .map(([k, v]) => `<tr><td style="width:45mm">${esc(k)}</td><td>${esc(v)}</td></tr>`)
        .join("")}</tbody></table>`,
    },
  ];
}
