# T4Teens 17-juli transfer -> tapas-demo (directe DB-import)

Zet de 13 echte T4Teens-afnames van 17 juli in de persistente database van tapas-demo.
Herberekent het volledige rapport (generatorContract) uit de originele antwoorden met
DEZELFDE buildT4TeensContract die het platform gebruikt. Veilig en idempotent.

## Bestanden
- `import-naar-tapas-demo.mts`  -> het importscript
- `t4teens-17juli-export.json`  -> de 13 records (bron)

## Draaien in de Render Shell van tapas-demo
1. Open in Render: service **tapas-demo** -> tab **Shell**.
2. Ga naar de projectmap (de map met package.json):
       cd /opt/render/project/src
3. Zorg dat deze map `t4teens-transfer/` met beide bestanden bevat.
   (Ze zitten al in de repo/zip; bij twijfel upload je ze naar die map.)
4. Draai de import (DB-pad wordt automatisch /data/data.db via TAPAS_DB_PATH):
       ./node_modules/.bin/tsx t4teens-transfer/import-naar-tapas-demo.mts
5. Verwacht: "Geimporteerd: 13 | Overgeslagen: 0".
   Draai je het per ongeluk nog eens, dan staat er "Overgeslagen: 13" (geen dubbels).

## Controle achteraf
- Log in op /admin (marc@tapascity.com) en filter op T4Teens: de 13 namen staan als "voltooid".
- Elk profiel opent met een volledig rapport (items 19/24).

## Veiligheid
- Idempotent: dubbele import onmogelijk (check op naam + completed_at).
- Verse id's, respondent_code en invite_token -> geen botsing met bestaande records.
- De showcase-seed (MD-/LU-/JA-2026-001) raakt deze records NOOIT aan; ze overleven elke herstart.
