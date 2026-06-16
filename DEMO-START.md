# TaPas Platform — Demo lokaal draaien

Deze map bevat een volledig werkende demoversie van het TaPas Platform, gevuld met geloofwaardige (fictieve) data, alsof het al dagelijks in gebruik is. Je draait dit lokaal op een Windows- of Mac-computer en klikt vrij rond door alle onderdelen.

## Wat zit erin
- De volledige applicatie (frontend + backend).
- Een vooraf gevulde database (`data.db`): 8 organisaties, 78 afnames, 13 facturen + 1 creditnota, coaches, deelnemers, T4Recruitment-rolprofielen, 4 Teamscan-sessies en 2 HDD-bestuurstrajecten.
- Een reeds gemaakte build (map `dist`).

## Benodigdheden (eenmalig)
1. Installeer **Node.js 20 of hoger** via https://nodejs.org (kies de "LTS"-versie). Volg de installer; standaardopties volstaan.
2. Open een terminal:
   - **Windows:** druk op de Windows-toets, typ `cmd`, open "Opdrachtprompt".
   - **Mac:** open "Terminal" (via Spotlight: Cmd+spatie, typ "Terminal").

## Starten — stap voor stap
1. Pak deze map uit op een plek zonder spaties in het pad, bijvoorbeeld `C:\tapas-demo` (Windows) of `~/tapas-demo` (Mac).
2. Ga in de terminal naar die map:
   - Windows: `cd C:\tapas-demo`
   - Mac: `cd ~/tapas-demo`
3. Installeer de afhankelijkheden (eenmalig, duurt 1–2 minuten):
   ```
   npm install
   ```
4. Start de demo:
   - **Windows (Opdrachtprompt):**
     ```
     set TAPAS_DEMO=1 && set NODE_ENV=production && set PORT=5055 && node dist/index.cjs
     ```
   - **Windows (PowerShell):**
     ```
     $env:TAPAS_DEMO=1; $env:NODE_ENV="production"; $env:PORT=5055; node dist/index.cjs
     ```
   - **Mac / Linux:**
     ```
     TAPAS_DEMO=1 NODE_ENV=production PORT=5055 node dist/index.cjs
     ```
5. Open je browser (Chrome aanbevolen) en ga naar:
   ```
   http://localhost:5055/#/admin
   ```

## Belangrijkste schermen (kopieer in de adresbalk)
- Beheer / organisaties: `http://localhost:5055/#/admin`
- Credits, grootboek, facturen, bestuur (KPI's): `http://localhost:5055/#/admin/credits`
- T4Recruitment: `http://localhost:5055/#/t4r`
- Teamscan: `http://localhost:5055/#/teamscan`
- HDD (bestuurstrajecten): `http://localhost:5055/#/hdd`
- Voorbeeld-deelnemersdashboard (Hanne Peeters, Frans, met chat):
  `http://localhost:5055/#/dashboard/cfjb7LUVS4gEc7h6edzI8in6nzWS67`

## Stoppen
Druk in de terminal op `Ctrl + C`.

## Opmerkingen
- De AI-chat in de demo werkt in "demo-modus": ze geeft een nette voorgeprogrammeerde reactie (er is geen externe AI-verbinding nodig).
- Alle data is fictief maar realistisch. Niets verwijst naar echte personen.
- Wil je opnieuw beginnen met een lege database? Vervang `data.db` door `data.db.preseed.bak` (hernoem die naar `data.db`).

Volg het bijgevoegde rondleidingsdocument ("TaPas Platform Demo Rondleiding") voor een uitgewerkte route langs alle spraakmakende elementen per onderdeel.
