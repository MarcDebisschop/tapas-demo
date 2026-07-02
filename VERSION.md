# TaPasCity Platform — Versie-overzicht

## Huidige versie: v2.7.0 — Publiek coach-register: foto's B&W + Rembrandt-galerij + contactformulier

**Datum:** 2 juli 2026  
**pplx.app URL:** https://tapas-platform-2.pplx.app/

### Wat is nieuw in v2.7.0 (Strikte Werkregels toegepast)

**1. Foto's — algemene lijst zwart-wit, Galerij der Jesters Rembrandt**
- In de algemene coach-lijst (`/coaches`) tonen Marc Debisschop, Kris Debisschop, Prof. Leen Adams en Herman Van Esbroeck nu een **plain zwart-wit** portret.
- Nieuwe, aparte assets (Regel 2): `client/public/coaches-lijst/{marc,kris,leen,herman}-bw.jpg` (bronfoto's van tapascity.com/nl/tapas-crew, grayscale-geforceerd).
- Client-side `FOTO_BW_OVERRIDE`-map in `coaches.tsx` mapt de Rembrandt-bronpaden naar de B&W-assets — **serverdata onaangeroerd** (Regel 1).
- De **Rembrandt-portretten blijven uitsluitend** in de Galerij der Jesters (`/academy/jester`).
- **Herman:** de nieuwe (bijgeleverde) foto vervangt de oude in de algemene lijst (B&W) én is omgezet naar een Rembrandt-portret voor de galerij (`jester-galerij/assets/img/portret-herman.png`).

**2. Publiek contactformulier per coach**
- Elke coach-kaart heeft een knop "Contact opnemen" met een dialoogvenster (naam, e-mail, bericht).
- Nieuwe, aparte server-route (Regel 2): `server/routes-coach-contact.ts` — `POST /api/coaches/:id/contact`, `GET /api/coaches/:id/contact-adres`, `GET /api/admin/coach-contactaanvragen` (admin-gated). Nieuwe tabel `coach_contactaanvragen`.
- **Doeladres wordt server-side bepaald** uit `coach_register.email`; is dat leeg, dan valt het terug op `info@tapascity.com`.
- Het e-mailadres is **beheerbaar via de bestaande admin** (coach-bewerkscherm → `PUT /api/admin/coaches/:id`); na opslaan staat het automatisch juist, zowel op de publieke pagina als in het contactformulier (beide lezen dezelfde bron).
- Beveiliging: lengtegrenzen (naam ≤200, e-mail ≤254, bericht ≤5000) + lichtgewicht in-memory rate limiter (5 aanvragen / 15 min / IP). Het ruwe e-mailadres wordt niet meer in de UI getoond (minder spam-oogst).

**Checksums (Regel 5):** coaches.tsx `79b4efd2235815f7f80c674fd89ad16f` · routes-coach-contact.ts `f7192b6a043d231f0e14e58e2ae685fc` · routes.ts `544d8303247a1a2ad4f99d225c61e246` · herman-bw.jpg `7c0ffa718e8b2d5837be94f51af551cd` · kris-bw.jpg `ed943290e01c5201d56e21b545cf189f` · leen-bw.jpg `920c34a74aa9f34645adf6157bd73003` · marc-bw.jpg `28cabf788f6747029009c757b0a984d6` · gallery portret-herman.png `371c5c2a0321a369d4c880456d892825`. Do-not-touch bronbestanden ongewijzigd (byte-identiek geverifieerd).

### Wat is gefixt in v2.6.0

**1. Vlaamse stem (profieluitleg) — definitieve fix**
- **Oorzaak van het steeds terugkeren:** `/api/tts` levert de echte Vlaamse Sulafat-stem (via Gemini) en heeft `GEMINI_API_KEY` nodig — enkel op Render aanwezig. In de pplx.app-demo is die API geblokkeerd, waardoor `/api/tts` faalde. De **oude code viel dan stil terug op de browser Web Speech API**, die geen nl-BE-stem heeft en dus de Hollandse nl-NL-stem afspeelde. Die terugval was telkens de boosdoener.
- **Fix:** de Web Speech API-terugval is **volledig verwijderd** uit `UitlegPaneel.tsx` (0 `speechSynthesis`-referenties in de live bundle). Op Render speelt nu altijd de echte Vlaamse Sulafat; op de demo verschijnt een nette melding i.p.v. de verkeerde stem. De verkeerde stem kan dus niet meer terugkomen.

**2. Gepersonaliseerde bibliotheek + podcast (deelnemersdashboard) — hersteld & robuust**
- Nieuwe server-side feature (aparte bestanden, Strikte Werkregel 2): `server/bibliotheek-deelnemer.ts` (10 boeken + 9/10 podcasts) + twee routes in `server/routes-deelnemer.ts` + UI-component `BibliotheekPaneel.tsx` in het dashboard.
- **Adaptief:** boeken/podcasts worden gesorteerd op het driver-/focusprofiel uit het meest recente generatorContract, dus ze passen zich aan de evolutie van de deelnemer aan.
- **18+-gating hersteld (bugfix):** de doelgroep wordt nu betrouwbaar afgeleid uit het `instrumentId`-veld BINNENIN het contract-JSON (bv. `t4p-teens-kompas` / `t4p-business-kompas`), niet uit de lege DB-kolom `afnames.instrument_id` (die is NULL voor alle demo-deelnemers). Professionals én studenten (18+) krijgen de bibliotheek; teens (< 18) worden afgeschermd.

### Strikte werkregels — nageleefd
- Niets herbouwd wat al bestond; nieuwe features in aparte bestanden.
- Do-not-touch bronbestanden byte-identiek gebleven (checksums geverifieerd).
- Historische ZIP-8 referentiebundle (`index-CxFhBwUz.js`) onaangeroerd bewaard.

---

## Vorige versie: v2.4.0 — Demo Compleet

**Naam:** TaPasCity Platform Demo  
**Package:** `tapascity-platform-demo`  
**Versie:** `2.4.0`  
**Datum:** 25 juni 2026  
**Git commit:** 298c09c  
**pplx.app URL:** https://tapas-fase1-preview.pplx.app/

---

## Wat zit er in v2.4.0

### Demo-data (volledig geseed)
- ✅ **Admin beheer** — 3 organisaties, 6 afnames, credits, 9 transacties, 4 facturen, 2 licenties
- ✅ **T4P Business Kompas** — Marc Debisschop showcase profiel (token: MarcDebisschopShowcaseT4P01)
- ✅ **T4Recruitment** — 3 sessies (Vantage, Innovatech, Academie)
- ✅ **TaPas Teamscan** — 2 sessies (Innovatech leadership team, Academie communicatie)
- ✅ **Impact-roos** — statisch PNG + PDF voorbeeld
- ✅ **2MINSCAN** — voorbeeldrapport knop (Nathalie Wouters, EG-code RgEEO-a)
- ✅ **Human Due Diligence** — volledig afgerond M&A-traject (Loop Earplugs, 5 boardleden, Gate=Go)
- ✅ **T4Teens / T4Students** — informatieve pagina's
- ✅ **Vraagbeheer** — statische itembank

### Admin login (DEMO_MODE)
- Email: marc@tapascity.com
- Wachtwoord: Tintinenco01

### Instrumenten op homepage
Mijn profiel · Kompas · T4Recruitment · Teamscan · Impact-roos · 2MINSCAN · Human Due Diligence · TaPas Lounge

---

## Versiehistorie

| Versie | Datum | Beschrijving |
|--------|-------|--------------|
| v2.4.0 | 25/06/2026 | HDD seed + 2MINSCAN demo-knop + instrumentenkaarten homepage |
| v2.3.0 | 25/06/2026 | T4Recruitment + Teamscan demo-sessies |
| v2.2.0 | 25/06/2026 | Uitgebreide demo-data: transacties, facturen, licenties |
| v2.1.0 | 25/06/2026 | seedDemoData: 3 org + 6 afnames + credits |
| v2.0.0 | 25/06/2026 | Admin login fix (readOnly DEMO_MODE) |
