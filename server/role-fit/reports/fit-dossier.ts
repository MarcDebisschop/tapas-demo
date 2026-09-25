// ---------------------------------------------------------------------------
// server/role-fit/reports/fit-dossier.ts
//
// Dossier 1: Recruitment & Role Fit Dossier. Rendert het contract van
// bouwFitDossier naar HTML. Geen eigen logica: enkel weergave.
// ---------------------------------------------------------------------------
import { bewijsChips, bouwDocument, coverHtml, esc, INDICATIE_KLEUR, label, lijst, methodeBlokken, type Blok } from "./stijl";
import { fitKaart, groeibaan, orgFitKaart, rolContextMatrix } from "./svg";

export function renderFitDossier(c: any): string {
  const blokken: Blok[] = [];
  blokken.push({
    nieuwePagina: true,
    sectie: "Samenvatting",
    html: `<h2><span class="nr">1</span>Samenvatting voor het besluit</h2>
<p>Vier invalshoeken, elk met eigen bewijs. Er is geen totaalscore: lees elke kaart op zichzelf.</p>
<div class="kaarten">${c.statuskaarten
      .map(
        (k: any) =>
          `<div class="kaart"><div class="t">${esc(k.titel)}</div><div class="w">${esc(k.waarde)}</div><div class="klein">${esc(k.toelichting)}</div><div style="margin-top:1.6mm">${bewijsChips(k.bewijs)}</div></div>`,
      )
      .join("")}</div>`,
  });
  blokken.push({
    html: `<h3>Rol- en contextmatrix</h3><p class="klein">Aantal vereisten per kriticiteit en fit-indicatie. Gates staan apart.</p>${rolContextMatrix(c.matrix)}`,
  });

  const bl = c.blauwdruk;
  blokken.push({
    nieuwePagina: true,
    sectie: "Rolblauwdruk",
    html: `<h2><span class="nr">2</span>Rolblauwdruk</h2><div class="kader"><b>Missie van de rol</b><p>${esc(bl.missie || "Niet ingevuld.")}</p></div>
<h3>Beoogde resultaten</h3>${lijst(bl.resultaten)}
<div class="twee"><div><h3>Na 90 dagen</h3><p>${esc(bl.verwachtingen.d90 || "Niet ingevuld.")}</p></div><div><h3>Na 180 dagen</h3><p>${esc(bl.verwachtingen.d180 || "Niet ingevuld.")}</p></div></div>
<h3>Na een jaar</h3><p>${esc(bl.verwachtingen.d365 || "Niet ingevuld.")}</p>`,
  });
  blokken.push({
    html: `<h3>Vereisten</h3><table class="splits"><thead><tr><th>Vereiste</th><th>Dimensie</th><th>Niveau</th><th>Kriticiteit</th></tr></thead><tbody>${bl.vereisten
      .map((v: any) => `<tr><td>${esc(v.vereiste)}</td><td>${esc(v.dimensie)}</td><td>${esc(v.niveau)}</td><td>${esc(v.kriticiteit)}</td></tr>`)
      .join("")}</tbody></table>`,
  });

  blokken.push({
    nieuwePagina: true,
    sectie: "Omgeving en organisatie",
    html: `<h2><span class="nr">3</span>Omgeving en organisatie</h2>${
      c.omgeving.velden.length
        ? `<table class="splits"><thead><tr><th style="width:45mm">Aspect</th><th>Beschrijving</th></tr></thead><tbody>${c.omgeving.velden
            .map((v: any) => `<tr><td>${esc(v.sleutel)}</td><td>${esc(v.waarde)}</td></tr>`)
            .join("")}</tbody></table>`
        : `<p class="klein">Geen omgevingsvelden ingevuld in de wizard.</p>`
    }`,
  });
  blokken.push({
    html: `<h3>Bevestigde contextclaims</h3>${bewijsChips(["context"])}<table class="splits"><thead><tr><th style="width:36mm">Categorie</th><th>Claim</th><th style="width:14mm">Bron</th></tr></thead><tbody>${
      c.omgeving.claims.length
        ? c.omgeving.claims.map((k: any) => `<tr><td>${esc(k.categorie)}</td><td>${esc(k.claim)}</td><td>${esc(k.bronId ?? "wizard")}</td></tr>`).join("")
        : `<tr><td colspan="3">Geen bevestigde claims over omgeving, organisatie of team.</td></tr>`
    }</tbody></table>`,
  });

  blokken.push({
    nieuwePagina: true,
    sectie: "Werkpatroon uit het profiel",
    html: `<h2><span class="nr">4</span>Werkpatroon uit het profiel</h2>
<p>Bron: ${esc(c.profielbron.instrument)}. Het net-signaal en de energie per construct, zoals in het rapportcontract van de afname. Geen omrekening, geen aanvulling van ontbrekende waarden.</p>${bewijsChips(["profiel"])}`,
  });
  blokken.push({
    html: `<table class="splits"><thead><tr><th>Construct</th><th>Familie</th><th>Net-signaal</th><th>Energie</th></tr></thead><tbody>${c.patroon
      .map(
        (p: any) =>
          `<tr><td>${esc(p.construct)}</td><td>${esc(p.familie)}</td><td>${p.volledig ? esc(p.net) : "niet beschikbaar"}</td><td>${p.volledig ? esc(p.energie) : "niet beschikbaar"}</td></tr>`,
      )
      .join("")}</tbody></table>`,
  });

  blokken.push({
    nieuwePagina: true,
    sectie: "Fitkaart",
    html: `<h2><span class="nr">5</span>Fitkaart met betrouwbaarheid</h2><p class="klein">Kleur: fit-indicatie. Bolletjes: betrouwbaarheid (een is laag, twee is midden, drie is hoog). Zonder observatie is de betrouwbaarheid ten hoogste midden.</p>`,
  });
  const nietGate = c.matrix.filter((r: any) => !r.gate);
  for (let i = 0; i < nietGate.length; i += 14) {
    blokken.push({ html: fitKaart(nietGate.slice(i, i + 14)) });
  }

  blokken.push({
    nieuwePagina: true,
    sectie: "Fit per vereiste",
    html: `<h2><span class="nr">6</span>Fit per vereiste</h2><p class="klein">Waarom elke indicatie er staat, welke andere verklaring mogelijk is en wat nog te verifiëren valt.</p>`,
  });
  for (const r of c.matrix) {
    blokken.push({
      html: `<div class="kaart" style="border-top-color:${INDICATIE_KLEUR[r.indicatie]}"><div class="t">${esc(r.dimensie)} &middot; ${esc(r.fitTypeLabel)} &middot; ${esc(r.kriticiteitLabel)}</div>
<div class="w">${esc(r.vereiste)}</div>
<div>${label(r.indicatieLabel, INDICATIE_KLEUR[r.indicatie])} <span class="klein">Betrouwbaarheid: ${esc(r.confidenceLabel)} &middot; Ontwikkelafstand: ${esc(r.afstandLabel)}</span></div>
<div class="twee" style="margin-top:1.5mm"><div><b class="klein">Waarom</b>${lijst(r.uitleg)}</div><div><b class="klein">Andere verklaringen</b>${lijst(r.alternatieven)}</div></div>
<div>${bewijsChips(r.bewijs)}</div></div>`,
    });
  }

  blokken.push({
    nieuwePagina: true,
    sectie: "Organisatiefit",
    html: `<h2><span class="nr">7</span>Organisatiefit in vier delen</h2>${orgFitKaart([
      { titel: "Wat de rol vraagt", rijen: c.orgFit.vraagVermogen },
      { titel: "Wat de omgeving biedt", rijen: c.orgFit.behoefteAanbod },
      { titel: "Gelijkenis in waarden", rijen: c.orgFit.gelijkenis },
      { titel: "Aanvulling op het team", rijen: c.orgFit.aanvulling },
    ])}`,
  });

  blokken.push({
    sectie: "Scenario's",
    html: `<h2><span class="nr">8</span>Scenario's</h2><p class="klein">Voorwaardelijke beschrijvingen, geen voorspellingen.</p>${c.scenarios
      .map((s: any) => `<div class="kader" style="margin-bottom:2.5mm"><b>${esc(s.naam)}</b><p>${esc(s.beschrijving)}</p>${lijst(s.aandachtspunten)}</div>`)
      .join("")}`,
  });

  blokken.push({
    nieuwePagina: true,
    sectie: "Groeibaan",
    html: `<h2><span class="nr">9</span>Groeibaan</h2><p class="klein">Ontwikkelafstand voor de vereisten die ontwikkelbaar zijn. Een onbekende afstand staat als stippellijn.</p>${groeibaan(c.runway)}`,
  });

  blokken.push({
    sectie: "Verificatieagenda",
    html: `<h2><span class="nr">10</span>Verificatieagenda</h2><table class="splits"><thead><tr><th>Vereiste</th><th style="width:26mm">Kriticiteit</th><th style="width:36mm">Route</th><th>Vraag</th></tr></thead><tbody>${
      c.verificatieagenda.length
        ? c.verificatieagenda.map((v: any) => `<tr><td>${esc(v.vereiste)}</td><td>${esc(v.kriticiteitLabel)}</td><td>${esc(v.route)}</td><td>${esc(v.vraag)}</td></tr>`).join("")
        : `<tr><td colspan="4">Geen open punten.</td></tr>`
    }</tbody></table>`,
  });
  blokken.push({
    html: `<h3>Knock-out-vereisten</h3><p class="klein">Worden nooit uit het profiel afgeleid.</p>${bewijsChips(["technisch", "referentie"])}<table class="splits"><thead><tr><th>Vereiste</th><th style="width:40mm">Status</th></tr></thead><tbody>${
      c.gates.length ? c.gates.map((g: any) => `<tr><td>${esc(g.vereiste)}</td><td>${esc(g.statusLabel)}</td></tr>`).join("") : `<tr><td colspan="2">Geen knock-out-vereisten.</td></tr>`
    }</tbody></table>`,
  });

  blokken.push(...methodeBlokken(c.methode, c.bronnen, c.versies));

  return bouwDocument({
    titel: `Recruitment & Role Fit Dossier - ${c.zaak.functieTitel}`,
    documentLabel: "Recruitment & Role Fit Dossier",
    kenmerk: `Case ${c.zaak.id}`,
    voetMeta: `${c.product} | contract ${c.contractversie}`,
    cover: coverHtml({
      merk: "TaPas Recruitment & Role Fit",
      titel: "Recruitment & Role Fit Dossier",
      sub: c.zaak.functieTitel,
      rijen: [
        ["Kandidaat", c.zaak.kandidaatLabel],
        ["Beslisdoel", c.zaak.beslisdoel],
        ["Senioriteit", c.zaak.senioriteit || "Niet opgegeven"],
        ["Beslisdatum", c.zaak.beslisdatum || "Niet opgegeven"],
        ["Gegevens bevroren op", c.zaak.bevrorenOp || "Nog niet bevroren"],
        ["Rechtsgrond", c.zaak.rechtsgrond],
      ],
      noot: "Beslissingsondersteuning, geen besluit. Profielsignalen zijn hypothesen over gedrag en energie in deze rol, te toetsen in de H-BOM Evidence Check. Vertrouwelijk: enkel voor wie bij dit besluit betrokken is.",
    }),
    blokken,
  });
}
