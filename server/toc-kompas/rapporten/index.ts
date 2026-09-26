// ---------------------------------------------------------------------------
// server/toc-kompas/rapporten/index.ts
//
// De vier rapporten van het TOC Commitmentkompas:
//   captain-charter       de ingevulde vragenlijst van een Captain als charter;
//   workshopdossier       de consolidatie voor de alignment workshop;
//   commitment-register   register, kaarten, Coverage Matrix en Decision Log;
//   kwartaalscorecard     de stand van de vastgestelde commitments.
//
// Eigen rapportregister van de module, los van server/rapport-registry.ts,
// zodat de bestaande rapporten onaangeroerd blijven.
// ---------------------------------------------------------------------------
import {
  ACCEPTATIECRITERIA,
  BESLUITREGELS,
  CAPACITEIT_CATEGORIEEN,
  CAPTAIN_ROL_INFO,
  CIRKEL_TEKST,
  COMMITMENT_STATUS_LABEL,
  COMMITMENT_STATUSSEN,
  COMMITMENT_TYPE_LABEL,
  DEKKINGSSCORES,
  DOMEINEN,
  GEEN_GEMIDDELDE,
  KAART_VELDEN,
  KERNREGEL,
  RACI_UITLEG,
  REFLECTIE,
  REFLECTIE_BD,
  REFLECTIE_BD_TITEL,
  RONDE_STATUS_LABEL,
  SIGNAAL_INFO,
  SIGNAAL_SOORTEN,
  VISIBILITY_GRENZEN,
  VISIBILITY_ROLBEDOELING,
  VRAAGBLOKKEN,
  WORKSHOP_AGENDA,
  WORKSHOP_VOORBEREIDING,
  beschikbareUren,
  capaciteitSom,
  urenVoor,
  type Antwoorden,
  type CaptainRol,
  type RapportType,
} from "@shared/toc-kompas";
import { bouwDocument, coverHtml, datum, esc, KLEUR, label, lijst, slot, waarde, type Blok } from "./stijl";

const STATUS_KLEUR: Record<string, string> = { groen: "#2E7D32", amber: KLEUR.amber, rood: "#B42318", geblokkeerd: "#5B5B5B" };

function statusLabel(s: string): string {
  return label(COMMITMENT_STATUS_LABEL[s as keyof typeof COMMITMENT_STATUS_LABEL] ?? s, STATUS_KLEUR[s] ?? KLEUR.grijs, s === "amber" ? KLEUR.ink : "#fff");
}

function voet(c: any): string {
  return `${c.ronde.titel} (${c.ronde.periode}) · ${c.moduleversie}`;
}

