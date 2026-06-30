# server/routes/

Domeinrouters — opsplitsing van `server/routes.ts` (item 1.1, Fase 5).

## Domeinindeling

| Bestand | Domein | URL-prefix | Regels in routes.ts |
|---|---|---|---|
| `instrumenten.ts` | Instrument-registry | /api/instrument(s) | ~129-162 |
| `afnames.ts` | Afnames, uitnodigingen, scoring | /api/afnames, /api/uitnodigingen | ~163-453 |
| `admin.ts` | Admin login/sessie, afname-inzicht | /api/admin | ~455-549 |
| `financieel.ts` | Credits, billers, organisaties, betalingen, facturen, creditnota's, bestuur, GDPR | /api/credits, /api/billers, /api/organisaties, etc. | ~550-1090 |
| `rapporten.ts` | Rapport-generatie en -download | /api/rapporten | ~839-938 |
| `dashboard.ts` | Persoonlijk dashboard, chat, uitleg, TTS | /api/dashboard, /api/deelnemers, /api/tts | ~1090-1572 |
| `t4r.ts` | T4Recruitment: licenties, sessies, kringleden, studies, rolprofiel-reader | /api/licenties, /api/sessies, /api/r | ~1572-1812 |
| `interesse.ts` | Interesse-aanmeldingen | /api/interesse | ~1812-1880 |

## Architectuur

Elke domeinrouter exporteert een `register*Routes(app: Express)` functie.
`routes.ts` is een dunne orchestrator die alle functies aanroept na de
bestaande externe sub-routers (T4R, Teamscan, HDD, STM, Toegang).

**Publieke interface ongewijzigd** — alle URL-patronen en response-formaten blijven
identiek. De opsplitsing is puur intern.

## Werkregels

- Nooit `routes.ts` verwijderen — de hoofdfunctie `registerRoutes` blijft daar
- Elke domeinrouter importeert `storage` van `../storage` (niet de repositories)
- Bij twijfel: extraheer exact, interpreteer nooit
