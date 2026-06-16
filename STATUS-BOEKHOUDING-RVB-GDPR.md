# TaPas Platform — Statusrapport
## Boekhouding · Raad van Bestuur · GDPR & Privacy

**Opgesteld voor:** Marc Debisschop (TaPasCity / 2BQ CONSULT)
**Datum:** 13 juni 2026
**Versie:** 1.0
**Scope:** TaPas Platform — credits, facturatie & afname-keten (T4P Business Kompas plug-in)

---

## 0. Managementsamenvatting

Het TaPas Platform is na deze uitbreiding **klaar voor een serieus boekhoudkundig, bestuurlijk en privacy-gesprek**. In één bouwronde zijn drie lagen toegevoegd:

1. **Boekhouding** — creditnota's met eigen doorlopende reeks en automatische btw-spiegeling, plus een volledige boekhoudexport (facturen + creditnota's) in CSV en JSON.
2. **Raad van Bestuur** — één bestuurs-dashboard ("Bestuur"-tab) met KPI's over omzet, klanten, credits, afnames, betalingen én GDPR-status, met export.
3. **GDPR & privacy** — verwerkingsdoel, rechtsgrond, privacyverklaring-versie, bewijslast (IP + tijdstip toestemming), bewaartermijn per afname, recht op inzage/overdraagbaarheid (data-export), recht op intrekking van toestemming en onomkeerbare anonimisering.

**Belangrijkste openstaande punten (vereisen een externe beslissing):**
- Btw-classificatie van credits formeel laten bevestigen door de boekhouder (single-purpose voucher).
- Rechtsgrond GDPR kritisch herbekijken: "toestemming" is in een werkgever-werknemercontext vaak **geen** geldige grond.
- Verwerkersovereenkomst (DPA) met afnemende organisaties en met technische dienstverleners (hosting, betaalprovider) opstellen.

Alle drie de lagen zijn na implementatie **end-to-end doorgetest** (zie sectie 5).

---

## 1. Boekhouding & accountant

### 1.1 Wat het platform vandaag vastlegt

| Object | Vastgelegde gegevens |
|---|---|
| **Factuur** | Doorlopend uniek nummer per jaar (`2BQ-2026-0001`), datum, klant + btw-nummer, snapshot van de facturerende entiteit, bedrag excl. btw, btw-tarief, btw-bedrag, bedrag incl. btw, kanaal (Peppol/klassiek), koppeling aan de betaling. Onveranderlijk na aanmaak. |
| **Creditnota** *(nieuw)* | Eigen doorlopende reeks (`2BQ-CN-2026-0001`), verwijzing naar de oorspronkelijke factuur, reden, negatieve spiegelbedragen (excl./btw/incl.), datum. Eén per factuur. |
| **Betaling** | Provider, providerreferentie, methode, bedrag excl./btw/incl., status (open/betaald/mislukt), koppeling aan factuur én credittransactie. |
| **Credittransactie** | Elke aankoop, reservering, verbruik, overdracht en correctie als afzonderlijke grootboekregel met aantal + omschrijving. |

### 1.2 Wat nieuw is toegevoegd in deze ronde

- **Creditnota's als volwaardig boekhoudkundig document.** Een factuur wordt nooit gewijzigd of verwijderd; een correctie gebeurt altijd via een creditnota die de factuur negatief spiegelt. Dit respecteert het principe van de onveranderlijke factuur. Optioneel worden de bijbehorende credits automatisch teruggeboekt via een correctie-grootboekregel.
- **Dubbele-creditnota-bescherming.** Het systeem weigert een tweede creditnota op dezelfde factuur (foutmelding i.p.v. stille dubbeltelling).
- **Boekhoudexport.** Eén export met álle facturen én creditnota's, beschikbaar als:
  - **CSV** met `;`-scheidingsteken en BOM → opent meteen correct in Excel (NL-instellingen);
  - **JSON** voor een eventuele directe koppeling met boekhoudsoftware.
  Velden: documenttype, nummer, datum, klant, klant-btw, bedrag excl., btw-tarief, btw-bedrag, bedrag incl., munt, kanaal.

### 1.3 Wettelijk kader (België, juni 2026)

