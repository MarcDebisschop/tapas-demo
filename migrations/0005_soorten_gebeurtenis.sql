-- Verruimt de toegelaten soorten van een gebeurtenis.
--
-- Aanleiding. Het scherm van de Regiekamer toont vier soorten: Gesprek,
-- Bericht, Overleg en Vaststelling. De databank liet er tot hier drie toe:
-- gesprek, bericht en rechtstreeks_contact. Twee van de vier soorten die het
-- scherm kent konden dus niet weggeschreven worden, en de soort die de databank
-- wel toeliet had op het scherm geen vertaling. Deze migratie heft die breuk op
-- aan de kant van de databank.
--
-- Vijf waarden en niet vier. De soort rechtstreeks_contact blijft toegelaten.
-- Reden: er kunnen rijen bestaan die haar dragen, en een beperking die een
-- bestaande rij niet meer toelaat laat de herbouw hieronder falen op de regel
-- die de rijen overzet. Het scherm biedt haar niet langer aan; ze blijft
-- uitsluitend leesbaar voor wat er al staat.
--
-- Herbouw en niet ALTER. SQLite kan een controlebeperking niet wijzigen, dus de
-- tabel wordt opnieuw opgebouwd. Dit volgt regel voor regel het patroon van
-- migratie 0004, dat voor deze tabel al een keer met de hand is nagemeten.
--
-- Elke regel kan zonder fout een tweede keer lopen: de hulptabel wordt eerst
-- weggehaald wanneer ze nog zou bestaan, en de index wordt met IF NOT EXISTS
-- hersteld.
--
-- Een grens die migratie 0004 eerlijk moest vermelden, bestaat hier niet meer.
-- Die migratie kon de auteur bij een tweede rechtstreekse loop niet meenemen,
-- omdat de kolom bij de eerste loop nog niet bestond. Nu bestaat ze wel en staat
-- ze uitdrukkelijk in de kolomlijst hieronder, dus geen enkele auteur gaat bij
-- een herhaalde loop verloren.
--
-- Twee zaken zijn met opzet zo en niet anders, gelijk aan 0004. De
-- controlebeperking houdt haar naam en noemt de tabel niet bij naam, want
-- tijdens de opbouw draagt de tabel nog haar werknaam. En de rijen worden
-- overgezet met een uitdrukkelijke kolomlijst en niet met een sterretje, zodat
-- een latere kolom deze migratie niet stil kan verschuiven.
DROP TABLE IF EXISTS `traject_gebeurtenissen_ruimere_soorten`;
--> statement-breakpoint
CREATE TABLE `traject_gebeurtenissen_ruimere_soorten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`lijn_id` integer NOT NULL,
	`tijdstip` integer NOT NULL,
	`soort` text NOT NULL,
	`vaststelling` text NOT NULL,
	`indruk` text DEFAULT '' NOT NULL,
	`vastgelegd_door_persoon_id` integer,
	FOREIGN KEY (`traject_id`) REFERENCES `traject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lijn_id`) REFERENCES `traject_lijnen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vastgelegd_door_persoon_id`) REFERENCES `traject_personen`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "traject_gebeurtenissen_soort_geldig" CHECK("soort" IN ('gesprek', 'bericht', 'overleg', 'vaststelling', 'rechtstreeks_contact'))
);
--> statement-breakpoint
INSERT INTO `traject_gebeurtenissen_ruimere_soorten`
	(`id`, `traject_id`, `lijn_id`, `tijdstip`, `soort`, `vaststelling`, `indruk`, `vastgelegd_door_persoon_id`)
SELECT `id`, `traject_id`, `lijn_id`, `tijdstip`, `soort`, `vaststelling`, `indruk`, `vastgelegd_door_persoon_id`
FROM `traject_gebeurtenissen`;
--> statement-breakpoint
DROP TABLE `traject_gebeurtenissen`;
--> statement-breakpoint
ALTER TABLE `traject_gebeurtenissen_ruimere_soorten` RENAME TO `traject_gebeurtenissen`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_gebeurtenissen_lijn_tijdstip` ON `traject_gebeurtenissen` (`lijn_id`,`tijdstip`);
