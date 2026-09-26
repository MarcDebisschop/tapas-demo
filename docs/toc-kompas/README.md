# TOC Commitmentkompas in TaPas CORE

Moduleversie `toc-kompas-1.0.0`, signaalregels `toc-kompas-signalen-1.0.0`.

Het TOC Commitmentkompas brengt de commitments van het Team of Captains digitaal
samen: elke Captain vult via een eigen link in, het platform bewaart de
antwoorden, consolideert ze en maakt de rapporten die het TOC in de workshop en
daarna gebruikt. Het Team of Captains werkt als een cirkel van vier
gelijkwaardige Captains. Geen Captain staat hiërarchisch boven een andere. Het
TOC en de statutaire raad van bestuur blijven gescheiden.

| Captain | Rol in de code |
| --- | --- |
| Captain of Talent & Innovation | `talent_innovation` |
| Captain of Execution & Horizon | `execution_horizon` |
| Captain of The Academy | `academy` |
| Captain of Visibility | `visibility` |

## Verloop van een ronde

Een ronde doorloopt vier fasen, in deze volgorde:

1. `INTAKE`: de hoofdbeheerder maakt de ronde aan (periode `JJJJ-Qn`, titel,
   deadline, naam en e-mail per Captain). Het platform maakt vier invullinks.
   Die links worden een keer getoond; bewaard wordt enkel een hash.
2. `CONSOLIDATIE`: gaat vanzelf in zodra de vierde Captain indient, of
   wanneer de hoofdbeheerder de nulmeting afsluit. Vanaf dan kan een Captain
   niets meer wijzigen, tenzij de hoofdbeheerder de invulling heropent.
3. `VASTGESTELD`: het TOC stelt in de workshop het register vast, na de
   acceptatiecriteria. Het platform weigert de vaststelling zolang een kaart
   een verplicht veld mist (deliverable, acceptatiebewijs, deadline,
   capaciteit, beslissingsrecht, stopkeuze).
4. `AFGESLOTEN`: de ronde is afgerond en alleen nog leesbaar.

## Wat de Captain invult

De invullink opent een publieke pagina zonder account. De stappen:
Start, A Identiteit en realiteit, B Capaciteitsverdeling (met teller die op
100% moet uitkomen), C Delivery commitments (tot vijf, met RACI), D
Bedrijfsleiding commitments, E Grenzen, Dekkingsscan (19 domeinen),
Reflectie (per Captain, met optionele vragen over Business Development) en
Indienen.

- Het concept wordt twee seconden na elke wijziging bewaard, met een
  versienummer. Een tweede venster dat intussen bewaarde, geeft een melding
  in plaats van stil te overschrijven.
- Bij indienen controleert het platform: beschikbare uren ingevuld,
  percentages samen 100%, naam ingevuld en uren bij elke commitment.
  Percentages zonder uren worden niet aanvaard. "Onbekend" mag, het blokkeert
  niet maar wordt zichtbaar.
- Na indienen kan de Captain het eigen Captain Charter afdrukken.

## Wat de hoofdbeheerder doet

Onder Beheer, link "TOC Commitmentkompas" (alleen voor de hoofdbeheerder):

- Captains: status per Captain, nieuwe link, heropenen, antwoorden bekijken,
  nulmeting afsluiten.
- Consolidatie: capaciteit per Captain in uren en percentages, signalen
  (rood, oranje, geel, blauw) en de heatmap per domein. Er is geen
  gemiddelde score.
- Register: commitments overnemen uit de indieningen, kaarten aanvullen en
  status zetten.
- Coverage Matrix: per domein een A-owner, een dekkingsscore die het TOC
  zelf kiest en een actie.
- Decision Log: besluiten met datum, beslisser, rationale en review.
- Acceptatie: automatische criteria en criteria die het TOC bevestigt, daarna
  vaststellen en afsluiten.
- Rapporten: Captain Charter per Captain, Workshopdossier, Commitment
  Register en Kwartaalscorecard, als HTML en PDF.

## Rapporten en borging

- Elk rapport krijgt een inputhash. Een rapport met dezelfde invoer wordt
  hergebruikt, gewijzigde invoer geeft een nieuwe versie. Oude versies
  blijven bewaard.
- Elke indiening krijgt een inhoudshash.
- Twaalf audit-acties onder het voorvoegsel `toc_kompas_` in
  `gdpr_audit_log`: ronde aangemaakt, ingediend, vergrendeld, heropend,
  link vernieuwd, gewijzigd, besluit vastgelegd, vastgesteld, afgesloten,
  gelezen, rapport gemaakt, rapport gedownload.
- Publieke invulroutes zijn begrensd per IP en weigeren tokens met een
  onmogelijke lengte.

## Bestanden

| Onderdeel | Pad |
| --- | --- |
| Gedeelde inhoud, vragen en regels | `shared/toc-kompas.ts` |
| Tabellen (inline DDL) | `server/toc-kompas/ddl.ts` |
| Migratie (strikt additief) | `migrations/0013_toc_kompas.sql` |
| Drizzle-schema | `server/toc-kompas/schema.ts` |
| Opslag | `server/toc-kompas/storage.ts` |
| Consolidatie en signalen | `server/toc-kompas/consolidatie.ts` |
| Servicelaag | `server/toc-kompas/service.ts` |
| Routes | `server/toc-kompas/routes.ts` |
| Rapporten | `server/toc-kompas/rapporten/` |
| Beheerschermen en invulpagina | `client/src/pages/toc-kompas/` |
| Tests | `tests/toc-kompas-flow.test.ts`, `tests/toc-kompas-migratie.test.ts`, `tests/toc-kompas-consolidatie.test.ts` |

Zes tabellen: `toc_kompas_rondes`, `toc_kompas_captains`,
`toc_kompas_indieningen`, `toc_kompas_commitments`, `toc_kompas_besluiten`,
`toc_kompas_artefacten`.

## API

Beheer (aangemeld als hoofdbeheerder, anders 403), onder `/api/toc-kompas`:

| Methode | Pad |
| --- | --- |
| GET, POST | `/rondes` |
| GET | `/rondes/:id` |
| POST | `/rondes/:id/captains/:cid/link`, `/heropen` |
| GET | `/rondes/:id/captains/:cid/antwoorden` |
| POST | `/rondes/:id/vergrendel` |
| POST | `/rondes/:id/commitments/overnemen`, `/rondes/:id/commitments` |
| PUT, DELETE | `/rondes/:id/commitments/:cid` |
| POST | `/rondes/:id/commitments/:cid/status` |
| PUT | `/rondes/:id/coverage`, `/rondes/:id/acceptatie` |
| POST | `/rondes/:id/besluiten`, `/vaststellen`, `/afsluiten` |
| POST | `/rondes/:id/rapporten/:type` |
| GET | `/rondes/:id/artefacten/:aid?formaat=html\|pdf` |

Publiek, met de token uit de invullink, onder `/api/toc-kompas/invullen/:token`:
GET (status), PUT `/concept`, POST `/indienen`, GET `/charter`.

## Tests en omgeving

- `npx vitest run tests/toc-kompas-flow.test.ts tests/toc-kompas-migratie.test.ts tests/toc-kompas-consolidatie.test.ts tests/migratieloper.test.ts`
- `TOC_KOMPAS_GEEN_PDF=1` slaat het maken van PDF's over (voor tests zonder
  Chromium).
- De tabellen worden bij het opstarten aangemaakt; bestaande tabellen van
  andere modules worden niet aangeraakt.
