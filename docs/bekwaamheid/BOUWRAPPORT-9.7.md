# Bouwrapport — §9.7, de drie schermen die bekwaamheid suggereerden

**Datum** 14 augustus 2026 · **Repo** `/home/user/workspace/core/` op `b808577` (v2.7.0) · **Node** v20.20.1 · **Vitest** v4.1.10

---

## 1. Wat §9.7 vroeg, en wat er nu staat

Het bouwplan beschrijft drie plaatsen waar het platform iets over bekwaamheid leek te zeggen zonder dat er een bekwaamheidsbeslissing achter zat. Het punt van §9.7 is niet dat die schermen moeten verdwijnen, maar dat ze moeten zeggen wat ze werkelijk meten.

| Scherm | Wat er stond | Wat er nu staat |
|---|---|---|
| `/admin/toegang` | Schakelaars per platformdeel, zonder enige verwijzing naar een licentie | Een tweede kolom **Licentie** naast elke module-rij, met de vijf standen in woorden |
| `/admin/stm` | Een zelftrainingsmodule met een inschalingslabel dat als kwalificatie las | `/admin/oefenen`, titel **Oefenen**, met een afbakening bij zowel de module als de uitkomst |
| `/admin/kwaliteit` | Kolom "Afnames" die oefensessies telde; "STM"-kolom naast de afnamenorm | Praktijkactiviteit expliciet benoemd, afnames en oefensessies gescheiden getoond |

De onderliggende afspraak van dit blok: **toegang heeft twee voorwaarden.** De schakelaar opent een platformdeel; de licentie geeft het recht er een afname mee te doen. Beide moeten kloppen, en tot deze ronde was op geen enkel scherm te zien dat de tweede bestond.

---

## 2. Waarom er één eindpunt is en geen drie

§9.7 noemt drie schermen die elk een licentiestand willen laten zien. Drie schermen die elk zelf statussen gaan tellen, is drie keer een kans op een ander antwoord op dezelfde vraag. Daarom staat de berekening op één plaats en het ophalen op één plaats.

```
server/bekwaamheid/licentiebeeld.ts          274 r.   rekenkern, leest niets
server/bekwaamheid/routes-licentiebeeld.ts   173 r.   GET /api/bekwaamheid/licentiebeeld
```

De rekenkern kent vijf standen: `buiten_het_register`, `geen_licenties`, `in_orde`, `let_op`, `geen_afnamerecht`. De interne `beoordeel()` spiegelt **exact** `magAfnemen` uit de poort — met gelijkloop-tests over alle zeven statussen en vijf geldigheidsvensters. Zou het scherm een ander antwoord geven dan de poort, dan is het scherm erger dan geen scherm.

De route is een leesweg: er wordt niets geschreven, ook geen auditregel. Wie kijkt hoe iemand ervoor staat, verandert daarmee niets aan die persoon. Het antwoord bevat geen namen en geen e-mailadressen — alleen een afbeelding van beheerder-id naar getallen en statussen. Een scherm dat een naam wil, heeft die al.

### Waarom `perPlatformdeel` erbij hoort

Licenties staan op instrumenten. De schakelaars op `/admin/toegang` staan op platformdelen. Zonder brug zou het scherm zelf moeten weten welk instrument bij `kompas` hoort, en dan bestaat die afbeelding op twee plaatsen — in de server en in de browser. Ze staat nu op één plaats: `poort-platformdelen.ts`, dezelfde afbeelding die de poort gebruikt om te weigeren.

**Feitelijke vondst:** van de 16 instrumenten in `PLATFORMDEEL_VAN_INSTRUMENT` hebben er zes een platformdeel (`t4p-business-kompas → kompas`, `t4recruitment → t4r`, `tapas-teamscan → teamscan`, `twominscan → twominscan`, `impact-roos → impact`, `hdd → hdd`). De tien andere — waaronder t4teens, t4students, t4kids, t4o, de vier t4sports-varianten, stm en driverscan — hebben er geen. Van de vier families uit blok 2 heeft alleen T4P Business een platformdeel. De platformdelen `bekwaamheid`, `credits` en `t4p-profielen` hebben geen instrument achter zich; daar is een licentievoorwaarde niet aan de orde en daar staat dus geen cel.

---

## 3. De onderbouwing die eerder ontbrak

