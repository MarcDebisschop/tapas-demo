# Releasebeleid TaPas CORE

Dit document beschrijft hoe versies genummerd worden, wanneer er vrijgegeven
wordt, hoe de changelog wordt bijgehouden en welke poort een release moet halen.

Het is opzettelijk kort. Een beleid dat niemand naleeft is erger dan geen
beleid, want het wekt de indruk dat er controle is.

## 1. Versienummers: semantische versionering

Een versie heeft de vorm `HOOFD.MINOR.PATCH`, bijvoorbeeld `2.5.0`.

- **HOOFD** stijgt bij een breuk: bestaande afnemers moeten iets aanpassen.
  Denk aan een endpoint dat verdwijnt, een veld dat van naam verandert, een
  antwoordvorm die wijzigt, of een migratie die niet terug te draaien is.
- **MINOR** stijgt bij nieuwe functionaliteit die achterwaarts verenigbaar is.
  Een nieuw endpoint, een nieuw scherm, een extra veld.
- **PATCH** stijgt bij herstelwerk zonder nieuwe functionaliteit.

### Waar zit de versie

Op twee plaatsen, en ze moeten overeenkomen:

1. `"version"` in `package.json`.
2. Een git-tag `vHOOFD.MINOR.PATCH` op de commit in `main`.

Op het moment van schrijven bestaat er nog geen enkele tag en staat
`package.json` op een nummer dat sinds de oudste zichtbare commit niet is
verhoogd. Dat is precies het gat dat dit beleid dicht.

### Beveiligingsherstel en semver

Een lek dichten verwijdert soms gedrag waar iemand op leunde. Toch is dat geen
automatische hoofdversie: semver beschermt de *ondersteunde* interface, en een
lek is nooit ondersteund. De afweging hoort wel in de changelog te staan, met
naam en toenaam, zodat een lezer zelf kan beoordelen of het hem raakt. Zie de
verantwoording bij 2.5.0 in [../CHANGELOG.md](../CHANGELOG.md).

## 2. Releaseritme

Er wordt vrijgegeven **wanneer er iets af is**, niet op een vaste dag. Een vast
ritme met een half afgewerkte functie erin is slechter dan een week wachten.

Richtlijnen:

- **Beveiligings- en privacyherstel** gaat zo snel mogelijk, als eigen release.
  Het wordt niet meegenomen met werk dat nog niet klaar is, want dan bepaalt het
  langzaamste onderdeel wanneer het lek dicht is.
- **Functionaliteit** wordt gebundeld per samenhangend geheel. De
  organisatie-scoping is als negen commits gebouwd maar als een release
  vrijgegeven: los van elkaar zijn de fases niet zinvol te gebruiken.
- **Herstelwerk** mag meeliften op de volgende release, tenzij een gebruiker
  erop wacht.

## 3. Werkwijze per release

1. Werk op een feature-branch, nooit rechtstreeks op `main`.
2. Maak per samenhangende stap een aparte commit, met een Nederlandstalig
   bericht dat vertelt WAAROM de wijziging nodig was en niet enkel wat ze doet.
3. Open een pull request naar `main` met een Nederlandstalige omschrijving.
   Vermeld expliciet wat bewust NIET is gedaan en waarom; dat is even
   waardevolle informatie als wat er wel gebeurd is.
4. Draai de release-gate (paragraaf 5). Alles groen, of het gaat niet door.
5. Werk de changelog bij (paragraaf 4).
6. Na samenvoegen: verhoog `package.json`, zet de tag `vX.Y.Z` en duw de tag.

## 4. Changelog bijhouden

