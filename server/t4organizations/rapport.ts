import type { T4OScores, VermogenScore, Spanningsveld, CongruentieRij, RoutineEnergie } from "./scoring";
import type { T4OSessie } from "./schema";

/**
 * TaPas 4 Organizations — HTML-rapportgenerator.
 * ------------------------------------------------------------------
 * renderT4ORapport() bouwt het volledige organisatierapport als
 * zelfstandige HTML-pagina, dynamisch gevuld met de berekende scores.
 * De kop-/tekststructuur volgt het demo-rapport (14 secties). Stijl:
 * navy accenten (#16384a), goud accent, serif koppen, KPI-cards en
 * staafbalken via inline HTML/CSS — geen externe libraries.
 */

const TEXTC = "#16384a";
const MUTED = "#5b6b73";
const GOUD = "#b08b3f";
const DISCLAIMER = "Fictieve demonstratiescan · niet voor diagnose, selectie of voorspelling";

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
function fmt(n: number | null, dec = 2): string {
  if (n == null) return "—";
  return n.toFixed(dec).replace(".", ",");
}

// --- Staafbalk vermogen (t.o.v. org-gemiddelde stippellijn) -----------------
function vermogenBars(vermogens: VermogenScore[], gemiddelde: number): string {
  const max = 5;
  const gemPct = (gemiddelde / max) * 100;
  const rijen = vermogens
    .map((v) => {
      const score = v.score ?? 0;
      const pct = (score / max) * 100;
      const boven = v.score != null && v.score >= gemiddelde;
      const kleur = v.score == null ? "#cbd3d8" : boven ? "#3f8f5b" : "#c98a3f";
      return `<div style="display:flex;align-items:center;gap:12px;margin:7px 0">
        <div style="width:190px;font-size:13px;color:${TEXTC};font-weight:600">${esc(v.label)}</div>
        <div style="flex:1;position:relative;height:22px;background:#f1f4f5;border-radius:5px">
          <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${kleur};border-radius:5px"></div>
          <div style="position:absolute;left:${gemPct}%;top:-3px;bottom:-3px;width:0;border-left:2px dashed ${MUTED}"></div>
        </div>
        <div style="width:44px;text-align:right;font-weight:700;color:${TEXTC};font-size:13px">${fmt(v.score)}</div>
      </div>`;
    })
    .join("");
  return `<div style="margin:16px 0">
    <div style="text-align:right;font-size:12px;color:${MUTED};margin-bottom:4px">stippellijn = organisatiegemiddelde ${fmt(gemiddelde)}</div>
    ${rijen}
  </div>`;
}

// --- Energie-saldostaven (naar links = lek, naar rechts = bron) -------------
function energieBars(routines: RoutineEnergie[]): string {
  const rijen = routines
    .map((r) => {
      const pct = Math.min(50, Math.abs(r.saldo) * 50); // saldo in [-1,1] -> halve breedte
      const bron = r.saldo >= 0;
      const kleur = r.saldo === 0 ? "#9aa7ac" : bron ? "#3f8f5b" : "#c0473f";
      const zijde = bron ? `left:50%;width:${pct}%` : `right:50%;width:${pct}%`;
      return `<div style="display:flex;align-items:center;gap:12px;margin:6px 0">
        <div style="width:250px;font-size:13px;color:${TEXTC}">${esc(r.prompt)}</div>
        <div style="flex:1;position:relative;height:20px;background:#f7f8f9;border-radius:4px">
          <div style="position:absolute;left:50%;top:0;bottom:0;width:0;border-left:1px solid #cbd3d8"></div>
          <div style="position:absolute;top:0;height:100%;${zijde};background:${kleur};border-radius:4px"></div>
        </div>
        <div style="width:44px;text-align:right;font-weight:700;font-size:13px;color:${kleur}">${fmt(r.saldo)}</div>
      </div>`;
    })
    .join("");
  return `<div style="margin:16px 0">${rijen}</div>`;
}