// ---- Captain Charter ---------------------------------------------------------------------------
function renderCharter(c: any): string {
  const cap = c.captain;
  const rol = cap.rol as CaptainRol;
  const info = CAPTAIN_ROL_INFO[rol];
  const a: Antwoorden = c.antwoorden;
  const uren = beschikbareUren(a);
  const blokken: Blok[] = [];

  blokken.push({
    nieuwePagina: true,
    sectie: "Rol in de cirkel",
    html: `<h2>Rol in de cirkel</h2><div class="kader"><p>${esc(CIRKEL_TEKST)}</p></div>
<div class="kaarten" style="margin-top:3mm"><div class="kaart"><div class="t">Primaire waarde</div><div class="w">${esc(info.primaireWaarde)}</div></div>
<div class="kaart"><div class="t">Grens</div><div class="w">${esc(info.grens)}</div></div>
<div class="kaart"><div class="t">Deliveryfocus</div><p>${esc(info.deliveryfocus)}</p></div>
<div class="kaart"><div class="t">Bedrijfsleidingfocus</div><p>${esc(info.bedrijfsleidingfocus)}</p></div></div>
${rol === "visibility" ? `<h3>Rolbedoeling</h3><p>${esc(VISIBILITY_ROLBEDOELING)}</p><h3>Grenzen</h3>${lijst(VISIBILITY_GRENZEN)}` : ""}`,
  });

  for (const blok of VRAAGBLOKKEN) {
    const rijen = blok.vragen.map((v) => `<tr><td style="width:48mm"><b>${esc(v.label)}</b><div class="klein">${esc(v.hulp)}</div></td><td>${waarde(a.velden?.[v.sleutel])}</td></tr>`).join("");
    const extra: string[] = [];
    if (blok.sleutel === "B") {
      extra.push(`<h3>Verdeling van de capaciteit</h3><table><thead><tr><th>Categorie</th><th>Percentage</th><th>Uren per week</th><th>Betekenis</th></tr></thead><tbody>${CAPACITEIT_CATEGORIEEN.map((k) => {
        const p = a.capaciteit[k.sleutel];
        return `<tr><td><b>${esc(k.label)}</b></td><td>${p === null ? waarde(null) : `${esc(p)}%`}</td><td>${waarde(urenVoor(p, uren))}</td><td>${esc(k.uitleg)}</td></tr>`;
      }).join("")}<tr><td><b>Totaal</b></td><td><b>${capaciteitSom(a) === null ? "onvolledig" : `${esc(capaciteitSom(a))}%`}</b></td><td>${waarde(uren)}</td><td>Delivery, bedrijfsleiding en buffer samen zijn 100%.</td></tr></tbody></table>`);
    }
    if (blok.sleutel === "C") {
      extra.push(`<h3>Delivery commitments</h3><table class="splits"><thead><tr><th>#</th><th>Outcome / deliverable</th><th>Ontvanger</th><th>Bewijs &amp; acceptatie</th><th>Deadline</th><th>Uren/week</th><th>A/R/C/I</th></tr></thead><tbody>${
        a.delivery.filter((r) => r.outcome.trim()).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.outcome)}</td><td>${waarde(r.ontvanger)}</td><td>${waarde(r.bewijs)}</td><td>${waarde(r.deadline)}</td><td>${waarde(r.uren)}</td><td>${waarde(r.raci)}</td></tr>`).join("") ||
        `<tr><td colspan="7" class="leeg">Geen delivery commitments ingevuld.</td></tr>`
      }</tbody></table>`);
    }
    if (blok.sleutel === "D") {
      extra.push(`<h3>Bedrijfsleiding commitments</h3><table class="splits"><thead><tr><th>#</th><th>Leiderschapsuitkomst</th><th>Beslissing / kader</th><th>Bewijs</th><th>Deadline</th><th>Uren/week</th><th>Mandaat</th></tr></thead><tbody>${
        a.bedrijfsleiding.filter((r) => r.uitkomst.trim()).map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.uitkomst)}</td><td>${waarde(r.beslissing)}</td><td>${waarde(r.bewijs)}</td><td>${waarde(r.deadline)}</td><td>${waarde(r.uren)}</td><td>${waarde(r.mandaat)}</td></tr>`).join("") ||
        `<tr><td colspan="7" class="leeg">Geen bedrijfsleiding commitments ingevuld.</td></tr>`
      }</tbody></table>`);
    }
    blokken.push({ nieuwePagina: blok.sleutel === "A", sectie: "Vragenlijst", html: `<h2>${esc(blok.titel)}</h2><table class="splits"><tbody>${rijen}</tbody></table>` });
    for (const e of extra) blokken.push({ html: e });
  }

  blokken.push({
    nieuwePagina: true,
    sectie: "Dekkingsscan",
    html: `<h2>Dekkingsscan</h2><p class="klein">${esc(RACI_UITLEG)}</p><table class="splits"><thead><tr><th>Domein</th><th>Mijn rol</th><th>Gewenste rol</th><th>Uren/maand</th><th>Zekerheid 1 tot 5</th><th>Wat ontbreekt</th></tr></thead><tbody>${DOMEINEN.map((d) => {
      const r = a.dekking?.[d.sleutel];
      return `<tr><td><b>${esc(d.naam)}</b></td><td>${waarde(r?.mijnRol)}</td><td>${waarde(r?.gewensteRol)}</td><td>${waarde(r?.urenPerMaand)}</td><td>${waarde(r?.zekerheid)}</td><td>${waarde(r?.ontbrekend)}</td></tr>`;
    }).join("")}</tbody></table>`,
  });

  const refl = REFLECTIE[rol];
  blokken.push({
    nieuwePagina: true,
    sectie: "Reflectie",
    html: `<h2>Reflectie voor de ${esc(info.titel)}</h2><table class="splits"><tbody>${refl.map((v, i) => `<tr><td style="width:70mm"><b>${esc(v)}</b></td><td>${waarde(a.reflectie?.[`r${i + 1}`])}</td></tr>`).join("")}</tbody></table>`,
  });
  const bd = REFLECTIE_BD.map((v, i) => [v, a.reflectie?.[`bd${i + 1}`]] as const).filter(([, x]) => x && String(x).trim());
  if (bd.length) {
    blokken.push({ html: `<h3>${esc(REFLECTIE_BD_TITEL)}</h3><table class="splits"><tbody>${bd.map(([v, x]) => `<tr><td style="width:70mm"><b>${esc(v)}</b></td><td>${esc(x)}</td></tr>`).join("")}</tbody></table>` });
  }
  blokken.push({ html: `<div class="kader"><p><b>Kernregel.</b> ${esc(KERNREGEL)}</p></div>${slot()}` });

  const ind = c.indiening;
  return bouwDocument({
    titel: `Captain Charter ${cap.naam}`,
    documentLabel: "Captain Charter",
    kenmerk: `${info.titel}`,
    voetMeta: voet(c),
    cover: coverHtml({
      merk: "TOC Commitmentkompas",
      titel: "Captain Charter",
      sub: info.titel,
      rijen: [
        ["Captain", cap.naam],
        ["Ronde", `${c.ronde.titel} (${c.ronde.periode})`],
        ["Ingediend", ind ? `${datum(ind.ingediendOp)}, versie ${ind.versie}` : "nog niet ingediend"],
        ["Inhoudshash", ind ? String(ind.contentHash).slice(0, 16) : "geen"],
      ],
      concept: ind ? undefined : "Concept: nog niet ingediend",
      noot: "Individueel ingevuld zonder de antwoorden van andere Captains te zien. Dit charter is de persoonlijke inbreng voor de gezamenlijke workshop, geen vastgesteld commitment.",
    }),
    blokken,
  });
}

