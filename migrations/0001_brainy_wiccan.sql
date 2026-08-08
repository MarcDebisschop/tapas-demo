CREATE TABLE IF NOT EXISTS `gdpr_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer,
	`actie` text NOT NULL,
	`afname_id` integer,
	`detail` text,
	`tijdstip` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_gdpr_audit_afname` ON `gdpr_audit_log` (`afname_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `prive_aankoop` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`betaling_id` integer NOT NULL,
	`instrument_id` text NOT NULL,
	`intake` text NOT NULL,
	`factuur_id` integer,
	`aangemaakt_op` text NOT NULL,
	`bewaartot` text,
	`geanonimiseerd_op` text,
	`consent_versie` text,
	`consent_ip` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kwaliteit_alerts` (
	`beheerder_id` integer PRIMARY KEY NOT NULL,
	`trap1_sent` integer DEFAULT 0 NOT NULL,
	`trap2_sent` integer DEFAULT 0 NOT NULL,
	`trap3_sent` integer DEFAULT 0 NOT NULL,
	`bijgewerkt_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kwaliteit_maillog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`beheerder_id` integer NOT NULL,
	`trap` integer NOT NULL,
	`naam` text NOT NULL,
	`email` text NOT NULL,
	`verstuurd_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_kwaliteit_maillog_beheerder` ON `kwaliteit_maillog` (`beheerder_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kwaliteit_normen` (
	`beheerder_id` integer PRIMARY KEY NOT NULL,
	`norm` integer NOT NULL,
	`bijgewerkt_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kwaliteit_notities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`beheerder_id` integer NOT NULL,
	`soort` text NOT NULL,
	`tekst` text NOT NULL,
	`opgelost` integer DEFAULT 0 NOT NULL,
	`aangemaakt_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_kwaliteit_notities_beheerder` ON `kwaliteit_notities` (`beheerder_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `kwaliteit_overrides` (
	`beheerder_id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`reden` text,
	`bijgewerkt_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stm_sessies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`beheerder_id` integer NOT NULL,
	`gestart_at` text NOT NULL,
	`afgerond_at` text,
	`score_totaal` real,
	`inschaling` text,
	`duur_seconden` integer,
	`scores_per_laag` text DEFAULT '{}' NOT NULL,
	`feedback` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_stm_sessies_beheerder` ON `stm_sessies` (`beheerder_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4sports_module_resultaten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`afname_id` integer NOT NULL,
	`module_id` text NOT NULL,
	`resultaat_json` text NOT NULL,
	`aangemaakt_at` text NOT NULL,
	UNIQUE(`afname_id`,`module_id`)
);
