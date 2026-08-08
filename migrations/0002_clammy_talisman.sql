CREATE TABLE IF NOT EXISTS `traject_fasen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`volgnummer` integer NOT NULL,
	`naam` text NOT NULL,
	`poortomschrijving` text NOT NULL,
	`poortstatus` text DEFAULT 'gesloten' NOT NULL,
	`poort_geopend_op` integer,
	`poort_geopend_door_beheerder_id` integer,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`poort_geopend_door_beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_fasen_volgnummer_bereik" CHECK("traject_fasen"."volgnummer" BETWEEN 1 AND 9)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_fasen_traject` ON `traject_fasen` (`traject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_fasen_volgnummer` ON `traject_fasen` (`traject_id`,`volgnummer`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traject_gebeurtenissen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`lijn_id` integer NOT NULL,
	`tijdstip` integer NOT NULL,
	`soort` text NOT NULL,
	`vaststelling` text NOT NULL,
	`indruk` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lijn_id`) REFERENCES `traject_lijnen`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_gebeurtenissen_soort_geldig" CHECK("traject_gebeurtenissen"."soort" IN ('gesprek', 'bericht', 'rechtstreeks_contact'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_gebeurtenissen_lijn_tijdstip` ON `traject_gebeurtenissen` (`lijn_id`,`tijdstip`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traject_lijnen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`partij_een_id` integer NOT NULL,
	`partij_twee_id` integer NOT NULL,
	`stiltedrempel_dagen` integer NOT NULL,
	`aangemaakt_op` integer NOT NULL,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partij_een_id`) REFERENCES `traject_partijen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partij_twee_id`) REFERENCES `traject_partijen`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_lijnen_partijvolgorde" CHECK("traject_lijnen"."partij_een_id" < "traject_lijnen"."partij_twee_id"),
	CONSTRAINT "traject_lijnen_stiltedrempel" CHECK("traject_lijnen"."stiltedrempel_dagen" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_lijnen_traject` ON `traject_lijnen` (`traject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_lijnen_partijen` ON `traject_lijnen` (`traject_id`,`partij_een_id`,`partij_twee_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traject_partijen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`soort` text NOT NULL,
	`naam` text NOT NULL,
	`ankerpunt` text NOT NULL,
	`kring` integer NOT NULL,
	`rol` text NOT NULL,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_partijen_kring_bereik" CHECK("traject_partijen"."kring" BETWEEN 0 AND 4)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_partijen_traject` ON `traject_partijen` (`traject_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traject_vragen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`lijn_id` integer NOT NULL,
	`vrager_partij_id` integer NOT NULL,
	`ontvanger_partij_id` integer NOT NULL,
	`werkstroom_id` integer NOT NULL,
	`vraagtekst` text NOT NULL,
	`kader` text NOT NULL,
	`antwoordtermijn_op` integer NOT NULL,
	`antwoord_kring` integer NOT NULL,
	`toestand` text DEFAULT 'gesteld' NOT NULL,
	`vrijgave_vrager_door_beheerder_id` integer,
	`vrijgave_ontvanger_door_beheerder_id` integer,
	`vrijgave_vrager_op` integer,
	`vrijgave_ontvanger_op` integer,
	`aangemaakt_op` integer NOT NULL,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lijn_id`) REFERENCES `traject_lijnen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vrager_partij_id`) REFERENCES `traject_partijen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ontvanger_partij_id`) REFERENCES `traject_partijen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`werkstroom_id`) REFERENCES `traject_werkstromen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vrijgave_vrager_door_beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vrijgave_ontvanger_door_beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_vragen_antwoordkring_bereik" CHECK("traject_vragen"."antwoord_kring" BETWEEN 0 AND 4),
	CONSTRAINT "traject_vragen_toestand_geldig" CHECK("traject_vragen"."toestand" IN ('gesteld', 'erkend', 'in_behandeling', 'beantwoord', 'gedeeld'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_vragen_traject` ON `traject_vragen` (`traject_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_vragen_lijn` ON `traject_vragen` (`lijn_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traject_werkstromen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`naam` text NOT NULL,
	`leider_partij_id` integer,
	`status` text DEFAULT 'niet_gestart' NOT NULL,
	`eerstvolgende_oplevering` text,
	`eerstvolgende_oplevering_op` text,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`leider_partij_id`) REFERENCES `traject_partijen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_werkstromen_traject` ON `traject_werkstromen` (`traject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_werkstromen_naam` ON `traject_werkstromen` (`traject_id`,`naam`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traject` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`organisatie_id` integer NOT NULL,
	`aangemaakt_door_beheerder_id` integer NOT NULL,
	`huidige_fase` integer DEFAULT 1 NOT NULL,
	`zekerheidstrap` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`aangemaakt_op` integer NOT NULL,
	FOREIGN KEY (`organisatie_id`) REFERENCES `organisaties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door_beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_huidige_fase_bereik" CHECK("traject"."huidige_fase" BETWEEN 1 AND 9),
	CONSTRAINT "traject_zekerheidstrap_bereik" CHECK("traject"."zekerheidstrap" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_organisatie` ON `traject` (`organisatie_id`);