// ---- Gedeelde onderdelen voor de TOC-rapporten -----------------------------------------------
function naamVan(c: any, id: number | null): string {
  const cap = c.captains.find((x: any) => x.id === id);
  return cap ? cap.naam : "";
}

function capaciteitTabel(c: any): string {
  const rijen = c.consolidatie.capaciteit
    .map(
      (r: any) =>
        `<tr><td><b>${esc(r.naam)}</b><div class="klein">${esc(r.titel)}</div></td><td>${waarde(r.beschikbareUren)}</td><td>${waarde(r.zekerheid)}</td><td>${r.deliveryPct ?? "?"}% / ${r.bedrijfsleidingPct ?? "?"}% / ${r.bufferPct ?? "?"}%</td><td>${r.som === null ? "onvolledig" : `${esc(r.som)}%`}</td><td>${esc(r.geplandeUren)}</td><td>${waarde(r.inzetbaarUren)}</td><td>${r.benutting === null ? waarde(null) : `${esc(r.benutting)}%`}</td></tr>`,
    )
    .join("");
  return `<table class="splits"><thead><tr><th>Captain</th><th>Uren/week</th><th>Zekerheid</th><th>Delivery / leiding / buffer</th><th>Som</th><th>Gepland u/wk</th><th>Inzetbaar u/wk</th><th>Benutting</th></tr></thead><tbody>${rijen || `<tr><td colspan="8" class="leeg">Geen ingediende vragenlijsten.</td></tr>`}</tbody></table>
<p class="klein">Gepland is de som van de uren per week van de ingediende commitments. Inzetbaar is de beschikbare capaciteit min de buffer.</p>`;
}

