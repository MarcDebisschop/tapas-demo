-- ---------------------------------------------------------------------------
-- 0011_kwaliteit_evaluaties_organisatie: module Kwaliteit & Evaluaties,
-- stap organisatie-evaluatie (§7 van de bouwspecificatie).
--
-- AANLEIDING. Het platform kon nog geen enkele opleidingssessie laten
-- evalueren door de organisatie die ze inkocht. Deze migratie legt de zeven
-- tabellen aan die de organisatie-evaluatieflow nodig heeft: de
-- contactpersoon en coach als eigen entiteit, de opleidingssessie zelf, de
-- token-uitnodiging, de evaluatie (concept en ingediend), de individuele
-- antwoorden met een snapshot van de vraagtekst, en het kwaliteitssignaal.
--
-- STRIKT ADDITIEF. Alleen CREATE TABLE en CREATE INDEX, allemaal met
-- IF NOT EXISTS. Geen ALTER, geen DROP, geen herbouw van een bestaande
-- tabel. Elke regel kan zonder fout een tweede keer lopen. Deze migratie
-- raakt geen enkele bestaande tabel of rij.
--
-- NAAMGEVING EN BOTSING. Het prefix `kwaliteit_` is al bezet door de
-- bestaande STM-module (server/stm/schema.ts: kwaliteit_normen,
-- kwaliteit_overrides, kwaliteit_alerts, kwaliteit_maillog,
-- kwaliteit_notities). Deze module gebruikt daarom het prefix `evaluatie_`,
-- zodat er geen enkele botsing ontstaat met bestaande tabellen of routes.
--
-- ZELFDRAGEND. server/kwaliteit-evaluaties/storage.ts maakt deze tabellen
-- ook zelf aan bij het opstarten (CREATE TABLE IF NOT EXISTS, hetzelfde
-- huispatroon als server/t4organizations/storage.ts) zodat de module ook
-- zonder migratieloop bruikbaar is. Deze migratie bestaat om het
-- Drizzle-schema en de effectieve databank in lijn te houden en om de
-- tabellen aantoonbaar te maken in het migratiespoor (zie
-- tests/migraties-aanwezig.test.ts). Beide plaatsen definiëren dezelfde
-- kolommen; wie er één wijzigt, wijzigt de andere mee.
--
-- TOKENBEVEILIGING. Zelfde grondpatroon als server/magic-link.ts, met twee
-- bewuste verschillen: de geldigheid is hier UITNODIGING_GELDIG_DAGEN dagen
-- in plaats van enkele uren, en het token wordt pas bij INDIENEN als
-- gebruikt gemarkeerd, niet bij de eerste opening — tussentijds terugkeren
-- zonder dataverlies is een expliciete eis (§14.3).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `evaluatie_organisatie_contacten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisatie_id` integer NOT NULL,
	`naam` text NOT NULL,
	`email` text NOT NULL,
	`functie` text,
	`actief` integer DEFAULT true NOT NULL,
	`aangemaakt_op` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluatie_contacten_org` ON `evaluatie_organisatie_contacten` (`organisatie_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evaluatie_coaches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`email` text,
	`actief` integer DEFAULT true NOT NULL,
	`aangemaakt_op` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evaluatie_sessies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`organisatie_id` integer NOT NULL,
	`coach_id` integer,
	`start_datetime` text NOT NULL,
	`eind_datetime` text,
	`locatie` text,
	`taal` text DEFAULT 'nl' NOT NULL,
	`aantal_deelnemers_verwacht` integer,
	`aantal_deelnemers_werkelijk` integer,
	`bevestigde_doelstellingen` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'gepland' NOT NULL,
	`is_testdata` integer DEFAULT false NOT NULL,
	`aangemaakt_op` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluatie_sessies_org` ON `evaluatie_sessies` (`organisatie_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evaluatie_uitnodigingen` (
	`token` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'organisatie' NOT NULL,
	`sessie_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	`taal` text DEFAULT 'nl' NOT NULL,
	`verloopt_op` text NOT NULL,
	`ingewisseld_op` text,
	`ingetrokken_op` text,
	`aangemaakt_op` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluatie_uitnodigingen_sessie` ON `evaluatie_uitnodigingen` (`sessie_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evaluatie_organisatie_evaluaties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uitnodiging_token` text NOT NULL,
	`sessie_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`contact_id` integer NOT NULL,
	`taal` text DEFAULT 'nl' NOT NULL,
	`status` text DEFAULT 'concept' NOT NULL,
	`basisinfo_klopt` text,
	`basisinfo_toelichting` text,
	`score_passend` real,
	`score_professioneel` real,
	`score_activerend` real,
	`score_toepasbaar` real,
	`score_duurzaam` real,
	`score_totaal` real,
	`aanbevelingsscore` real,
	`signaal_niveau` text,
	`signaal_types` text,
	`signaal_beschrijving` text,
	`signaal_wil_contact` integer,
	`signaal_contact_naam` text,
	`signaal_contact_email` text,
	`signaal_contact_telefoon` text,
	`mag_contact_opnemen` integer,
	`is_testdata` integer DEFAULT false NOT NULL,
	`ingediend_op` text,
	`aangemaakt_op` text NOT NULL,
	`bijgewerkt_op` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_evaluatie_orgeval_token` ON `evaluatie_organisatie_evaluaties` (`uitnodiging_token`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluatie_orgeval_sessie` ON `evaluatie_organisatie_evaluaties` (`sessie_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evaluatie_antwoorden` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evaluatie_type` text DEFAULT 'organisatie' NOT NULL,
	`evaluatie_id` integer NOT NULL,
	`vraag_code` text NOT NULL,
	`vraag_tekst` text NOT NULL,
	`taal` text DEFAULT 'nl' NOT NULL,
	`numerieke_waarde` real,
	`tekst_waarde` text,
	`aangemaakt_op` text NOT NULL,
	`bijgewerkt_op` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_evaluatie_antwoorden_uniek` ON `evaluatie_antwoorden` (`evaluatie_type`,`evaluatie_id`,`vraag_code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `evaluatie_signalen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bron_type` text DEFAULT 'organisatie_evaluatie' NOT NULL,
	`bron_id` integer NOT NULL,
	`sessie_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`coach_id` integer,
	`ernst` text NOT NULL,
	`types` text DEFAULT '[]' NOT NULL,
	`beschrijving` text,
	`wil_contact` integer DEFAULT false NOT NULL,
	`contact_naam` text,
	`contact_email` text,
	`contact_telefoon` text,
	`status` text DEFAULT 'nieuw' NOT NULL,
	`aangemaakt_op` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_evaluatie_signalen_status` ON `evaluatie_signalen` (`status`);
