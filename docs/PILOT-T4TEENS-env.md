# T4Teens-pilot — deploy & env (branch `pilot-t4teens`)

Nieuw bestand (Werkprotocol Regel 2 — strikt additief, wijzigt geen bestaand pad).
Documentatie voor het draaien van de T4Teens-only schoolpilot als **aparte**
Render-service, zonder de live-service of `.env.production` aan te raken (Regel 1).

## De twee schakelaars

| Variabele | Waarde (pilot) | Effect |
|---|---|---|
| `VITE_DEMO_MODE` | `false` | App draait "echt": leerlingen kunnen invoeren en versturen. |
| `VITE_SOLO_INSTRUMENT` | `t4teens` | PoortenIntro overgeslagen + alle andere ingangen/navigatie verborgen. |

Beide zijn **build-time** (Vite bakt ze in tijdens `npm run build`).

## ⚠️ Waarom géén `.env.pilot`-bestand

`npm run build` roept `vite build` aan **zonder** `--mode pilot`. Vite laadt dan
enkel `.env` en `.env.production`. Een los `.env.pilot` wordt **stil genegeerd** —
de pilot zou dan per ongeluk `VITE_DEMO_MODE=true` uit `.env.production` oppikken.

## ✅ Bewezen betrouwbare methode: Render build-environment

Getest met Vite `loadEnv("production", …)`: **`process.env` wint van
`.env.production`** voor `VITE_`-variabelen. Zet daarom op de aparte Render
pilot-service `t4teens-pilot` deze **build-environment variabelen**:

```
VITE_DEMO_MODE=false
VITE_SOLO_INSTRUMENT=t4teens
```

Geverifieerd netto resultaat met deze override:

```
VITE_DEMO_MODE       = "false"   → DEMO_MODE actief? false  (invoer werkt) ✓
VITE_SOLO_INSTRUMENT = "t4teens" → solo-modus actief                       ✓
```

De bestaande `.env.production` (`VITE_DEMO_MODE=true`) en de LIVE-service blijven
volledig ongewijzigd. De override geldt uitsluitend voor de pilot-service.

## Render-serviceconfig (samenvatting)

- **Repo/branch:** `MarcDebisschop/tapas-demo` → branch `pilot-t4teens`
- **Build:** `pip install -r requirements.txt && npm install --legacy-peer-deps && npm run build`
- **Start:** `node dist/index.cjs`
- **Node:** 20 · **Regio:** Frankfurt (zoals de bestaande `render.yaml`)
- **Env (build):** `VITE_DEMO_MODE=false`, `VITE_SOLO_INSTRUMENT=t4teens`, `NODE_ENV=production`
- **Persistente Disk:** koppelen (bv. mount `/var/data`) zodat de SQLite-database
  de 30 leerlingafnames overleeft bij cold-start/redeploy.

## Additieve code-ingrepen op deze branch

- `client/src/lib/soloMode.ts` — nieuw bestand: `SOLO_INSTRUMENT`, `SOLO_MODE`,
  `soloSkipIntro()`, `verbergBuitenSolo()`. Default-uit.
- `client/src/App.tsx` — één regel: `useState(() => isAdminRoute() || soloSkipIntro())`.
- `server/instrument-beschikbaarheid.ts` — één registry-regel: `tapas-t4teens`
  (open/dicht-knop voor prior-beheerder; default UIT).

Staat `VITE_SOLO_INSTRUMENT` leeg, dan is het gedrag identiek aan de live-service.

## Status van de twee eerder openstaande punten

- **Navigatie verbergen — AFGEROND & GEVERIFIEERD.** In `home.tsx` worden de
  zijpaden (werelden-tegels `PlatformOverzicht`, de Lounge-sectie en de
  T4Sports-demolink) alleen nog getoond wanneer `!verbergBuitenSolo()`. De
  componenten zelf zijn niet aangeraakt (comment "NIET AANRAKEN" gerespecteerd);
  enkel de render eromheen is conditioneel. Runtime-getest met Playwright op twee
  builds:
  - Solo (`VITE_SOLO_INSTRUMENT=t4teens`): werelden-tegels, Lounge-knop en
    T4Sports-link **afwezig**, intro overgeslagen, 0 JS-errors.
  - Baseline (leeg): alle zijpaden **aanwezig**, gedrag identiek aan live.
  De admin-toegang tot **Vraagbeheer** (`#/admin`) blijft in beide gevallen
  bereikbaar — vragen blijven dus aanpasbaar tot vlak voor de afname.

- **Harde open/dicht-poort — BEWUST NIET ingebouwd.** `tapas-t4teens` staat in de
  beschikbaarheids-registry (admin-knop werkt), maar de T4Teens-afnameroute
  handhaaft die vlag niet actief zoals driverscan dat doet. Keuze voor de pilot:
  dit raakt de afname-flow zélf en brengt regressierisico in de keten die we
  ongemoeid willen houden. Voor één school met ~30 leerlingen is een harde poort
  niet nodig — de links worden gericht uitgedeeld. Minder ingrijpen = veiliger.
  Wil je later toch een harde poort, dan bouwen we die additief in de T4Teens-flow,
  na jouw akkoord + eigen test.