function signalenBlokken(c: any): Blok[] {
  const uit: Blok[] = [];
  for (const soort of [...SIGNAAL_SOORTEN, "aandacht"] as const) {
    const lijstje = c.consolidatie.signalen.filter((s: any) => s.soort === soort);
    const info = soort === "aandacht" ? { label: "Aandachtspunten", definitie: "Capaciteit boven 90%, buffer onder 10% of een verdeling die niet op 100% uitkomt.", actie: "Bespreek in het blok capaciteit en percentages.", kleur: KLEUR.grijs } : SIGNAAL_INFO[soort];
    uit.push({
      html: `<h3>${label(info.label, info.kleur, soort === "oranje" || soort === "geel" ? KLEUR.ink : "#fff")} <span class="klein">${esc(lijstje.length)} signaal(en)</span></h3><p class="klein">${esc(info.definitie)} Actie: ${esc(info.actie)}</p>${lijst(lijstje.map((s: any) => s.tekst))}`,
    });
  }
  return uit;
}

function raciTabel(c: any): string {
  const caps = c.captains.filter((x: any) => x.heeftIndiening);
  const kop = caps.map((x: any) => `<th>${esc(x.naam)}</th>`).join("");
  const rijen = c.consolidatie.domeinen
    .map((d: any) => {
      const cellen = caps
        .map((x: any) => {
          const r = d.rollen.find((y: any) => y.captainId === x.id);
          const nu = r?.mijnRol || "";
          const gw = r?.gewensteRol || "";
          return `<td>${nu ? `<b>${esc(nu)}</b>` : `<span class="klein">leeg</span>`}${gw && gw !== nu ? ` <span class="klein">wil ${esc(gw)}</span>` : ""}${r?.urenPerMaand ? `<div class="klein">${esc(r.urenPerMaand)} u/mnd</div>` : ""}</td>`;
        })
        .join("");
      const sig = d.signalen.map((s: string) => label(s.toUpperCase(), SIGNAAL_INFO[s as keyof typeof SIGNAAL_INFO].kleur, s === "oranje" || s === "geel" ? KLEUR.ink : "#fff")).join(" ");
      return `<tr><td><b>${esc(d.naam)}</b></td>${cellen}<td>${sig || `<span class="klein">geen</span>`}</td></tr>`;
    })
    .join("");
  return `<table class="splits"><thead><tr><th>Domein</th>${kop}<th>Signaal</th></tr></thead><tbody>${rijen}</tbody></table>`;
}

function coverageTabel(c: any): string {
  return `<table class="splits"><thead><tr><th>Domein</th><th>A-owner</th><th>Dekkingsscore</th><th>Actie</th></tr></thead><tbody>${c.coverage
    .map((r: any) => {
      const sc = DEKKINGSSCORES.find((s) => s.score === r.score);
      return `<tr><td><b>${esc(r.naam)}</b></td><td>${r.ownerLabel ? esc(r.ownerLabel) : label("Geen A-owner", SIGNAAL_INFO.rood.kleur)}</td><td>${sc ? esc(sc.label) : waarde(null)}</td><td>${waarde(r.actie)}</td></tr>`;
    })
    .join("")}</tbody></table><p class="klein">${esc(GEEN_GEMIDDELDE)}</p>`;
}

function besluitenTabel(c: any): string {
  return `<table class="splits"><thead><tr><th>Datum</th><th>Onderwerp en besluit</th><th>Beslisser</th><th>Rationale, aannames en gevolgen</th><th>Review</th></tr></thead><tbody>${
    c.besluiten
      .map(
        (b: any) =>
          `<tr><td>${esc(b.datum)}<div class="klein">B${esc(b.id)}${b.vervangtBesluitId ? `, vervangt B${esc(b.vervangtBesluitId)}` : ""}</div></td><td><b>${esc(b.onderwerp)}</b><div>${esc(b.besluit)}</div></td><td>${esc(b.beslisser)}</td><td>${waarde(b.rationale)}${b.aannames ? `<div class="klein">Aannames: ${esc(b.aannames)}</div>` : ""}${b.gevolgen ? `<div class="klein">Gevolgen: ${esc(b.gevolgen)}</div>` : ""}</td><td>${waarde(b.reviewmoment)}</td></tr>`,
      )
      .join("") || `<tr><td colspan="5" class="leeg">Nog geen besluiten vastgelegd.</td></tr>`
  }</tbody></table>`;
}

