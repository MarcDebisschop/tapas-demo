CREATE TABLE IF NOT EXISTS `traject_personen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`partij_id` integer,
	`naam` text NOT NULL,
	`email` text NOT NULL,
	`beheerder_id` integer,
	`deelnemer_id` integer,
	`actief` integer DEFAULT 1 NOT NULL,
	`aangemaakt_op` integer NOT NULL,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partij_id`) REFERENCES `traject_partijen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`deelnemer_id`) REFERENCES `deelnemers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_personen_actief_geldig" CHECK("traject_personen"."actief" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_personen_traject` ON `traject_personen` (`traject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_personen_email` ON `traject_personen` (`traject_id`,`email`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `traject_rollen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`persoon_id` integer NOT NULL,
	`rol` text NOT NULL,
	`werkstroom_id` integer,
	`toegekend_door_beheerder_id` integer NOT NULL,
	`toegekend_op` integer NOT NULL,
	`ingetrokken_op` integer,
	`ingetrokken_door_beheerder_id` integer,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`persoon_id`) REFERENCES `traject_personen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`werkstroom_id`) REFERENCES `traject_werkstromen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`toegekend_door_beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingetrokken_door_beheerder_id`) REFERENCES `beheerders`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_rollen_rol_geldig" CHECK("traject_rollen"."rol" IN ('facilitator', 'ankerpunt_investeerder', 'ankerpunt_onderneming', 'werkstroomleider', 'adviseur', 'overlegorgaan', 'betrokkene')),
	CONSTRAINT "traject_rollen_werkstroom_geldig" CHECK(("traject_rollen"."rol" = 'werkstroomleider' AND "traject_rollen"."werkstroom_id" IS NOT NULL) OR ("traject_rollen"."rol" <> 'werkstroomleider' AND "traject_rollen"."werkstroom_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_rollen_traject` ON `traject_rollen` (`traject_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_rollen_persoon` ON `traject_rollen` (`persoon_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_rollen_toekenning` ON `traject_rollen` (`traject_id`,`persoon_id`,`rol`,coalesce(`werkstroom_id`, 0)) WHERE "traject_rollen"."ingetrokken_op" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_rollen_facilitator` ON `traject_rollen` (`traject_id`) WHERE "traject_rollen"."rol" = 'facilitator' AND "traject_rollen"."ingetrokken_op" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_rollen_ankerpunt_investeerder` ON `traject_rollen` (`traject_id`) WHERE "traject_rollen"."rol" = 'ankerpunt_investeerder' AND "traject_rollen"."ingetrokken_op" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_rollen_ankerpunt_onderneming` ON `traject_rollen` (`traject_id`) WHERE "traject_rollen"."rol" = 'ankerpunt_onderneming' AND "traject_rollen"."ingetrokken_op" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_traject_rollen_werkstroomleider` ON `traject_rollen` (`traject_id`,`werkstroom_id`) WHERE "traject_rollen"."rol" = 'werkstroomleider' AND "traject_rollen"."ingetrokken_op" IS NULL;