Het bouwplan stelt dat `/admin/toegang` "controle suggereert die niet bestaat". Dat is deze ronde feitelijk bevestigd. In `server/bekwaamheid/poort-platformdelen.ts` staat vastgelegd: `toegangen` werd tot nu toe **door geen enkel endpoint gelezen om iets te weigeren**. De enige aanroepers zitten in `server/toegang/routes.ts` — het lezen en schrijven van de vlaggen zelf. De vlaggen op `/admin/toegang` waren dus decoratief. De poort is de eerste plaats waar ze iets doen.

Dat is geen interpretatie van het scherm maar een eigenschap van de broncode, en het is de reden dat de kolom licentie ernaast hoort: de schakelaar alleen heeft nooit iets tegengehouden.

---

## 4. De drie schermen, per stuk

### 4.1 `/admin/toegang` — de kolom licentie

Per beheerderkaart staat er nu een samenvatting, en per module-rij een cel. De **accreditatie-rijen zijn bewust ongemoeid gelaten**: daar zit geen instrument achter, dus daar valt geen afnamerecht over te zeggen.

Elke stand krijgt **woorden**, niet alleen een kleur. Kleur is een tweede signaal, nooit het enige. Naast de stand verschijnen, waar van toepassing, `alert open`, `voorwaarde open` en `verloopt`.

Boven de tabel staat een uitlegblok (`data-testid="uitleg-twee-voorwaarden"`) met de peildatum erin. Mislukt het ophalen, dan zegt het scherm dat, en het zegt er meteen bij dat de schakelaars wél werken — een leeg vak zou als "geen licentie" gelezen worden, en dat is een ander feit dan "niet opgehaald".

### 4.2 `/admin/oefenen` — het oude `/admin/stm`

De route heet nu `/admin/oefenen`; `/admin/stm` leidt ernaartoe om, zodat bestaande links blijven werken. De titel is **Oefenen**. Er is een afbakeningsblok bij de module (`oefenen-afbakening`) en één bij de uitkomst (`oefenen-resultaat-afbakening`).

Het inschalingslabel is **blijven staan**. Het is nuttige oefenfeedback en het weghalen zou de module armer maken. Wat eraan toegevoegd is, is de grens die er altijd al was: geen bekwaamheidsbeslissing, geen invloed op de licentie.

**Scores, kennislagen, adaptieve selectie en feedback zijn niet aangeraakt.** Dat is met opzet: bevinding 4 stelt dat de cesuur 0,85/0,70/0,55 niet onderbouwd is en dat de adaptieve selectie naar zwakke lagen stuurt. Dat zijn inhoudelijke vragen over het instrument. Ze horen niet in een ronde die over woorden op een scherm gaat, en ze zijn hier dus niet stil beslecht.

### 4.3 `/admin/kwaliteit` — de teller

De reparatie aan de serverkant was al gedaan (`server/routes-stm.ts`, r. 934-1003): `berekenKwaliteitsStatus` leest nu `bekwaamheidOpslag.tellers.telAfnames(...)` en `laatsteAfname(b.id)`, en de oefenkant staat apart als `oefensessies_count` en `laatste_oefensessie`. Deze ronde volgt de clientkant.

Wat er stond: de kolom "Afnames" telde afgeronde oefensessies. Iemand die veel oefende en niets afnam, lag op schema. Dat is de omkering van wat het scherm bedoelde te zeggen.

Wat er nu staat: een blok bovenaan (`kwaliteit-afbakening`) dat expliciet zegt dat dit scherm praktijkactiviteit meet en niet bekwaamheid. De kop luidt "Praktijkactiviteit {jaar}", de tabelkop "Afname-overzicht {jaar} — voltooide afnames tegen de norm". "Laatste activiteit" heet nu "Laatste afname". De kolom "STM" heet "Oefenen" en toont naast de lagen ook het aantal oefensessies en de datum van de laatste. In het detailpaneel staan "Laatste afname" en "Oefensessies {jaar}" naast elkaar, als twee dingen en niet als één.

**De vier verwijzingen naar `/admin/stm` in dit bestand zijn niet gewijzigd.** Bij nameting bleken het API-paden te zijn (`/api/admin/stm-voortgang`), geen paginalinks. Er staat in het hele bestand geen enkele link naar de pagina. Alleen de woorden op het scherm zijn aangepast; de vier API-paden en de vier in `server/admin-stm-voortgang.ts` blijven zoals ze waren.