function acceptatieTabel(c: any): string {
  return `<table class="splits"><thead><tr><th>Criterium</th><th>Stand</th><th>Toelichting</th></tr></thead><tbody>${c.acceptatie.criteria
    .map((k: any) => `<tr><td>${esc(k.tekst)}<div class="klein">${k.automatisch ? "Getoetst door het platform" : "Bevestigd door het TOC"}</div></td><td>${k.voldaan ? label("Voldaan", "#2E7D32") : label("Open", KLEUR.amber, KLEUR.ink)}</td><td>${esc(k.toelichting)}</td></tr>`)
    .join("")}</tbody></table>`;
}

function registerTabel(c: any, metStatus: boolean): string {
  return `<table class="splits"><thead><tr><th>ID</th><th>Type</th><th>Owner (A)</th><th>Deliverable</th><th>Deadline</th><th>Bewijs</th><th>u/wk</th>${metStatus ? "<th>Status</th>" : ""}</tr></thead><tbody>${
    c.commitments
      .map(
        (k: any) =>
          `<tr><td><b>${esc(k.code)}</b></td><td>${esc(COMMITMENT_TYPE_LABEL[k.type as "delivery"])}</td><td>${esc(naamVan(c, k.ownerCaptainId))}</td><td>${waarde(k.deliverable || k.objective)}</td><td>${waarde(k.deadline)}</td><td>${waarde(k.acceptatiebewijs)}</td><td>${waarde(k.urenPerWeek)}</td>${metStatus ? `<td>${statusLabel(k.status)}${k.statusToelichting ? `<div class="klein">${esc(k.statusToelichting)}</div>` : ""}</td>` : ""}</tr>`,
      )
      .join("") || `<tr><td colspan="${metStatus ? 8 : 7}" class="leeg">Nog geen commitments in het register.</td></tr>`
  }</tbody></table>`;
}

function kaartHtml(c: any, k: any): string {
  const dom = DOMEINEN.find((d) => d.sleutel === k.domein)?.naam ?? "";
  return `<div class="kaart"><div class="t">${esc(k.code)} · ${esc(COMMITMENT_TYPE_LABEL[k.type as "delivery"])} · ${esc(dom || "domein niet gekozen")}</div><div class="w">${esc(k.deliverable || k.objective || "Zonder titel")}</div>
<table><tbody><tr><td style="width:44mm"><b>Accountable owner</b></td><td>${esc(naamVan(c, k.ownerCaptainId))}</td></tr>${KAART_VELDEN.map((v) => `<tr><td><b>${esc(v.label)}</b></td><td>${waarde(k[v.sleutel])}</td></tr>`).join("")}<tr><td><b>Uren per week</b></td><td>${waarde(k.urenPerWeek)}</td></tr><tr><td><b>Status</b></td><td>${statusLabel(k.status)}</td></tr></tbody></table></div>`;
}

function tocCover(c: any, titel: string, sub: string, noot: string, concept?: string): string {
  return coverHtml({
    merk: "TOC Commitmentkompas",
    titel,
    sub,
    rijen: [
      ["Ronde", `${c.ronde.titel} (${c.ronde.periode})`],
      ["Fase", RONDE_STATUS_LABEL[c.ronde.status as keyof typeof RONDE_STATUS_LABEL] ?? c.ronde.status],
      ["Captains", c.captains.map((x: any) => x.naam).join(", ")],
      ["Deadline intake", c.ronde.deadline || "niet vastgelegd"],
    ],
    concept,
    noot,
  });
}

