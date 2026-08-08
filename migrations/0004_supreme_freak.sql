-- Voegt aan de gebeurtenissen van een traject de auteur toe: de persoon die de
-- gebeurtenis vastlegde. De kolom mag leeg blijven, want de rijen van voor deze
-- migratie hebben geen bekende auteur, en een beheerder die zelf geen persoon in
-- het traject is heeft er ook geen.
--
-- Met de hand nagekeken en herschreven. De generator leverde een enkele regel
-- "ALTER TABLE ... ADD ...". Die regel breekt bij een tweede loop, want SQLite
-- kent geen "IF NOT EXISTS" bij het toevoegen van een kolom en weigert dan met
-- "duplicate column name". Daarom bouwt deze migratie de tabel opnieuw op met de
-- kolom erin. Elke regel hieronder kan zonder fout een tweede keer lopen: de
-- hulptabel wordt eerst weggehaald wanneer ze nog zou bestaan, de rijen worden
-- overgezet met de kolommen die in beide gevallen bestaan, en de index wordt met
-- "IF NOT EXISTS" hersteld. Met de hand nagemeten op een kopie van de databank:
-- na een eerste en na een tweede loop staan dezelfde negen rijen in de tabel, met
-- de kolom en de index erbij, en de sleutelcontrole blijft schoon.
--
-- Een grens die eerlijk vermeld moet worden. Loopt iemand dit bestand een tweede
-- keer rechtstreeks over een databank waarin al auteurs zijn vastgelegd, dan
-- blijven alle rijen staan maar komt die auteur opnieuw leeg te staan, want de
-- overzetregel kan een kolom niet noemen die bij de eerste loop nog niet bestond.
-- In dit project loopt een migratie uitsluitend via het migratiedagboek, en dat
-- dagboek slaat een reeds toegepaste migratie over, dus die grens wordt in de
-- praktijk niet geraakt.
--
-- Twee zaken zijn met opzet zo en niet anders. De controlebeperking op "soort"
-- houdt haar naam en haar inhoud, maar noemt de tabel niet meer bij naam, want
-- tijdens de opbouw draagt de tabel nog haar werknaam. En de rijen worden
-- overgezet met een uitdrukkelijke kolomlijst en niet met een sterretje, zodat
-- een latere kolom deze migratie niet stil kan verschuiven.
DROP TABLE IF EXISTS `traject_gebeurtenissen_met_auteur`;
--> statement-breakpoint
CREATE TABLE `traject_gebeurtenissen_met_auteur` (
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
	CONSTRAINT "traject_gebeurtenissen_soort_geldig" CHECK("soort" IN ('gesprek', 'bericht', 'rechtstreeks_contact'))
);
--> statement-breakpoint
INSERT INTO `traject_gebeurtenissen_met_auteur`
	(`id`, `traject_id`, `lijn_id`, `tijdstip`, `soort`, `vaststelling`, `indruk`)
SELECT `id`, `traject_id`, `lijn_id`, `tijdstip`, `soort`, `vaststelling`, `indruk`
FROM `traject_gebeurtenissen`;
--> statement-breakpoint
DROP TABLE `traject_gebeurtenissen`;
--> statement-breakpoint
ALTER TABLE `traject_gebeurtenissen_met_auteur` RENAME TO `traject_gebeurtenissen`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_traject_gebeurtenissen_lijn_tijdstip` ON `traject_gebeurtenissen` (`lijn_id`,`tijdstip`);