- **E-facturatie via Peppol is verplicht sinds 1 januari 2026** voor alle Belgische btw-plichtige B2B-transacties. Niet-naleving kan administratieve boetes opleveren (KB 8 juli 2025: oplopend tot €1.500 / €3.000 / €5.000). Het platform genereert per factuur en creditnota een gestructureerd Peppol-document. ([Peppol.nl](https://www.peppol.nl/nl/nieuws/verplichte-e-facturatie-peppol-belgie-vanaf-2026), [e-invoice.be](https://e-invoice.be/blog/peppol-verplicht))
- **Bewaarplicht 10 jaar** voor facturen en boekhoudkundige stukken (art. 60 Btw-Wetboek, gewijzigd bij wet 20 november 2022; art. III.86 WER), te rekenen vanaf 1 januari na afsluiting van het boekjaar. ([Sayli](https://sayli.be/blog/nl/tva/hoe-lang-facturen-bewaren-belgie), [Accountable](https://www.accountable.eu/nl-be/blog/facturen-bijhouden/))
- **Verplichte factuurvermeldingen** (KB nr. 1, art. 5 / Btw-Wetboek art. 53): datum, uniek doorlopend volgnummer, identiteit + adres + btw-nummer van uitreiker, identiteit + btw-nummer van de klant (B2B), omschrijving, eenheidsprijs excl. btw, btw-tarief en btw-bedrag, totaal incl. btw. Het platform vult deze automatisch in. ([FACTURYS](https://facturys.eu/nl/verplichte-vermeldingen-factuur), [Informer](https://www.informer.eu/nl-be/factureren/factuur-opstellen))
- **Btw op credits = single-purpose voucher.** Omdat een credit maar voor één welbepaalde dienst inwisselbaar is en tarief + plaats van de dienst op voorhand vaststaan, valt de btw bij de **aankoop** (21%), niet bij het verbruik. ([Rechtenkrant](https://rechtenkrant.be/hoe-zit-het-met-de-btw-behandeling-van-vouchers/), [Grant Thornton](https://www.grantthornton.be/the-field/articles/btw-op-vouchers-toegelicht/))

### 1.4 Kritische gap-analyse boekhouding

| Punt | Status | Actie |
|---|---|---|
| Onveranderlijke facturen | ✅ Gedekt | — |
| Creditnota's met eigen reeks | ✅ Nieuw gedekt | — |
| Boekhoudexport (CSV/JSON) | ✅ Nieuw gedekt | Afstemmen op het rekeningschema van de boekhouder |
| Peppol-document per factuur/creditnota | ✅ Gedekt | Administratieve Peppol-aansluiting (verzendkanaal) bevestigen |
| Btw-classificatie credits | ⚠️ Hypothese | **Laten bevestigen door boekhouder vóór livegang** |
| Grootboekrekening-mapping | ⚠️ Open | Rekeningnummers opvragen bij boekhouder en in de export verwerken |
| Periodeafsluiting / btw-aangifte-overzicht per kwartaal | 🔲 Nog niet | Kan als volgende stap worden toegevoegd (subtotalen per periode) |

---

## 2. Raad van Bestuur & investeerders

### 2.1 Het bestuurs-dashboard ("Bestuur"-tab)

Er is één bestuursoverzicht toegevoegd dat de staat van de organisatie in brede zin samenvat. Alle cijfers komen rechtstreeks uit de live data; niets wordt handmatig ingevoerd.

**Omzet & facturatie**
- Omzet excl. btw, btw, incl. btw
- Netto omzet ná creditnota's (de werkelijk gerealiseerde omzet)
- Aantal facturen en aantal creditnota's

**Klanten & credits**
- Aantal organisaties en aantal betalende organisaties
- Verdeling per klanttype
- Credits verkocht, verbruikt, gereserveerd en uitstaand
- **Verzilveringsgraad** (welk percentage van de verkochte credits effectief verbruikt is) — een sterke indicator van productadoptie en van de uitgestelde-omzetverplichting

**Afnames & betalingen**
- Totaal aantal afnames, voltooid, in uitvoering, voltooiingsgraad
- Aantal gegenereerde rapporten
- Geslaagde / mislukte / openstaande betalingen en de **betaalslagingsgraad**

**Gemiddelden**
- Gemiddelde orderwaarde excl. btw
- Omzet per betalende organisatie

**GDPR-status** (zie ook sectie 3)
- Afnames met persoonsgegevens, geanonimiseerd, toestemming ingetrokken, bewaartermijn verstreken

**Export:** het volledige KPI-pakket is downloadbaar als JSON, en de boekhoudexport als CSV — direct bruikbaar voor een bestuurspresentatie of een datakamer voor investeerders.

### 2.2 Kritische gap-analyse bestuursrapportage

| Wat de RvB doorgaans wil zien | Status | Toelichting |
|---|---|---|
| Gerealiseerde omzet (netto, na correcties) | ✅ Gedekt | Netto na creditnota's |
| Uitgestelde omzet / verplichting (uitstaande credits) | ✅ Gedekt | Uitstaande credits × prijs is direct afleidbaar |
| Adoptie / gebruik (verzilveringsgraad, voltooiingsgraad) | ✅ Gedekt | — |
| Klantengroei en concentratie | ⚠️ Deels | Aantallen wel; **groei over de tijd nog niet** (zie hieronder) |
| Conversie betaling | ✅ Gedekt | Betaalslagingsgraad |
| **Trends over de tijd** (MRR-achtige reeksen, maand-op-maand) | 🔲 Nog niet | Momentopname i.p.v. tijdreeks. Volgende stap: snapshots per maand. |
| Cohort-/retentieanalyse | 🔲 Nog niet | Vereist tijdreeksen; zinvol zodra er meer historiek is |
| Cashflow / DSO | 🔲 Nog niet | Betaalmomenten worden vastgelegd; rapportering kan toegevoegd worden |

**Aanbeveling:** voor een investeerdersdossier is de logische volgende uitbreiding een **maandelijkse snapshot** van deze KPI's, zodat groei, verzilvering en retentie als trendlijnen getoond kunnen worden in plaats van als momentopname. De onderliggende data laat dit toe; enkel de periodieke vastlegging ontbreekt nog.

---

## 3. GDPR & privacy — uitgebreide status

> Dit is een technisch-organisatorische statusbeschrijving, geen juridisch advies. Voor de definitieve rechtsgrond en de verwerkersovereenkomsten is validatie door een DPO/jurist aangewezen.

### 3.1 Welke persoonsgegevens verwerkt het platform?

| Categorie | Voorbeeld | Gevoeligheid |
|---|---|---|
| Identiteit deelnemer | Naam, bedrijf, functie | Gewoon |
| Antwoorden vragenlijst | Forced-choice + energie-inschattingen (deel 1 & 2) | Gedragsgegevens — gevoelig in arbeidscontext |
| Afgeleid profiel | Gegenereerd energetisch gedragsprofiel | Afgeleide gevoelige gegevens |
| Toestemmingsbewijs | IP-adres, user-agent, tijdstip toestemming | Bewijslast |
| Facturatiegegevens opdrachtgever | Btw-nummer, adres | Bedrijfsgegevens |

Het platform verwerkt **geen** bijzondere categorieën in de zin van AVG art. 9 (geen gezondheids-, biometrische of strafrechtelijke gegevens). Wel zijn gedragsgegevens in een werkgever-werknemerrelatie gevoelig en vragen ze om extra zorgvuldigheid.

### 3.2 Wat nieuw is toegevoegd in deze ronde

Per afname legt het platform nu expliciet vast en/of ondersteunt:

1. **Verwerkingsdoel** — "Genereren van een professioneel energetisch gedragsprofiel (T4P Business Kompas)".
2. **Rechtsgrond** — vandaag standaard "toestemming" (zie kritische kanttekening in 3.4).
3. **Versie van de privacyverklaring** die gold op het moment van toestemming (`v1.0 (2026-06)`).
4. **Bewijslast van de toestemming** — IP-adres, user-agent en tijdstip worden vastgelegd (AVG art. 7: aantoonbaarheid).
5. **Bewaartermijn per afname** — `bewaartotDatum`, standaard 24 maanden voor de profieldata (doelbinding), aanpasbaar.
6. **Recht op inzage en overdraagbaarheid (art. 15 & 20)** — een gestructureerd data-exportpakket per betrokkene (identiteit, verwerking, verzamelde gegevens, afgeleide documenten), beschikbaar als leesbaar pakket en als JSON.
7. **Recht op intrekking van toestemming (art. 7.3)** — intrekking wordt met tijdstip geregistreerd.
8. **Recht op gegevenswissing / anonimisering (art. 17)** — een **onomkeerbare anonimisering** die naam, bedrijf, functie, alle ruwe antwoorden, het profielcontract en het toestemmingsbewijs (IP/user-agent) wist. De naam wordt vervangen door `[geanonimiseerd]`. De geaggregeerde schil (bestaan van de afname, betaling, factuur) blijft behouden voor de boekhouding en de KPI-tellingen. De bewerking is idempotent (dubbel uitvoeren is veilig).

### 3.3 Bewaartermijnen — de dubbele logica

Het platform hanteert bewust **twee verschillende bewaarregimes**, omdat boekhoudrecht en privacyrecht hier botsen:

| Gegevenstype | Bewaartermijn | Grond |
|---|---|---|
| Factuur- en boekhouddata | **10 jaar** | Wettelijke verplichting (art. 60 Btw-Wetboek / art. III.86 WER) |
| Psychometrische antwoorden + profiel | **doelgebonden, standaard 24 maanden** | Opslagbeperking (AVG art. 5.1.e): niet langer dan nodig voor het doel |

Dit betekent: na anonimisering verdwijnen de persoonsgegevens en de antwoorden, maar de factuur blijft (geanonimiseerd qua deelnemer, volledig qua boekhouding) 10 jaar bewaard. ([Claeys & Engels — GDPR-bewaartermijnen](https://www.claeysengels.be/nl-be/nieuws-events/newsflash-gdpr-bewaartermijnen), [pitch.law — data retention](https://www.pitch.law/nl/knowledge-base/data-retention-policies-how-long-should-you-keep-personal-data))

### 3.4 Kritische kanttekening: is "toestemming" wel de juiste rechtsgrond?

Dit is het belangrijkste privacy-aandachtspunt. In een **werkgever-werknemerrelatie** is toestemming volgens de Belgische rechtsleer vaak **geen geldige rechtsgrond**, omdat er een machtsverhouding bestaat en de toestemming daardoor niet "vrij" is. ([Sirius Legal](https://siriuslegaladvocaten.be/blogs/de-toestemming-in-de-relatie-werkgever-werknemer-onder-de-gdpr/))

Concreet:
- Als een **werkgever** zijn medewerkers het T4P Business Kompas laat invullen, is "toestemming van de werknemer" wellicht een wankele grond. Een grond als **gerechtvaardigd belang** of **uitvoering van een (arbeids- of opdracht)overeenkomst** is dan doorgaans passender — mits een belangenafweging en transparantie.
- Als een **individu vrijwillig en voor zichzelf** een profiel laat opmaken (bv. in een coachingcontext buiten de werkgever om), kan toestemming wél gelden.

Het platform legt de rechtsgrond nu **expliciet per afname** vast, zodat dit per scenario correct ingesteld kan worden. **Aanbeveling:** bepaal samen met een jurist/DPO welke rechtsgrond geldt per gebruiksscenario en stel de standaard daarop in.

### 3.5 Kritische gap-analyse GDPR

| AVG-vereiste | Status | Actie |
|---|---|---|
| Verwerkingsdoel vastgelegd (art. 5.1.b) | ✅ Gedekt | — |
| Rechtsgrond vastgelegd (art. 6) | ✅ Technisch gedekt | **Juridisch valideren per scenario** (3.4) |
| Bewijslast toestemming (art. 7) | ✅ Gedekt | — |
| Opslagbeperking / bewaartermijn (art. 5.1.e) | ✅ Gedekt | — |
| Recht op inzage & overdraagbaarheid (art. 15, 20) | ✅ Gedekt | — |
| Recht op intrekking (art. 7.3) | ✅ Gedekt | — |
| Recht op wissing / anonimisering (art. 17) | ✅ Gedekt | — |
| Dataminimalisatie (art. 5.1.c) | ✅ Grotendeels | Enkel strikt nodige velden worden gevraagd |
| **Privacyverklaring (extern document)** | 🔲 Op te stellen | Versie wordt al geregistreerd; de tekst zelf moet juridisch opgesteld worden |
| **Verwerkingsregister (art. 30)** | 🔲 Op te stellen | Organisatorisch document; data hiervoor is aanwezig |
| **Verwerkersovereenkomst / DPA (art. 28)** | 🔲 Op te stellen | Met afnemende organisaties én met hosting/betaalprovider |
| **DPIA (art. 35)** | ⚠️ Te beoordelen | Gedragsprofilering in arbeidscontext kan een DPIA vereisen |
| Beveiliging (art. 32) | ⚠️ Productie-afhankelijk | Versleuteling in transit/at rest, toegangsbeheer en logging definitief regelen bij livegang |
| Meldplicht datalekken (art. 33-34) | 🔲 Procedure | Interne procedure vastleggen |

### 3.6 Rol-kwalificatie (belangrijk voor de contracten)

- Wanneer een **organisatie** haar medewerkers laat profileren: die organisatie is wellicht **verwerkingsverantwoordelijke** en TaPasCity/2BQ CONSULT **verwerker** → een **verwerkersovereenkomst (DPA)** is dan verplicht.
- Wanneer TaPasCity zelf het doel en de middelen bepaalt (eigen aanbod): dan is TaPasCity zelf verwerkingsverantwoordelijke.
- Deze kwalificatie bepaalt welke contracten nodig zijn en moet per aanbiedingsvorm vastgelegd worden.

---

## 4. Prioritaire actielijst

**Vóór livegang (juridisch/fiscaal — extern):**
1. Btw-behandeling credits laten bevestigen door de boekhouder.
2. Rechtsgrond GDPR per scenario laten valideren (toestemming vs. gerechtvaardigd belang/overeenkomst).
3. Privacyverklaring, verwerkingsregister en DPA('s) laten opstellen.
4. Beoordelen of een DPIA vereist is.
5. Peppol-aansluiting administratief bevestigen.

**Volgende bouwronde (binnen het platform — intern):**
6. Maandelijkse KPI-snapshots voor trend- en cohortrapportage (RvB/investeerders).
7. Grootboekrekening-mapping in de boekhoudexport.
8. Btw-aangifte-overzicht per kwartaal (subtotalen per periode).
9. Beveiligingsmaatregelen (encryptie, toegangsbeheer, audit-logging) definitief vastleggen voor productie.

---

## 5. Resultaat doortest (na implementatie)

Alle nieuwe functies zijn na implementatie end-to-end getest — geslaagd:

| Test | Resultaat |
|---|---|
| Factuur aanmaken via betaling → bevestiging | ✅ Factuur `2BQ-2026-0001`, €250 excl. / €52,50 btw / €302,50 incl. |
| Creditnota aanmaken | ✅ `2BQ-CN-2026-0001`, negatieve spiegelbedragen, verwijst naar factuur |
| Dubbele creditnota op dezelfde factuur | ✅ Correct geweigerd (foutmelding) |
| Credits terugboeken via creditnota | ✅ Saldo correct teruggezet, correctie-grootboekregel aangemaakt |
| Peppol-document creditnota | ✅ Gestructureerd CreditNote-document |
| Bestuurs-KPI's | ✅ Omzet/klanten/credits/afnames/betalingen/GDPR allemaal correct |
| Boekhoudexport JSON + CSV | ✅ Beide met facturen én creditnota's; CSV opent correct in Excel (BOM + `;`) |
| GDPR data-export (art. 15/20) | ✅ Volledig pakket per betrokkene |
| Recht op intrekking toestemming | ✅ Geregistreerd met tijdstip |
| Bewaartermijn aanpassen | ✅ Werkt |
| Onomkeerbare anonimisering | ✅ Persoonsdata gewist, idempotent, KPI-schil behouden |
| Bestuur-tab — desktop / dark mode / mobiel (390px) | ✅ Correct en leesbaar in alle drie |
| Creditnota-knop & -kolom in Facturen-tab | ✅ Knop "Crediteren" + badge bij bestaande creditnota |

Het platform is live bijgewerkt en beschikbaar in de bijgevoegde preview.

---

*Bronnen geraadpleegd op 13 juni 2026. Dit document is een werk- en statusdocument en vervangt geen formeel fiscaal, boekhoudkundig of juridisch advies.*