// ---- Workshopdossier ------------------------------------------------------------------------
function renderWorkshop(c: any): string {
  const blokken: Blok[] = [];
  blokken.push({
    nieuwePagina: true,
    sectie: "Voorbereiding",
    html: `<h2>Voorbereiding</h2>${lijst(WORKSHOP_VOORBEREIDING)}<div class="kader"><p>${esc(CIRKEL_TEKST)}</p></div>
<h3>Agenda van 180 minuten</h3><table><thead><tr><th>Minuten</th><th>Onderdeel</th><th>Output</th></tr></thead><tbody>${WORKSHOP_AGENDA.map((r) => `<tr><td>${esc(r.tijd)}</td><td>${esc(r.onderdeel)}</td><td>${esc(r.output)}</td></tr>`).join("")}</tbody></table>
<h3>Besluitregels</h3>${lijst(BESLUITREGELS)}`,
  });
  if (c.consolidatie.zonderIndiening.length) {
    blokken.push({ html: `<div class="kader"><p><b>Zonder ingediende vragenlijst:</b> ${esc(c.consolidatie.zonderIndiening.map((x: any) => x.naam).join(", "))}. De nulmeting werd vergrendeld met als reden: ${esc(c.ronde.vergrendelReden ?? "")}</p></div>` });
  }
  blokken.push({ nieuwePagina: true, sectie: "Capaciteit", html: `<h2>Capaciteit en percentages</h2>${capaciteitTabel(c)}` });
  blokken.push({ nieuwePagina: true, sectie: "Signalen", html: `<h2>Signalen voor de workshop</h2><p class="klein">Een signaal is een vraag voor het TOC, geen oordeel over een persoon. Regelversie ${esc(c.consolidatie.regelversie)}.</p>` });
  blokken.push(...signalenBlokken(c));
  blokken.push({ nieuwePagina: true, sectie: "Coverage heatmap", html: `<h2>Coverage heatmap: A/R/C/I per domein</h2><p class="klein">${esc(RACI_UITLEG)} Vetgedrukt is de huidige rol; "wil" is de gewenste rol.</p>${raciTabel(c)}` });
  blokken.push({
    nieuwePagina: true,
    sectie: "Dekkingsscore",
    html: `<h2>Dekkingsscore per domein</h2><p>Het TOC stelt in de workshop per domein samen een score vast. Het platform berekent die niet.</p><table><thead><tr><th>Score</th><th>Betekenis</th><th>Criteria</th></tr></thead><tbody>${DEKKINGSSCORES.map((s) => `<tr><td><b>${esc(s.label)}</b></td><td>${esc(s.betekenis)}</td><td>${esc(s.criteria)}</td></tr>`).join("")}</tbody></table><div class="kader" style="margin-top:3mm"><p>${esc(GEEN_GEMIDDELDE)}</p></div>${slot()}`,
  });
  return bouwDocument({
    titel: `Workshopdossier ${c.ronde.periode}`,
    documentLabel: "Workshopdossier",
    kenmerk: c.ronde.periode,
    voetMeta: voet(c),
    cover: tocCover(c, "Workshopdossier", "Alignment workshop van 180 minuten", "Consolidatie van de individuele vragenlijsten: capaciteit, commitments, A/R/C/I, gaten en conflicten. Feiten vóór debat."),
    blokken,
  });
}

// ---- Commitment Register -----------------------------------------------------------------
function renderRegister(c: any): string {
  const vast = c.ronde.status === "VASTGESTELD" || c.ronde.status === "AFGESLOTEN";
  const blokken: Blok[] = [];
  blokken.push({ nieuwePagina: true, sectie: "Commitment Register", html: `<h2>Commitment Register</h2>${registerTabel(c, vast)}` });
  c.commitments.forEach((k: any, i: number) => blokken.push({ nieuwePagina: i === 0, sectie: "Commitmentkaarten", html: kaartHtml(c, k) }));
  blokken.push({ nieuwePagina: true, sectie: "Coverage Matrix", html: `<h2>Coverage Matrix</h2>${coverageTabel(c)}` });
  blokken.push({ nieuwePagina: true, sectie: "Decision Log", html: `<h2>Decision Log</h2>${besluitenTabel(c)}` });
  blokken.push({ nieuwePagina: true, sectie: "Acceptatie", html: `<h2>Acceptatiecriteria</h2>${acceptatieTabel(c)}${vast ? `<p class="klein">Vastgesteld op ${esc(datum(c.ronde.vastgesteldOp))}. ${esc(c.ronde.vaststelToelichting ?? "")}</p>` : ""}${slot()}` });
  return bouwDocument({
    titel: `Commitment Register ${c.ronde.periode}`,
    documentLabel: "Commitment Register",
    kenmerk: c.ronde.periode,
    voetMeta: voet(c),
    cover: tocCover(c, "Commitment Register", "Register, Coverage Matrix en Decision Log", "Eén Accountable owner per deliverable. Geen nieuw commitment zonder capaciteit of stopkeuze.", vast ? undefined : "Concept: nog niet vastgesteld door het TOC"),
    blokken,
  });
}

