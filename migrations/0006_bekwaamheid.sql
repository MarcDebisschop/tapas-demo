-- Voegt de veertien tabellen van de module Bekwaamheid toe.
--
-- Aanleiding. Het platform kon tot hier niet beantwoorden wie met welk
-- instrument mag werken. Wie geaccrediteerd was, stond als lijst met namen in
-- de code van een route; hoeveel afnames iemand deed, werd geteld op de
-- oefensessies in plaats van op de afnames; en er bestond geen enkele plaats
-- waar een licentie, een norm of een beslissing kon worden vastgelegd. Deze
-- migratie legt de tabellen aan die dat mogelijk maken. Ze verandert geen enkele
-- bestaande tabel en geen enkele bestaande rij.
--
-- Strikt additief. Alleen CREATE TABLE en CREATE INDEX, allemaal met
-- IF NOT EXISTS. Geen ALTER, geen DROP, geen herbouw van een bestaande tabel,
-- geen UPDATE. Elke regel kan zonder fout een tweede keer lopen. Wie deze
-- migratie terugdraait, verliest niets van wat er voordien stond.
--
-- Geen enkele rij wordt hier geschreven. Het overzetten van de bestaande
-- gegevens — het register en de accreditaties — gebeurt met een apart script dat
-- een droogloop kent, en niet in een migratie die stil bij het opstarten loopt.
-- Een migratie die persoonsgegevens verplaatst zonder dat iemand meekijkt, is
-- precies het soort handeling dat later niemand kan verantwoorden.
--
-- Waarom de controlebeperkingen in de tabel staan en niet alleen in de code. De
-- gesloten waardenlijsten staan ook in server/bekwaamheid/schema.ts. Die
-- herhaling is geen dubbelwerk: de eerste vorm beschermt de code, de tweede
-- beschermt de databank tegen code die er ooit langsheen gaat — een script, een
-- console, een latere route die de lijst niet kent.
--
-- Twee beloften uit het draaiboek staan hieronder als controlebeperking en niet
-- als afspraak. Een uitslag kan niet gepubliceerd worden zolang de debrief niet
-- is gebeurd (bekwaamheid_beslissingen, bekwaamheid_tussentijdse_toetsen), en
-- de twee bekrachtigers van een beslissing moeten verschillen.
--
-- Namen. De tabelnaam `licenties` was in shared/schema.ts al bezet door de
-- commerciële licenties van T4Recruitment. Vandaar de volledige prefix
-- `bekwaamheid_` op alle veertien tabellen, ook waar dat lang wordt.
CREATE TABLE IF NOT EXISTS `bekwaamheid_geaccrediteerden` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`beheerder_id` integer,
	`coach_register_id` integer,
	`naam` text NOT NULL,
	`email` text,
	`landcode` text DEFAULT 'BE' NOT NULL,
	`taal` text DEFAULT 'nl' NOT NULL,
	`is_trainer` integer DEFAULT false NOT NULL,
	`actief` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_geaccrediteerde_landcode" CHECK(length("landcode") = 2),
	-- Het e-mailadres mag ontbreken: van een deel van de geaccrediteerden staat in
	-- het coachregister geen adres, en een adres verzinnen om een kolomeis te halen
	-- is precies hoe er negentien niet-bestaande adressen in de broncode terecht
	-- zijn gekomen. Maar iemand zonder adres én zonder koppeling naar een beheerder
	-- of naar het coachregister is niet identificeerbaar, en zo iemand hoort niet in
	-- een register te staan. Minstens één van de drie sleutels is verplicht.
	CONSTRAINT "bekwaamheid_geaccrediteerde_identificeerbaar" CHECK(
		"email" IS NOT NULL OR "beheerder_id" IS NOT NULL OR "coach_register_id" IS NOT NULL
	),
	CONSTRAINT "bekwaamheid_geaccrediteerde_email_niet_leeg" CHECK(
		"email" IS NULL OR length(trim("email")) > 0
	)
);
--> statement-breakpoint
-- Gedeeltelijk uniek: twee mensen mogen nooit hetzelfde adres hebben, maar
-- meerdere mensen mogen wel géén adres hebben.
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_geaccrediteerde_email` ON `bekwaamheid_geaccrediteerden` (`email`) WHERE `email` IS NOT NULL;
--> statement-breakpoint
-- Tweede sleutel voor wie geen adres heeft: de rij in het coachregister.
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_geaccrediteerde_coachregister` ON `bekwaamheid_geaccrediteerden` (`coach_register_id`) WHERE `coach_register_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_geaccrediteerde_beheerder` ON `bekwaamheid_geaccrediteerden` (`beheerder_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_accreditaties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`geaccrediteerde_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`niveau` integer NOT NULL,
	`behaald_op` text NOT NULL,
	`opleiding_id` integer,
	`bewijs_herkomst` text NOT NULL,
	`ingetrokken_op` text,
	`ingetrokken_reden` text,
	FOREIGN KEY (`geaccrediteerde_id`) REFERENCES `bekwaamheid_geaccrediteerden`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_accreditatie_herkomst" CHECK("bewijs_herkomst" IN ('academy', 'historisch', 'handmatig')),
	CONSTRAINT "bekwaamheid_accreditatie_intrekking_volledig" CHECK(("ingetrokken_op" IS NULL AND "ingetrokken_reden" IS NULL)
          OR ("ingetrokken_op" IS NOT NULL AND "ingetrokken_reden" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_accreditatie_persoon` ON `bekwaamheid_accreditaties` (`geaccrediteerde_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_accreditatie_instrument` ON `bekwaamheid_accreditaties` (`geaccrediteerde_id`,`instrument_id`,`niveau`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_normprofielen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`versie` integer NOT NULL,
	`weging` text NOT NULL,
	`drempel_totaal` real NOT NULL,
	`drempel_per_as` text NOT NULL,
	`activiteitsdrempel` integer NOT NULL,
	`activiteitsvenster_maanden` integer NOT NULL,
	`methode` text NOT NULL,
	`paneel_omschrijving` text NOT NULL,
	`vastgesteld_op` text NOT NULL,
	`vastgesteld_door` text NOT NULL,
	`bevroren_op` text,
	`onderbouwing` text NOT NULL,
	CONSTRAINT "bekwaamheid_normprofiel_versie_positief" CHECK("versie" >= 1),
	CONSTRAINT "bekwaamheid_normprofiel_drempel_bereik" CHECK("drempel_totaal" > 0 AND "drempel_totaal" <= 1),
	CONSTRAINT "bekwaamheid_normprofiel_onderbouwing_lengte" CHECK(length("onderbouwing") >= 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_normprofiel_versie` ON `bekwaamheid_normprofielen` (`instrument_id`,`versie`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_licenties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`geaccrediteerde_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`status` text NOT NULL,
	`geldig_van` text NOT NULL,
	`geldig_tot` text,
	`laatste_bekrachtiging` text,
	`volgende_bekrachtiging` text,
	`volgende_tussentijdse_toets` text,
	`alert_actief` integer DEFAULT false NOT NULL,
	`voorwaarde_tekst` text,
	`voorwaarde_voor` text,
	`bron_beslissing_id` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`geaccrediteerde_id`) REFERENCES `bekwaamheid_geaccrediteerden`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_licentie_status" CHECK("status" IN ('bekrachtigd', 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'slapend', 'opgeschort', 'beeindigd', 'overgangsperiode')),
	CONSTRAINT "bekwaamheid_licentie_voorwaarde_volledig" CHECK("status" <> 'voorwaardelijk'
          OR ("voorwaarde_tekst" IS NOT NULL AND "voorwaarde_voor" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_licentie_instrument` ON `bekwaamheid_licenties` (`geaccrediteerde_id`,`instrument_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_licentie_status` ON `bekwaamheid_licenties` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_licentie_volgende_toets` ON `bekwaamheid_licenties` (`volgende_tussentijdse_toets`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_rondes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`geaccrediteerde_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`normprofiel_id` integer NOT NULL,
	`soort` text NOT NULL,
	`codenummer` text NOT NULL,
	`fase` text DEFAULT 'voorbereiding' NOT NULL,
	`geopend_op` text NOT NULL,
	`venster_tot` text NOT NULL,
	`afgerond_op` text,
	`aanpassingen` text,
	`aanpassingen_reden` text,
	`notitie_intern` text,
	`verwerkingsdoel` text DEFAULT 'bekwaamheidsbeoordeling' NOT NULL,
	`rechtsgrond` text DEFAULT 'overeenkomst' NOT NULL,
	`privacyverklaring_versie` text,
	FOREIGN KEY (`geaccrediteerde_id`) REFERENCES `bekwaamheid_geaccrediteerden`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`normprofiel_id`) REFERENCES `bekwaamheid_normprofielen`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_ronde_soort" CHECK("soort" IN ('nulmeting', 'bekrachtiging', 'herkansing', 'reactivatie')),
	CONSTRAINT "bekwaamheid_ronde_fase" CHECK("fase" IN ('voorbereiding', 'open', 'ingeleverd', 'in_beoordeling', 'beslissing_voorstel', 'overleg', 'beslist', 'gedebrieft', 'afgesloten', 'bezwaar', 'gestaakt'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_ronde_codenummer` ON `bekwaamheid_rondes` (`codenummer`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_ronde_persoon` ON `bekwaamheid_rondes` (`geaccrediteerde_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_ronde_fase` ON `bekwaamheid_rondes` (`fase`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`as` text NOT NULL,
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
	CONSTRAINT "bekwaamheid_item_gebruik" CHECK("gebruik" IN ('oefenen', 'meten', 'verbrand'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_item_instrument` ON `bekwaamheid_items` (`instrument_id`,`as`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_item_gebruik` ON `bekwaamheid_items` (`gebruik`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_bewijsstukken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL,
	`nummer` integer NOT NULL,
	`as` text NOT NULL,
	`weging` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`ruwe_score` real,
	`itemset_id` integer,
	`route` text,
	`opname_verklaring` integer DEFAULT false NOT NULL,
	`ingeleverd_op` text,
	`beoordeeld_op` text,
	FOREIGN KEY (`ronde_id`) REFERENCES `bekwaamheid_rondes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_bewijsstuk_nummer_bereik" CHECK("nummer" BETWEEN 1 AND 5),
	CONSTRAINT "bekwaamheid_bewijsstuk_as" CHECK("as" IN ('weten', 'zien', 'zeggen', 'zorgen')),
	CONSTRAINT "bekwaamheid_bewijsstuk_status" CHECK("status" IN ('open', 'ingeleverd', 'beoordeeld', 'nvt')),
	CONSTRAINT "bekwaamheid_bewijsstuk_route" CHECK("route" IS NULL OR "route" IN ('simulatie', 'eigen_opname')),
	CONSTRAINT "bekwaamheid_bewijsstuk_score_bereik" CHECK("ruwe_score" IS NULL OR ("ruwe_score" >= 0 AND "ruwe_score" <= 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_bewijsstuk_nummer` ON `bekwaamheid_bewijsstukken` (`ronde_id`,`nummer`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_itemsets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL,
	`bewijsstuk_nummer` integer NOT NULL,
	`item_ids` text NOT NULL,
	`antwoorden` text,
	`item_tijden` text,
	`samengesteld_op` text NOT NULL,
	FOREIGN KEY (`ronde_id`) REFERENCES `bekwaamheid_rondes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_itemset_bewijsstuk_bereik" CHECK("bewijsstuk_nummer" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_itemset_bewijsstuk` ON `bekwaamheid_itemsets` (`ronde_id`,`bewijsstuk_nummer`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bewijsstuk_id` integer NOT NULL,
	`beoordelaar_id` integer NOT NULL,
	`onderdeel` text NOT NULL,
	`score` integer NOT NULL,
	`onderbouwing` text NOT NULL,
	`ingevoerd_op` text NOT NULL,
	`is_kalibratie` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`bewijsstuk_id`) REFERENCES `bekwaamheid_bewijsstukken`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_score_onderbouwing_lengte" CHECK(length("onderbouwing") >= 40)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_score_bewijsstuk` ON `bekwaamheid_scores` (`bewijsstuk_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_score_invoer` ON `bekwaamheid_scores` (`bewijsstuk_id`,`beoordelaar_id`,`onderdeel`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_beslissingen` (
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
	CONSTRAINT "bekwaamheid_beslissing_voorstel" CHECK("voorstel_uitkomst" IN ('bekrachtigd', 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'herkansing', 'niet_bekrachtigd')),
	CONSTRAINT "bekwaamheid_beslissing_definitief" CHECK("definitieve_uitkomst" IN ('bekrachtigd', 'bekrachtigd_met_aandachtspunt', 'voorwaardelijk', 'herkansing', 'niet_bekrachtigd')),
	CONSTRAINT "bekwaamheid_beslissing_bekrachtigers_verschillen" CHECK("bekrachtiger_een_id" <> "bekrachtiger_twee_id"),
	CONSTRAINT "bekwaamheid_beslissing_afwijking_gemotiveerd" CHECK("definitieve_uitkomst" = "voorstel_uitkomst"
          OR ("afwijking_motivering" IS NOT NULL AND length("afwijking_motivering") >= 40)),
	CONSTRAINT "bekwaamheid_beslissing_publicatie_na_debrief" CHECK("gepubliceerd_op" IS NULL OR "debrief_op" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_beslissing_ronde` ON `bekwaamheid_beslissingen` (`ronde_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_tussentijdse_toetsen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`geaccrediteerde_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`licentie_id` integer NOT NULL,
	`peildatum` text NOT NULL,
	`venster_van` text NOT NULL,
	`venster_tot` text NOT NULL,
	`afnames_aantal` integer NOT NULL,
	`afnames_drempel` integer NOT NULL,
	`stm_sessies` integer NOT NULL,
	`stm_gemiddelde` real,
	`stm_per_laag` text,
	`signalen` text NOT NULL,
	-- Leeg tot een mens de uitkomst vaststelt. Zou hier de berekening al staan,
	-- dan draagt een voorbereide toets een uitkomst die niemand heeft vastgesteld,
	-- en dan is elke lezer die `vastgesteld_op` vergeet te controleren één
	-- vergissing verwijderd van een geautomatiseerd oordeel.
	`uitkomst` text,
	`berekende_uitkomst` text NOT NULL,
	`afwijking_motivering` text,
	`vastgesteld_door` integer,
	`vastgesteld_op` text,
	`besproken_op` text,
	`gepubliceerd_op` text,
	`coachingsplan_id` integer,
	FOREIGN KEY (`geaccrediteerde_id`) REFERENCES `bekwaamheid_geaccrediteerden`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`licentie_id`) REFERENCES `bekwaamheid_licenties`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_toets_uitkomst" CHECK("uitkomst" IS NULL OR "uitkomst" IN ('geen_signaal', 'aandachtspunt', 'alert')),
	CONSTRAINT "bekwaamheid_toets_berekend" CHECK("berekende_uitkomst" IN ('geen_signaal', 'aandachtspunt', 'alert')),
	-- Vaststellen en uitkomst gaan samen: het één zonder het ander laat niet zien
	-- wie er verantwoordelijk voor is.
	CONSTRAINT "bekwaamheid_toets_vaststelling_volledig" CHECK(("vastgesteld_op" IS NULL AND "uitkomst" IS NULL)
          OR ("vastgesteld_op" IS NOT NULL AND "uitkomst" IS NOT NULL)),
	CONSTRAINT "bekwaamheid_toets_afwijking_gemotiveerd" CHECK("uitkomst" IS NULL
          OR "uitkomst" = "berekende_uitkomst"
          OR ("afwijking_motivering" IS NOT NULL AND length("afwijking_motivering") >= 40)),
	CONSTRAINT "bekwaamheid_toets_publicatie_na_gesprek" CHECK("gepubliceerd_op" IS NULL OR "besproken_op" IS NOT NULL),
	CONSTRAINT "bekwaamheid_toets_alert_heeft_plan" CHECK("uitkomst" IS NULL
          OR "uitkomst" <> 'alert'
          OR "vastgesteld_op" IS NULL
          OR "coachingsplan_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_toets_persoon` ON `bekwaamheid_tussentijdse_toetsen` (`geaccrediteerde_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_toets_licentie` ON `bekwaamheid_tussentijdse_toetsen` (`licentie_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_coachingsplannen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`geaccrediteerde_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`tussentijdse_toets_id` integer NOT NULL,
	`aanleiding` text NOT NULL,
	`doel` text NOT NULL,
	`afspraken` text NOT NULL,
	`begeleider_id` integer,
	`opgesteld_op` text NOT NULL,
	`opgesteld_door` integer,
	`akkoord_geaccrediteerde_op` text,
	`evaluatie_op` text NOT NULL,
	`afgesloten_op` text,
	`uitkomst` text,
	FOREIGN KEY (`geaccrediteerde_id`) REFERENCES `bekwaamheid_geaccrediteerden`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tussentijdse_toets_id`) REFERENCES `bekwaamheid_tussentijdse_toetsen`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_plan_uitkomst" CHECK("uitkomst" IS NULL OR "uitkomst" IN ('opgelost', 'verlengd', 'meegenomen_naar_bekrachtiging')),
	CONSTRAINT "bekwaamheid_plan_afsluiting_volledig" CHECK(("afgesloten_op" IS NULL AND "uitkomst" IS NULL)
          OR ("afgesloten_op" IS NOT NULL AND "uitkomst" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_plan_persoon` ON `bekwaamheid_coachingsplannen` (`geaccrediteerde_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_plan_toets` ON `bekwaamheid_coachingsplannen` (`tussentijdse_toets_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_bezwaren` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL,
	`ingediend_op` text NOT NULL,
	`grond` text NOT NULL,
	`ontvangstbevestigd_op` text,
	`behandelaar_intern` integer,
	`behandelaar_extern_omschrijving` text,
	`uitspraak_op` text,
	`uitspraak` text,
	`uitspraak_motivering` text,
	`status_tijdens_bezwaar_ongewijzigd` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`ronde_id`) REFERENCES `bekwaamheid_rondes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_bezwaar_uitspraak" CHECK("uitspraak" IS NULL OR "uitspraak" IN ('gegrond', 'deels_gegrond', 'ongegrond')),
	CONSTRAINT "bekwaamheid_bezwaar_uitspraak_volledig" CHECK(("uitspraak" IS NULL AND "uitspraak_op" IS NULL)
          OR ("uitspraak" IS NOT NULL AND "uitspraak_op" IS NOT NULL
              AND "uitspraak_motivering" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_bezwaar_ronde` ON `bekwaamheid_bezwaren` (`ronde_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `bekwaamheid_agenda` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`geaccrediteerde_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`soort` text NOT NULL,
	`datum` text NOT NULL,
	`afgehandeld_op` text,
	`herinnering_verstuurd_op` text,
	FOREIGN KEY (`geaccrediteerde_id`) REFERENCES `bekwaamheid_geaccrediteerden`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bekwaamheid_agenda_soort" CHECK("soort" IN ('bekrachtiging_verwacht', 'tussentijdse_toets_verwacht', 'coachingsplan_evaluatie', 'voorwaarde_verloopt', 'venster_sluit', 'debrief_openstaand', 'bezwaartermijn', 'activiteit_onder_drempel'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_bekwaamheid_agenda_datum` ON `bekwaamheid_agenda` (`datum`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_bekwaamheid_agenda_post` ON `bekwaamheid_agenda` (`geaccrediteerde_id`,`instrument_id`,`soort`,`datum`);
