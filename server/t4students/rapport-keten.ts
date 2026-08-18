// ---------------------------------------------------------------------------
// server/t4students/rapport-keten.ts
//
// De ene weg van contract naar rapport voor het T4Students-studiekompas:
//
//   bouwRapportUitContract()  contract  ->  T4SRapport (35 bladen)
//   pdfVanRapport()           T4SRapport -> PDF-buffer (pdfkit)
//   htmlVanRapport()          T4SRapport -> leesbare HTML voor het scherm
//   titelVanRapport()         de titel die in de rapportenlijst staat
//
// WAAROM DIT BESTAAT
// De PDF van dit instrument wordt door pdfkit getekend (rapport-pdf.ts) en niet
// door een browser over HTML heen. De algemene rapportroutes kennen maar twee
// wegen: een bewaarde PDF (kolom pdfBase64) of Playwright over de bewaarde HTML.
// Zonder een bewaarde PDF zou de download de HTML-weergave afdrukken in plaats
// van het echte studiekompas. Daarom zet deze module de pdfkit-tekening om naar
// een buffer die bij het rapport bewaard wordt, en levert ze daarnaast een
// eerlijke HTML-weergave voor de leesweergave op het scherm.
// ---------------------------------------------------------------------------

import { T4STUDENTS_INSTRUMENT } from "./instrument";
import { bouwT4StudentsRapport } from "./rapport-paginas";
import { renderT4StudentsRapport } from "./rapport-pdf";
import type { T4SBlok, T4SRapport, T4SRij } from "./rapport-contract";
import { leesT4StudentsContract } from "./afnamecontract";
import type { T4SAfnameContract } from "./afnamecontract";

/** Bouwt het volledige rapport uit een bevroren afnamecontract. */
export function bouwRapportUitContract(ruwContract: unknown): T4SRapport {
  const contract: T4SAfnameContract = leesT4StudentsContract(ruwContract);
  return bouwT4StudentsRapport(
    T4STUDENTS_INSTRUMENT,
    contract.resultaat,
    contract.antwoorden,
    contract.licentie,
    {
      naam: contract.respondent.naam,
      code: contract.respondent.code,
      datum: contract.datum,
      instrumentVersie: contract.instrumentVersie,
    },
  );
}

/** De titel in de rapportenlijst. */
export function titelVanRapport(rapport: T4SRapport): string {
  const naam = (rapport.naam ?? "").trim();
  return naam ? `T4Students Studiekompas: ${naam}` : "T4Students Studiekompas";
}

/**
 * Tekent het rapport en levert de PDF als buffer. pdfkit schrijft in stukken
 * naar een stroom; die stukken worden hier verzameld tot één buffer, hetzelfde
 * patroon dat de toetsen van dit instrument gebruiken.
 */
export function pdfVanRapport(rapport: T4SRapport): Promise<Buffer> {
  return new Promise((klaar, mislukt) => {
    try {
      const { doc } = renderT4StudentsRapport(rapport);
      const stukken: Buffer[] = [];
      doc.on("data", (stuk: Buffer) => stukken.push(stuk));
      doc.on("end", () => klaar(Buffer.concat(stukken)));
      doc.on("error", mislukt);
      doc.end();
    } catch (e) {
      mislukt(e);
    }
  });
}

// ── HTML-weergave ───────────────────────────────────────────────────────────