// ---- Kwartaalscorecard -----------------------------------------------------------------------
function renderScorecard(c: any): string {
  const tel = Object.fromEntries(COMMITMENT_STATUSSEN.map((s) => [s, c.commitments.filter((k: any) => k.status === s).length]));
  const scoreTel = DEKKINGSSCORES.map((s) => ({ ...s, n: c.coverage.filter((r: any) => r.score === s.score).length }));
  const blokken: Blok[] = [];
  blokken.push({
    nieuwePagina: true,
    sectie: "Stand van de commitments",
    html: `<h2>Stand van de commitments</h2><div class="kaarten">${COMMITMENT_STATUSSEN.map((s) => `<div class="kaart" style="border-top-color:${STATUS_KLEUR[s]}"><div class="t">${esc(COMMITMENT_STATUS_LABEL[s])}</div><div class="w">${esc(tel[s])}</div></div>`).join("")}</div>`,
  });
  blokken.push({ html: registerTabel(c, true) });
  blokken.push({ nieuwePagina: true, sectie: "Capaciteit", html: `<h2>Capaciteit per Captain</h2>${capaciteitTabel(c)}` });
  blokken.push({
    nieuwePagina: true,
    sectie: "Dekking",
    html: `<h2>Dekking van de domeinen</h2><p class="klein">Aantal domeinen per vastgestelde score. Er wordt geen gemiddelde berekend.</p><table><thead><tr><th>Score</th><th>Aantal domeinen</th></tr></thead><tbody>${scoreTel.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.n)}</td></tr>`).join("")}</tbody></table>
<h3>Domeinen met score 0 of 1</h3>${lijst(c.coverage.filter((r: any) => r.score !== null && r.score <= 1).map((r: any) => `${r.naam}${r.actie ? `: ${r.actie}` : ""}`))}`,
  });
  blokken.push({ nieuwePagina: true, sectie: "Besluiten", html: `<h2>Besluiten dit kwartaal</h2>${besluitenTabel(c)}` });
  blokken.push({ html: `<h2>Acceptatiecriteria</h2>${acceptatieTabel(c)}${c.ronde.afgeslotenOp ? `<p class="klein">Kwartaal afgesloten op ${esc(datum(c.ronde.afgeslotenOp))}. ${esc(c.ronde.afsluitToelichting ?? "")}</p>` : ""}${slot()}` });
  return bouwDocument({
    titel: `Kwartaalscorecard ${c.ronde.periode}`,
    documentLabel: "Kwartaalscorecard",
    kenmerk: c.ronde.periode,
    voetMeta: voet(c),
    cover: tocCover(c, "Kwartaalscorecard", `Kwartaal ${c.ronde.periode}`, "Stand van het vastgestelde register. Een amber, rode of geblokkeerde status is een signaal voor heronderhandeling, geen oordeel over een persoon."),
    blokken,
  });
}

export const RENDERERS: Record<RapportType, (contract: any) => string> = {
  "captain-charter": renderCharter,
  workshopdossier: renderWorkshop,
  "commitment-register": renderRegister,
  kwartaalscorecard: renderScorecard,
};

/** Voor tests: welke vaste teksten de rapporten gebruiken. */
export const VASTE_RAPPORTTEKSTEN = [CIRKEL_TEKST, KERNREGEL, GEEN_GEMIDDELDE, ...BESLUITREGELS, ...ACCEPTATIECRITERIA.map((k) => k.tekst)];
