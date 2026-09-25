// ---------------------------------------------------------------------------
// server/role-fit/reports/decision-dossier.ts
//
// Dossier 3: Integrated Decision & Growth Dossier, en het losse uittreksel met
// feedback voor de kandidaat.
// ---------------------------------------------------------------------------
import { bewijsChips, bouwDocument, coverHtml, esc, INTEGRATIE_KLEUR, label, lijst, methodeBlokken, type Blok } from "./stijl";
import { convergentieMatrix, groeibaan } from "./svg";

function convKaart(r: any): string {
  return `<div class="kaart" style="border-top-color:${INTEGRATIE_KLEUR[r.status]}"><div class="t">${esc(r.dimensie)}</div><div class="w">${esc(r.stelling)}</div>
<div>${label(r.statusLabel, INTEGRATIE_KLEUR[r.status])} <span class="klein">Betrouwbaarheid: ${esc(r.confidenceLabel)}${r.overschreven ? ` &middot; berekend: ${esc(r.berekendLabel)}` : ""}</span></div>
${lijst(r.redenen)}${r.overschreven ? `<p class="klein"><b>Reden voor aanpassing:</b> ${esc(r.overrideReden)}</p>` : ""}<div>${bewijsChips(r.bewijs)}</div></div>`;
}

function feedbackHtml(f: any): string {
  return `<h2>Feedback voor de kandidaat</h2><p class="klein">Rol: ${esc(f.functieTitel)}</p>
<div class="kader"><p>${esc(f.tekst || "Nog geen feedbacktekst vastgelegd.")}</p></div>
<div class="twee"><div><h3>Wat zichtbaar werd</h3>${lijst(f.zichtbaar)}</div><div><h3>Om verder te verkennen</h3>${lijst(f.verder)}</div></div>
<p class="klein">${esc(f.uitleg)}</p>`;
}