function pagina(titel: string, inhoud: string): string {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titel)}</title>
<style>
  :root { --tekst:${TEXTC}; --muted:${MUTED}; --goud:${GOUD}; }
  * { box-sizing:border-box; }
  body { font-family:'Source Serif 4', Georgia, serif; color:var(--tekst); margin:0; background:#f7f8f9; line-height:1.6; }
  .wrap { max-width:880px; margin:0 auto; padding:48px 34px 80px; background:#fff; }
  h1 { font-size:30px; margin:0 0 6px; }
  h2 { font-size:22px; margin:40px 0 4px; }
  h3 { font-size:16px; margin:20px 0 6px; }
  .eyebrow { color:var(--goud); font-size:12px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; margin:0 0 2px; font-family:system-ui,sans-serif; }
  .lead { color:var(--muted); font-size:15px; }
  p { margin:10px 0; }
  .disclaimer { background:#f1f5f7; border-left:4px solid ${TEXTC}; padding:12px 16px; font-size:13px; color:var(--muted); margin:18px 0; border-radius:0 6px 6px 0; }
  table { width:100%; border-collapse:collapse; margin:14px 0; font-family:system-ui, sans-serif; font-size:14px; }
  th, td { padding:9px 10px; border-bottom:1px solid #eef1f2; text-align:left; }
  th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
  .kpis { display:flex; gap:14px; flex-wrap:wrap; margin:22px 0; }
  .kpi { flex:1 1 160px; background:#fbfcfc; border:1px solid #eef1f2; border-top:3px solid ${TEXTC}; border-radius:10px; padding:16px 18px; text-align:center; }
  .kpi .naam { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--goud); font-weight:700; font-family:system-ui,sans-serif; }
  .kpi .waarde { font-size:34px; font-weight:700; color:${TEXTC}; margin:6px 0 2px; }
  .kpi .sub { font-size:12px; color:var(--muted); }
  .card { background:#fbfcfc; border:1px solid #eef1f2; border-radius:10px; padding:16px 18px; margin:12px 0; }
  .card h3 { margin-top:0; }
  .badge { display:inline-block; padding:2px 10px; border-radius:11px; font-size:12px; font-weight:700; color:#fff; font-family:system-ui,sans-serif; }
  .cover { background:${TEXTC}; color:#fff; margin:-48px -34px 0; padding:56px 34px 44px; }
  .cover .eyebrow { color:${GOUD}; }
  .cover h1 { color:#fff; font-size:34px; }
  .cover .meta { margin-top:22px; font-size:14px; font-family:system-ui,sans-serif; }
  .cover .meta div { margin:4px 0; }
  .cover .meta b { display:inline-block; width:130px; color:#b9c6cd; font-weight:600; }
  ul { padding-left:20px; }
  ol.aanbev { list-style:none; padding:0; counter-reset:a; }
  ol.aanbev li { counter-increment:a; position:relative; padding:12px 0 12px 46px; border-bottom:1px solid #eef1f2; }
  ol.aanbev li::before { content:counter(a); position:absolute; left:0; top:12px; width:30px; height:30px; background:${TEXTC}; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-family:system-ui,sans-serif; }
  .muted { color:var(--muted); }
  footer { margin-top:46px; padding-top:16px; border-top:1px solid #eef1f2; font-size:12px; color:var(--muted); }
</style></head><body><div class="wrap">${inhoud}</div></body></html>`;
}

function duidingKleur(d: string): string {
  if (d.startsWith("Sterke")) return "#3f8f5b";
  if (d.startsWith("Lichte")) return "#c98a3f";
  if (d.startsWith("Duidelijke")) return "#c0473f";
  return MUTED;
}

export function renderT4ORapport(scores: T4OScores, sessie: T4OSessie): string {
  const { kpi, vermogens, orgGemiddelde, spanningsvelden, congruentie, groeizones, routineEnergie, aantalPerRing, aantalTotaal } = scores;

  // ---- Cover ---------------------------------------------------------------
  const cover = `<div class="cover">
    <p class="eyebrow">TaPas 4 Organizations — energetische organisatiescan</p>
    <h1>Wie deze organisatie in essentie is</h1>
    <p style="color:#cdd8de;font-size:15px;max-width:620px">Een verwoordende lezing van de organisatiescan, met voorzichtige ontwikkelingsrichtingen en een verkenning van het talent dat de organisatie van binnenuit kan versterken.</p>
    <div class="meta">
      <div><b>Organisatie</b>${esc(sessie.orgNaam)}</div>
      ${sessie.orgLabel ? `<div><b>Profiel</b>${esc(sessie.orgLabel)}</div>` : ""}
      <div><b>Deelname</b>${aantalTotaal} respondenten — ${aantalPerRing.binnen} leiding, ${aantalPerRing.midden} medewerkers, ${aantalPerRing.buiten} externe stakeholders</div>
      <div><b>Lezing</b>Drie ringen — binnen, midden, buiten — samengebracht tot één organisatiebeeld</div>
    </div>
  </div>`;

  // ---- Leeswijzer ----------------------------------------------------------
  const leeswijzer = `
    <p class="eyebrow">Leeswijzer</p>
    <h2>Hoe u dit rapport leest</h2>
    <p>Dit is geen scorebord. Een organisatiescan levert getallen op, maar getallen zijn pas betekenisvol wanneer ze worden teruggelezen naar het verhaal van een organisatie. Dit rapport brengt de bevindingen samen tot een samenhangend beeld van wie deze organisatie in essentie is — waar haar kracht ligt, waar haar energie weglekt, en waar haar groeiruimte zich aandient.</p>
    <div class="disclaimer"><strong>Een momentopname, geen oordeel.</strong> De scan beschrijft hoe de organisatie zichzelf vandaag ervaart. Het is een spiegel, geen meetlat en geen voorspelling. De bevindingen nodigen uit tot gesprek en reflectie; ze leveren geen diagnose, geen selectiebesluit en geen prognose.</div>`;

  // ---- Synthese ------------------------------------------------------------
  const sterkste = [...vermogens].filter((v) => v.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const zwakste = [...vermogens].filter((v) => v.score != null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  const grootsteSpanning = spanningsvelden[0];
  const synthese = `
    <p class="eyebrow">Synthese</p>
    <h2>Het beeld in één blik</h2>
    <p>${esc(sessie.orgNaam)} toont ${sterkste ? `haar sterkste vermogen in <strong>${esc(sterkste.label.toLowerCase())}</strong> (${fmt(sterkste.score)})` : "een gemengd beeld"}${zwakste ? `, terwijl <strong>${esc(zwakste.label.toLowerCase())}</strong> (${fmt(zwakste.score)}) het meest om aandacht vraagt` : ""}. Het organisatiegemiddelde over de acht vermogens ligt op ${fmt(orgGemiddelde)}.</p>
    ${grootsteSpanning ? `<p>Het scherpste signaal in deze scan is het verschil tussen leiding en werkvloer rond <strong>${esc(grootsteSpanning.label.toLowerCase())}</strong> (verschil ${fmt(grootsteSpanning.verschil)}). Dat verdient aandacht — niet als probleem, maar als de plek waar de organisatie het meest te ontwikkelen heeft.</p>` : ""}
    <div class="kpis">
      <div class="kpi"><div class="naam">Identiteit</div><div class="waarde">${fmt(kpi.identiteit, 1)}</div><div class="sub">coherentie (op 5)</div></div>
      <div class="kpi"><div class="naam">Presteren</div><div class="waarde">${fmt(kpi.presteren, 1)}</div><div class="sub">exploitatiekracht (op 5)</div></div>
      <div class="kpi"><div class="naam">Vernieuwen</div><div class="waarde">${fmt(kpi.vernieuwen, 1)}</div><div class="sub">exploratiekracht (op 5)</div></div>
      <div class="kpi"><div class="naam">Energie</div><div class="waarde">${fmt(kpi.energie, 1)}</div><div class="sub">batterij (op 10)</div></div>
    </div>`;

  // ---- Identiteit & betekenis ----------------------------------------------
  const identiteit = `
    <p class="eyebrow">Identiteit & betekenis</p>
    <h2>Wie deze organisatie in essentie is</h2>
    <p>Aan de binnenkant van elke organisatie ligt een verhaal over wie ze is en waarom ze bestaat. De identiteitscoherentie — de mate waarin mensen hetzelfde beeld delen van waar de organisatie voor staat — komt uit op <strong>${fmt(kpi.identiteit)}</strong> op 5, tegenover een organisatiegemiddelde van ${fmt(orgGemiddelde)}. ${kpi.identiteit != null && kpi.identiteit >= orgGemiddelde ? "Dat betekent dat de organisatie een gedeelde kern heeft waarop ze kan bouwen." : "Dat wijst erop dat het gedeelde verhaal nog aan scherpte kan winnen."}</p>
    <p>Alles wat hierna komt — de energie, de vermogens, de spanningen — speelt zich af tegen de achtergrond van deze identiteit. De vraag is niet óf er een kern is, maar of die kern voldoende ruimte krijgt om ook te vernieuwen en te leren.</p>`;

  // ---- Energie & klimaat ---------------------------------------------------
  const bron = [...routineEnergie].sort((a, b) => b.saldo - a.saldo)[0];
  const lek = [...routineEnergie].sort((a, b) => a.saldo - b.saldo)[0];
  const energie = `
    <p class="eyebrow">Energie & klimaat</p>
    <h2>Waar de energie vandaan komt — en waar ze weglekt</h2>
    <p>Elke organisatie heeft een energiebalans. De collectieve batterij staat op <strong>${fmt(kpi.energie, 1)}</strong> op 10. Onderstaand beeld toont per onderwerp het saldo tussen wat energie geeft en wat energie kost. Een staaf naar rechts is een bron; een staaf naar links is een lek.</p>
    ${energieBars(routineEnergie)}
    ${bron ? `<h3>Waar energie ontstaat</h3><p>De grootste energiebron is <strong>${esc(bron.prompt.toLowerCase())}</strong> (${fmt(bron.saldo)}).</p>` : ""}
    ${lek ? `<h3>Waar energie weglekt</h3><p>Het grootste lek is <strong>${esc(lek.prompt.toLowerCase())}</strong> (${fmt(lek.saldo)}). Energieverlies dat in de werkprocessen zit, is beter aanpakbaar dan lekken die in de mensen of de cultuur zouden zitten.</p>` : ""}`;

  // ---- Collectieve vermogens -----------------------------------------------
  const vermogensSectie = `
    <p class="eyebrow">Collectieve vermogens</p>
    <h2>Sterk in uitvoeren, zoekend in vernieuwen</h2>
    <p>Onder de identiteit liggen de vermogens waarmee een organisatie haar werk doet. Het beeld hieronder zet elk vermogen af tegen het organisatiegemiddelde (de stippellijn op ${fmt(orgGemiddelde)}). Boven de lijn is bovengemiddeld sterk; eronder vraagt om aandacht.</p>
    ${vermogenBars(vermogens, orgGemiddelde)}`;

  // ---- Spanningsvelden -----------------------------------------------------
  const spanningRijen = spanningsvelden
    .map((s) => `<tr><td style="font-weight:600">${esc(s.label)}</td><td style="text-align:center">${fmt(s.leiding)}</td><td style="text-align:center">${fmt(s.werkvloer)}</td><td style="text-align:center;font-weight:700">${fmt(s.verschil)}</td></tr>`)
    .join("");
  const spanning = `
    <p class="eyebrow">Spanningsvelden</p>
    <h2>Waar leiding en werkvloer elkaar nog zoeken</h2>
    <p>Een organisatie spreekt nooit met één stem. Het wordt interessant waar de leiding en de medewerkers verschillend kijken naar hetzelfde. Zulke verschillen zijn geen ruzie; het zijn de plekken waar het gesprek nog niet is afgerond.</p>
    ${spanningsvelden.length ? `<table><thead><tr><th>Vermogen</th><th style="text-align:center">Leiding</th><th style="text-align:center">Werkvloer</th><th style="text-align:center">Verschil</th></tr></thead><tbody>${spanningRijen}</tbody></table>` : `<p class="muted">Geen betekenisvolle verschillen (drempel 0,8) tussen leiding en werkvloer, of onvoldoende gegevens uit beide ringen.</p>`}`;

  // ---- Congruentie ---------------------------------------------------------
  const congruentieRijen = congruentie
    .map((c: CongruentieRij) => `<tr>
      <td style="font-weight:600">${esc(c.label)}</td>
      <td style="text-align:center">${fmt(c.binnen)}</td>
      <td style="text-align:center">${fmt(c.midden)}</td>
      <td style="text-align:center">${fmt(c.buiten)}</td>
      <td><span class="badge" style="background:${duidingKleur(c.duiding)}">${esc(c.duiding)}</span></td>
    </tr>`)
    .join("");
  const congruentieSectie = `
    <p class="eyebrow">Congruentie</p>
    <h2>Vallen woord en daad samen?</h2>
    <p>Stemt wat de organisatie over zichzelf zegt overeen met wat de mensen rondom haar ervaren? We vergelijken het beeld van de binnenkring (leiding), de middenkring (medewerkers) en de buitenkring (externe stakeholders) op drie thema's.</p>
    <table><thead><tr><th>Thema</th><th style="text-align:center">Binnen</th><th style="text-align:center">Midden</th><th style="text-align:center">Buiten</th><th>Duiding</th></tr></thead><tbody>${congruentieRijen}</tbody></table>
    ${aantalPerRing.buiten === 0 ? `<p class="muted">Er namen geen externe stakeholders deel; de buitenkring-congruentie kon niet worden berekend.</p>` : ""}`;

  // ---- De brug naar het individu -------------------------------------------
  const brug = `
    <p class="eyebrow">De brug naar het individu</p>
    <h2>Van organisatie naar mens — en terug</h2>
    <p>De T4P leest wie een mens in essentie is. De T4O leest wie een organisatie in essentie is. Die congruentie — de match tussen mens en organisatie — staat centraal: welke mens past, in zijn diepste kern, bij wat deze organisatie in haar diepste kern nodig heeft.</p>
    <div class="card"><h3>De vier groeizones die om talent vragen</h3>
      <p class="muted">De scan markeert vier vermogens die onder het organisatiegemiddelde liggen. Samen vormen ze het profiel van wat de organisatie van binnenuit kan versterken:</p>
      <ul>${groeizones.map((g) => `<li><strong>${esc(g.label)}</strong> — ${fmt(g.score)}</li>`).join("")}</ul>
    </div>`;

  // ---- Talent dat versterkt ------------------------------------------------
  const talentNarratief: Record<string, { titel: string; tekst: string }> = {
    seizing: { titel: "Wie kansen omzet in beweging", tekst: "Mensen die van nature doortastend beslissen en verantwoordelijkheid omarmen — die inzicht omzetten in actie en de weg van herkenning naar beslissing verkorten." },
    exploratiekracht: { titel: "Wie nieuwe wegen durft te verkennen", tekst: "Mensen met een onderzoekende, nieuwsgierige inslag die het bestaande in vraag stellen uit verlangen naar beter, en het experiment normaal maken op de plek waar het werk gebeurt." },
    "ambidextere-integratie": { titel: "Wie uitvoeren en vernieuwen verbindt", tekst: "Vertalers die het vakmanschap van de organisatie respecteren én het nieuwe omarmen, zonder de betrouwbaarheid te ondermijnen." },
    "organisatorische-leerlus": { titel: "Wie de organisatie laat leren", tekst: "Mensen met een reflectieve instelling die patronen zien over situaties heen en van terugkijken een gewoonte maken in plaats van een uitzondering." },
    transforming: { titel: "Wie de organisatie helpt omvormen", tekst: "Mensen die rollen en structuren durven herzien wanneer de situatie het vraagt, met behoud van de eigenheid." },
    sensing: { titel: "Wie de signalen vroeg opvangt", tekst: "Mensen die veranderingen in behoeften en omgeving vroeg opmerken en die signalen naar binnen brengen." },
    identiteitscoherentie: { titel: "Wie het verhaal levend houdt", tekst: "Mensen die de kernopdracht vertalen naar het dagelijks werk en betekenis geven aan keuzes." },
    exploitatiekracht: { titel: "Wie kwaliteit bewaakt", tekst: "Mensen die betrouwbaar leveren en processen scherp houden zonder de vernieuwing te blokkeren." },
  };
  const groeiKaarten = groeizones
    .map((g, i) => {
      const n = talentNarratief[g.dimensie] ?? { titel: g.label, tekst: `Talent dat ${g.label.toLowerCase()} van binnenuit versterkt.` };
      return `<div class="card"><p class="eyebrow">Groeizone ${i + 1}</p><h3>${esc(n.titel)}</h3><p>${esc(n.tekst)}</p></div>`;
    })
    .join("");
  const talent = `
    <p class="eyebrow">Talent dat versterkt</p>
    <h2>Wie zoeken we om de groeizones te dichten?</h2>
    <p>Dit hoofdstuk vertaalt de vier groeizones naar een menselijk profiel. Het gaat uitdrukkelijk <strong>niet</strong> om personen of namen, en het is geen selectie- of beoordelingsinstrument. Het beschrijft het soort mensen dat een organisatie als deze van binnenuit sterker maakt.</p>
    ${groeiKaarten}`;

  // ---- Ontwikkelingsrichtingen (5) -----------------------------------------
  const aanbevelingen = [
    "Begin bij de besturingsstructuur, niet bij de mensen. Maak besluitlijnen explicieter, geef mandaat lager in de organisatie, en bewaak de doorlooptijd van beslissingen — daar komt veel weglekkende energie terug.",
    "Vertaal vernieuwingsruimte naar de werkvloer. Dicht de kloof tussen leiding en vloer niet met woorden maar met zichtbare keuzes: concrete tijd voor experiment, een klein mandaat, en publieke waardering voor wie een nieuwe weg verkent.",
    "Bescherm de focus. Minder gelijktijdige prioriteiten is geen rem op ambitie, maar de voorwaarde ervoor. Kies bewust wat níet gebeurt.",
    "Maak van terugkijken een gewoonte. Bouw lichte, terugkerende reflectiemomenten in — klein, betekenisvol en gericht op wat de volgende keer beter kan, zonder te verzanden in rapportage.",
    "Richt de blik ook naar buiten. Een periodiek, open gesprek met de buitenkring — en het consequent opvolgen ervan — sluit de congruentiekloof en versterkt het vertrouwen waarop de organisatie rust.",
  ];
  const ontwikkeling = `
    <p class="eyebrow">Ontwikkelingsrichtingen</p>
    <h2>Voorzichtige aanbevelingen</h2>
    <p>De volgende richtingen zijn uitnodigingen tot gesprek, geen voorschriften. Ze volgen rechtstreeks uit wat de scan toont, en zijn bewust beperkt in aantal.</p>
    <ol class="aanbev">${aanbevelingen.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>`;

  // ---- Verantwoording ------------------------------------------------------
  const verantwoording = `
    <p class="eyebrow">Verantwoording</p>
    <h2>Methode, reikwijdte en grenzen</h2>
    <p>Het beeld is opgebouwd uit de antwoorden van <strong>${aantalTotaal} respondenten</strong>, verdeeld over drie ringen: ${aantalPerRing.binnen} leidinggevende(n) (binnenring), ${aantalPerRing.midden} medewerker(s) (middenring) en ${aantalPerRing.buiten} externe stakeholder(s) (buitenring). De scan leest vier lagen: identiteit en betekenis, energie en klimaat, collectieve vermogens, en de waardecreatiehandtekening.</p>
    <p><strong>Wat dit rapport niet is.</strong> Dit is een reflectie-instrument, geen meetlat. Het levert geen diagnose, geen selectie- of beoordelingsbesluit, en geen voorspelling. De getallen richten het gesprek; ze rangschikken geen mensen of teams.</p>
    <ul class="muted">
      <li>Een scan is een momentopname; ze beschrijft hoe de organisatie zich nu ervaart.</li>
      <li>Zelfrapportage kleurt: mensen beschrijven hun beleving.</li>
      <li>Kleine groepen (zoals de buitenring) vragen om voorzichtige interpretatie.</li>
      <li>De waarde ontstaat pas in de dialoog die op dit rapport volgt.</li>
    </ul>`;

  // ---- Jesters-slot --------------------------------------------------------
  const jesters = `
    <p class="eyebrow">De TaPas Jesters</p>
    <h2>Van meten naar benoemen</h2>
    <div class="card"><p>Een rapport meet; het verandert pas iets wanneer iemand de ongemakkelijke conclusie hardop durft te benoemen, aan de tafel waar het telt. Dat is de rol van de TaPas Jester: een gemandateerde buitenstaander die de onbesproken waarheid puntscherp, respectvol en met lichtheid op tafel legt — zonder ooit zelf het besluit te bezitten. De zotskap zit op een wetenschappelijk hoofd: de inhoud is ernstig, de toon is die van de nar, zodat de waarheid landt in plaats van afgeweerd te worden.</p></div>
    <div class="disclaimer">${DISCLAIMER}. TaPas 4 Organizations — onderdeel van het TaPasCity-platform. Rechtermonocle: het individu (T4P). Linkermonocle: de organisatie (T4O). De neusbrug: de congruentie tussen beide.</div>
    <footer>${esc(sessie.orgNaam)} · Organisatierapport · ${DISCLAIMER}</footer>`;

  const inhoud = [
    cover, leeswijzer, synthese, identiteit, energie, vermogensSectie,
    spanning, congruentieSectie, brug, talent, ontwikkeling, verantwoording, jesters,
  ].join("\n");

  return pagina(`Organisatieprofiel · ${sessie.orgNaam}`, inhoud);
}
