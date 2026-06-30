# server/repositories/

Domein-repositories — opsplitsing van `server/storage.ts` (item NP-3/1.2, Fase 5).

## Domeinindeling

| Bestand | Domein | Regels in storage.ts |
|---|---|---|
| `afnames.ts` | Afnames, uitnodigingen, GDPR | ~1679-1775, 2586-2668 |
| `billers.ts` | BillerEntiteiten | ~1773-1820 |
| `organisaties.ts` | Organisaties | ~1819-1860 |
| `credits.ts` | CreditSaldi, CreditTransacties, Betalingen, Facturen, Creditnota's, KPIs | ~1859-2590 |
| `rapporten.ts` | Rapporten | ~2274-2320 |
| `deelnemers.ts` | Deelnemers, ChatBerichten, Uitleg | ~2669-2848 |
| `sessies.ts` | Licenties, Sessies, Kringleden, Studies | ~2848-3150 |
| `toegang.ts` | Beheerders, Toegangen, Tarieven, Coach accreditatie | ~3148-3295 |

## Architectuur

Elke repository exporteert standalone functies die `db` en `sqlite` direct importeren
vanuit `server/storage.ts` (via re-export). De `DatabaseStorage`-klasse in `storage.ts`
delegeert naar deze functies.

**Publieke interface ongewijzigd** — alle imports elders (`import { storage } from "./storage"`)
werken ongewijzigd. De repositories zijn interne implementatiedetails.

## Werkregels

- Nooit `storage.ts` verwijderen — dit is de publieke façade
- Nooit rechtstreeks importeren vanuit routes (altijd via storage)
- Bij twijfel: regel 4 — extraheer uit de bundle, interpreteer nooit