export function renderBesluitDossier(c: any): string {
  const blokken: Blok[] = [];
  const b = c.besluit;
  blokken.push({
    nieuwePagina: true,
    sectie: "Besluit",
    html: `<h2><span class="nr">1</span>Besluit</h2>${
      b
        ? `<div class="kaarten"><div class="kaart"><div class="t">Aanbeveling</div><div class="w">${esc(b.aanbevelingLabel)}</div><div class="klein">Getekend door ${esc(b.ondertekenaar)} op ${esc(b.getekendOp)}</div></div>
<div class="kaart"><div class="t">Invoerhash</div><div class="w" style="font-size:8pt;word-break:break-all">${esc(b.inputHash)}</div><div class="klein">Het besluit hoort bij precies deze vastgelegde gegevens.</div></div></div>
<h3>Motivering</h3><div class="kader"><p>${esc(b.rationale)}</p></div><h3>Voorwaarden</h3>${lijst(b.voorwaarden)}`
        : `<p>Er is nog geen getekend besluit. Dit is een conceptversie.</p>`
    }`,
  });
  blokken.push({
    html: `<h3>Knock-out-vereisten</h3><table class="splits"><thead><tr><th>Vereiste</th><th style="width:32mm">Status</th><th>Toelichting</th></tr></thead><tbody>${
      c.gates.length ? c.gates.map((g: any) => `<tr><td>${esc(g.vereiste)}</td><td>${esc(g.statusLabel)}</td><td>${esc(g.toelichting)}</td></tr>`).join("") : `<tr><td colspan="3">Geen.</td></tr>`
    }</tbody></table>`,
  });

  blokken.push({
    nieuwePagina: true,
    sectie: "Convergentie",
    html: `<h2><span class="nr">2</span>Convergentie van bewijs</h2><p class="klein">Per hypothese: profielrichting, ankerscore van elke observator en de integratiestatus. Niet uitgemiddeld.</p>`,
  });
  for (let i = 0; i < c.convergentie.length; i += 14) blokken.push({ html: convergentieMatrix(c.convergentie.slice(i, i + 14)) });

  const groepen: Array<[string, any[]]> = [
    ["Sterktes met convergerend bewijs", c.sterktes],
    ["Risico's en tegenindicaties", c.risicos],
    ["Gemengd en contextafhankelijk", c.gemengd.filter((x: any) => !c.risicos.includes(x))],
    ["Onvoldoende bewijs", c.onvoldoende],
  ];
  groepen.forEach(([titel, rijen], i) => {
    blokken.push({ nieuwePagina: i === 0, sectie: "Bevindingen", html: `<h3>${esc(titel)}</h3>${rijen.length ? "" : `<p class="klein">Geen.</p>`}` });
    for (const r of rijen) blokken.push({ html: convKaart(r) });
  });

  blokken.push({
    nieuwePagina: true,
    sectie: "Groei en start",
    html: `<h2><span class="nr">3</span>Groeibaan en startplan</h2>${groeibaan(c.runway)}`,
  });
  if (b) {
    blokken.push({ html: `<div class="twee"><div><h3>Eerste 100 dagen</h3><p>${esc(b.plan100 || "Niet ingevuld.")}</p></div><div><h3>Tot 180 dagen</h3><p>${esc(b.plan180 || "Niet ingevuld.")}</p></div></div>` });
    blokken.push({
      html: `<h3>Vervolgstappen</h3><table class="splits"><thead><tr><th>Stap</th><th style="width:40mm">Eigenaar</th><th style="width:30mm">Termijn</th></tr></thead><tbody>${
        b.vervolgstappen.length ? b.vervolgstappen.map((s: any) => `<tr><td>${esc(s.stap)}</td><td>${esc(s.eigenaar)}</td><td>${esc(s.termijn)}</td></tr>`).join("") : `<tr><td colspan="3">Geen.</td></tr>`
      }</tbody></table>`,
    });
  }

  const a = c.audit;
  blokken.push({
    nieuwePagina: true,
    sectie: "Spoor",
    html: `<h2><span class="nr">4</span>Spoor van het besluit</h2><table><tbody>
<tr><td style="width:55mm">Gegevens bevroren op</td><td>${esc(a.bevrorenOp || "Niet bevroren")}</td></tr>
<tr><td>Reden bevriezing onder voorbehoud</td><td>${esc(a.freezeOverride || "Niet van toepassing")}</td></tr>
${a.observatoren.map((o: any) => `<tr><td>${esc(o.rol === "recruiter" ? "Recruiter" : "Hiring manager")}: ${esc(o.naam)}</td><td>Ingediend op ${esc(o.ingediendOp || "niet ingediend")}</td></tr>`).join("")}
</tbody></table>
<h3>Correcties op observaties</h3>${lijst(a.correcties.map((k: any) => `Opdracht ${k.opdracht}, oefening ${k.oefening}, versie ${k.versie}: ${k.reden}`))}
<h3>Aanpassingen van de integratie</h3>${lijst(a.overrides.map((o: any) => `Hypothese ${o.hypotheseId}: ${o.reden}`))}`,
  });

  blokken.push(...methodeBlokken(c.methode, c.bronnen, c.versies));
  blokken.push({ nieuwePagina: true, sectie: "Feedback voor de kandidaat", html: feedbackHtml(c.kandidaatFeedback) });

  return bouwDocument({
    titel: `Integrated Decision & Growth Dossier - ${c.zaak.functieTitel}`,
    documentLabel: "Integrated Decision & Growth Dossier",
    kenmerk: `Case ${c.zaak.id}`,
    voetMeta: `${c.product} | contract ${c.contractversie}`,
    cover: coverHtml({
      merk: "TaPas Recruitment & Role Fit",
      titel: "Integrated Decision & Growth Dossier",
      sub: c.zaak.functieTitel,
      rijen: [
        ["Kandidaat", c.zaak.kandidaatLabel],
        ["Beslisdoel", c.zaak.beslisdoel],
        ["Aanbeveling", b ? b.aanbevelingLabel : "Nog geen besluit"],
        ["Getekend op", b ? b.getekendOp : "Niet getekend"],
      ],
      noot: "Het besluit is een menselijk besluit met een geschreven motivering. Dit dossier legt het bewijs en de redenering vast. Vertrouwelijk.",
    }),
    blokken,
  });
}

export function renderKandidaatFeedback(c: any): string {
  return bouwDocument({
    titel: `Feedback - ${c.zaak.functieTitel}`,
    documentLabel: "Feedback voor de kandidaat",
    kenmerk: c.zaak.kandidaatLabel,
    voetMeta: `${c.product}`,
    cover: coverHtml({
      merk: "TaPas",
      titel: "Feedback over je selectieproces",
      sub: c.zaak.functieTitel,
      rijen: [["Voor", c.zaak.kandidaatLabel]],
      noot: "Deze feedback gaat over wat binnen dit proces zichtbaar werd. Ze is geen oordeel over wie je bent.",
    }),
    blokken: [
      { nieuwePagina: true, sectie: "Feedback", html: feedbackHtml(c.feedback) },
      { html: `<h3>Over deze feedback</h3>${lijst(c.methode.regels.slice(-1))}` },
    ],
  });
}
