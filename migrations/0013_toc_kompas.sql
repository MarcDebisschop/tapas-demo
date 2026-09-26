-- ---------------------------------------------------------------------------
-- 0013_toc_kompas: het TOC Commitmentkompas van het Team of Captains.
--
-- AANLEIDING. Het Commitmentkompas bestond enkel als Word-document. Deze
-- migratie legt de zes tabellen aan waarmee de vier Captains hun vragenlijst
-- digitaal invullen via een persoonlijke link, en waarmee de consolidatie,
-- het Commitment Register, de Coverage Matrix, het Decision Log en de
-- rapporten per kwartaal geborgd worden.
--
-- STRIKT ADDITIEF. Alleen CREATE TABLE, CREATE INDEX en CREATE TRIGGER, alles
-- met IF NOT EXISTS. Geen ALTER, geen DROP, geen herbouw van een bestaande
-- tabel. Elke regel kan zonder fout een tweede keer lopen. Deze migratie
-- raakt geen enkele bestaande tabel of rij.
--
-- ZELFDRAGEND. server/toc-kompas/storage.ts voert dezelfde definitie uit bij
-- het opstarten (server/toc-kompas/ddl.ts). De tekst hieronder is daar
-- letterlijk aan gelijk; tests/toc-kompas-migratie.test.ts bewaakt dat.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `toc_kompas_rondes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`periode` text NOT NULL,
	`deadline` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'INTAKE' NOT NULL CHECK (`status` IN ('INTAKE','CONSOLIDATIE','VASTGESTELD','AFGESLOTEN')),
	`owner_admin_id` integer NOT NULL,
	`vergrendeld_op` text,
	`vergrendel_reden` text,
	`coverage_json` text DEFAULT '[]' NOT NULL,
	`coverage_versie` integer DEFAULT 0 NOT NULL,
	`acceptatie_json` text DEFAULT '{}' NOT NULL,
	`acceptatie_versie` integer DEFAULT 0 NOT NULL,
	`vastgesteld_op` text,
	`vastgesteld_door_admin_id` integer,
	`vaststel_toelichting` text,
	`afgesloten_op` text,
	`afsluit_toelichting` text,
	`versie` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_toc_kompas_rondes_periode` ON `toc_kompas_rondes` (`periode`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `toc_kompas_captains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL REFERENCES `toc_kompas_rondes`(`id`),
	`rol` text NOT NULL CHECK (`rol` IN ('talent_innovation','execution_horizon','academy','visibility')),
	`naam` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`token_hash` text NOT NULL,
	`link_vernieuwd_op` text,
	`concept_json` text DEFAULT '{}' NOT NULL,
	`concept_versie` integer DEFAULT 0 NOT NULL,
	`concept_op` text,
	`laatste_indiening_id` integer,
	`ingediend_op` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_toc_kompas_captains_rol` ON `toc_kompas_captains` (`ronde_id`,`rol`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_toc_kompas_captains_token` ON `toc_kompas_captains` (`token_hash`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `toc_kompas_indieningen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL REFERENCES `toc_kompas_rondes`(`id`),
	`captain_id` integer NOT NULL REFERENCES `toc_kompas_captains`(`id`),
	`versie` integer NOT NULL,
	`antwoorden_json` text NOT NULL,
	`content_hash` text NOT NULL,
	`ingediend_op` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_toc_kompas_indieningen_versie` ON `toc_kompas_indieningen` (`captain_id`,`versie`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_toc_kompas_indieningen_onveranderlijk` BEFORE UPDATE ON `toc_kompas_indieningen`
BEGIN
	SELECT RAISE(ABORT, 'Een ingediende vragenlijst wordt niet gewijzigd.');
END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `toc_kompas_commitments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL REFERENCES `toc_kompas_rondes`(`id`),
	`code` text NOT NULL,
	`volgnummer` integer NOT NULL,
	`type` text NOT NULL CHECK (`type` IN ('delivery','bedrijfsleiding')),
	`owner_captain_id` integer NOT NULL REFERENCES `toc_kompas_captains`(`id`),
	`domein` text DEFAULT '' NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`deliverable` text DEFAULT '' NOT NULL,
	`baseline_target` text DEFAULT '' NOT NULL,
	`responsible` text DEFAULT '' NOT NULL,
	`consulted_informed` text DEFAULT '' NOT NULL,
	`deadline` text DEFAULT '' NOT NULL,
	`acceptatiebewijs` text DEFAULT '' NOT NULL,
	`capaciteit` text DEFAULT '' NOT NULL,
	`uren_per_week` real,
	`beslissingsrecht` text DEFAULT '' NOT NULL,
	`budget` text DEFAULT '' NOT NULL,
	`dependencies` text DEFAULT '' NOT NULL,
	`toprisico` text DEFAULT '' NOT NULL,
	`stopkeuze` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'groen' NOT NULL CHECK (`status` IN ('groen','amber','rood','geblokkeerd')),
	`status_toelichting` text DEFAULT '' NOT NULL,
	`heronderhandeling` text DEFAULT '' NOT NULL,
	`bron_indiening_id` integer,
	`created_by_admin_id` integer NOT NULL,
	`versie` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_toc_kompas_commitments_code` ON `toc_kompas_commitments` (`code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_toc_kompas_commitments_ronde` ON `toc_kompas_commitments` (`ronde_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `toc_kompas_besluiten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL REFERENCES `toc_kompas_rondes`(`id`),
	`datum` text NOT NULL,
	`onderwerp` text NOT NULL,
	`besluit` text NOT NULL,
	`beslisser` text NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`aannames` text DEFAULT '' NOT NULL,
	`gevolgen` text DEFAULT '' NOT NULL,
	`reviewmoment` text DEFAULT '' NOT NULL,
	`vervangt_besluit_id` integer,
	`vastgelegd_door_admin_id` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_toc_kompas_besluiten_ronde` ON `toc_kompas_besluiten` (`ronde_id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_toc_kompas_besluiten_onveranderlijk` BEFORE UPDATE ON `toc_kompas_besluiten`
BEGIN
	SELECT RAISE(ABORT, 'Een vastgelegd besluit wordt niet gewijzigd; leg een nieuw besluit vast dat het vervangt.');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_toc_kompas_besluiten_blijvend` BEFORE DELETE ON `toc_kompas_besluiten`
BEGIN
	SELECT RAISE(ABORT, 'Een vastgelegd besluit wordt niet verwijderd.');
END;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `toc_kompas_artefacten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ronde_id` integer NOT NULL REFERENCES `toc_kompas_rondes`(`id`),
	`captain_id` integer,
	`type` text NOT NULL,
	`versie` integer NOT NULL,
	`input_hash` text NOT NULL,
	`html` text NOT NULL,
	`pdf_base64` text,
	`created_by_admin_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_toc_kompas_artefacten_ronde` ON `toc_kompas_artefacten` (`ronde_id`,`type`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `trg_toc_kompas_artefacten_onveranderlijk` BEFORE UPDATE ON `toc_kompas_artefacten`
BEGIN
	SELECT RAISE(ABORT, 'Een rapportartefact wordt niet gewijzigd.');
END;
