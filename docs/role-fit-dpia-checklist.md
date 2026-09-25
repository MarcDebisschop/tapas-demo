# Recruitment & Role Fit: DPIA-checklist

Werkdocument voor de gegevensbeschermingseffectbeoordeling. Het vinkje staat
op "gebouwd" wanneer de maatregel in de code zit; "open" betekent dat de
organisatie of de verwerkingsverantwoordelijke nog iets moet doen voor live
gebruik.

## Noodzaak en proportionaliteit

| Punt | Status | Toelichting |
| --- | --- | --- |
| Doel per case vastgelegd (selectie, interne mobiliteit, ontwikkeling) | gebouwd | Veld beslisdoel, verplicht bij aanmaken |
| Rechtsgrond per verwerking bepaald | open | Door de verwerkingsverantwoordelijke vast te leggen |
| Informatie aan de kandidaat vooraf | open | Tekst voor de kandidaat op te stellen in de pilot |
| Alleen gegevens die de rol nodig heeft | gebouwd | Vereisten moeten uit bevestigde context komen; verboden categorieen worden geweigerd |

## Risico's en maatregelen

| Risico | Maatregel | Status |
| --- | --- | --- |
| Geautomatiseerde beslissing (AVG art. 22) | Geen totaalscore, geen rangschikking; besluit alleen door een benoemde ondertekenaar met motivering | gebouwd |
| Gevoelige of discriminerende criteria | Taalfilter op vereisten, claims en besluiten (leeftijd, gezondheid, afkomst, gezinssituatie en vergelijkbare) | gebouwd, met risico op vals positief bij zorgrollen |
| Bevestigingsbias bij observatoren | Semi-blinde observatie, kalibratie, embargo op convergentie tot beide indieningen binnen zijn | gebouwd; kalibratie wordt per browser bewaard |
| AI-uitvoer als feit behandeld | AI-claims zijn voorstellen, elk moet een mens goedkeuren; passage-controle, taalcontrole en logging in role_fit_ai_runs | gebouwd |
| Prompt injection via bronnen | Claims zonder letterlijke passage worden verworpen; goedgekeurde tekst passeert de taalcontrole | gebouwd |
| Toegang buiten de eigen organisatie | Tenancy per organisatie, prior ziet alles, owner enkel de eigen organisatie | gebouwd |
| Observatorlink gedeeld | Tokenlink met vervaldatum, nieuwe link maakt de oude ongeldig, indiening vergrendelt | gebouwd |
| Te lange bewaring | Bewaartermijn per case, opruimroute voor verlopen cases, verwijderen en archiveren | gebouwd; automatische planning nog open |
| Wijzigingen zonder spoor | Audit-events per stap, correcties met reden en versie | gebouwd |

## Rechten van de betrokkene

| Recht | Status |
| --- | --- |
| Inzage | Dossier en feedbackrapport exporteerbaar als HTML en PDF |
| Rectificatie | Correcties op observaties met reden, context via nieuwe case |
| Wissen | Verwijderen per case; opruimen na bewaartermijn |
| Menselijke tussenkomst | Besluit alleen door een mens met motivering |

## Voor live gebruik nog te doen

- DPIA afronden en laten valideren door de functionaris gegevensbescherming.
- Externe methodiekreview (recruiter, psychometricus, hiring manager).
- Schriftelijke claims policy op basis van `docs/role-fit-intended-use.md`.
- Beoordeling onder de AI-verordening als hoog-risicotoepassing (werkgelegenheid):
  risicobeheer, datagovernance, logging, technische documentatie, informatie
  aan gebruikers en menselijk toezicht.
- Verwerkersovereenkomst met een eventuele AI-provider (ROLE_FIT_AI_URL).
