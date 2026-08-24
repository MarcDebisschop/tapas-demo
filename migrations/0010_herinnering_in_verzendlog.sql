-- ---------------------------------------------------------------------------
-- 0010_herinnering_in_verzendlog.sql
--
-- WAAROM. De belknop in het beheeroverzicht zette tot nu alleen een datum:
-- "herinnerd op". Er werd niets verstuurd. Wie op die knop drukte, dacht een
-- herinnering te versturen en deed dat niet. Nu verstuurt die knop werkelijk een
-- bericht, en dan hoort die verzendpoging in hetzelfde logboek als alle andere.
--
-- Een herinnering krijgt bewust een eigen soort en gaat niet als "uitnodiging"
-- het logboek in. Bij een klacht is precies dat het verschil dat je wil zien:
-- kreeg iemand een eerste uitnodiging, of een tweede bericht dat ook niet aankwam.
--
-- WAAROM DE TABEL WORDT HERBOUWD. De toegestane soorten staan in een CHECK, en
-- SQLite kan een CHECK niet wijzigen. De enige weg is: een nieuwe tabel met de
-- ruimere CHECK, de rijen overzetten, de oude weg, de nieuwe hernoemen. De
-- kolommen blijven exact dezelfde als in migratie 0009.
--
-- DIT BESTAND VERDRAAGT GEEN TWEEDE LOOP: het breekt de tabel af en bouwt haar
-- opnieuw op. De registerregel in server/migratieloper.ts kijkt daarom naar de
-- nieuwe toegestane waarde in de opgeslagen omschrijving van de tabel.
-- ---------------------------------------------------------------------------

CREATE TABLE `mail_verzendlog_nieuw` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tijdstip` text NOT NULL,
	`soort` text NOT NULL,
	`ontvanger` text NOT NULL,
	`afzender` text NOT NULL,
	`onderwerp` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`kanaal` text NOT NULL,
	`melding` text,
	`taal` text,
	`instrument` text,
	CONSTRAINT "mail_verzendlog_soort" CHECK("soort" IN ('uitnodiging', 'herinnering', 'toegangsmail', 'aanmeldlink', 'bericht')),
	CONSTRAINT "mail_verzendlog_status" CHECK("status" IN ('verstuurd', 'gesimuleerd', 'fout')),
	CONSTRAINT "mail_verzendlog_kanaal" CHECK("kanaal" IN ('brevo-api', 'smtp', 'geen'))
);

INSERT INTO `mail_verzendlog_nieuw`
	(`id`, `tijdstip`, `soort`, `ontvanger`, `afzender`, `onderwerp`, `status`, `kanaal`, `melding`, `taal`, `instrument`)
SELECT
	`id`, `tijdstip`, `soort`, `ontvanger`, `afzender`, `onderwerp`, `status`, `kanaal`, `melding`, `taal`, `instrument`
FROM `mail_verzendlog`;

DROP TABLE `mail_verzendlog`;

ALTER TABLE `mail_verzendlog_nieuw` RENAME TO `mail_verzendlog`;

CREATE INDEX IF NOT EXISTS `idx_mail_verzendlog_tijdstip` ON `mail_verzendlog` (`tijdstip`);
CREATE INDEX IF NOT EXISTS `idx_mail_verzendlog_status` ON `mail_verzendlog` (`status`,`tijdstip`);
CREATE INDEX IF NOT EXISTS `idx_mail_verzendlog_ontvanger` ON `mail_verzendlog` (`ontvanger`);
