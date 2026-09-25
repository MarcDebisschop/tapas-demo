// ---------------------------------------------------------------------------
// server/role-fit/reports/hbom-guide.ts
//
// Dossier 2: H-BOM Evidence Check Guide. Gids voor de case-eigenaar en de
// ondertekenaar. Bevat de hypothesen en daarom NIET bedoeld voor observatoren
// voor de observaties vergrendeld zijn (de routes bewaken dat).
// ---------------------------------------------------------------------------
import { bouwDocument, coverHtml, esc, lijst, methodeBlokken, type Blok } from "./stijl";

export function renderHbomGids(c: any): string {
  const blokken: Blok[] = [];
  const geselecteerd = c.pool.filter((h: any) => h.geselecteerd);
  blokken.push({
    nieuwePagina: true,
    sectie: "Opzet",
    html: `<h2><span class="nr">1</span>Opzet van de Evidence Check</h2>
<div class="kaarten"><div class="kaart"><div class="t">Pakket</div><div class="w">${esc(c.pakketLabel || "Nog niet gekozen")}</div><div class="klein">${esc(c.aantalGeselecteerd)} geselecteerde hypothesen uit een pool van ${esc(c.pool.length)}.</div></div>
<div class="kaart"><div class="t">Observatoren</div><div class="w">${esc(c.observatoren.length)} toegewezen</div><div class="klein">${c.observatoren.map((o: any) => `${esc(o.rol === "recruiter" ? "Recruiter" : "Hiring manager")}: ${esc(o.naam)}`).join("<br>") || "Nog niet toegewezen."}</div></div></div>
<h3>Semi-blinde werkwijze</h3>${lijst(c.semiBlind)}`,
  });
  blokken.push({
    html: `<h3>Hypothesepool</h3><p class="klein">Prioriteit is kriticiteit maal onzekerheid maal observeerbaarheid. Een hogere waarde betekent meer informatiewinst per minuut, geen oordeel.</p>
<table class="splits"><thead><tr><th style="width:9mm">Rang</th><th>Dimensie</th><th style="width:22mm">Kriticiteit</th><th style="width:20mm">Onzekerheid</th><th style="width:22mm">Observeerbaar</th><th style="width:16mm">Prioriteit</th><th style="width:16mm">Gekozen</th></tr></thead><tbody>${c.pool
      .map(
        (h: any) =>
          `<tr><td>${esc(h.rang)}</td><td>${esc(h.dimensie)}</td><td>${esc(h.kriticiteitLabel)}</td><td>${esc(h.onzekerheid)}</td><td>${esc(h.observeerbaarheidLabel)}</td><td>${esc(h.prioriteit)}</td><td>${h.geselecteerd ? "ja" : "nee"}</td></tr>`,
      )
      .join("")}</tbody></table>`,
  });

  blokken.push({ nieuwePagina: true, sectie: "Hypothesen", html: `<h2><span class="nr">2</span>Geselecteerde hypothesen</h2><p class="klein">Enkel voor de gids. Observatoren zien deze pagina niet.</p>` });
  for (const h of geselecteerd) {
    blokken.push({
      html: `<div class="kaart"><div class="t">${esc(h.dimensie)} &middot; ${esc(h.methodeLabel)}</div><div class="w">${esc(h.stelling)}</div>
<p class="klein"><b>Tegenhypothese:</b> ${esc(h.tegenhypothese)}</p>
<div class="twee"><div><b class="klein">Bevestigend gedrag</b>${lijst(h.bevestigend)}</div><div><b class="klein">Tegengesteld gedrag</b>${lijst(h.tegen)}</div></div>
<b class="klein">Andere verklaringen</b>${lijst(h.alternatief)}
<p class="klein"><b>Niet afleiden:</b> ${esc(h.verbodenInferentie)}</p></div>`,
    });
  }

  blokken.push({ nieuwePagina: true, sectie: "Oefeningen", html: `<h2><span class="nr">3</span>Oefeningen en ankers</h2><p class="klein">Dit is wat de observatoren zien.</p>` });
  for (const o of c.oefeningen) {
    blokken.push({
      html: `<div class="kaart"><div class="t">Oefening ${esc(o.volgorde)} &middot; ${esc(o.methodeLabel)}</div><div class="w">${esc(o.titel)}</div><p>${esc(o.instructie)}</p>
<b class="klein">Doorvragen</b>${lijst(o.probes)}
<table><thead><tr><th style="width:26mm">Anker</th><th>Beschrijving</th></tr></thead><tbody>
<tr><td>5</td><td>${esc(o.ankers["5"])}</td></tr><tr><td>3</td><td>${esc(o.ankers["3"])}</td></tr><tr><td>1</td><td>${esc(o.ankers["1"])}</td></tr><tr><td>Onvoldoende kans</td><td>${esc(o.ankers.onvoldoende)}</td></tr></tbody></table></div>`,
    });
  }

  blokken.push({
    sectie: "Knock-out-vereisten",
    html: `<h3>Knock-out-vereisten: aparte route</h3><table class="splits"><thead><tr><th>Vereiste</th><th>Route</th><th>Status</th></tr></thead><tbody>${
      c.gates.length ? c.gates.map((g: any) => `<tr><td>${esc(g.vereiste)}</td><td>${esc(g.route)}</td><td>${esc(g.statusLabel)}</td></tr>`).join("") : `<tr><td colspan="3">Geen.</td></tr>`
    }</tbody></table>`,
  });

  blokken.push(...methodeBlokken(c.methode, [], c.versies));
  return bouwDocument({
    titel: `H-BOM Evidence Check Guide - ${c.zaak.functieTitel}`,
    documentLabel: "H-BOM Evidence Check Guide",
    kenmerk: `Case ${c.zaak.id}`,
    voetMeta: `${c.product} | contract ${c.contractversie}`,
    cover: coverHtml({
      merk: "TaPas Recruitment & Role Fit",
      titel: "H-BOM Evidence Check Guide",
      sub: c.zaak.functieTitel,
      rijen: [
        ["Kandidaat", c.zaak.kandidaatLabel],
        ["Pakket", c.pakketLabel || "Nog niet gekozen"],
        ["Gegevens bevroren op", c.zaak.bevrorenOp || "Nog niet bevroren"],
      ],
      noot: "Hypothesegestuurde gedragsobservatie. Deze gids bevat de hypothesen en is niet bedoeld voor de observatoren tot hun observaties vergrendeld zijn.",
    }),
    blokken,
  });
}
