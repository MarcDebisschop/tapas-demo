# Temperamentenwiel — module

Losstaande module voor het Temperamentenwiel: de speelmat met 24 posities, de
plaatsing van deelnemers op het wiel en de geautomatiseerde teamdynamiek-analyse.

## Status

Stap 1 van vier. Deze module **is nog niet aangesloten**. Er is geen enkele
bestaande pagina, route of component gewijzigd. Wie deze map verwijdert, verandert
niets aan het gedrag van het platform.

De vervolgstappen liggen ter goedkeuring voor:

1. **Deze stap** — module aanwezig, getypeerd, niet aangesloten.
2. Wiel en wielpositie in het individuele 2MINSCAN-rapport
   (`client/src/pages/twominscan-rapport.tsx`, bij de Insights Discovery-kaart).
3. Teamwiel met initialen plus een aparte deelnemerspagina in de teamscan-sessie.
4. Blok teamdynamiek op basis van `analyseerTeam`.

## Bestanden

| Bestand                 | Inhoud                                                                    |
| ----------------------- | ------------------------------------------------------------------------- |
| `posities.ts`           | De 24 posities met kleurvolgorde, radii, sectoren 1-8, energietaal per kleur |
| `wiel.ts`               | `bouwWiel(svg, opties)` — tekent het wiel; `tekenDeelnemers`               |
| `dynamiek.ts`           | `analyseerTeam(deelnemers)`, `sectorVanPositie`, `sectorLabel`             |
| `Temperamentenwiel.tsx` | Dun React-omhulsel rond `bouwWiel`                                        |
| `index.ts`              | Publieke ingang                                                           |

## Bronwaarheid

- **Kleurvolgorde per positie**: gemeten op de Speelmat Temperamenten version 1.0
  (2022). Elke positie heeft haar eigen volgorde van vier kleuren in vier radiale
  banden: 1e, 2e, 3e en de kostkleur in de kern. Er zijn geen vlakke
  kwadrantkleuren en geen gradiënten. Deze volgorde mag niet worden gewijzigd.
- **Wielposities, MBTI-equivalent, EG-codes**: `client/src/twominscan/profielen.ts`
  ("VERSION JANUARY 2022").
- **Sectoren 1-8**: Combinatie Temperamenten en Leiderschapstijlen (TaPasCity).
- **Meng-posities** (de acht `T/R`- en `R/T`-posities) staan op de mat met twee in
  elkaar grijpende driehoeken op de grens tussen kleur 1 en kleur 2, en liggen
  exact op een sectorgrens. `sectorLabel` geeft daarom een overgang terug, bv.
  `4-5 · overgang`.

## Twee vastgestelde verschillen tussen mat en profielen.ts

Gemeld, niet aangepast. Het aanpassen van `profielen.ts` valt buiten deze stap en
raakt de matching van de 2MINSCAN.

| Wielpositie | `profielen.ts` (`egCodeRaw`) | Speelmat  |
| ----------- | ---------------------------- | --------- |
| 128-148     | `T/RbXN-g`                   | `R/Tg O-b` |
| 35-55       | `TaXN-b`                     | `Ta N-g`  |

## Deelnemers op het wiel

`WielDeelnemer` is `{ naam, initialen, wielpositie, zone? }`. De radiale plaatsing
van een marker heeft **geen** kleurbetekenis: markers liggen in een eigen
markerzone tussen de banden.

- `zone: "classic"` — buitenste helft
- `zone: "accommodating"` — binnenste helft
- `zone` weggelaten of `null` — capsule over beide helften, omdat de 2MINSCAN die
  nuance niet meet

## Taalregels

De teksten in `dynamiek.ts` blijven binnen het 2MINSCAN-kader: energietaal, geen
uitspraken over talent, potentieel, competenties, selectiegeschiktheid of
diagnose, en "creativiteit" wordt niet als verklaring gebruikt. Wie het waarom van
voorkeursgedrag of talentpotentieel wil onderzoeken, hoort naar het TaPas Kompas
te worden verwezen.

## Gebruik (na goedkeuring van stap 2)

```tsx
import { Temperamentenwiel, analyseerTeam } from "@/temperamentenwiel";

const deelnemers = [
  { naam: "Voorbeeld Een", initialen: "VE", wielpositie: "26-46" },
  { naam: "Voorbeeld Twee", initialen: "VT", wielpositie: "33-53" },
];

<Temperamentenwiel deelnemers={deelnemers} />;
const analyse = analyseerTeam(deelnemers);
```

De donkere kernwaas met INNER WHY van de gedrukte mat staat standaard uit
(`kern: false`), zodat de kleurlagen in het binnengebied zichtbaar blijven. Zet
`kern` alleen aan voor drukwerk dat de mat moet nabootsen.
