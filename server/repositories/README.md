# server/repositories/

Domein-repositories: de gefaseerde ontvlechting van `server/storage.ts`.

## Stand van zaken (30-07-2026, na de broncode-audit)

Deze map bevat **alleen nog aangesloten code**. Elk `.ts`-bestand hier wordt
werkelijk geïmporteerd door `server/storage.ts`:

| Bestand | Domein | Aangesloten |
|---|---|---|
| `billers.ts` | BillerEntiteiten | ja |
| `organisaties.ts` | Organisaties | ja |

## Waarom acht bestanden verdwenen zijn

De audit (bevinding A-2, ernst hoog) stelde vast dat deze map zes niet-aangesloten
**kopieën** bevatte van code die in `server/storage.ts` leeft: `afnames.ts`,
`credits.ts`, `rapporten.ts`, `deelnemers.ts`, `sessies.ts` en `toegang.ts`, samen
met de hulpmodule `db.ts` en de verzamelmodule `index.ts` die alleen die kopieën
opnieuw uitvoerde. Niemand importeerde ze - nagegaan met een zoekopdracht over
`server/`, `client/`, `shared/`, `tests/` en `script/`: nul verwijzingen.

Twee kopieën van dezelfde datalaaglogica zijn erger dan één lange module. Wie de
kopie aanpast in de veronderstelling dat ze live is, verandert niets; wie de
storage aanpast, laat de kopie stil verouderen. Dat is een klassieke bron van
stille fouten. Een waarschuwing in dit bestand dekte dat risico maar gedeeltelijk
af, dus zijn de kopieën verwijderd (2.020 regels dode code).

## De regel vanaf nu

**Per cluster echt aansluiten, en de kopie in `storage.ts` in dezelfde beweging
verwijderen. Nooit een repository toevoegen die niemand importeert.**

Die regel wordt afgedwongen door een test: `tests/repositories-geen-dode-kopieen.test.ts`
faalt zodra er in deze map een `.ts`-bestand staat dat niet door `server/storage.ts`
geïmporteerd wordt.
