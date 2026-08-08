CREATE TABLE IF NOT EXISTS `afnames` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisatie_id` integer,
	`respondent_code` text NOT NULL,
	`name` text NOT NULL,
	`company` text,
	`role` text,
	`consent_given` integer DEFAULT false NOT NULL,
	`consent_scope` text,
	`consent_timestamp` text,
	`verwerkingsdoel` text,
	`rechtsgrond` text DEFAULT 'toestemming' NOT NULL,
	`privacyverklaring_versie` text,
	`consent_ip` text,
	`consent_user_agent` text,
	`bewaartot_datum` text,
	`geanonimiseerd_at` text,
	`consent_ingetrokken_at` text,
	`baseline_energy` integer DEFAULT 5 NOT NULL,
	`taal` text DEFAULT 'nl' NOT NULL,
	`status` text DEFAULT 'consent' NOT NULL,
	`invite_token` text,
	`bezits_token` text,
	`uitgenodigd_at` text,
	`herinnerd_at` text,
	`main_responses` text,
	`connection_answers` text,
	`item_tijden` text,
	`generator_contract` text,
	`deelnemer_email` text,
	`instrument_id` text,
	`leeftijdsband` text,
	`ouderlijke_toestemming` integer DEFAULT false NOT NULL,
	`ouderlijke_toestemming_at` text,
	`ouder_naam` text,
	`ouder_email` text,
	`ouderlijke_toestemming_ip` text,
	`ouderlijke_toestemming_user_agent` text,
	`aangemaakt_door_beheerder_id` integer,
	`aangemaakt_door_organisatie_id` integer,
	`created_at` text NOT NULL,
	`completed_at` text,
	UNIQUE(`respondent_code`),
	UNIQUE(`invite_token`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `beheerders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`email` text NOT NULL,
	`organisatie` text DEFAULT 'TaPasCity' NOT NULL,
	`organisatie_id` integer,
	`is_prior` integer DEFAULT false NOT NULL,
	`toegevoegd_door` text,
	`actief` integer DEFAULT true NOT NULL,
	`wachtwoord_hash` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organisatie_id`) REFERENCES `organisaties`(`id`) ON UPDATE no action ON DELETE no action,
	UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `betalingen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisatie_id` integer NOT NULL,
	`provider` text DEFAULT 'mollie' NOT NULL,
	`provider_ref` text,
	`methode` text,
	`pakket_id` text,
	`credits` integer NOT NULL,
	`bedrag_excl_btw_cent` integer NOT NULL,
	`btw_tarief` integer DEFAULT 21 NOT NULL,
	`btw_bedrag_cent` integer NOT NULL,
	`bedrag_incl_btw_cent` integer NOT NULL,
	`munt` text DEFAULT 'EUR' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`credit_transactie_id` integer,
	`factuur_id` integer,
	`checkout_url` text,
	`created_at` text NOT NULL,
	`betaald_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `biller_entiteiten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`vennootschapsnaam` text NOT NULL,
	`adres` text,
	`postcode` text,
	`gemeente` text,
	`land` text DEFAULT 'België' NOT NULL,
	`btw_nummer` text,
	`kbo_nummer` text,
	`peppol_id` text,
	`iban` text,
	`logo` text,
	`huisstijl_kleur` text DEFAULT '#b08b3f' NOT NULL,
	`factuur_footer` text,
	`factuur_prefix` text DEFAULT 'INV' NOT NULL,
	`btw_tarief` integer DEFAULT 21 NOT NULL,
	`geldig_van` text NOT NULL,
	`geldig_tot` text,
	`actief` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chat_berichten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deelnemer_id` integer NOT NULL,
	`rol` text NOT NULL,
	`inhoud` text NOT NULL,
	`veiligheid` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coach_accreditatie_aanvragen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`email` text NOT NULL,
	`certificering` text NOT NULL,
	`motivatie` text NOT NULL,
	`status` text DEFAULT 'ingediend' NOT NULL,
	`behandeld_door` text,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_saldi` (
	`organisatie_id` integer PRIMARY KEY NOT NULL,
	`beschikbaar` integer DEFAULT 0 NOT NULL,
	`gereserveerd` integer DEFAULT 0 NOT NULL,
	`verbruikt` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_transacties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organisatie_id` integer NOT NULL,
	`type` text NOT NULL,
	`aantal` integer NOT NULL,
	`afname_id` integer,
	`biller_entiteit_id` integer,
	`omschrijving` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `creditnotas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creditnotanummer` text NOT NULL,
	`factuur_id` integer NOT NULL,
	`biller_entiteit_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`reden` text,
	`biller_snapshot` text NOT NULL,
	`klant_snapshot` text NOT NULL,
	`regels` text NOT NULL,
	`bedrag_excl_btw_cent` integer NOT NULL,
	`btw_bedrag_cent` integer NOT NULL,
	`bedrag_incl_btw_cent` integer NOT NULL,
	`munt` text DEFAULT 'EUR' NOT NULL,
	`kanaal` text DEFAULT 'pdf' NOT NULL,
	`peppol_status` text DEFAULT 'n.v.t.' NOT NULL,
	`peppol_document` text,
	`credits_teruggeboekt` integer DEFAULT false NOT NULL,
	`creditnota_datum` text NOT NULL,
	`created_at` text NOT NULL,
	UNIQUE(`creditnotanummer`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deelnemers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`naam` text,
	`foto_url` text,
	`taal` text DEFAULT 'nl' NOT NULL,
	`dashboard_token` text NOT NULL,
	`mail_cadans` text DEFAULT 'uit' NOT NULL,
	`mail_uitgeschreven_at` text,
	`vragen_gebruikt` integer DEFAULT 0 NOT NULL,
	`vragen_tegoed` integer DEFAULT 0 NOT NULL,
	`uitleg_gebruikt_deelnemer` integer DEFAULT 0 NOT NULL,
	`uitleg_tegoed_deelnemer` integer DEFAULT 0 NOT NULL,
	`uitleg_gebruikt_coach` integer DEFAULT 0 NOT NULL,
	`uitleg_tegoed_coach` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	UNIQUE(`email`),
	UNIQUE(`dashboard_token`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `facturen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factuurnummer` text NOT NULL,
	`biller_entiteit_id` integer NOT NULL,
	`organisatie_id` integer NOT NULL,
	`betaling_id` integer,
	`biller_snapshot` text NOT NULL,
	`klant_snapshot` text NOT NULL,
	`regels` text NOT NULL,
	`bedrag_excl_btw_cent` integer NOT NULL,
	`btw_bedrag_cent` integer NOT NULL,
	`bedrag_incl_btw_cent` integer NOT NULL,
	`munt` text DEFAULT 'EUR' NOT NULL,
	`kanaal` text DEFAULT 'pdf' NOT NULL,
	`peppol_status` text DEFAULT 'n.v.t.' NOT NULL,
	`peppol_document` text,
	`factuurdatum` text NOT NULL,
	`betaalstatus` text DEFAULT 'betaald' NOT NULL,
	`vervaldatum` text,
	`created_at` text NOT NULL,
	UNIQUE(`factuurnummer`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `licenties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sleutel` text NOT NULL,
	`klantnaam` text NOT NULL,
	`klant_email` text,
	`max_profielen` integer,
	`prijs_per_profiel_cent` integer DEFAULT 0 NOT NULL,
	`munt` text DEFAULT 'EUR' NOT NULL,
	`gebruikte_profielen` integer DEFAULT 0 NOT NULL,
	`geldig_van` text NOT NULL,
	`geldig_tot` text,
	`status` text DEFAULT 'actief' NOT NULL,
	`notities` text,
	`created_at` text NOT NULL,
	UNIQUE(`sleutel`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organisaties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`type` text DEFAULT 'bedrijf' NOT NULL,
	`btw_nummer` text,
	`kbo_nummer` text,
	`peppol_id` text,
	`peppol_bereikbaar` integer DEFAULT false NOT NULL,
	`factuur_type` text DEFAULT 'pdf' NOT NULL,
	`contactpersoon` text,
	`email` text,
	`adres` text,
	`postcode` text,
	`gemeente` text,
	`land` text DEFAULT 'België' NOT NULL,
	`huisstijl_logo` text,
	`huisstijl_kleur` text,
	`huisstijl_footer` text,
	`login_email` text,
	`wachtwoord_hash` text,
	`login_actief` integer DEFAULT false NOT NULL,
	`branding_logo_url` text,
	`branding_achtergrond_url` text,
	`branding_achtergrond_kleur` text,
	`branding_quote` text,
	`created_at` text NOT NULL,
	UNIQUE(`login_email`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rapporten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`afname_id` integer NOT NULL,
	`variant` text DEFAULT 'kompas' NOT NULL,
	`titel` text NOT NULL,
	`inhoud` text NOT NULL,
	`html` text NOT NULL,
	`pdf_base64` text,
	`contract_versie` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessie_deelnemers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessie_id` integer NOT NULL,
	`rol` text DEFAULT 'stakeholder' NOT NULL,
	`naam` text,
	`email` text,
	`invite_token` text NOT NULL,
	`status` text DEFAULT 'uitgenodigd' NOT NULL,
	`individuele_input` text,
	`uitgenodigd_at` text,
	`toegetreden_at` text,
	`created_at` text NOT NULL,
	UNIQUE(`invite_token`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessie_studies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessie_id` integer NOT NULL,
	`kandidaat_label` text NOT NULL,
	`studie_contract` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text DEFAULT 't4recruitment' NOT NULL,
	`organisatie_id` integer,
	`licentie_id` integer,
	`titel` text NOT NULL,
	`facilitator_naam` text,
	`facilitator_email` text,
	`taal` text DEFAULT 'nl' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`kring_vergrendeld` integer DEFAULT false NOT NULL,
	`heropeningen` integer DEFAULT 0 NOT NULL,
	`sessie_state` text,
	`rolprofiel_contract` text,
	`created_at` text NOT NULL,
	`vergrendeld_at` text,
	`gefinaliseerd_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tarieven` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`instrument_id` text NOT NULL,
	`naam` text NOT NULL,
	`omschrijving` text DEFAULT '' NOT NULL,
	`flow_type` text DEFAULT 'individual' NOT NULL,
	`model` text DEFAULT 'per-stuk' NOT NULL,
	`credit_cost` integer DEFAULT 1 NOT NULL,
	`bundel_grootte` integer,
	`bundel_credits` integer,
	`is_custom` integer DEFAULT false NOT NULL,
	`gewijzigd_door` text,
	`updated_at` text NOT NULL,
	UNIQUE(`instrument_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `toegangen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`beheerder_id` integer NOT NULL,
	`platformdeel` text NOT NULL,
	`toegestaan` integer DEFAULT false NOT NULL,
	`gewijzigd_door` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `hdd_board_leden` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traject_id` integer NOT NULL,
	`naam` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`instrument_tokens` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `hdd_trajecten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`board_naam` text NOT NULL,
	`org_label` text DEFAULT '' NOT NULL,
	`context` text DEFAULT 'self-screening' NOT NULL,
	`vereist_stratum` integer,
	`status` text DEFAULT 'fase1_open' NOT NULL,
	`gate_resultaat` text,
	`platform_sessie_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4o_antwoorden` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`respondent_id` integer NOT NULL,
	`antwoorden` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4o_respondenten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessie_id` integer NOT NULL,
	`token` text NOT NULL,
	`groep` text NOT NULL,
	`rank` integer NOT NULL,
	`afgerond` integer DEFAULT false NOT NULL,
	`afgerond_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4o_sessies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_naam` text NOT NULL,
	`org_label` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4r_answers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`item_id` text NOT NULL,
	`classification` text,
	`context_value` text,
	`critical` integer DEFAULT false NOT NULL,
	`rank` integer,
	`note` text,
	`conflict` integer DEFAULT false NOT NULL,
	`final_decision` text,
	`final_reason` text,
	`updated_by` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4r_audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`event` text NOT NULL,
	`detail` text,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4r_candidate_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`candidate_label` text NOT NULL,
	`source_file` text,
	`metingen` text DEFAULT '{}' NOT NULL,
	`context` text DEFAULT '{}' NOT NULL,
	`raw_text` text,
	`verified` integer DEFAULT false NOT NULL,
	`decision` text,
	`decision_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4r_chat` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`rol` text NOT NULL,
	`inhoud` text NOT NULL,
	`veiligheid` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4r_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`function_title` text NOT NULL,
	`org_label` text NOT NULL,
	`role_type` text NOT NULL,
	`role_level` text NOT NULL,
	`fill_mode` text NOT NULL,
	`end_moment` text NOT NULL,
	`context_version` text DEFAULT 'v1' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`closed_ring` integer DEFAULT false NOT NULL,
	`platform_sessie_id` integer,
	`chat_gebruikt` integer DEFAULT 0 NOT NULL,
	`chat_tegoed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `t4r_stakeholders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`name` text NOT NULL,
	`stakeholder_role` text NOT NULL,
	`system_role` text DEFAULT 'stakeholder' NOT NULL,
	`voting` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `teamscan_antwoorden` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`deelnemer_id` integer NOT NULL,
	`fundament` text NOT NULL,
	`lencioni` text NOT NULL,
	`vertrouwen_ranking` text NOT NULL,
	`vertrouwen_prestatie` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `teamscan_deelnemers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessie_id` integer NOT NULL,
	`token` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`afgerond` integer DEFAULT false NOT NULL,
	`afgerond_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `teamscan_sessies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_naam` text NOT NULL,
	`org_label` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`platform_sessie_id` integer,
	`created_at` integer NOT NULL
);