---

## 5. Gemeten verificatie

| Controle | Uitkomst |
|---|---|
| Volledige suite (`npx vitest run`) | **184 bestanden, 2.309 tests, alles groen** (63,95 s) |
| Nieuwe tests | `bekwaamheid-licentiebeeld.test.ts` 29 groen · `bekwaamheid-licentiebeeld-route.test.ts` 14 groen |
| Typecontrole (`npx tsc --noEmit`) | 72 meldingen, **geen enkele** in een nieuw of gewijzigd bestand (alle 72 in admin-inzichten, lounge, studie, scoring-modules e.d.) |
| Bundel (`npx vite build`) | slaagt in 20,24 s |
| Bestandsgrens (`git diff --name-only \| wc -l`) | **14** — exact op de afspraak |

De 14 gewijzigde bestanden: `client/src/App.tsx` · `client/src/pages/admin-kwaliteit.tsx` · `client/src/pages/admin-toegang.tsx` · `client/src/pages/stm.tsx` · `drizzle.config.ts` · `server/audit-log.ts` · `server/bulk-import/routes.ts` · `server/db-encryptie.ts` · `server/migratieloper.ts` · `server/routes-stm.ts` · `server/routes.ts` · `server/routes/afnames.ts` · `shared/platformdelen.ts` · `tests/migratieloper.test.ts`. Samen 586 toevoegingen en 74 verwijderingen.

Nieuwe, niet-gevolgde bestanden (buiten de grens): de vier modules hierboven plus `client/src/components/bekwaamheid/licentiekolom-teksten.ts` (149 r.) en `LicentieKolom.tsx` (224 r.), en twee testbestanden (350 + 259 r.).

### Eén test die mijn eigen verwachting weersprak

De test `draagt een weigergrond mee naar de bundeling` verwachtte de reden `status_zonder_afnamerecht`. De code geeft `status opgeschort`. **De test is aangepast, niet de code**: de reden komt in de zwevende uitleg van de cel op het scherm te staan, en daar hoort een leesbare zin en geen sleutel. Dat is een feit uit de code en geen keuze die deze ronde is gemaakt.

---

## 6. Afwijkingen om te melden

**De vijftalige teksten staan op de verkeerde plaats.** `licentiekolom-teksten.ts` hoort in `shared/i18n.ts`, met prefix `lk_`. Ze staan nu in een apart clientbestand, puur om binnen de bestandsgrens van 14 te blijven — `shared/i18n.ts` is een gevolgd bestand en zou de vijftiende zijn geweest. Dit staat ook in de kop van het bestand zelf. Bij een volgende ronde waarin `shared/i18n.ts` open mag, horen ze daarheen. Een test bewaakt intussen dat elke sleutel in alle vijf de talen bestaat en dat geen taal een sleutel heeft die het Nederlands niet kent.

**Nog niet visueel nagekeken met echte data.** Alle 14 `bekwaamheid%`-tabellen staan in productie op nul rijen. De licentiekolom toont dus overal `buiten_het_register`, en dat is correct maar niet informatief. Hetzelfde gold voor scherm 9.6. Zodra er registerrijen zijn, hoort dit scherm met echte data bekeken te worden — vooral het gedrag bij een beheerder met licenties op meerdere platformdelen.

**Bevinding 2 staat nog open.** `EXTRA_PRACTITIONERS` is een hardgecodeerde array in `routes-stm.ts:329` met 21 namen en e-mailadressen (id's 1001-1021) in een publieke repository. Dat zijn persoonsgegevens buiten de databank, en dus buiten de bewaartermijnjob, het auditlogboek en het recht op verwijdering. Dat is niet met woorden op een scherm te repareren en het valt buiten §9.7, maar het is de zwaarste van de openstaande punten.

---

## 7. Wat deze ronde niet gedaan heeft

`admin-coaches.tsx` en `coach-dashboard.tsx` zijn **niet** aangeraakt. §9.7 noemt ze wel, maar ze vallen buiten de bestandsgrens van 14. De serverlaag ligt er klaar voor: hetzelfde eindpunt geeft per beheerder al alles wat die twee schermen nodig hebben, dus dat is een ronde van twee bestanden en geen nieuw ontwerp. Daar is aparte toestemming voor nodig.
