# server/shared/ — Gedeelde server-side helpers

Deze directory bevat documentatie over de gedeelde helper-functies die door
meerdere route-bestanden worden gebruikt. De functies zelf staan in hun
respectievelijke bestanden; dit README documenteert de intentie en de locaties.

## Filosofie

> Geen code dupliceren. Centrale logica leeft op één plek en wordt geïmporteerd.

## Gedeelde helpers — overzicht

### `bouwDashboardData(deelnemerId)` → `server/dashboard.ts`
Assembleert de volledige dashboard-payload voor een deelnemer:
- Haalt profiel, afnames, scores, coach-info op uit SQLite
- Combineert T4P, T4Students, T4Teens, T4Recruitment resultaten
- Wordt gebruikt door `/api/dashboard/:deelnemerId` (routes.ts)

### `buildGeneratorContract(afname, profiel)` → `server/scoring.ts`
Bouwt het JSON-contract dat naar de AI-generator gestuurd wordt:
- Contractversie, instrumentId, deelnemer-info, consent-scope, secties
- Wordt gebruikt door generatie-routes in routes.ts en routes-deelnemer.ts
- Zie ook: `generatorContractSchema` in `shared/schema.ts` (valideert output)

### `parseProfiel(profielJson)` → `server/scoring.ts`
Parseert en valideert het opgeslagen JSON-profiel:
- Veilige fallback bij corrupte data
- Wordt intern gebruikt door scoring en rapport-generatie

### `stmSessieOpslagen` → `server/stm-storage.ts`
SQLite-gebaseerde opslag voor STM-sessies (vervangt in-memory Maps):
- `maakAan`, `vindOp`, `update`, `afronden`, `historiek`, `alleVanBeheerder`
- Wordt gebruikt door alle routes in `server/routes-stm.ts`

## Richtlijnen voor nieuwe helpers

1. **Nooit dupliceren** — als dezelfde logica in 2 route-bestanden nodig is, extraheer naar een eigen bestand
2. **Exports benoemen** — altijd named exports, geen default exports
3. **Types delen** — gedeelde TypeScript-interfaces horen in `shared/schema.ts` of `shared/types.ts`
4. **Documenteer hier** — voeg elke nieuwe helper toe aan dit README

## Toekomstige uitbreidingen (zie bouwplan Fase 3+)

- `server/shared/auth.ts` — centrale auth-middleware helpers
- `server/shared/email.ts` — e-mailsjablonen en verzend-helpers
- `server/shared/audit.ts` — audit-logging utilities
