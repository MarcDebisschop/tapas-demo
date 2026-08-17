-- ---------------------------------------------------------------------------
-- 0009_mailverzendlog: het blijvende verzendlogboek van uitgaande e-mail
--
-- AANLEIDING. Een uitnodiging voor een vragenlijst werd op 10 augustus 2026 via
-- de bulk-import aangemaakt en verstuurd. De ontvanger meldde dat het bericht
-- niet aankwam, ook niet in ongewenste post. Achteraf was niet vast te stellen
-- wat er met dat bericht gebeurd was. De verzendweg meldt per bericht wel een
-- stand (verstuurd, gesimuleerd, fout), maar die stand werd enkel in het
-- antwoord van de route meegegeven en nergens bewaard. Zodra het scherm weg was,
-- was het spoor weg. Wat overbleef was de logregel op de server, en die is op
-- Render vluchtig.
--
-- WAT DEZE TABEL VASTLEGT. Eén regel per verzendpoging: het tijdstip, de soort
-- mail, de ontvanger, de afzender, het onderwerp, de stand, het kanaal waarover
-- het bericht naar buiten ging, en de melding die de leverancier teruggaf. Zo is
-- een klacht als "ik heb niets gekregen" naderhand te beantwoorden met een
-- vaststelling in plaats van met een vermoeden.
--
-- WAT DEZE TABEL BEWUST NIET VASTLEGT. De persoonlijke link en de berichttekst.
-- Een deelnemerslink is een sleutel: wie hem heeft, opent de deur van die
-- deelnemer. De verzendmodule houdt links daarom al buiten elke logregel, en dat
-- beginsel geldt hier even hard. Een verzendlogboek moet kunnen aantonen DAT er
-- verstuurd is, niet WAT er precies in stond. Het onderwerp blijft wel staan,
-- want dat bevat geen sleutel en is nodig om berichten van elkaar te
-- onderscheiden.
--
-- AVG. De grondslag is de eigen bedrijfsvoering: aantonen dat een verplichte
-- mededeling werkelijk verzonden is. De gegevens zijn tot het minimum beperkt:
-- adres, tijdstip, stand. Er staat geen inhoud in en er staat geen sleutel in.
-- Het register van doorgiften in server/doorgifteregister.ts noemt de
-- mailleverancier al als ontvanger van deze adressen; deze tabel voegt daar geen
-- nieuwe ontvanger aan toe.
--
-- WAAROM ADDITIEF. Het bestand maakt enkel een nieuwe tabel en drie indexen aan,
-- alles met IF NOT EXISTS. Er wordt geen bestaande tabel aangeraakt en er wordt
-- niets herbouwd, dus een tweede loop kan niets stukmaken. De registerregel in
-- server/migratieloper.ts staat er toch, omdat een uitdrukkelijke regel
-- duidelijker is dan een migratie die stil opnieuw over de databank gaat.
--
-- DE DRIE INDEXEN. Het scherm in Mailbeheer opent op de jongste regels, filtert
-- op stand, en zoekt op adres wanneer iemand meldt dat hij niets kreeg. Dat zijn
-- precies deze drie ingangen. Zonder die indexen werd het scherm stil langzamer
-- naarmate het logboek groeit, en een logboek groeit altijd.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `mail_verzendlog` (
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
	CONSTRAINT "mail_verzendlog_soort" CHECK("soort" IN ('uitnodiging', 'toegangsmail', 'aanmeldlink', 'bericht')),
	CONSTRAINT "mail_verzendlog_status" CHECK("status" IN ('verstuurd', 'gesimuleerd', 'fout')),
	CONSTRAINT "mail_verzendlog_kanaal" CHECK("kanaal" IN ('brevo-api', 'smtp', 'geen'))
);

CREATE INDEX IF NOT EXISTS `idx_mail_verzendlog_tijdstip` ON `mail_verzendlog` (`tijdstip`);
CREATE INDEX IF NOT EXISTS `idx_mail_verzendlog_status` ON `mail_verzendlog` (`status`,`tijdstip`);
CREATE INDEX IF NOT EXISTS `idx_mail_verzendlog_ontvanger` ON `mail_verzendlog` (`ontvanger`);
