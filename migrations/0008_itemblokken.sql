-- ---------------------------------------------------------------------------
-- 0008_itemblokken — de kennischeckblokken in de itembank
--
-- AANLEIDING. Draaiboek §4.3 legt de kennischeck vast als veertig items in vijf
-- blokken met exacte aantallen: A Constructen 10, B Scoring en rapportlogica 6,
-- C Grenzen 8, D Interpretatiefouten herkennen 8, E Ethiek, consent en GDPR 8.
-- Bij die verdeling staat een reden die niet decoratief is: "Blok C en E zijn
-- samen 40% van de check. Dat is opzettelijk: de meeste schade in dit vak komt
-- niet van iets niet weten, maar van iets beweren wat je niet mag beweren."
--
-- Het schema uit bouwplan §6.6 kan die verdeling niet uitdrukken. De enige
-- inhoudelijke indeling op bekwaamheid_items is de kolom "as", en bewijsstuk 1
-- is volledig één as: WETEN. Alle veertig items van een kennischeck hebben
-- daarmee dezelfde waarde in de enige kolom die iets over inhoud zegt. Een
-- samensteller die uit die bank veertig items trekt, kan controleren dat het er
-- veertig zijn en dat ze alle veertig over WETEN gaan — en verder niets. Of blok
-- C erin zit, is voor de databank en voor de code niet vast te stellen.
--
-- WAAROM DIT EEN KOLOM WORDT EN GEEN AFSPRAAK. Drie overwogen wegen.
--
--   1. Alleen tellen op "as". Dan blijft de 40%-eis een instructie aan wie items
--      schrijft. Bouwplan §1073 noemt "de itembank blijft leeg" al als een van de
--      grootste risico's van dit project, met vulwerk dat "altijd naar achteren
--      schuift". Een eis die alleen in een document staat, is precies de eis die
--      onder tijdsdruk als eerste sneuvelt, en dan zonder spoor.
--   2. Het blok in bron_verwijzing zetten. Geen migratie nodig, maar dan betekent
--      één tekstveld twee dingen. Zulke velden lopen uiteen, en er is geen CHECK
--      op te zetten.
--   3. Een eigen kolom met CHECK. Dan kan de samensteller weigeren, en weigeren
--      is het enige dat een verdeling werkelijk afdwingt.
--
-- De derde weg is gekozen. De reden om het NU te doen is dezelfde als bij 0007:
-- de tabel is leeg en de module is niet uitgeleverd, dus de correctie kost op dit
-- moment niets. Nagemeten vóór deze migratie: bekwaamheid_items bevat nul rijen.
--
-- WAAROM DE KOLOM LEEG MAG ZIJN. De blokken A tot E zijn de indeling van de
-- kennischeck, niet van de itembank. Er kunnen items in de bank staan die geen
-- kennischeckitem zijn: oefenitems bij een ander bewijsstuk, items op de assen
-- ZIEN, ZEGGEN en ZORGEN. Die hebben geen blok, en een blok verzinnen om een
-- kolomeis te halen is hoe een schema zijn betekenis verliest. NULL betekent hier
-- precies één ding: dit item hoort niet in de blokstructuur van de kennischeck.
--
-- De samensteller van bewijsstuk 1 eist wél een blok. Dat is de juiste plaats
-- voor die eis: de bank mag ruimer zijn dan de check.
--
-- WAAROM EEN BLOK ALLEEN OP DE AS WETEN MAG. Blok D heet "Interpretatiefouten
-- herkennen" en blok E "Ethiek, consent en GDPR". Beide zijn kennisvragen; ze
-- horen bij WETEN omdat de kennischeck de meting van WETEN is. Een blok-D-item op
-- de as ZORGEN hoort nergens: het zou in geen enkele kennischeck terechtkomen en
-- toch meetellen als blokdekking. De tweede CHECK sluit die toestand uit in
-- plaats van erop te vertrouwen dat niemand hem maakt.
--
-- WAAROM DE TABEL WORDT HERBOUWD. SQLite kan met ALTER TABLE ADD COLUMN geen
-- kolom met een CHECK toevoegen. Herbouwen is de enige weg. Wat die herbouw hier
-- veilig maakt, is nagegaan en niet aangenomen:
--
--   1. GEEN ENKELE tabel verwijst naar bekwaamheid_items. Nagegaan met een
--      zoekopdracht op REFERENCES `bekwaamheid_items` over alle negen
--      migratiebestanden: nul treffers. De koppeling naar een gekozen item loopt
--      via bekwaamheid_itemsets.item_ids, een JSON-lijst zonder vreemde sleutel.
--      DROP TABLE kan dus geen verwijzing breken.
--   2. bekwaamheid_items heeft zelf geen uitgaande vreemde sleutels.
--   3. De twee indexen verdwijnen met de oude tabel en worden hieronder opnieuw
--      aangelegd. Zonder die regels was de bank stil langzamer geworden.
--   4. Het geheel zit in één transactie: valt een stap, dan valt alles terug.
--
-- Zoals bij 0007 staat er geen PRAGMA foreign_keys in dit bestand. De loper voert
-- elk migratiebestand uit binnen db.transaction(), en die pragma is binnen een
-- transactie een no-op; hem opschrijven zou een veiligheid suggereren die er niet
-- is.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bekwaamheid_items_nieuw` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`as` text NOT NULL,
	`blok` text,
	`soort` text NOT NULL,
	`stam` text NOT NULL,
	`opties` text,
	`sleutel` text NOT NULL,
	`toelichting_goed` text NOT NULL,
	`toelichting_fout` text NOT NULL,
	`gebruik` text DEFAULT 'oefenen' NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`actief` integer DEFAULT true NOT NULL,
	`p_waarde` real,
	`discriminatie` real,
	`bron_verwijzing` text,
	CONSTRAINT "bekwaamheid_item_as" CHECK("as" IN ('weten', 'zien', 'zeggen', 'zorgen')),
	CONSTRAINT "bekwaamheid_item_soort" CHECK("soort" IN ('scenario', 'meerkeuze', 'juistfout', 'open')),
	CONSTRAINT "bekwaamheid_item_gebruik" CHECK("gebruik" IN ('oefenen', 'meten', 'verbrand')),
	CONSTRAINT "bekwaamheid_item_blok" CHECK("blok" IS NULL OR "blok" IN ('A', 'B', 'C', 'D', 'E')),
	CONSTRAINT "bekwaamheid_item_blok_alleen_weten" CHECK("blok" IS NULL OR "as" = 'weten')
);

-- Op een lege tabel kopieert dit nul rijen. De nieuwe kolom krijgt NULL: geen
-- enkel bestaand item wordt in een blok geplaatst. Zou deze migratie een blok
-- toekennen — bijvoorbeeld alle weten-items in blok A — dan legde ze een indeling
-- vast die niemand heeft gemaakt, en de samensteller zou die indeling daarna als
-- feit behandelen. Wie een blok wil, kent het toe met een geregistreerde
-- handeling.
INSERT INTO `bekwaamheid_items_nieuw`
  (`id`, `instrument_id`, `as`, `blok`, `soort`, `stam`, `opties`, `sleutel`,
   `toelichting_goed`, `toelichting_fout`, `gebruik`, `versie`, `actief`,
   `p_waarde`, `discriminatie`, `bron_verwijzing`)
SELECT
   `id`, `instrument_id`, `as`, NULL, `soort`, `stam`, `opties`, `sleutel`,
   `toelichting_goed`, `toelichting_fout`, `gebruik`, `versie`, `actief`,
   `p_waarde`, `discriminatie`, `bron_verwijzing`
FROM `bekwaamheid_items`;

DROP TABLE `bekwaamheid_items`;

ALTER TABLE `bekwaamheid_items_nieuw` RENAME TO `bekwaamheid_items`;

-- Beide indexen opnieuw. De eerste is verruimd met blok: de samensteller vraagt
-- per instrument om items van één as in één blok met één gebruik, en dat is
-- precies deze reeks kolommen.
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_item_instrument` ON `bekwaamheid_items` (`instrument_id`,`as`,`blok`);
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_item_gebruik` ON `bekwaamheid_items` (`gebruik`);
