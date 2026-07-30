# Back-up en herstel

Dit document sluit het laatste deel van auditbevinding O-1 ("geen bouwpijplijn,
monitoring of back-upstrategie"). De bouwpijplijn staat in
`.github/workflows/ci.yml`, de monitoring op `GET /api/gezondheid`, en de
back-upstrategie staat hier.

## Waarom een kopieerbevel niet volstaat

De databank draait in WAL-modus. Een gewone bestandskopie tijdens gebruik kan een
half geschreven transactie bevatten en is dus niet betrouwbaar. `script/backup.mjs`
gebruikt de online-back-upvoorziening van SQLite: die maakt een consistente kopie
terwijl het platform blijft draaien, en controleert de kopie daarna meteen.

## Een back-up nemen

```bash
node script/backup.mjs                       # kopie in ./backups/, 14 bewaard
node script/backup.mjs --map /var/backups    # eigen doelmap
node script/backup.mjs --bewaar 30           # 30 kopieen bewaren
```

Instelbaar via omgevingsvariabelen: `TAPAS_DB_PAD`, `TAPAS_BACKUP_MAP`,
`TAPAS_BACKUP_BEWAAR`.

Het script eindigt met foutcode 1 wanneer de kopie de integriteitscontrole niet
haalt. Een geplande taak ziet die foutcode, dus een stille mislukking is
uitgesloten.

## Aanbevolen ritme

| Wanneer | Wat | Waar |
|---|---|---|
| Elke nacht | `node script/backup.mjs --bewaar 14` | persistente schijf van de instance |
| Elke week | de nieuwste kopie wegzetten buiten de hostingprovider | externe opslag |
| Voor elke uitrol | eenmalige kopie met de hand | persistente schijf |
| Elk kwartaal | herstelproef (zie hieronder) | wegwerp-omgeving |

Op Render kan dit met een cron job in dezelfde service. Een kopie die alleen op
dezelfde schijf staat als de databank, beschermt tegen een menselijke fout maar
niet tegen verlies van de schijf; daarom de wekelijkse kopie buiten de provider.

## Herstellen

1. Zet het platform stil (de service stoppen of op onderhoud zetten).
2. Bewaar de huidige databank onder een andere naam - nooit overschrijven, ook
   niet wanneer je zeker bent.
   ```bash
   mv data.db data.db.voor-herstel
   ```
3. Zet de gekozen kopie op de plaats van de databank.
   ```bash
   cp backups/tapas-20260730-0300.db data.db
   ```
4. Verwijder achtergebleven WAL-bestanden van de oude databank.
   ```bash
   rm -f data.db-wal data.db-shm
   ```
5. Start het platform. Bij de opstart meldt het zelf de databankintegriteit
   (aantal actieve kernindexen, afdwinging van verwijzingen, verweesde
   verwijzingen).
6. Controleer `GET /api/gezondheid`: die moet `{"status":"ok"}` teruggeven.
7. Controleer in het beheerscherm het aantal afnames tegen wat je verwacht.

## Herstelproef

Een back-up die nooit teruggezet is, is een aanname. Doe elk kwartaal een proef in
een wegwerp-omgeving: kopie terugzetten, platform starten, inloggen, één rapport
openen. Noteer datum en uitkomst. Dat is precies wat een auditor of investeerder
wil zien: niet dat er kopieën bestaan, maar dat herstel aantoonbaar werkt.

## Bewaartermijn en privacy

Back-ups bevatten persoonsgegevens en psychometrische profielen. Ze vallen dus
onder hetzelfde bewaarbeleid als de databank zelf: kopieën ouder dan de
bewaartermijn worden opgeruimd (het script doet dat automatisch via `--bewaar`), en
kopieën buiten de hostingprovider horen op versleutelde opslag te staan. Een
verzoek tot wissen dat in de live databank is uitgevoerd, werkt pas volledig door
zodra de oudere kopieën verlopen zijn; leg die termijn vast in het privacyregister.
