-- ---------------------------------------------------------------------------
-- 0007_beslisuitkomsten — het beslisvocabulaire gelijktrekken met het draaiboek
--
-- AANLEIDING. Migratie 0006 liet vijf uitkomsten toe: 'bekrachtigd',
-- 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'herkansing' en
-- 'niet_bekrachtigd'. Draaiboek §5.3 noemt vijf andere: Bekrachtigd,
-- Bekrachtigd met aandachtspunt, Voorwaardelijk bekrachtigd, Opgeschort en
-- Beëindigd. Voor dat verschil stond nergens een reden opgeschreven; een
-- zoekopdracht over de module en de documentatie leverde alleen de drie regels
-- op waar de lijst zelf staat.
--
-- WAAROM HET DRAAIBOEK VOORGAAT. Drie feiten.
--
--   1. 'herkansing' staat al in RONDESOORTEN als soort ronde. Hetzelfde woord
--      ook als beslisuitkomst gebruiken maakt van twee verschillende dingen één
--      term, en juist bij een bezwaar moet ondubbelzinnig zijn wat er besloten
--      is en wat er daarna is georganiseerd.
--   2. 'niet_bekrachtigd' komt in het draaiboek niet voor. Het draaiboek
--      verbiedt uitdrukkelijk de woorden gezakt, afgekeurd en onvoldoende; een
--      term die de bekrachtiging letterlijk ontkent, ligt in datzelfde register.
--   3. 'opgeschort' en 'beeindigd' staan al in LICENTIESTATUSSEN, en
--      'opgeschort' staat niet in STATUSSEN_MET_AFNAMERECHT. Het gevolg dat het
--      draaiboek bij Opgeschort beschrijft — geen nieuwe vragenlijsten — is
--      daarmee al technisch geregeld. Eén woord voor één ding.
--
-- WAAROM DIT NU KAN. Alle veertien tabellen van 0006 zijn leeg en de module is
-- nog niet uitgeleverd. Een correctie kost op dit moment niets. Later kost ze
-- een migratie plus elke beslissing die er inmiddels onder is genomen.
--
-- WAAROM DE TABEL WORDT HERBOUWD. SQLite kan een CHECK niet wijzigen met ALTER
-- TABLE. De enige weg is de tabel opnieuw opbouwen. Dat gebeurt hier met een
-- lege tabel, dus zonder gegevensverlies; de INSERT ... SELECT staat er toch,
-- zodat dit bestand ook correct is op een installatie waar toch al iets stond.
--
-- WAAROM ER GEEN PRAGMA foreign_keys IN DIT BESTAND STAAT. Een eerste versie
-- begon met PRAGMA foreign_keys = OFF en eindigde met = ON, zoals de handleiding
-- van SQLite bij een tabelherbouw voorschrijft. Die twee regels zijn eruit
-- gehaald omdat ze hier NIETS DOEN: server/migratieloper.ts voert elk
-- migratiebestand uit binnen db.transaction(), en PRAGMA foreign_keys is binnen
-- een transactie een no-op. Ze zouden een veiligheid suggereren die er niet is.
--
-- Wat de herbouw dan wel veilig maakt, is nagegaan en niet aangenomen:
--
--   1. GEEN ENKELE tabel verwijst naar bekwaamheid_beslissingen. Nagegaan met
--      een zoekopdracht op REFERENCES `bekwaamheid_beslissingen` over alle acht
--      migratiebestanden: nul treffers. DROP TABLE kan dus geen verwijzing
--      breken. De vijftien vreemde sleutels in 0006 wijzen allemaal de andere
--      kant op.
--   2. De uitgaande sleutel naar bekwaamheid_rondes wordt in de nieuwe tabel
--      identiek opnieuw opgeschreven.
--   3. De loper draait vóór borgDatabankIntegriteit() (server/storage.ts, regel
--      119 tegenover 1614), en die functie zet PRAGMA foreign_keys = ON. Tijdens
--      de migratie staat de handhaving dus uit, en erna aan.
--   4. Het geheel zit in één transactie: valt een stap, dan valt alles terug.
--
-- WAT DE MACHINE MAG VOORSTELLEN. De CHECK laat alle vijf de uitkomsten toe voor
-- zowel het voorstel als de definitieve beslissing, maar 'beeindigd' is voor de
-- machine niet berekenbaar: dat vereist twee mislukte herkansingen, weigering of
-- een integriteitsbreuk, en dat zijn menselijke feiten die niet in asscores
-- zitten. Dat 'beeindigd' nooit als voorstel uit de machine komt, wordt niet hier
-- afgedwongen maar in server/bekwaamheid/beslisregels.ts, met een eigen test. Een
-- CHECK op de kolom zou het onmogelijk maken dat een mens het definitief
-- vaststelt, en dat moet juist wel kunnen.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bekwaamheid_beslissingen_nieuw` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL,
	`voorstel_uitkomst` text NOT NULL,
	`voorstel_berekening` text NOT NULL,
	`definitieve_uitkomst` text NOT NULL,
	`afwijking_motivering` text,
	`bekrachtiger_een_id` integer NOT NULL,
	`bekrachtiger_twee_id` integer NOT NULL,
	`bekrachtigd_op` text NOT NULL,
	`gepubliceerd_op` text,
	`debrief_op` text,
	`debrief_door` integer,
	FOREIGN KEY (`ronde_id`) REFERENCES `bekwaamheid_rondes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_beslissing_voorstel" CHECK("voorstel_uitkomst" IN ('bekrachtigd', 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'opgeschort', 'beeindigd')),
	CONSTRAINT "bekwaamheid_beslissing_definitief" CHECK("definitieve_uitkomst" IN ('bekrachtigd', 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'opgeschort', 'beeindigd')),
	CONSTRAINT "bekwaamheid_beslissing_bekrachtigers_verschillen" CHECK("bekrachtiger_een_id" <> "bekrachtiger_twee_id"),
	CONSTRAINT "bekwaamheid_beslissing_afwijking_gemotiveerd" CHECK("definitieve_uitkomst" = "voorstel_uitkomst"
          OR ("afwijking_motivering" IS NOT NULL AND length("afwijking_motivering") >= 40)),
	CONSTRAINT "bekwaamheid_beslissing_publicatie_na_debrief" CHECK("gepubliceerd_op" IS NULL OR "debrief_op" IS NOT NULL)
);