function veilig(tekst: unknown): string {
  return String(tekst ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getal(waarde: number | null | undefined, precisie = 1): string {
  if (typeof waarde !== "number" || !Number.isFinite(waarde)) return "geen meetpunt";
  return waarde.toFixed(precisie).replace(".", ",");
}

function rijHtml(rij: T4SRij): string {
  const naam = veilig(rij.construct);
  const omschrijving = rij.omschrijving ? `<span class="om">${veilig(rij.omschrijving)}</span>` : "";
  const groep = rij.groep ? veilig(rij.groep) : "niet volledig ingevuld";
  return (
    `<tr><th>${naam}${omschrijving}</th>` +
    `<td>${veilig(groep)}</td>` +
    `<td>${getal(rij.herkenning, rij.weergavePrecisie ?? 1)}</td>` +
    `<td>${getal(rij.energie)}</td>` +
    `<td>${veilig(rij.leeswoord)}</td></tr>`
  );
}

function tabelHtml(rijen: T4SRij[]): string {
  return (
    `<table><thead><tr><th>Wat gemeten is</th><th>Groep</th>` +
    `<th>Herkenning</th><th>Energie</th><th>Lezing</th></tr></thead><tbody>` +
    rijen.map(rijHtml).join("") +
    `</tbody></table>`
  );
}

function citaatregelsHtml(regels: { vraag: string; herkenning: string | null; energie: string | null }[]): string {
  return (
    `<ul class="citaat">` +
    regels
      .map((r) => {
        const staart = [r.herkenning, r.energie].filter(Boolean).map((s) => veilig(s)).join(" / ");
        return `<li><span class="vraag">${veilig(r.vraag)}</span>${staart ? `<em>${staart}</em>` : ""}</li>`;
      })
      .join("") +
    `</ul>`
  );
}

/** Eén blok naar HTML. Elke bloksoort van het rapportcontract komt hier voor. */
function blokHtml(blok: T4SBlok): string {
  switch (blok.soort) {
    case "intro":
      return `<p class="intro">${veilig(blok.tekst)}</p>`;
    case "alinea":
      return `<p>${veilig(blok.tekst)}</p>`;
    case "tussenkop":
      return `<h3>${veilig(blok.tekst)}</h3>`;
    case "banden":
      return (
        blok.banden
          .map(
            (band) =>
              `<section class="band"><h4>${veilig(band.nummer)}. ${veilig(band.titel)}</h4>` +
              `<p class="onder">${veilig(band.onderschrift)}</p>` +
              (band.noot ? `<p class="noot">${veilig(band.noot)}</p>` : "") +
              tabelHtml(band.rijen) +
              `</section>`,
          )
          .join("") +
        (blok.legende.length
          ? `<p class="legende">${blok.legende.map((l) => veilig(l)).join(" ")}</p>`
          : "") +
        (blok.naschrift.length
          ? blok.naschrift.map((n) => `<p class="noot">${veilig(n)}</p>`).join("")
          : "")
      );
    case "rangtabel":
      return (
        tabelHtml(blok.rijen) +
        blok.naschrift.map((n) => `<p class="noot">${veilig(n)}</p>`).join("")
      );
    case "constructblok":
      return (
        `<section class="constructblok"><h4>${veilig(blok.construct)}</h4>` +
        (blok.omschrijving ? `<p class="om">${veilig(blok.omschrijving)}</p>` : "") +
        `<p class="cijfers">Herkenning ${getal(blok.herkenning, blok.weergavePrecisie ?? 1)}` +
        ` / energie ${getal(blok.energie)}</p>` +
        `<p>${veilig(blok.duiding)}</p></section>`
      );
    case "citaat":
      return (
        `<section class="vlak"><p class="opschrift">${veilig(blok.opschrift)}</p>` +
        `<h4>${veilig(blok.kop)}</h4>${citaatregelsHtml(blok.regels)}</section>`
      );
    case "batterij":
      return `<p class="batterij"><strong>${getal(blok.waarde, 0)} op 10</strong> ${veilig(blok.zin)}</p>`;
    case "kolommen":
      return (
        `<div class="kolommen"><section><h4>${veilig(blok.kopLinks)}</h4>` +
        citaatregelsHtml(blok.links) +
        `</section><section><h4>${veilig(blok.kopRechts)}</h4>` +
        citaatregelsHtml(blok.rechts) +
        `</section></div>`
      );
    case "opsomming":
      return (
        (blok.kop ? `<h4>${veilig(blok.kop)}</h4>` : "") +
        `<ul>${blok.punten.map((p) => `<li>${veilig(p)}</li>`).join("")}</ul>`
      );
    case "kader":
      return (
        `<section class="kader"><p class="opschrift">${veilig(blok.opschrift)}</p>` +
        `<h4>${veilig(blok.kop)}</h4>` +
        (blok.omschrijving ? `<p class="om">${veilig(blok.omschrijving)}</p>` : "") +
        `<p>${veilig(blok.tekst)}</p></section>`
      );
    case "kaartvlak":
      return (
        `<section class="vlak"><p class="opschrift">${veilig(blok.opschrift)}</p>` +
        `<h4>${veilig(blok.kop)}</h4>` +
        (blok.omschrijving ? `<p class="om">${veilig(blok.omschrijving)}</p>` : "") +
        `<p class="${blok.citaatstijl ? "citaatstijl" : ""}">${veilig(blok.tekst)}</p>` +
        (blok.contactregel ? `<p class="contact">${veilig(blok.contactregel)}</p>` : "") +
        `</section>`
      );
    case "zinvlak":
      return `<blockquote>${veilig(blok.tekst)}</blockquote>`;
    case "kleinschrift":
      return `<p class="klein">${veilig(blok.tekst)}</p>`;
    case "paren":
      return (
        `<table class="paren"><tbody>` +
        blok.paren
          .map((p) => `<tr><th>${veilig(p.label)}</th><td>${veilig(p.waarde)}</td></tr>`)
          .join("") +
        `</tbody></table>`
      );
    case "vragen":
      return (
        `<section class="vragen"><h4>${veilig(blok.kop)}</h4>` +
        `<ol>${blok.vragen.map((v) => `<li>${veilig(v)}</li>`).join("")}</ol></section>`
      );
    case "ruimte":
      return `<div class="ruimte"></div>`;
    default:
      return "";
  }
}

const STIJL = `
  :root { color-scheme: light; }
  body { font-family: Georgia, "Times New Roman", serif; color: #2b2621; background: #f7f4ee;
         margin: 0; padding: 24px; line-height: 1.55; }
  .blad { background: #ffffff; max-width: 760px; margin: 0 auto 20px; padding: 32px 40px;
          border: 1px solid #e2d9c9; }
  .blad.cover { text-align: center; padding: 96px 40px; }
  h1 { font-size: 30px; margin: 0 0 8px; }
  h2 { font-size: 21px; margin: 0 0 4px; }
  h3 { font-size: 16px; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
  h4 { font-size: 15px; margin: 0 0 6px; }
  p { margin: 0 0 10px; font-size: 14px; }
  .ondertitel { font-size: 13px; color: #7b6f5e; margin-bottom: 18px; }
  .opschrift { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7c68;
               margin-bottom: 4px; }
  .om, .noot, .legende, .klein { font-size: 12px; color: #6f6357; }
  .om { display: block; font-weight: normal; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 12px; font-size: 13px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ece4d6; vertical-align: top; }
  thead th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a7c68; }
  .kader { border-left: 3px solid #b08a4f; background: #ffffff; padding: 12px 16px; margin: 0 0 14px; }
  .vlak { background: #f6efe2; padding: 12px 16px; margin: 0 0 14px; }
  blockquote { background: #f6efe2; font-style: italic; text-align: center; padding: 18px 24px;
               margin: 0 0 14px; }
  .citaat { list-style: none; padding: 0; margin: 0; font-size: 13px; }
  .citaat li { margin-bottom: 6px; }
  .citaat em { display: block; color: #6f6357; }
  .citaatstijl { font-style: italic; }
  .kolommen { display: flex; gap: 24px; }
  .kolommen > section { flex: 1; }
  .ruimte { height: 14px; }
  .voet { font-size: 11px; color: #8a7c68; border-top: 1px solid #ece4d6; margin-top: 20px;
          padding-top: 8px; }
  @media print { body { background: #ffffff; padding: 0; }
                 .blad { border: 0; margin: 0; page-break-after: always; } }
`;

/**
 * De leesweergave op het scherm. De echte PDF wordt door pdfkit getekend
 * (pdfVanRapport); deze HTML is er om het rapport in de app te kunnen lezen en
 * als terugvalpad wanneer de bewaarde PDF ontbreekt.
 */
export function htmlVanRapport(rapport: T4SRapport): string {
  const bladen = rapport.paginas
    .map((pagina) => {
      if (pagina.soort === "cover") {
        return (
          `<section class="blad cover"><h1>${veilig(pagina.titel)}</h1>` +
          `<p class="ondertitel">${veilig(pagina.ondertitel)}</p>` +
          `<p>${veilig(rapport.naam)}</p><p class="klein">${veilig(rapport.code)} ` +
          `${veilig(rapport.datum)}</p>` +
          pagina.blokken.map(blokHtml).join("") +
          `</section>`
        );
      }
      return (
        `<section class="blad"><h2>${veilig(pagina.titel)}</h2>` +
        (pagina.ondertitel ? `<p class="ondertitel">${veilig(pagina.ondertitel)}</p>` : "") +
        pagina.blokken.map(blokHtml).join("") +
        `<p class="voet">Een momentopname, geen oordeel of beslissing. ` +
        `Blad ${veilig(pagina.nr)}.</p></section>`
      );
    })
    .join("");
  return (
    `<!DOCTYPE html><html lang="${veilig(rapport.taal || "nl")}"><head>` +
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${veilig(titelVanRapport(rapport))}</title><style>${STIJL}</style></head><body>` +
    bladen +
    `</body></html>`
  );
}
