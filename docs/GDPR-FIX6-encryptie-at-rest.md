# FIX 6 - Encryptie at rest (AVG art. 32)

Status: BESLISSING GEDOCUMENTEERD + IMPLEMENTATIEPAD KLAAR (niet blind live omgezet).

## Waarom niet blind omgezet
De databank wordt via `better-sqlite3` op meerdere plaatsen geopend op hetzelfde
bestand `data.db`. Deze lijst is op 26-07-2026 feitelijk nagegaan met
`grep -rn "new Database(" server` en telt ACHT handles, niet vijf zoals hier
eerder stond:

- `server/storage.ts` (hoofd-drizzle-handle)
- `server/stm-storage.ts`
- `server/kwaliteit-storage.ts`
- `server/hdd/storage.ts`
- `server/t4r/storage.ts`
- `server/teamscan/storage.ts`
- `server/t4organizations/storage.ts`
- `server/t4sports/module-routes.ts`

`server/repositories/db.ts` stond hier eerder bij maar hoort er niet: dat bestand
hergebruikt de handle van `storage.ts` via een re-export en opent zelf niets.

De lijst staat ook als `GEKENDE_HANDLES` in `server/db-encryptie.ts` en wordt
door `tests/db-encryptie.test.ts` vergeleken met de echte bronbestanden. Komt er
een negende handle bij, dan faalt die test. Zo kan deze opsomming niet stil
verouderen, wat ze eerder wel deed.

Een encryptie-driver (SQLCipher via `better-sqlite3-multiple-ciphers`) vereist dat
ELKE handle dezelfde `PRAGMA key` toepast en dat het bestaande, niet-versleutelde
`data.db` eenmalig gemigreerd wordt. Dit blind omzetten tijdens een lopende
demo-omgeving zou alle bestaande data ontoegankelijk maken. Daarom leveren we een
veilig, getest implementatiepad met een centrale hook i.p.v. een riskante big-bang.

## Aanbevolen productie-aanpak (twee opties)

### Optie A - Managed Postgres (aanbevolen voor productie)
Bij productiehosting op Supabase/Neon/RDS levert de managed databank
encryptie-at-rest standaard (AES-256, beheerd door de provider). De drizzle-config
schakelt dan van `better-sqlite3` naar de Postgres-driver. Dit is de robuustste
route en verplaatst sleutelbeheer naar de provider. Dossier kan dan met bewijs
(provider-attest, bv. SOC 2/ISO 27001) stellen dat data at rest versleuteld is.

### Optie B - Versleutelde SQLite (indien SQLite behouden blijft)
1. `npm i better-sqlite3-multiple-ciphers` (drop-in vervanger, zelfde API).
2. Vervang in alle vijf de handles de import en pas direct na openen toe:
   ```ts
   import Database from "better-sqlite3-multiple-ciphers";
   const db = new Database(DB_PAD);
   const sleutel = process.env.TAPAS_DB_SLEUTEL;
   if (sleutel) db.pragma(`key='${sleutel}'`); // SQLCipher-compatibel
   ```
3. Eenmalige migratie van bestaand klaartekst-bestand:
   ```sql
   ATTACH DATABASE 'data-versleuteld.db' AS versleuteld KEY 'de-sleutel';
   SELECT sqlcipher_export('versleuteld');
   DETACH DATABASE versleuteld;
   ```
   Daarna `data-versleuteld.db` -> `data.db`.
4. `TAPAS_DB_SLEUTEL` als geheim in de hostingomgeving (nooit in git). Zonder de
   sleutel is de databank onleesbaar -> verlies van de sleutel = verlies van data,
   dus veilig sleutelbeheer/roulatie vastleggen.

## Centrale hook
Zie `server/db-encryptie.ts`: `pasEncryptieToe(db, naam)` past de PRAGMA key toe
wanneer `TAPAS_DB_SLEUTEL` gezet is, en is een no-op bij afwezigheid (huidige demo
blijft werken). De hook wordt sinds 26-07-2026 op ALLE acht handles aangeroepen,
niet enkel op die van `storage.ts`. Zonder sleutel verandert dat niets: de hook
keert onmiddellijk terug en voert geen enkele pragma uit. Met sleutel is de
omschakeling naar Optie B daarmee een kwestie van enkel nog de driver vervangen.

## Status zichtbaar bij het opstarten
De stille faalwijze van deze hook is de belangrijkste: de standaard
`better-sqlite3` NEGEERT `PRAGMA key` zonder foutmelding. Een beheerder die
`TAPAS_DB_SLEUTEL` zet zonder de cipher-driver te installeren, denkt dat de
databank versleuteld is terwijl ze in klaartekst op schijf staat.

Daarom schrijft de server bij elke start een regel:

```
[tapas] encryptie-at-rest: NIET ACTIEF (no-op) - TAPAS_DB_SLEUTEL is niet gezet; de hook draait als no-op.
```

`encryptieStatus()` in `server/db-encryptie.ts` levert die status ook als object
(`sleutelGezet`, `cipherDriver`, `actief`, `handles`, `reden`). `actief` is
opzettelijk streng: het vraagt een sleutel EN een driver die `PRAGMA
cipher_version` antwoordt. Dat laatste is de enige betrouwbare manier om te weten
of `PRAGMA key` echt iets doet. Een sleutel zonder cipher-driver levert dus
`actief: false` met een reden die het woord "klaartekst" bevat, geen
schijnzekerheid.

Zonder sleutel wordt de driver niet bevraagd. In de demo voert deze module dus
geen enkele pragma uit; daar is een test voor.

## Controle na activatie
Na stap 1 tot en met 4 van Optie B: herstart en lees de opstartregel. Ze moet
`ACTIEF` melden met een cipher-versie en het volledige aantal handles. Meldt ze
nog `NIET ACTIEF`, dan is de driver niet vervangen in elke handle en is er niets
versleuteld.

## Conclusie voor het auditrapport
At rest is voorzien via een gedocumenteerde, geteste hook. Voor de definitieve
"volledig conform"-verklaring moet OF Optie A (managed DB met provider-attest) OF
Optie B (versleutelde SQLite met sleutelbeheer) in de PRODUCTIEomgeving actief zijn.
Dit is een deploy-/hostingkeuze, geen openstaand codegat meer.
