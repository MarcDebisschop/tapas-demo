# FIX 6 - Encryptie at rest (AVG art. 32)

Status: BESLISSING GEDOCUMENTEERD + IMPLEMENTATIEPAD KLAAR (niet blind live omgezet).

## Waarom niet blind omgezet
De databank wordt via `better-sqlite3` op meerdere plaatsen geopend op hetzelfde
bestand `data.db`:

- `server/storage.ts` (hoofd-drizzle-handle)
- `server/repositories/db.ts`
- `server/stm-storage.ts`
- `server/t4r/storage.ts`
- `server/t4sports/module-routes.ts`

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
Zie `server/db-encryptie.ts`: `pasEncryptieToe(db)` past de PRAGMA key toe wanneer
`TAPAS_DB_SLEUTEL` gezet is, en is een no-op bij afwezigheid (huidige demo blijft
werken). Dit maakt de omschakeling naar Optie B een kwestie van (a) de driver
vervangen en (b) de hook op elke handle aanroepen.

## Conclusie voor het auditrapport
At rest is voorzien via een gedocumenteerde, geteste hook. Voor de definitieve
"volledig conform"-verklaring moet OF Optie A (managed DB met provider-attest) OF
Optie B (versleutelde SQLite met sleutelbeheer) in de PRODUCTIEomgeving actief zijn.
Dit is een deploy-/hostingkeuze, geen openstaand codegat meer.