`CHANGELOG.md` in de repo-root, in de stijl van
[Keep a Changelog](https://keepachangelog.com/nl/1.1.0/), in het Nederlands.

- Elke versie krijgt een eigen kop met datum in de vorm `JJJJ-MM-DD`.
- Groepeer per soort: `Beveiliging`, `Toegevoegd`, `Gewijzigd`, `Gerepareerd`,
  `Verwijderd`, `Verouderd`. Laat een groep weg als ze leeg is.
- Schrijf voor een lezer die de code niet kent. "Scope toegevoegd" zegt niets;
  "de organisatie komt uit de sessie in plaats van uit de URL, want elke
  bezoeker kon het nummer raden" zegt alles.
- Noem bestandsnamen waar ze helpen, maar bouw geen tweede documentatie op.
  De code is de waarheid; de changelog is de geschiedenis.
- Wijzigingen die nog niet vrijgegeven zijn, staan onder een kop
  `[Niet vrijgegeven]`. Bij het vrijgeven wordt die kop het versienummer.
- **Verzin niets.** Elke regel moet terug te vinden zijn in de git-historie of
  in de code. Als een detail niet meer na te gaan is, schrijf dan dat het niet
  na te gaan is.

## 5. Release-gate: de teststrategie

Er wordt niets vrijgegeven dat deze twee controles niet haalt. Ze draaien in de
werkkopie, voor de pull request en nog eens voor het taggen.

### 5.1 Vitest, volledig groen

```
npx vitest run
```

Stand op 26-07-2026: **366 tests over 27 bestanden, alles groen.** Deze
telling mag stijgen, nooit dalen. Een test verwijderen of overslaan is een
beslissing die in de pull request verantwoord moet worden, niet iets wat
onderweg gebeurt.

De suite is de reden dat grotere ingrepen aandurven. Het opsplitsen van
`server/storage.ts` is enkel verantwoord omdat de tests een regressie
onmiddellijk aanwijzen; zonder dat vangnet zou dezelfde ingreep onverantwoord
zijn.

Wat de suite dekt, in lagen:

- **Gedrag van endpoints** met een echte Express-app op een vrije poort. Geen
  nagebootste HTTP-laag, want dan test je je nabootsing.
- **Isolatie tussen organisaties**, tabelgestuurd: endpoint maal rol maal
  verwachte uitkomst. Zo valt een nieuw endpoint zonder guard op.
- **Pure regels** als functie, los van de DOM. Zie `brandingBesluit` in
  `shared/branding.ts`: het Earhart-watermerk is een merkregel en wordt als
  zodanig getest, niet via een schermtest.
- **Broncontroles** waar gedrag niet te draaien is. `tests/i18n-dekking.test.ts`
  leest de bronbestanden en vergelijkt de gebruikte vertaalsleutels met de
  tabel. Zulke tests krijgen een eigen vangnet, bijvoorbeeld een minimum aan
  gevonden treffers, zodat een stukke regex de test niet stil laat slagen.
- **Migraties** worden gevalideerd op een KOPIE van `data.db`, tweemaal
  achtereen om idempotentie aan te tonen, met controle op rijaantallen en
  `PRAGMA integrity_check`.

### 5.2 TypeScript: geen nieuwe fouten

```
npx tsc --noEmit
```

Stand op 26-07-2026: **73 fouten.** Dat is geen doel maar een bekende schuld,
vastgelegd zodat ze niet stilletjes groeit. De regel is eenvoudig: de telling
mag na een wijziging niet hoger zijn dan ervoor. Lager mag altijd; de telling
stond op 77 en vier zijn opgelost.

Waarom niet eerst opruimen: een deel van die 73 zit in code waar geen test op
staat, en zulke meldingen repareren zonder vangnet is precies het soort ingreep waar
gedrag stilletjes verandert. De resterende fouten en het voorstel per groep
staan in [TECHNISCHE-SCHULD.md](TECHNISCHE-SCHULD.md).

Let op dat `tsc` de vertaalsleutels niet volledig kan bewaken: waar een
vertaalfunctie als prop wordt doorgegeven met het type `(s: string) => string`,
valt de sleutelcontrole weg. Daarom bestaat `tests/i18n-dekking.test.ts`.

### 5.3 Bouwen

```
npx vite build
```

Moet slagen. Een groene testsuite met een gebroken bouw levert niets af.

## 6. Wat het beleid niet regelt

- **Activeren van encryptie-at-rest.** De hook staat klaar en meldt bij het
  opstarten of ze actief is of als no-op draait. Aanzetten in productie vraagt
  een sleutelbeheerbeslissing en een keuze van driver; dat is geen
  releasebeslissing. Zie `server/db-encryptie.ts` en
  [GDPR-FIX6-encryptie-at-rest.md](GDPR-FIX6-encryptie-at-rest.md).
- **Terugdraaien van migraties.** Alle migraties zijn additief, dus een oudere
  versie van de code blijft draaien op een nieuwere databank. Een echte
  terugdraaiprocedure bestaat niet en is nooit nodig geweest. Zodra er een
  niet-additieve migratie komt, moet die hier eerst beschreven worden.
