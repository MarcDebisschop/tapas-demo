/* =========================================================================
   Simulatie bekwaamheidsmodule
   Alle regels, drempels en weigeringsteksten zijn overgenomen uit de
   broncode van tapas-demo op commit c24d7c1. De casusgegevens zijn verzonnen.
   ========================================================================= */

'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ------------------------------------------------------------------ navigatie */

$$('.navlink').forEach((b) => {
  b.addEventListener('click', () => {
    $$('.navlink').forEach((x) => x.classList.remove('actief'));
    $$('.paneel').forEach((x) => x.classList.remove('actief'));
    b.classList.add('actief');
    $('#' + b.dataset.doel).classList.add('actief');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* ================================================================== 0. START */

const SCHERMEN = [
  {
    pad: '/admin/bekwaamheid/register',
    naam: 'Het register',
    doet: 'Wie is geaccrediteerd, op welk instrument, met welke licentiestatus en tot wanneer.',
    niet: 'Verwijdert niemand — inactief zetten vraagt een reden en laat een spoor. Trekt geen accreditatie weg.',
  },
  {
    pad: '/admin/bekwaamheid/normprofiel',
    naam: 'Het normprofiel',
    doet: 'De cesuur per instrument: vier wegingen die tot exact 1 optellen, een drempel per as en een drempel op het totaal.',
    niet: 'Kiest de cesuur niet. Die komt van een panel; het scherm legt hem vast en bevriest hem.',
  },
  {
    pad: '/admin/bekwaamheid/items',
    naam: 'De itembank',
    doet: 'Items opstellen en beheren, met de drie gebruiken: oefenen, meten, verbrand.',
    niet: 'Keurt geen items in de browser en wist er nooit een. Een item verdwijnt niet, het wordt verbrand.',
  },
  {
    pad: '/admin/bekwaamheid/rondes',
    naam: 'De rondes',
    doet: 'Rondes openen, bewijsstukken vastleggen, fasen laten opvolgen.',
    niet: 'Bepaalt de fasenloop niet en geeft geen codenummer uit — dat doet de server.',
  },
  {
    pad: '/admin/bekwaamheid/beoordelen',
    naam: 'Het beoordelen',
    doet: 'Rubriekscores 0–3 met een onderbouwing per score, en het afronden van een bewijsstuk.',
    niet: 'Kiest de beoordelaar niet: wie scoort, is wie is aangemeld. De server neemt geen beoordelaar-id aan.',
  },
  {
    pad: '/admin/bekwaamheid/beslissingen',
    naam: 'De beslissingen',
    doet: 'Het voorstel opvragen, de beslissing vastleggen met twee bekrachtigers, debriefen, publiceren, bezwaar behandelen.',
    niet: 'Rekent geen voorstel. Vult het beslisveld niet voor — wie een voorgevulde keuze ziet, bevestigt haar.',
  },
  {
    pad: '/admin/bekwaamheid/cyclus',
    naam: 'De cyclus',
    doet: 'De tussentijdse toetsen, de coachingsplannen en de agenda met de verwachte momenten.',
    niet: 'Is geen sanctie-instrument en rekent de toets niet na. Een alert schorst niets.',
  },
];

$('#schermenlijst').innerHTML = SCHERMEN.map((s) => `
  <article class="scherm">
    <code class="scherm-pad">${s.pad}</code>
    <h4>${s.naam}</h4>
    <p>${s.doet}</p>
    <p class="niet"><strong>Doet bewust niet:</strong> ${s.niet}</p>
  </article>`).join('');

/* ================================================================== 1. RONDE */

/* ---- casus (verzonnen gegevens, echte regels) ---- */

const ASSEN = ['weten', 'zien', 'zeggen', 'zorgen'];
const DREMPEL_AS = 0.60;
const DREMPEL_TOTAAL = 0.70;
const ZONE_BOVEN = 0.65;
const WEGING = { weten: 0.25, zien: 0.25, zeggen: 0.25, zorgen: 0.25 };

/* rubriekscores 0-3 per bewijsstuk; asscore = gemiddelde / 3  */
const CASUS_STUKKEN = [
  { nr: 1, as: 'weten',  titel: 'Kennischeck blokken A–E',      route: 'simulatie',     rubrieken: [3, 2, 2] },
  { nr: 2, as: 'zien',   titel: 'Profielinterpretatie op band',  route: 'eigen_opname',  rubrieken: [2, 2, 2, 2, 1] },
  { nr: 3, as: 'zeggen', titel: 'Terugkoppelgesprek, gesimuleerd', route: 'simulatie',   rubrieken: [3, 2, 3] },
  { nr: 4, as: 'zorgen', titel: 'Grensgeval en doorverwijzing',  route: 'simulatie',     rubrieken: [2, 3, 2] },
];

function asscore(stuk) {
  const som = stuk.rubrieken.reduce((a, b) => a + b, 0);
  return som / stuk.rubrieken.length / 3;
}

/* ---- de motor, letterlijk de vijf regels in volgorde ---- */

function bepaalVoorstel(scores, leemte) {
  const onder = ASSEN.filter((a) => scores[a] < DREMPEL_AS);
  const zone  = ASSEN.filter((a) => scores[a] >= DREMPEL_AS && scores[a] <= ZONE_BOVEN);
  const totaal = ASSEN.reduce((t, a) => t + scores[a] * WEGING[a], 0);

  const keten = [];
  const voeg = (regel, tekst, raakt) => keten.push({ regel, tekst, raakt });

  voeg('twee_of_meer_assen_onder_drempel',
    `Twee of meer assen onder de drempel van ${nl(DREMPEL_AS)} — nu ${onder.length}`,
    onder.length >= 2);
  voeg('een_as_onder_drempel',
    `Exact één as onder de drempel — nu ${onder.length}`,
    onder.length === 1);
  voeg('totaal_onder_drempel',
    `Totaal onder ${nl(DREMPEL_TOTAAL)} — nu ${nl(totaal)}`,
    totaal < DREMPEL_TOTAAL);
  voeg('as_in_aandachtszone',
    `Minstens één as in de aandachtszone ${nl(DREMPEL_AS)} tot en met ${nl(ZONE_BOVEN)} — nu ${zone.length}`,
    zone.length >= 1);
  voeg('administratieve_leemte',
    'Er is een administratieve leemte meegegeven',
    !!leemte);

  const eerste = keten.find((k) => k.raakt);
  const uitkomsten = {
    twee_of_meer_assen_onder_drempel: 'opgeschort',
    een_as_onder_drempel: 'voorwaardelijk',
    totaal_onder_drempel: 'voorwaardelijk',
    as_in_aandachtszone: 'bekrachtigd_met_aandachtspunt',
    administratieve_leemte: 'bekrachtigd_met_aandachtspunt',
  };

  return {
    uitkomst: eerste ? uitkomsten[eerste.regel] : 'bekrachtigd',
    regel: eerste ? eerste.regel : 'norm_gehaald',
    totaal, onder, zone, keten,
  };
}

function nl(x, d = 2) {
  return x.toFixed(d).replace('.', ',');
}

/* ---- toestand van de ronde ---- */

const beginToestand = () => ({
  stap: 1,
  fase: 'voorbereiding',
  code: 'R-2026-0007',
  normBevroren: false,
  stukken: CASUS_STUKKEN.map((s) => ({ ...s, status: 'open', gescoord: false })),
  voorstel: null,
  beslissing: null,
  debrief: null,
  gepubliceerd: null,
  audit: [],
});

let R = beginToestand();

function log(tekst, actor) {
  R.audit.unshift({ tekst, actor, tijd: tijdstip(R.audit.length) });
}

function tijdstip(i) {
  const basis = new Date(2026, 2, 3, 9, 12);
  basis.setMinutes(basis.getMinutes() + i * 0);
  const dagen = [0, 0, 0, 1, 1, 1, 1, 4, 4, 5, 6, 8, 9];
  const d = new Date(2026, 2, 3 + (dagen[Math.min(i, dagen.length - 1)] || 0), 9 + (i % 6), 12 + (i * 7) % 45);
  return d.toLocaleString('nl-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ---- de twaalf stappen ---- */

const W = {  /* woordelijke weigeringen uit de code */
  geenNorm: "Voor T4P-BUSINESS-KOMPAS geldt geen bevroren normprofiel; een ronde kan niet openen zonder cesuur.",
  stukFase: (fase) => `Ronde R-2026-0007 staat in fase '${fase}'; bewijsstukken worden vastgelegd in de voorbereiding.`,
  stukNummer: "Het nummer van een bewijsstuk ligt tussen 1 en 5.",
  stukBestaat: "Bewijsstuk 1 bestaat al op ronde R-2026-0007.",
  weging: "De weging van een bewijsstuk is groter dan nul.",
  inleverFase: (fase) => `Ronde R-2026-0007 staat in fase '${fase}'; inleveren kan alleen wanneer de ronde open staat.`,
  scoreFase: (fase) => `Ronde R-2026-0007 staat in fase '${fase}'; scores worden ingevoerd tijdens de beoordeling.`,
  scoreOpen: (n) => `Bewijsstuk ${n} is nog niet ingeleverd.`,
  scoreGeheel: "Een rubriekscore is een geheel getal van 0 tot en met 3.",
  scoreLengte: "Een score vraagt een onderbouwing van minstens veertig tekens.",
  scoreHerzien: "Een score wordt alleen herzien door de beoordelaar die haar invoerde.",
  geenScores: (n) => `Bewijsstuk ${n} heeft nog geen enkele score.`,
  beslisFase: (fase) => `Ronde R-2026-0007 staat in fase '${fase}'; een beslissing hoort na het voorstel of na overleg.`,
  beslisAl: "Ronde R-2026-0007 heeft al een beslissing.",
  tweeMensen: "Een beslissing wordt door twee verschillende mensen bekrachtigd.",
  afwijking: (v, d) => `De beslissing wijkt af van het voorstel ('${v}' werd '${d}'). Dat vraagt een motivering van minstens veertig tekens.`,
  publiceerZonderDebrief: "Publiceren kan pas nadat het debriefgesprek is vastgelegd.",
  debriefAl: (d) => `De debrief is al vastgelegd op ${d}.`,
  bezwaarZonderBeslissing: "Ronde R-2026-0007 heeft nog geen beslissing; er is niets om bezwaar tegen te maken.",
  bezwaarGrond: "Een bezwaar vraagt een grond van minstens twintig tekens.",
  eindfase: (f) => `Ronde R-2026-0007 is ${f}; er verandert niets meer aan.`,
  overgang: (van, mag) => `Van '${van}' kan alleen naar ${mag.map((f) => `'${f}'`).join(' of ')}.`,
  staakReden: "Een ronde staken vraagt een reden van minstens tien tekens.",
};

const STAPPEN = {

  1: () => ({
    titel: 'Het normprofiel bevriezen',
    scherm: '/admin/bekwaamheid/normprofiel',
    uitleg: 'Zonder bevroren cesuur kan er geen ronde open. Dat is de eerste weigering die u tegenkomt als u de stappen omdraait: een norm die tijdens het meten nog kan schuiven, is geen norm.',
    acties: [
      { goed: true, kop: 'Normprofiel bevriezen',
        sub: 'Wegingen 0,25 per as (samen exact 1). Drempel per as 0,60, drempel op het totaal 0,70. Onderbouwing 247 tekens.',
        doe: () => { R.normBevroren = true; log('Normprofiel T4P Business Kompas bevroren — wegingen 0,25/0,25/0,25/0,25, drempel as 0,60, totaal 0,70.', 'admin'); volgende(); } },
      { kop: 'Ronde openen zonder te bevriezen',
        sub: 'Het profiel staat er, de wegingen tellen op tot 1, maar het is nog niet bevroren.',
        weiger: W.geenNorm, bron: 'storage.ts:2630 — rondes.open()' },
      { kop: 'Bevriezen met een onderbouwing van 84 tekens',
        sub: 'De cesuur is gekozen, de argumentatie is kort opgeschreven.',
        weiger: 'De onderbouwing van een normprofiel is minstens 200 tekens.',
        bron: 'normprofiel.ts:64 — ONDERBOUWING_MINIMUM = 200 (de tekst is hier geparafraseerd, de grens niet)' },
      { kop: 'Bevriezen met wegingen 0,3 / 0,3 / 0,3 / 0,3',
        sub: 'Vier gelijke assen, netjes symmetrisch — maar samen 1,2.',
        weiger: 'De vier wegingen tellen samen op tot 1.',
        bron: 'normprofiel.ts — met WEGING_TOLERANTIE, omdat IEEE-754 bij twee van de twaalf plausibele wegingen 0,9999999999999999 geeft' },
    ],
  }),

  2: () => ({
    titel: 'De ronde openen',
    scherm: '/admin/bekwaamheid/rondes',
    uitleg: 'De server geeft het codenummer uit, niet het scherm. R-2026-0007 is de zevende ronde van 2026; de teller loopt per jaar door. De ronde begint in fase voorbereiding: bewijsstukken worden vastgelegd, maar er wordt nog niets ingeleverd.',
    acties: [
      { goed: true, kop: 'Ronde openen — soort: bekrachtiging',
        sub: 'Lena Vermeire, T4P Business Kompas, venster van 3 maanden.',
        doe: () => { log('Ronde R-2026-0007 geopend — soort bekrachtiging, venster tot 03-06-2026.', 'admin'); volgende(); } },
      { kop: 'Een tweede ronde openen op hetzelfde instrument',
        sub: 'Er loopt al één ronde voor deze persoon op dit instrument.',
        weiger: 'Er loopt al een ronde (R-2026-0007) voor deze persoon op T4P-BUSINESS-KOMPAS.',
        bron: 'storage.ts:2644 — één lopende ronde per persoon per instrument' },
      { kop: 'Meteen naar fase beslist springen',
        sub: 'De uitkomst is in het overleg al besproken; het lijkt tijd te winnen.',
        weiger: W.overgang('voorbereiding', ['open', 'gestaakt']),
        bron: 'rondeloop.ts:45 — TOEGESTANE_OVERGANGEN' },
    ],
  }),

  3: () => ({
    titel: 'De vier bewijsstukken vastleggen',
    scherm: '/admin/bekwaamheid/rondes',
    uitleg: 'Elk bewijsstuk hoort bij precies één as en heeft een weging groter dan nul. Nummers lopen van 1 tot 5. Stuk 2 gaat via een eigen opname, de andere drie via een simulatie — dat onderscheid staat in BEWIJSSTUKROUTES en verandert niets aan de weging.',
    acties: [
      { goed: true, kop: 'Vier bewijsstukken vastleggen',
        sub: '1 weten · 2 zien (eigen opname) · 3 zeggen · 4 zorgen. Stuk 5 blijft ongebruikt in deze ronde.',
        doe: () => { log('Vier bewijsstukken vastgelegd op R-2026-0007 (nummers 1 t/m 4).', 'admin'); volgende(); } },
      { kop: 'Een bewijsstuk met nummer 6 vastleggen',
        sub: 'Het instrument heeft dit keer een extra onderdeel.',
        weiger: W.stukNummer, bron: 'storage.ts:2786' },
      { kop: 'Bewijsstuk 1 nog een keer vastleggen',
        sub: 'De kennischeck wordt in twee delen afgenomen.',
        weiger: W.stukBestaat, bron: 'storage.ts:2795' },
      { kop: 'Een bewijsstuk met weging 0 vastleggen',
        sub: 'Het onderdeel wordt afgenomen maar telt deze ronde niet mee.',
        weiger: W.weging,
        bron: 'storage.ts:2789 — wie iets niet wil meewegen, verklaart het niet van toepassing; dat laat een reden na' },
    ],
  }),

  4: () => ({
    titel: 'De ronde openzetten',
    scherm: '/admin/bekwaamheid/rondes',
    uitleg: 'Nu pas kan er ingeleverd worden. In fase voorbereiding zou de opslaglaag elke inlevering weigeren, en in fase open kan er geen bewijsstuk meer bijkomen. Die twee weigeringen zijn spiegelbeelden van elkaar: de samenstelling van het dossier staat vast voordat het gevuld wordt.',
    acties: [
      { goed: true, kop: 'Fase voorbereiding → open',
        sub: 'Het venster loopt. Lena kan haar vier stukken inleveren.',
        doe: () => { R.fase = 'open'; log("Fase 'voorbereiding' → 'open'.", 'admin'); volgende(); } },
      { kop: 'Bewijsstuk 1 inleveren in fase voorbereiding',
        sub: 'De kennischeck is al gemaakt; het lijkt onnodig te wachten.',
        weiger: W.inleverFase('voorbereiding'), bron: 'storage.ts:2820' },
      { kop: 'De ronde staken, reden: "stopt"',
        sub: 'Lena laat weten dat het niet lukt dit venster.',
        weiger: W.staakReden,
        bron: 'storage.ts:2700 — tien tekens is laag, maar het dwingt tot een woord meer dan "n.v.t."' },
    ],
  }),

  5: () => ({
    titel: 'De vier stukken inleveren',
    scherm: '/admin/bekwaamheid/rondes',
    uitleg: 'Inleveren zet de status van open naar ingeleverd. Een stuk dat al ingeleverd is, kan niet nog eens ingeleverd worden — de opslaglaag antwoordt dan met de status die het stuk nu heeft. Als alle vier binnen zijn, kan de ronde naar ingeleverd.',
    acties: [
      { goed: true, kop: 'Alle vier de stukken inleveren',
        sub: 'Vier opnames en één kennischeckuitslag komen binnen tussen 4 en 19 maart.',
        doe: () => { R.stukken.forEach((s) => { s.status = 'ingeleverd'; }); log('Bewijsstukken 1 t/m 4 ingeleverd.', 'Lena Vermeire'); volgende(); } },
      { kop: 'Bewijsstuk 3 scoren voordat het beoordeeld wordt',
        sub: 'De beoordelaar heeft de opname al bekeken en wil vooruitwerken.',
        weiger: W.scoreFase('open'), bron: 'storage.ts:2918' },
      { kop: 'Bewijsstuk 2 niet van toepassing verklaren, reden: "geen"',
        sub: 'De eigen opname is technisch mislukt.',
        weiger: 'Niet van toepassing verklaren vraagt een reden van minstens tien tekens.',
        bron: 'storage.ts:2855' },
    ],
  }),

  6: () => ({
    titel: 'De ronde naar beoordeling',
    scherm: '/admin/bekwaamheid/rondes',
    uitleg: 'Vanaf ingeleverd zijn er drie wegen: door naar in_beoordeling, terug naar open, of staken. Die stap terug is de enige in de hele loop, en ze bestaat voor het geval dat een beoordelaar vaststelt dat een opname onbruikbaar is — dan moet de kandidaat kunnen aanvullen zonder dat de ronde gestaakt wordt.',
    acties: [
      { goed: true, kop: 'Fase ingeleverd → in_beoordeling',
        sub: 'Twee beoordelaars nemen het dossier op.',
        doe: () => { R.fase = 'in_beoordeling'; log("Fase 'ingeleverd' → 'in_beoordeling'.", 'admin'); volgende(); } },
      { goedOok: true, kop: 'Fase ingeleverd → open (de enige stap terug)',
        sub: 'Stuk 2 blijkt onbruikbaar opgenomen. Terug naar open, Lena levert opnieuw in.',
        info: 'Dit is toegestaan. In deze simulatie gaan we door met de gewone weg, maar de stap bestaat en is de enige stap terug in de hele loop.',
        bron: 'rondeloop.ts:48 — ingeleverd → [ingeleverd? nee] → in_beoordeling, open, gestaakt' },
      { kop: 'Fase ingeleverd → beslissing_voorstel',
        sub: 'De scores komen uit de motor; de beoordeling lijkt een tussenstap.',
        weiger: W.overgang('ingeleverd', ['in_beoordeling', 'open', 'gestaakt']),
        bron: 'rondeloop.ts:48' },
    ],
  }),

  7: () => ({
    titel: 'De rubrieken scoren',
    scherm: '/admin/bekwaamheid/beoordelen',
    uitleg: 'Per rubriek een geheel getal van 0 tot en met 3, met een onderbouwing van minstens veertig tekens. Die veertig tekens staan niet alleen in de opslaglaag maar ook als CHECK-beperking in de databank zelf: een script dat om de opslaglaag heen werkt, komt er ook niet langs. Bij het afronden wordt het gemiddelde van de rubrieken door 3 gedeeld — zo wordt 0–3 een asscore op 0–1.',
    acties: [
      { goed: true, kop: 'Alle vier de stukken scoren en afronden',
        sub: 'Veertien rubriekscores met onderbouwing. Stuk 2 heeft vijf rubrieken en komt uit op precies 0,60.',
        doe: () => {
          R.stukken.forEach((s) => { s.status = 'beoordeeld'; s.gescoord = true; });
          log('14 rubriekscores ingevoerd met onderbouwing; vier bewijsstukken afgerond.', 'beoordelaar A + B');
          volgende();
        } },
      { kop: 'Een rubriek scoren met 2,5',
        sub: 'De prestatie zit tussen twee niveaus in.',
        weiger: W.scoreGeheel,
        bron: 'storage.ts:2929 + DB-CHECK — halve punten maken van een rubriek een cijfer, en dan verdwijnt het gedragsanker' },
      { kop: 'Onderbouwing: "goed gedaan, voldoet"',
        sub: 'Twintig tekens. De beoordelaar vindt het duidelijk.',
        weiger: W.scoreLengte,
        bron: 'storage.ts:2933 en DB-CHECK bekwaamheid_score_onderbouwing_lengte (schema.ts:756)' },
      { kop: 'De score van collega B herzien',
        sub: 'Beoordelaar A ziet een score van B die niet klopt en past hem aan.',
        weiger: W.scoreHerzien,
        bron: 'storage.ts:2983 — wie een score van een ander overschrijft, maakt van twee beoordelaars één' },
      { kop: 'Bewijsstuk 4 afronden voordat er een score op staat',
        sub: 'Het onderdeel is bekeken, het cijfer volgt later.',
        weiger: W.geenScores(4), bron: 'storage.ts:3022' },
    ],
  }),

  8: () => ({
    titel: 'Het voorstel opvragen',
    scherm: '/admin/bekwaamheid/beslissingen',
    uitleg: 'De motor rekent nu de vier asscores en het gewogen totaal, loopt de vijf regels af van zwaar naar licht en levert één voorstel met één bindende regel. Ze beslist niets, ze stelt nooit beeindigd voor, en ze raakt de accreditatie niet aan — het woord komt in beslisregels.ts niet voor, en een test bewaakt dat.',
    acties: [
      { goed: true, kop: 'Voorstel opvragen',
        sub: 'GET /api/bekwaamheid/rondes/7/voorstel',
        doe: () => {
          const scores = {};
          R.stukken.forEach((s) => { scores[s.as] = asscore(s); });
          R.voorstel = bepaalVoorstel(scores, false);
          R.voorstel.scores = scores;
          R.fase = 'beslissing_voorstel';
          log(`Voorstel van de motor: ${R.voorstel.uitkomst} — bindende regel ${R.voorstel.regel}. Fase → 'beslissing_voorstel'.`, 'server');
          volgende();
        } },
      { kop: 'Voorstel opvragen met stuk 4 nog onbeoordeeld',
        sub: 'Drie assen hebben een score, de vierde nog niet.',
        weiger: "De as 'zorgen' heeft nog geen beoordeeld bewijsstuk.",
        bron: 'beslisregels.ts — een onvolledig dossier geeft {uitkomst: null, onvolledig: [...]}; de route antwoordt 409 met het veld onvolledig. Dat is een aparte vorm, geen lage score.' },
      { kop: 'Een beslissing vastleggen zonder voorstel te vragen',
        sub: 'De uitkomst is in de bespreking duidelijk geworden.',
        weiger: W.beslisFase('in_beoordeling'), bron: 'storage.ts:3090' },
    ],
  }),

  9: () => ({
    titel: 'De beslissing vastleggen',
    scherm: '/admin/bekwaamheid/beslissingen',
    uitleg: 'Twee verschillende mensen bekrachtigen. Wie afwijkt van het voorstel, motiveert dat in minstens veertig tekens — en de databank slaat het voorstel op naast de beslissing, zodat de afwijking navertelbaar blijft. Het beslisveld staat leeg: het scherm vult het voorstel niet voor, want wie een voorgevulde keuze ziet, bevestigt haar.',
    acties: [
      { goed: true, kop: 'Voorstel volgen: bekrachtigd_met_aandachtspunt',
        sub: 'Bekrachtigers: Mieke Ravenstijn en Joris Delacroix. Aandachtspunt: de as zien staat precies op de drempel.',
        doe: () => {
          R.beslissing = {
            uitkomst: 'bekrachtigd_met_aandachtspunt',
            afwijking: false,
            bekrachtigers: ['Mieke Ravenstijn', 'Joris Delacroix'],
            voorwaarde: 'Aandachtspunt op de as zien: bij de volgende bekrachtiging wordt de profielinterpretatie opnieuw op band beoordeeld.',
          };
          R.fase = 'beslist';
          log("Beslissing vastgelegd: bekrachtigd_met_aandachtspunt, conform het voorstel. Bekrachtigd door Mieke Ravenstijn en Joris Delacroix. Fase → 'beslist'.", 'admin');
          volgende();
        } },
      { goedOok: true, kop: 'Afwijken naar bekrachtigd, met motivering van 168 tekens',
        sub: 'De bekrachtigers vinden dat de as zien in het gesprek beter tot zijn recht kwam dan de opname liet zien.',
        info: 'Dit is toegestaan. De beslissing wordt bekrachtigd, met het voorstel bekrachtigd_met_aandachtspunt ernaast in het dossier en de motivering eronder. In deze simulatie volgen we het voorstel, zodat het aandachtspunt zichtbaar blijft in de rest van de keten.',
        bron: 'storage.ts:3103 — de afwijking wordt niet verboden, ze wordt geregistreerd' },
      { kop: 'Afwijken naar bekrachtigd zonder motivering',
        sub: 'De bekrachtigers zijn het eens; een toelichting lijkt overbodig.',
        weiger: W.afwijking('bekrachtigd_met_aandachtspunt', 'bekrachtigd'),
        bron: 'storage.ts:3103 + DB-CHECK op de kolom (schema.ts:804 en 897)' },
      { kop: 'Twee keer dezelfde bekrachtiger invullen',
        sub: 'De tweede bekrachtiger is op vakantie; de eerste tekent voor beide.',
        weiger: W.tweeMensen,
        bron: 'storage.ts:3098 — de kern van de module in één regel' },
      { kop: 'Uitkomst beeindigd voorstellen aan de motor',
        sub: 'Het dossier is zwak genoeg om de licentie te beëindigen.',
        weiger: 'De motor stelt nooit beeindigd voor. Het retourtype is VoorstelbareUitkomst, en die verzameling bevat beeindigd niet.',
        bron: 'beslisregels.ts — beëindigen is een mensenbeslissing, geen rekenuitkomst. De bekrachtigers mogen het wel vastleggen; de motor mag het niet voorstellen.' },
    ],
  }),

  10: () => ({
    titel: 'Debriefen',
    scherm: '/admin/bekwaamheid/beslissingen',
    uitleg: 'Het debriefgesprek gaat vóór de publicatie. Dat is geen vormvereiste: het betekent dat Lena de uitkomst van een mens hoort en niet uit een portaal leest. De regiekamer meet dat als KPI — debrief binnen tien werkdagen na het laatste onderdeel, en de schriftelijke beslissing binnen drie werkdagen na de debrief.',
    acties: [
      { goed: true, kop: 'Debrief vastleggen — 26 maart 2026',
        sub: 'Gespreksfasen: opening, kern, wrijving, landing. De wrijving zat op de as zien.',
        doe: () => {
          R.debrief = '26-03-2026';
          R.fase = 'gedebrieft';
          log("Debriefgesprek vastgelegd op 26-03-2026. Fase → 'gedebrieft'.", 'Mieke Ravenstijn');
          volgende();
        } },
      { kop: 'Publiceren voordat het gesprek is gevoerd',
        sub: 'De uitkomst staat vast; Lena kan hem in haar portaal lezen.',
        weiger: W.publiceerZonderDebrief, bron: 'storage.ts:3178' },
      { kop: 'De debrief een tweede keer vastleggen',
        sub: 'Er is een vervolggesprek geweest.',
        weiger: W.debriefAl('26-03-2026'),
        bron: 'storage.ts:3154 — een tweede gesprek is een nieuwe aantekening, niet een overschrijving van de eerste' },
    ],
  }),

  11: () => ({
    titel: 'Publiceren',
    scherm: '/admin/bekwaamheid/beslissingen',
    uitleg: 'Publiceren maakt de uitkomst zichtbaar voor Lena, in haar eigen licentiebeeld op /api/coach/licentiebeeld — het enige eindpunt van de module dat niet achter vereisAdmin zit. Hier hoort de licentie op bekrachtigd_met_aandachtspunt te komen te staan, met een geldigheid van 24 maanden en twee agendaposten. Dat gebeurt niet. Zie het hoofdstuk Grenzen.',
    acties: [
      { goed: true, kop: 'Uitkomst publiceren',
        sub: 'Lena ziet vanaf nu haar uitkomst, het aandachtspunt en de bekrachtigers.',
        doe: () => {
          R.gepubliceerd = '27-03-2026';
          log('Uitkomst gepubliceerd op 27-03-2026 — zichtbaar in het licentiebeeld van Lena Vermeire.', 'admin');
          log('LET OP — de licentiestatus blijft op overgangsperiode staan en geldig_tot blijft leeg. licenties.naBekrachtiging() bestaat maar wordt nergens aangeroepen.', 'meting');
          volgende();
        } },
      { kop: 'Bezwaar maken vóór de publicatie',
        sub: 'Lena heeft in het gesprek al gezegd dat ze het er niet mee eens is.',
        info: 'Dit is toegestaan zodra er een beslissing is — bezwaar hangt aan de beslissing, niet aan de publicatie. Wat níet kan, is bezwaar maken op een ronde zonder beslissing: dan antwoordt de opslaglaag "Ronde R-2026-0007 heeft nog geen beslissing; er is niets om bezwaar tegen te maken."',
        bron: 'storage.ts:3252' },
    ],
  }),

  12: () => ({
    titel: 'Afsluiten — en wat daarna nog kan',
    scherm: '/admin/bekwaamheid/beslissingen · /admin/bekwaamheid/cyclus',
    uitleg: 'Afsluiten is geen eindpunt zonder deur: van afgesloten kan het nog naar bezwaar. Wat er níet meer kan, is staken — vanaf beslist staat er een uitkomst over een persoon vast, en die laten verdwijnen zou het spoor uitwissen. Over twaalf maanden volgt de tussentijdse toets, over vierentwintig de volgende bekrachtiging.',
    acties: [
      { goed: true, kop: 'Ronde afsluiten',
        sub: 'Het dossier is compleet: cijfers, onderbouwingen, voorstel, beslissing, bekrachtigers, debrief, publicatie.',
        doe: () => {
          R.fase = 'afgesloten';
          log("Fase 'gedebrieft' → 'afgesloten'. Het dossier is navertelbaar.", 'admin');
          volgende();
        } },
      { kop: 'De ronde staken in plaats van afsluiten',
        sub: 'De uitkomst was mager; staken lijkt netter dan vastleggen.',
        weiger: W.overgang('gedebrieft', ['afgesloten', 'bezwaar']),
        bron: 'rondeloop.ts:53 — gestaakt is bereikbaar tot en met overleg, daarna niet meer' },
      { kop: 'Bezwaar met grond: "niet eens"',
        sub: 'Negen tekens.',
        weiger: W.bezwaarGrond, bron: 'storage.ts:3258' },
    ],
  }),

  13: () => ({
    titel: 'Klaar — het dossier staat vast',
    scherm: '—',
    uitleg: 'Elke uitspraak in dit dossier is terug te lezen naar de cijfers waarop ze rustte, de mensen die haar namen en de reden dat er van het voorstel is afgeweken of niet. Dat is wat de module levert. Klik hieronder om nog twee dingen te proberen die na het afsluiten mogelijk zijn — of begin opnieuw.',
    acties: [
      { kop: 'Bezwaar aantekenen op de afgesloten ronde',
        sub: 'Lena tekent bezwaar aan met een grond van 214 tekens.',
        info: 'Dit is toegestaan: afgesloten → bezwaar staat in de fasentabel. Wat daarna vastloopt: bij een gegrond bezwaar laat de fasentabel bezwaar → in_beoordeling toe, maar de opslaglaag weigert een tweede beslissing op dezelfde ronde (UNIQUE op ronde_id, plus een dubbelcheck). Een herbeslissing na gegrond bezwaar is dus nog niet mogelijk. Zie Grenzen.',
        bron: 'rondeloop.ts:55 · storage.ts:3095' },
      { kop: 'Nog iets aan de scores wijzigen',
        sub: 'Er blijkt een typefout in de onderbouwing van rubriek 3 te staan.',
        weiger: W.eindfase('afgesloten'), bron: 'storage.ts:2728' },
    ],
  }),
};

const MAX_STAP = 13;

function volgende() {
  R.stap = Math.min(R.stap + 1, MAX_STAP);
  toonRonde();
  $('#d-melding').hidden = true;
}

/* ---- weergave ---- */

function toonRonde() {
  const def = STAPPEN[R.stap]();

  $('#d-code').textContent = R.code;
  const fv = $('#d-fase');
  fv.textContent = R.fase;
  fv.className = 'fase' + (R.fase === 'afgesloten' ? ' eind' : R.fase === 'gestaakt' ? ' stop' : '');

  $('#d-persoon').textContent = 'Lena Vermeire';
  $('#d-instr').textContent = 'T4P Business Kompas';
  $('#d-soort').textContent = 'bekrachtiging';
  $('#d-venster').textContent = R.stap >= 2 ? 'tot 03-06-2026' : '—';
  $('#d-status').textContent = R.stap >= 11 ? 'overgangsperiode ⚠' : 'overgangsperiode';

  /* bewijsstukken */
  $('#d-stukken tbody').innerHTML = R.stap < 3
    ? '<tr><td colspan="3" style="color:var(--tekst-vaag);font-size:.8rem">Nog niets vastgelegd.</td></tr>'
    : R.stukken.map((s) => `
      <tr>
        <td class="nr">${s.nr}</td>
        <td>${s.titel}<br><span class="klein-inline">${s.as}${s.route === 'eigen_opname' ? ' · eigen opname' : ''}</span></td>
        <td class="st ${s.status}">${s.status}</td>
      </tr>`).join('');

  /* assen */
  const heeftScores = R.stukken.every((s) => s.gescoord);
  $('#d-assen').innerHTML = !heeftScores
    ? '<p class="leeg" style="color:var(--tekst-vaag);font-size:.8rem;margin:0">Nog geen beoordeelde bewijsstukken.</p>'
    : R.stukken.map((s) => {
        const sc = asscore(s);
        const kl = sc < DREMPEL_AS ? 'onder' : sc <= ZONE_BOVEN ? 'zone' : 'goed';
        return `<div class="asrij">
          <span class="asnaam">${s.as}</span>
          <span class="asbalk"><i class="${kl}" style="width:${(sc * 100).toFixed(1)}%"></i><u style="left:${DREMPEL_AS * 100}%"></u></span>
          <span class="aswaarde">${nl(sc)}</span>
        </div>`;
      }).join('');

  /* voorstel */
  $('#d-voorstel').innerHTML = !R.voorstel
    ? '<p class="leeg">Nog geen voorstel.</p>'
    : `<span class="uitk">${R.voorstel.uitkomst}</span>
       <p class="gr">bindende regel: <code>${R.voorstel.regel}</code></p>
       <dl>
         <div><dt>Gewogen totaal</dt><dd>${nl(R.voorstel.totaal)} · drempel 0,70</dd></div>
         <div><dt>Assen onder drempel</dt><dd>${R.voorstel.onder.length}</dd></div>
         <div><dt>Assen in aandachtszone</dt><dd>${R.voorstel.zone.length}${R.voorstel.zone.length ? ' (' + R.voorstel.zone.join(', ') + ')' : ''}</dd></div>
         <div><dt>Activiteitsroute</dt><dd>voldoende_activiteit</dd></div>
       </dl>`;

  /* beslissing */
  $('#d-beslissing').innerHTML = !R.beslissing
    ? '<p class="leeg">Nog geen beslissing.</p>'
    : `<span class="uitk">${R.beslissing.uitkomst}</span>
       <p class="gr">${R.beslissing.afwijking ? 'wijkt af van het voorstel, met motivering' : 'conform het voorstel'}</p>
       <dl>
         <div><dt>Bekrachtigers</dt><dd>${R.beslissing.bekrachtigers.join(' + ')}</dd></div>
         <div><dt>Debrief</dt><dd>${R.debrief || '—'}</dd></div>
         <div><dt>Gepubliceerd</dt><dd>${R.gepubliceerd || '—'}</dd></div>
       </dl>
       ${R.beslissing.voorwaarde ? `<p class="gr" style="margin-top:.6rem;border-top:1px solid var(--rand);padding-top:.5rem">${R.beslissing.voorwaarde}</p>` : ''}`;

  /* audit */
  $('#d-audit').innerHTML = R.audit.length
    ? R.audit.map((a) => `<li>${a.tekst}<br><span>${a.tijd} · ${a.actor}</span></li>`).join('')
    : '<li style="color:var(--tekst-vaag)">Nog geen gebeurtenissen.</li>';

  /* stapkop */
  $('#d-stapnr').textContent = Math.min(R.stap, 12);
  $('#d-staptitel').textContent = def.titel;
  $('#d-stapuitleg').textContent = def.uitleg;
  $('#d-scherm').textContent = def.scherm;
  $('#d-scherm').closest('.scherm-wijzer').style.display =
    /^[\s\u2014-]*$/.test(def.scherm) ? 'none' : '';

  /* acties */
  $('#d-acties').innerHTML = def.acties.map((a, i) => `
    <button class="actie ${a.goed ? 'klaar' : a.goedOok ? '' : 'fout'}" data-i="${i}">
      <strong>${a.kop}</strong>
      <span>${a.sub}</span>
    </button>`).join('');

  $$('#d-acties .actie').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = def.acties[Number(btn.dataset.i)];
      if (a.doe) { a.doe(); return; }
      const m = $('#d-melding');
      m.hidden = false;
      m.className = 'melding' + (a.info ? ' ok' : '');
      m.innerHTML = `
        <p class="mkop">${a.info ? 'Dit mag — en dit gebeurt er' : 'De server weigert, woordelijk'}</p>
        <p class="mtekst">${a.info ? a.info : '&ldquo;' + a.weiger + '&rdquo;'}</p>
        <p class="mbron">${a.bron}</p>`;
      m.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
}

$('#btn-herstart').addEventListener('click', () => { R = beginToestand(); toonRonde(); });
toonRonde();

/* ================================================================== 2. MOTOR */

const mScores = { weten: 0.78, zien: 0.60, zeggen: 0.89, zorgen: 0.78 };

$('#m-schuiven').innerHTML = ASSEN.map((as) => `
  <label class="schuifrij" style="margin:0">
    <span class="schuiflabel">
      <span>${as}<span class="badge" id="mb-${as}"></span></span>
      <output id="mo-${as}"></output>
    </span>
    <input type="range" id="ms-${as}" min="0" max="100" step="1" value="${Math.round(mScores[as] * 100)}">
  </label>`).join('');

ASSEN.forEach((as) => {
  $('#ms-' + as).addEventListener('input', (e) => {
    mScores[as] = Number(e.target.value) / 100;
    tekenMotor();
  });
});
$('#m-leemte').addEventListener('change', tekenMotor);
$('#m-afnames').addEventListener('input', tekenMotor);

const VOORBEELDEN = {
  grens1: { weten: 0.50, zien: 0.50, zeggen: 1.00, zorgen: 0.80, leemte: false },
  grens2: { weten: 0.69, zien: 0.69, zeggen: 0.69, zorgen: 0.69, leemte: false },
  grens3: { weten: 0.80, zien: 0.63, zeggen: 0.85, zorgen: 0.78, leemte: false },
  grens4: { weten: 0.85, zien: 0.82, zeggen: 0.90, zorgen: 0.88, leemte: false },
};

$$('[data-vb]').forEach((b) => {
  b.addEventListener('click', () => {
    const v = VOORBEELDEN[b.dataset.vb];
    ASSEN.forEach((as) => { mScores[as] = v[as]; $('#ms-' + as).value = Math.round(v[as] * 100); });
    $('#m-leemte').checked = v.leemte;
    tekenMotor();
  });
});

const KLEURKLASSE = {
  opgeschort: 'slecht',
  voorwaardelijk: 'let',
  bekrachtigd_met_aandachtspunt: 'let',
  bekrachtigd: 'goed',
};

const NOTEN = {
  twee_of_meer_assen_onder_drempel: 'Twee zwakke assen zijn geen ongeluk maar een patroon. De licentie gaat op pauze en de persoon mag niet afnemen tot er een herkansing is. Let op: de motor stelt dit voor, ze doet het niet.',
  een_as_onder_drempel: 'Eén zwakke as krijgt een voorwaarde met een datum, geen verbod: <code>voorwaardelijk</code> staat in de verzameling statussen met afnamerecht. Dat is bewust — wie een tekortkoming moet herstellen, heeft praktijk nodig om te herstellen.',
  totaal_onder_drempel: 'Alle assen halen hun eigen drempel, maar samen niet de norm. Deze regel bestaat omdat vier keer "net aan" iets anders is dan vier keer "goed". Zonder deze regel kon iemand met vier keer 0,62 bekrachtigd worden.',
  as_in_aandachtszone: 'Niemand haalt de drempel niet, maar één as staat er zo dichtbij dat er iets van te zeggen valt. De aandachtszone loopt van 0,60 tot en met 0,65 — <strong>beide randen tellen mee</strong>. Een as die exact op 0,60 staat, is dus zowel niet-onder-de-drempel als in-de-aandachtszone.',
  administratieve_leemte: 'Een ontbrekend stuk is geen zwakke prestatie. Het krijgt daarom de lichtste uitkomst die iets aantekent, en de motor stelt hem niet zelf vast — de leemte wordt benoemd meegegeven door wie het dossier kent.',
  norm_gehaald: 'Geen regel bond. Dat is de enige weg naar <code>bekrachtigd</code>: niet omdat iets goed genoeg leek, maar omdat vijf regels op rij niet aansloegen.',
};

function tekenMotor() {
  const leemte = $('#m-leemte').checked;
  const afn = Number($('#m-afnames').value);
  $('#m-afn-uit').textContent = afn;

  const v = bepaalVoorstel(mScores, leemte);

  ASSEN.forEach((as) => {
    const sc = mScores[as];
    $('#mo-' + as).textContent = nl(sc);
    const b = $('#mb-' + as);
    if (sc < DREMPEL_AS) { b.className = 'badge onder'; b.textContent = 'onder drempel'; }
    else if (sc <= ZONE_BOVEN) { b.className = 'badge zone'; b.textContent = 'aandachtszone'; }
    else { b.className = 'badge goed'; b.textContent = 'haalt'; }
  });

  const u = $('#m-uitkomst');
  u.textContent = v.uitkomst;
  u.className = KLEURKLASSE[v.uitkomst] || '';
  $('#m-regel').textContent = v.regel;

  const tr = $('#m-totaal').parentElement;
  tr.className = 'totaalrij ' + (v.totaal < DREMPEL_TOTAAL ? 'mis' : 'haalt');
  $('#m-totaal').textContent = nl(v.totaal);

  $('#m-balken').innerHTML = ASSEN.map((as) => {
    const sc = mScores[as];
    const kl = sc < DREMPEL_AS ? 'onder' : sc <= ZONE_BOVEN ? 'zone' : 'goed';
    return `<div class="asrij">
      <span class="asnaam">${as}</span>
      <span class="asbalk"><i class="${kl}" style="width:${(sc * 100).toFixed(1)}%"></i><u style="left:${DREMPEL_AS * 100}%"></u></span>
      <span class="aswaarde">${nl(sc)}</span>
    </div>`;
  }).join('');

  let gevonden = false;
  $('#m-keten').innerHTML = v.keten.map((k) => {
    let kl = 'geen';
    if (k.raakt && !gevonden) { kl = 'bindt'; gevonden = true; }
    else if (k.raakt) kl = 'raakt';
    return `<li class="${kl}">${kl === 'bindt' ? '<strong>bindt: </strong>' : kl === 'raakt' ? 'slaat ook aan: ' : ''}${k.tekst}</li>`;
  }).join('') + `<li class="${gevonden ? 'geen' : 'bindt'}">${gevonden ? '' : '<strong>bindt: </strong>'}Geen regel sloeg aan → <code>norm_gehaald</code></li>`;

  const act = afn >= 6 ? 'voldoende_activiteit' : 'slapend';
  $('#m-noot').innerHTML = `<p>${NOTEN[v.regel]}</p>
    <p style="margin-top:.7rem"><strong>Activiteitsroute:</strong> <code>${act}</code>${afn < 6 ? ' — onder de drempel van 6 afnames in 24 maanden.' : ''} Dit staat in een <strong>eigen veld</strong> en kan de uitkomst hierboven niet veranderen. Een licentie die slaapt omdat er geen vraag was, is iets anders dan een licentie die is opgeschort omdat het werk niet op peil was.</p>`;
}
tekenMotor();

/* ================================================================== 3. JAAR 1 */

const TUSSENTIJDSE_DREMPEL = 3;   /* ceil(6 x 12 / 24) */
const OEFEN_ONDERGRENS = 55;

['j-afnames', 'j-sessies', 'j-gem'].forEach((id) => {
  $('#' + id).addEventListener('input', tekenJaar1);
});

function tekenJaar1() {
  const afn = Number($('#j-afnames').value);
  const ses = Number($('#j-sessies').value);
  const gem = Number($('#j-gem').value);

  $('#j-afn-uit').textContent = afn;
  $('#j-ses-uit').textContent = ses;
  $('#j-gem-uit').textContent = ses === 0 ? 'leeg' : gem;

  const s1 = afn < TUSSENTIJDSE_DREMPEL;
  const s2 = ses === 0 || gem < OEFEN_ONDERGRENS;

  const namen = [];
  if (s1) namen.push('afnames_onder_drempel');
  if (s2) namen.push('oefening_zwak_of_afwezig');

  let uitkomst, grond;
  if (namen.length === 0) { uitkomst = 'geen_signaal'; grond = 'Geen van de twee signalen sloeg aan.'; }
  else if (namen.length === 1) { uitkomst = 'aandachtspunt'; grond = `Eén signaal sloeg aan (${namen[0]}); één signaal geeft nooit meer dan een aandachtspunt.`; }
  else { uitkomst = 'alert'; grond = `Twee of meer signalen sloegen aan (${namen.join(', ')}); een coachingsplan is verplicht.`; }

  const u = $('#j-uitkomst');
  u.textContent = uitkomst;
  u.className = uitkomst === 'alert' ? 'slecht' : uitkomst === 'aandachtspunt' ? 'let' : 'goed';
  $('#j-regel').textContent = grond;

  $('#j-signalen').innerHTML = `
    <div class="signaal ${s1 ? 'aan' : ''}">
      <span class="snaam">afnames_onder_drempel</span>
      <p>${s1
        ? `${afn} afname${afn === 1 ? '' : 's'} in twaalf maanden, drempel ${TUSSENTIJDSE_DREMPEL}. Het signaal slaat aan.`
        : `<span class="slaat-niet-aan">${afn} afnames, drempel ${TUSSENTIJDSE_DREMPEL}. Slaat niet aan.</span>`}</p>
    </div>
    <div class="signaal ${s2 ? 'aan' : ''}">
      <span class="snaam">oefening_zwak_of_afwezig</span>
      <p>${ses === 0
        ? 'Geen afgeronde oefensessies in 12 maanden. Het signaal slaat aan — grens 1, niet 0. Wie nul keer oefende, heeft geen zwak gemiddelde, die heeft geen gemiddelde.'
        : gem < OEFEN_ONDERGRENS
          ? `Gemiddelde ${gem} over ${ses} sessies, ondergrens ${OEFEN_ONDERGRENS}. Het signaal slaat aan.`
          : `<span class="slaat-niet-aan">Gemiddelde ${gem} over ${ses} sessies, ondergrens ${OEFEN_ONDERGRENS}. Slaat niet aan.</span>`}</p>
    </div>`;

  $('#j-plan').innerHTML = uitkomst === 'alert'
    ? `<div class="plankaart">
         <h4>Coachingsplan verplicht</h4>
         <p>De toets kan niet worden afgesloten zonder plan. Het plan krijgt een evaluatiedatum op zes maanden en drie mogelijke uitkomsten:</p>
         <ul>
           <li><code>opgelost</code> — de signalen zijn weg</li>
           <li><code>verlengd</code> — er is meer tijd nodig</li>
           <li><code>meegenomen_naar_bekrachtiging</code> — het punt komt terug bij de volgende bekrachtiging</li>
         </ul>
         <p style="margin-top:.7rem"><strong>Wat er niet gebeurt:</strong> de licentie blijft staan, de poort blijft open, de status verandert niet.</p>
       </div>`
    : uitkomst === 'aandachtspunt'
      ? `<div class="plankaart" style="border-color:var(--rand);background:var(--inkt-2)">
           <h4 style="color:var(--tekst)">Geen plan verplicht</h4>
           <p>Het aandachtspunt wordt benoemd in het gesprek en aangetekend in het dossier. Eén signaal is een observatie, geen patroon — en de module maakt van een observatie geen verplichting.</p>
         </div>`
      : '';
}
tekenJaar1();

/* ================================================================== 4. POORT */

const STATUSSEN = ['bekrachtigd', 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'slapend', 'opgeschort', 'beeindigd', 'overgangsperiode'];
const MET_RECHT = ['bekrachtigd', 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'overgangsperiode'];
const HANDELINGEN = ['afname_aanmaken', 'uitnodiging_aanmaken', 'afname_voortzetten', 'rapport_bekijken', 'historiek_bekijken'];
const BINNEN_POORT = ['afname_aanmaken', 'uitnodiging_aanmaken'];
const STANDEN = ['uit', 'log', 'handhaaf'];

const P = { status: 'opgeschort', handeling: 'afname_aanmaken', stand: 'log' };

function knoppen(hostId, lijst, veld) {
  $(hostId).innerHTML = lijst.map((x) => `<button class="keuze ${P[veld] === x ? 'aan' : ''}" data-w="${x}">${x}</button>`).join('');
  $$(hostId + ' .keuze').forEach((b) => b.addEventListener('click', () => {
    P[veld] = b.dataset.w;
    knoppen(hostId, lijst, veld);
    tekenPoort();
  }));
}

$('#p-statustabel').innerHTML = STATUSSEN.map((s) => `
  <tr><td>${s.replace(/_/g, '_\u200B')}</td><td class="${MET_RECHT.includes(s) ? 'ja' : 'nee'}">${MET_RECHT.includes(s) ? 'ja' : 'nee'}</td></tr>`).join('');

function tekenPoort() {
  const binnen = BINNEN_POORT.includes(P.handeling);
  const recht = MET_RECHT.includes(P.status);

  let uitspraak, grond, effect, klasse;

  if (!binnen) {
    uitspraak = 'de poort komt er niet aan te pas';
    grond = `<code>${P.handeling}</code> staat niet in HANDELINGEN_BINNEN_DE_POORT.`;
    klasse = 'laat-door';
    effect = `<p>De poort weigert alleen het <strong>aanmaken</strong> van iets nieuws. Een lopende afname voortzetten, een rapport of de historiek bekijken valt er buiten — welke status de licentie ook heeft, ook <code>beeindigd</code>.</p>
      <p style="margin-top:.7rem">De grond: iemand mag nooit een afname kwijtraken door een status die verandert terwijl er een kandidaat in het systeem zit. Een deelnemer die halverwege een instrument zit, is geen partij in het licentiedossier van de practitioner.</p>`;
  } else if (recht) {
    uitspraak = 'toegestaan';
    grond = `Status <code>${P.status}</code> staat in STATUSSEN_MET_AFNAMERECHT.`;
    klasse = 'laat-door';
    effect = `<p>De handeling gaat door, in elke stand van de poort.</p>
      ${P.status === 'voorwaardelijk' ? '<p style="margin-top:.7rem"><strong>Waarom voorwaardelijk mag afnemen:</strong> een voorwaarde is een opdracht met een datum, geen verbod. Wie een tekortkoming moet herstellen, heeft praktijk nodig om te herstellen. Wat wél gebeurt: de voorwaarde staat in het licentiebeeld en er staat een agendapost op de vervaldatum.</p>' : ''}
      ${P.status === 'overgangsperiode' ? '<p style="margin-top:.7rem"><strong>Waarom overgangsperiode mag afnemen:</strong> dit is de status van iedereen die al werkte voordat de module bestond. Een poort die weigert voordat iemand een eerlijke kans heeft gehad om erdoor te komen, is geen poort maar een val.</p>' : ''}`;
  } else {
    grond = `Weigeringsgrond <code>status_zonder_afnamerecht</code> — &ldquo;Status ${P.status} geeft geen afnamerecht.&rdquo;`;
    if (P.stand === 'uit') {
      uitspraak = 'toegestaan — de poort staat uit';
      klasse = 'laat-door';
      effect = `<p>In de stand <code>uit</code> wordt er niets getoetst en niets vastgelegd. Dit is de stand voor een omgeving waar de module nog niet in gebruik is.</p>`;
    } else if (P.stand === 'log') {
      uitspraak = 'toegestaan — maar vastgelegd';
      klasse = 'logt';
      effect = `<p>Dit is de <strong>standaardstand</strong>, uit de omgevingsvariabele <code>BEKWAAMHEID_POORT</code>. De uitkomst met de weigeringsgrond wordt vastgelegd, maar de handeling gaat door.</p>
        <p style="margin-top:.7rem">Zo is te meten wat er zou zijn geweigerd voordat er iets geweigerd wordt. De regiekamer heeft daarvoor een eigen eindpunt: <code>POST /api/​bekwaamheid/​regiekamer/​poortsimulatie</code>.</p>`;
    } else {
      uitspraak = 'geweigerd';
      klasse = 'blokkeert';
      effect = `<p>In de stand <code>handhaaf</code> wordt de handeling geweigerd met de tekst hierboven. Dit is de enige stand waarin een licentie iets tegenhoudt.</p>
        <p style="margin-top:.7rem">${P.status === 'slapend' ? 'Bij <code>slapend</code>: de licentie slaapt omdat er te weinig afnames waren, niet omdat er iets misging. Reactiveren gaat via een ronde van de soort <code>reactivatie</code>.' : P.status === 'opgeschort' ? 'Bij <code>opgeschort</code>: de weg terug is een ronde van de soort <code>herkansing</code>.' : 'Bij <code>beeindigd</code>: dit is de enige uitkomst die de motor nooit voorstelt. Alleen mensen kunnen hem vastleggen.'}</p>`;
    }
  }

  const u = $('#p-uitspraak');
  u.textContent = uitspraak;
  u.className = klasse === 'blokkeert' ? 'slecht' : klasse === 'logt' ? 'let' : 'goed';
  $('#p-grond').innerHTML = grond;
  const e = $('#p-effect');
  e.className = 'effectvak ' + klasse;
  e.innerHTML = `<p class="ekop">wat er gebeurt</p>${effect}`;
}

knoppen('#p-statussen', STATUSSEN, 'status');
knoppen('#p-handelingen', HANDELINGEN, 'handeling');
knoppen('#p-standen', STANDEN, 'stand');
tekenPoort();

/* ================================================================== 5. FASENKAART */

const OVERGANGEN = {
  voorbereiding: ['open', 'gestaakt'],
  open: ['ingeleverd', 'gestaakt'],
  ingeleverd: ['in_beoordeling', 'open', 'gestaakt'],
  in_beoordeling: ['beslissing_voorstel', 'overleg', 'gestaakt'],
  beslissing_voorstel: ['overleg', 'beslist', 'gestaakt'],
  overleg: ['beslist', 'gestaakt'],
  beslist: ['gedebrieft'],
  gedebrieft: ['afgesloten', 'bezwaar'],
  afgesloten: ['bezwaar'],
  bezwaar: ['afgesloten', 'in_beoordeling'],
  gestaakt: [],
};

const FASE_TOELICHTING = {
  voorbereiding: 'De ronde bestaat, het codenummer is uitgegeven, de bewijsstukken worden vastgelegd. Er wordt nog niets ingeleverd: de samenstelling van het dossier staat vast voordat het gevuld wordt.',
  open: 'Het venster loopt. Bewijsstukken kunnen worden ingeleverd, maar er kan er geen meer bijkomen. Scoren kan hier nog niet — dat gebeurt tijdens de beoordeling.',
  ingeleverd: 'Alles is binnen. Dit is de enige fase met een weg terug: naar open, voor het geval een beoordelaar vaststelt dat een opname onbruikbaar is en de kandidaat moet kunnen aanvullen zonder dat de ronde gestaakt wordt.',
  in_beoordeling: 'Twee beoordelaars voeren rubriekscores in met een onderbouwing per score. Van hier gaat het naar het motorvoorstel, of rechtstreeks naar overleg als de beoordelaars het niet eens worden.',
  beslissing_voorstel: 'De motor heeft één voorstel gedaan met één bindende regel. De bekrachtigers kunnen het volgen, ervan afwijken met een motivering, of eerst overleggen.',
  overleg: 'Voor de gevallen waarin de bekrachtigers er samen niet uit komen. Van hier alleen naar beslist of gestaakt: overleg is geen parkeerplaats.',
  beslist: 'Er is een uitkomst over een persoon vastgelegd, met twee bekrachtigers erbij. Vanaf hier kan de ronde niet meer gestaakt worden — dat zou het spoor uitwissen. Er is nog maar één weg: debriefen.',
  gedebrieft: 'Het gesprek is gevoerd. Lena heeft de uitkomst van een mens gehoord, niet uit een portaal gelezen. Nu kan de uitkomst gepubliceerd worden en kan de ronde sluiten.',
  afgesloten: 'Het dossier staat vast. Geen enkele wijziging meer, met één deur open: bezwaar. Wie zich benadeeld voelt, kan altijd nog terecht.',
  bezwaar: 'Een bezwaar met een grond van minstens twintig tekens. Van hier kan het terug naar de beoordeling — want een gegrond bezwaar dat alleen tot een aantekening leidt, is geen bezwaarrecht.',
  gestaakt: 'Een eindfase zonder uitgang. De ronde is beëindigd voordat er een uitkomst was, met een reden van minstens tien tekens in het spoor. Bereikbaar tot en met overleg, daarna niet meer.',
};

const FASEN = Object.keys(OVERGANGEN);
let kGekozen = 'in_beoordeling';

function tekenKaart() {
  const doelen = OVERGANGEN[kGekozen];
  $('#k-fasen').innerHTML = FASEN.map((f) => {
    let kl = 'fasenknop';
    if (f === kGekozen) kl += ' aan';
    else if (doelen.includes(f)) kl += ' doel';
    else kl += ' dood';
    return `<button class="${kl}" data-f="${f}">${f}</button>`;
  }).join('');
  $$('#k-fasen .fasenknop').forEach((b) => b.addEventListener('click', () => { kGekozen = b.dataset.f; tekenKaart(); }));

  $('#k-detail').innerHTML = `
    <h3>${kGekozen}</h3>
    <p>${FASE_TOELICHTING[kGekozen]}</p>
    <div class="pijlen">
      ${doelen.length
        ? doelen.map((d) => `<span class="pijl">→ ${d}</span>`).join('')
        : '<span class="geen-pijl">geen uitgang — eindfase</span>'}
    </div>
    <p style="font-size:.82rem;color:var(--tekst-vaag)">${doelen.length
      ? `Van deze fase zijn ${doelen.length} van de 11 fasen bereikbaar. Elke andere overgang geeft: &ldquo;${W.overgang(kGekozen, doelen)}&rdquo;`
      : `Elke overgang uit deze fase geeft: &ldquo;Fase '${kGekozen}' is een eindfase; er volgt geen fase meer op.&rdquo;`}</p>`;
}
tekenKaart();

/* ================================================================== 6. GRENZEN */

const BEVINDINGEN = [
  {
    zwaar: 'hoog', titel: 'De brug van beslissing naar licentie is niet gelegd',
    tekst: 'De functie <code>licenties.naBekrachtiging()</code> bestaat en doet alles wat ze moet doen: status zetten, geldig_van en geldig_tot vullen, de volgende bekrachtiging op 24 maanden zetten, de tussentijdse toets op 12 maanden, de voorwaardetekst opslaan en twee agendaposten plaatsen. Ze wordt <strong>nergens aangeroepen</strong>. Een zoekopdracht over de hele server- en cliëntmap geeft één treffer buiten de definitie: een commentaar in <code>routes-register.ts</code> dat beweert dat het "vanuit de beslisweg" gebeurt. De beslissingsroute legt de beslissing vast en antwoordt — verder niets. Gevolg: na een bekrachtiging blijft de licentie op <code>overgangsperiode</code>, blijft <code>geldig_tot</code> leeg, en komen de twee agendaposten er nooit.',
    plek: 'storage.ts:953-996 · routes-beslissingen.ts:148-213 · onjuist commentaar in routes-register.ts:19',
  },
  {
    zwaar: 'hoog', titel: 'Een herbeslissing na gegrond bezwaar loopt vast',
    tekst: 'De fasentabel laat <code>bezwaar → in_beoordeling</code> toe, precies omdat een gegrond bezwaar tot een nieuwe beoordeling moet kunnen leiden. Maar de tabel met beslissingen heeft <code>UNIQUE(ronde_id)</code>, en de opslaglaag controleert dat nog een tweede keer: "Ronde R-2026-0007 heeft al een beslissing." De weg terug staat dus open en eindigt tegen een muur. Wie een gegrond bezwaar wil afhandelen, kan de uitkomst nu niet wijzigen.',
    plek: 'rondeloop.ts:55 · storage.ts:3050-3099',
  },
  {
    zwaar: 'midden', titel: 'Alle veertien tabellen staan op nul rijen',
    tekst: 'De schermen zijn nooit met echte gegevens bekeken. Wat u in deze simulatie ziet, is de bedoelde werking volgens de regels in de code — niet een schermafdruk van een gevuld systeem. Een leeg scherm en een correct scherm zien er in een test hetzelfde uit.',
    plek: 'veertien tabellen met prefix bekwaamheid_',
  },
  {
    zwaar: 'midden', titel: 'Drie procesnormen worden gemeten, drie niet',
    tekst: 'De regiekamer meet drie termijnen: debrief binnen 10 werkdagen na het laatste onderdeel, schriftelijke beslissing binnen 3 werkdagen na de debrief, bezwaar behandeld binnen 30 dagen. Drie andere normen uit het draaiboek staan er bewust <em>niet</em>: deelname minstens 90 procent, kader vooraf gelezen door minstens 85 procent, hoogstens 3 assessments per duo per dag. Die drie zijn niet uit de gegevens te halen. Een nul tonen waar geen meting bestaat, leest als "gehaald", en dat is de gevaarlijkste soort leeg vakje. Er staan acht van die posten expliciet op de lijst NIET_GEMETEN.',
    plek: 'regiekamer.ts:722-758 (meetProcesKpis) · regiekamer.ts:819 (NIET_GEMETEN)',
  },
  {
    zwaar: 'midden', titel: 'Het keuren van een itemset laat geen spoor na',
    tekst: '<code>itemsets.keurNa()</code> schrijft de uitslag weg zonder auditregel. Bij elke andere handeling in de module is terug te vinden wie wat wanneer deed; hier niet. En <code>plannen.stelOp()</code> toetst niet of er signalen waren: een coachingsplan kan worden opgesteld op een toets die geen alert gaf.',
    plek: 'storage.ts — itemsets.keurNa, plannen.stelOp',
  },
  {
    zwaar: 'laag', titel: 'Twee onjuiste beschrijvingen in scripts',
    tekst: 'De docstring van <code>script/migreer-bekwaamheid.mjs</code> beweert dat het script accreditaties vult; dat doet het niet. En <code>script/add_marc_showcase.ts</code> heeft een hardgecodeerde token in de broncode staan. Geen van beide raakt de werking van de module, maar wie de docstring vertrouwt, gaat op zoek naar accreditaties die er niet zijn.',
    plek: 'script/migreer-bekwaamheid.mjs · script/add_marc_showcase.ts',
  },
  {
    zwaar: 'laag', titel: 'De cesuur van de oefenmodule is niet onderbouwd',
    tekst: 'De grenzen 0,85 / 0,70 / 0,55 in de oefenmodule zijn niet gedocumenteerd met een argument. De ondergrens 55 die de tussentijdse toets gebruikt, is daarvan overgenomen — bewust, omdat twee losse getallen uit elkaar gaan lopen, maar het onderliggende getal blijft ongefundeerd. Verder: negen van de negenentwintig meetscripts bevatten absolute paden en werken alleen op de machine waarop ze zijn geschreven.',
    plek: 'bepaalInschaling in routes-stm.ts:452 · OEFENGEMIDDELDE_ONDERGRENS in cyclus.ts',
  },
];

$('#bevindingenlijst').innerHTML = BEVINDINGEN.map((b) => `
  <article class="bev">
    <div class="bkop">
      <span class="zwaar ${b.zwaar}">${b.zwaar === 'hoog' ? 'blokkerend' : b.zwaar === 'midden' ? 'aandacht' : 'aantekening'}</span>
      <h3>${b.titel}</h3>
    </div>
    <p>${b.tekst}</p>
    <p class="plek">${b.plek}</p>
  </article>`).join('');

/* ================================================================== 7. NASLAG */

const CIJFERS = [
  { w: '24', n: 'maanden tussen twee bekrachtigingen', b: 'CYCLUS_MAANDEN · cyclus.ts' },
  { w: '12', n: 'maanden tot de tussentijdse toets', b: 'TUSSENTIJDSE_TOETS_MAANDEN' },
  { w: '6', n: 'afnames minimaal per 24 maanden', b: 'ACTIVITEITSDREMPEL' },
  { w: '3', n: 'afnames minimaal per 12 maanden', b: 'berekend: ceil(6 × 12 / 24)' },
  { w: '4', n: 'afnames minimaal voordat een signaal betekenis heeft', b: 'MINIMUM_AFNAMES_VOOR_SIGNAAL' },
  { w: '55', n: 'ondergrens oefengemiddelde, schaal 0–100', b: 'OEFENGEMIDDELDE_ONDERGRENS' },
  { w: '0,65', n: 'bovengrens aandachtszone, rand telt mee', b: 'AANDACHTSZONE_BOVENGRENS' },
  { w: '0,60', n: 'ondergrens voorwaardelijk', b: 'VOORWAARDELIJK_ONDERGRENS' },
  { w: '6', n: 'maanden tot evaluatie coachingsplan', b: 'COACHINGSPLAN_EVALUATIE_MAANDEN' },
  { w: '10', n: 'werkdagen voor de debrief', b: 'KPI · regiekamer.ts' },
  { w: '3', n: 'werkdagen voor de schriftelijke beslissing', b: 'KPI · regiekamer.ts' },
  { w: '30', n: 'kalenderdagen voor een bezwaar', b: 'KPI · met dagenTussen()' },
  { w: '40', n: 'tekens minimaal voor een score-onderbouwing', b: 'opslaglaag + DB-CHECK' },
  { w: '40', n: 'tekens minimaal voor een afwijkingsmotivering', b: 'opslaglaag + DB-CHECK' },
  { w: '20', n: 'tekens minimaal voor een bezwaargrond', b: 'storage.ts:3258' },
  { w: '200', n: 'tekens minimaal voor een normprofielonderbouwing', b: 'ONDERBOUWING_MINIMUM' },
  { w: '0–3', n: 'rubriekscore, geheel getal', b: 'opslaglaag + DB-CHECK' },
  { w: '1–5', n: 'nummer van een bewijsstuk', b: 'storage.ts:2786' },
  { w: '0,75', n: 'norm voor de intraclass-correlatie', b: 'ICC_NORM · statistiek.ts' },
  { w: '20', n: 'afnames minimaal voor een itemanalyse', b: 'AFNAMEMINIMUM · itemanalyse.ts' },
];

$('#n-cijfers').innerHTML = CIJFERS.map((c) => `
  <div class="cijfer">
    <span class="waarde">${c.w}</span>
    <span class="naam">${c.n}</span>
    <span class="bron">${c.b}</span>
  </div>`).join('');

const WEIGERINGEN = [
  ['Een beslissing wordt door twee verschillende mensen bekrachtigd.', 'storage.ts:3098'],
  ["De beslissing wijkt af van het voorstel (\u2018x\u2019 werd \u2018y\u2019). Dat vraagt een motivering van minstens veertig tekens.", 'storage.ts:3103 + DB-CHECK'],
  ['Een score vraagt een onderbouwing van minstens veertig tekens.', 'storage.ts:2933 en 2997 + DB-CHECK'],
  ['Een score wordt alleen herzien door de beoordelaar die haar invoerde.', 'storage.ts:2983'],
  ['Een rubriekscore is een geheel getal van 0 tot en met 3.', 'storage.ts:2929 en 2993'],
  ['Publiceren kan pas nadat het debriefgesprek is vastgelegd.', 'storage.ts:3178'],
  ["Ronde <code> staat in fase 'x'; een beslissing hoort na het voorstel of na overleg.", 'storage.ts:3090'],
  ['Ronde <code> heeft al een beslissing.', 'storage.ts:3095'],
  ['Ronde <code> is afgesloten; er verandert niets meer aan.', 'storage.ts:2728'],
  ['Ronde <code> heeft nog geen beslissing; er is niets om bezwaar tegen te maken.', 'storage.ts:3252'],
  ['Een bezwaar vraagt een grond van minstens twintig tekens.', 'storage.ts:3258'],
];

$('#n-weigeringen').innerHTML = WEIGERINGEN.map(([t, b]) => `
  <li><span class="wt">&ldquo;${t.replace(/</g, '&lt;')}&rdquo;</span><span class="wc">${b}</span></li>`).join('');

// laat een lang adres alleen na een schuine streep afbreken, nooit midden in een naam
const zachtBreek = (t) => t.replace(/\//g, '/\u200B');

const EINDPUNTEN = [
  ['Het register', 'routes-register.ts', [
    ['get', '/register'], ['get', '/register/:id'], ['post', '/register'], ['post', '/register/:id/inactief'],
    ['get', '/licenties/:persoonId'], ['post', '/licenties/overgangsperiode'], ['post', '/licenties/:id/alert'],
    ['get', '/accreditaties/:persoonId'], ['post', '/accreditaties'], ['post', '/accreditaties/:id/intrekken'],
  ]],
  ['Het normprofiel', 'routes-normprofiel.ts', [
    ['get', '/normprofiel-instrumenten'], ['get', '/normprofiel/:instrumentId'], ['post', '/normprofiel'],
    ['patch', '/normprofiel/:id'], ['post', '/normprofiel/:id/bevries'],
  ]],
  ['De itembank', 'routes-items.ts', [
    ['get', '/items/:instrumentId'], ['get', '/item/:id'], ['post', '/items'], ['patch', '/item/:id'],
    ['get', '/itemset/:rondeId/:nummer'], ['post', '/itemsets'], ['post', '/itemsets/:id/inleveren'], ['post', '/itemsets/:id/nakijken'],
  ]],
  ['De rondes', 'routes-rondes.ts', [
    ['get', '/rondes'], ['get', '/rondes/:id'], ['get', '/rondes-volgend-nummer'], ['post', '/rondes'],
    ['post', '/rondes/:id/fase'], ['post', '/rondes/:id/aanpassing'], ['post', '/rondes/:id/bewijsstukken'],
    ['post', '/bewijsstukken/:id/inleveren'], ['post', '/bewijsstukken/:id/nvt'],
    ['get', '/bewijsstukken/:id/scores'], ['post', '/bewijsstukken/:id/scores'],
    ['patch', '/scores/:id'], ['post', '/bewijsstukken/:id/afronden'],
  ]],
  ['De beslissingen', 'routes-beslissingen.ts', [
    ['get', '/rondes/:id/voorstel'], ['post', '/rondes/:id/beslissing'], ['post', '/rondes/:id/debrief'],
    ['post', '/rondes/:id/publiceren'], ['get', '/bezwaren'], ['post', '/rondes/:id/bezwaar'],
    ['post', '/bezwaren/:id/ontvangst'], ['post', '/bezwaren/:id/uitspraak'],
  ]],
  ['De cyclus', 'routes-cyclus.ts', [
    ['get', '/toetsen/:persoonId'], ['get', '/toets/:id'], ['post', '/toetsen'], ['post', '/toetsen/:id/vaststellen'],
    ['post', '/toetsen/:id/publiceren'], ['post', '/toetsen/:id/gesprek'], ['post', '/coachingsplannen'],
    ['post', '/coachingsplannen/:id/akkoord'], ['post', '/coachingsplannen/:id/afsluiten'],
    ['get', '/agenda'], ['post', '/agenda/:id/afhandelen'], ['get', '/vervallende-toetsen'],
  ]],
  ['De regiekamer', 'routes-regiekamer.ts', [
    ['get', '/regiekamer'], ['post', '/regiekamer/poortsimulatie'],
  ]],
  ['Het licentiebeeld', 'routes-licentiebeeld.ts', [
    ['get', '/licentiebeeld'], ['get', '/api/coach/licentiebeeld — het enige eindpunt zonder vereisAdmin: hier leest een practitioner zijn eigen beeld'],
  ]],
];

$('#n-eindpunten').innerHTML = EINDPUNTEN.map(([naam, bestand, lijst]) => `
  <div class="epgroep">
    <h4>${naam} <span class="klein-inline">${lijst.length}</span></h4>
    <span class="epbestand">${bestand}</span>
    <ul class="eplijst">
      ${lijst.map(([v, p]) => `<li><span class="verb ${v}">${v}</span><span class="eppad">${zachtBreek(p.startsWith('/api') ? p : '/api/bekwaamheid' + p)}</span></li>`).join('')}
    </ul>
  </div>`).join('') + `
  <div class="epgroep">
    <h4>Samen <span class="klein-inline">60 adressen</span></h4>
    <p style="font-size:.85rem;color:var(--tekst-zacht);margin:.4rem 0 0">Negenenvijftig ervan zitten achter <code>vereisAdmin</code>. De zestigste is <code>/api/coach/licentiebeeld</code>, waar een practitioner zijn eigen licentiebeeld leest en niets anders.</p>
  </div>`;