-- Voor de volledigheid: op een lege tabel kopieert dit nul rijen. De oude
-- waarden 'herkansing' en 'niet_bekrachtigd' worden NIET omgezet naar een nieuwe
-- term. Zou dat wel gebeuren, dan legde deze migratie een uitkomst vast die
-- niemand heeft besloten. Bestaan er toch rijen met een oude waarde, dan valt
-- deze migratie op de CHECK en dat is de juiste uitkomst: dan hoort er een mens
-- naar te kijken.
INSERT INTO `bekwaamheid_beslissingen_nieuw`
  (`id`, `ronde_id`, `voorstel_uitkomst`, `voorstel_berekening`,
   `definitieve_uitkomst`, `afwijking_motivering`, `bekrachtiger_een_id`,
   `bekrachtiger_twee_id`, `bekrachtigd_op`, `gepubliceerd_op`, `debrief_op`,
   `debrief_door`)
SELECT
   `id`, `ronde_id`, `voorstel_uitkomst`, `voorstel_berekening`,
   `definitieve_uitkomst`, `afwijking_motivering`, `bekrachtiger_een_id`,
   `bekrachtiger_twee_id`, `bekrachtigd_op`, `gepubliceerd_op`, `debrief_op`,
   `debrief_door`
FROM `bekwaamheid_beslissingen`;

DROP TABLE `bekwaamheid_beslissingen`;

ALTER TABLE `bekwaamheid_beslissingen_nieuw` RENAME TO `bekwaamheid_beslissingen`;

-- De index verdwijnt met de oude tabel en moet dus opnieuw. Zonder deze regel kon
-- er stil een tweede beslissing op dezelfde ronde komen te staan.
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_beslissing_ronde` ON `bekwaamheid_beslissingen` (`ronde_id`);
