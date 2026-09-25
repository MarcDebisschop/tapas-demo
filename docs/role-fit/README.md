# Recruitment & Role Fit met H-BOM Evidence Check

## Waar staat wat

| Pad | Inhoud |
| --- | --- |
| `shared/role-fit.ts` | Statussen, labels, taalregels, Zod-invoer |
| `server/role-fit/` | DDL, schema, opslag, engines, service, routes, rapporten |
| `migrations/0012_role_fit.sql` | Strikt additieve migratie, veertien tabellen `role_fit_*` |
| `client/src/pages/role-fit/` | Beheerschermen en de publieke observatorpagina |
| `tests/role-fit-*.test.ts` | Flow, engines, migratie, golden cases, scenario |

## Opzetten

1. `npm install` en `npm run build` zoals voor de rest van het platform. De
   tabellen worden bij het opstarten aangemaakt (inline DDL) en de
   migratieloper herkent 0012 als toegepast.
2. Menu: Beheer, Recruitment & Role Fit (`/admin/role-fit`).
3. Optioneel een AI-provider voor de contextextractie via omgevingsvariabelen:
   `ROLE_FIT_AI_URL` (OpenAI-compatibel chat-eindpunt), `ROLE_FIT_AI_KEY` en
   `ROLE_FIT_AI_MODEL`. Zonder deze variabelen werkt de extractie
   regelgebaseerd.
4. PDF-rapporten gebruiken Playwright Chromium. Ontbreekt de browser, dan is er
   alleen HTML. `ROLE_FIT_GEEN_PDF=1` zet PDF bewust uit.

## Flow

Case, wizard en bronnen, claimreview, vereisten, bevestiging en bevriezing,
Fit Dossier, H-BOM-pakket en goedkeuring, observatie door recruiter en
hiring manager, integratie en convergentie, besluit, rapporten, archief.

## Beperkingen

- De kalibratie van observatoren wordt per browser bewaard (localStorage),
  niet op de server.
- Het taalfilter op medische en klinische termen kan bij zorgrollen een
  vals positief geven; de beheerder moet dan herformuleren.
- De opruimroute voor verlopen cases wordt nog niet automatisch gepland.
- De scoreankers zijn voorlopig en moeten in de pilot bijgesteld worden.

## Validatie-backlog

- Golden cases: vier geimplementeerd in `tests/role-fit-golden.test.ts`
  (ondersteund, gemengd, tegenindicatie, onvoldoende bewijs). Doel voor de
  pilot: tien, met echte maar geanonimiseerde cases.
- Interbeoordelaarsbetrouwbaarheid tussen recruiter en hiring manager meten.
- Criterium-onderzoek: het machineleesbare rapportcontract naast elke PDF
  maakt latere koppeling met prestaties mogelijk.

## Pilot

Minstens twee observatoren per case, ankers bijstellen op basis van
bewijsverschillen, en de dossiers inhoudelijk laten beoordelen door een
recruiter, een psychometricus en een hiring manager. Live commercieel gebruik
pas na DPIA, externe methodiekreview en claims policy
(`docs/role-fit-dpia-checklist.md`, `docs/role-fit-intended-use.md`).
