import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { TALEN, type Taal, STANDAARD_TAAL } from "./talen";

// ---------------------------------------------------------------------------
// Taal (Fase E — meertaligheid)
// De afname-taal is een VASTE EIGENSCHAP van de afname (zoals het token of de
// baseline): één keer gezet bij het aanmaken van de uitnodiging/afname en
// daarna bevroren. De volledige keten (deelnemerslink, vragenlijst, rapport)
// wordt in deze taal aangeboden en verwerkt. NL is de bron- en standaardtaal.
// ---------------------------------------------------------------------------
export { TALEN, STANDAARD_TAAL };
export type { Taal };
export const taalSchema = z.enum(TALEN);

// ---------------------------------------------------------------------------
// TaPas Platform — Fase B datamodel
// Eén instrument (T4P Business Kompas) met twee secties: 'main' (deel 1) en
// 'connection' (deel 2). Een AFNAME bundelt consent, identiteit, ruwe
// antwoorden en — na afronding — een server-side gegenereerd profiel
// (het bevroren A3 generator-contract).
// ---------------------------------------------------------------------------

// Een afname = één respondent die de keten doorloopt via één link.
export const afnames = sqliteTable("afnames", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Koper/afnemer die het credit voor deze afname draagt (nullable voor legacy
  // afnames uit Fase B die nog niet aan een organisatie gekoppeld waren).
  organisatieId: integer("organisatie_id"),
  // Gedeelde sleutel tussen sectie 'main' en 'connection'.
  respondentCode: text("respondent_code").notNull().unique(),
  name: text("name").notNull(),
  company: text("company"),
  role: text("role"),
  // Consent (GDPR) — verplicht vóór start.
  consentGiven: integer("consent_given", { mode: "boolean" }).notNull().default(false),
  consentScope: text("consent_scope"),
  consentTimestamp: text("consent_timestamp"),
  // --- GDPR-verwerkingscontext (Fase C4) ---
  // Verwerkingsdoel, rechtsgrond (AVG art. 6) en versie van de privacyverklaring
  // die de respondent zag op het moment van toestemming (bewijslast).
  verwerkingsdoel: text("verwerkingsdoel"),
  rechtsgrond: text("rechtsgrond").notNull().default("toestemming"),
  privacyverklaringVersie: text("privacyverklaring_versie"),
  // Bron-IP en user-agent op het moment van toestemming (bewijs van toestemming).
  consentIp: text("consent_ip"),
  consentUserAgent: text("consent_user_agent"),
  // Bewaartermijn: tot wanneer de persoonsgegevens van deze afname bewaard
  // mogen blijven. Na deze datum komt de afname in aanmerking voor anonimisering.
  bewaartotDatum: text("bewaartot_datum"),
  // Anonimisering (recht op vergetelheid / verstrijken bewaartermijn). Zodra
  // gezet, zijn de persoonsgegevens uit deze afname onomkeerbaar verwijderd.
  geanonimiseerdAt: text("geanonimiseerd_at"),
  // Intrekken van toestemming (AVG art. 7.3). Datum waarop de respondent of
  // de organisatie de toestemming introk.
  consentIngetrokkenAt: text("consent_ingetrokken_at"),
  // Zelf-ingeschatte professionele baseline-energie (0-10).
  baselineEnergy: integer("baseline_energy").notNull().default(5),
  // Afname-taal (Fase E): vaste eigenschap, gezet bij uitnodiging/aanmaak.
  taal: text("taal").notNull().default("nl"),
  // Status van de keten: 'uitgenodigd' -> 'consent' -> 'deel1' -> 'deel2' -> 'voltooid'.
  // 'uitgenodigd' = link aangemaakt, deelnemer is nog niet gestart.
  status: text("status").notNull().default("consent"),
  // --- Deelnemerslink / uitnodiging (Fase D) ---
  // Onraadbaar toegangstoken voor de deelnemerslink (i.p.v. het volgnummer-id
  // bloot te stellen). Wordt gebruikt in de URL /deelnemer/:token.
  inviteToken: text("invite_token").unique(),
  // Tijdstip waarop de uitnodiging (link) werd aangemaakt en eventueel herinnerd.
  uitgenodigdAt: text("uitgenodigd_at"),
  herinnerdAt: text("herinnerd_at"),
  // Ruwe antwoorden, opgeslagen als JSON-tekst (SQLite kent geen JSON-kolom).
  // mainResponses: object { "B0": { most, least, itemEnergy:{most,least}, blockEnergy }, ... }
  mainResponses: text("main_responses"),
  // connectionAnswers: object { q1, q2, q3, q4 }
  connectionAnswers: text("connection_answers"),
  // Het server-side gegenereerde A3 generator-contract (JSON-tekst).
  generatorContract: text("generator_contract"),
  // TaPas Persoonlijk Fase 1: koppeling naar de deelnemer (via e-mail) zodat de
  // respondent later op zijn persoonlijk dashboard al zijn afnames terugvindt.
  deelnemerEmail: text("deelnemer_email"),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

// Bij het aanmaken van een afname leveren we identiteit + baseline + consent.
export const insertAfnameSchema = createInsertSchema(afnames).pick({
  name: true,
  company: true,
  role: true,
  baselineEnergy: true,
}).extend({
  name: z.string().min(1, "Naam is verplicht"),
  company: z.string().optional(),
  role: z.string().optional(),
  baselineEnergy: z.number().int().min(0).max(10),
  taal: taalSchema.optional(),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Toestemming is verplicht om te starten" }),
  }),
});

export type InsertAfname = z.infer<typeof insertAfnameSchema>;
export type Afname = typeof afnames.$inferSelect;

// Een uitnodiging aanmaken: de beheerder geeft (optioneel) naam/bedrijf/functie
// en de organisatie die het credit draagt. De deelnemer geeft zelf toestemming
// en zijn baseline-energie wanneer hij via de link binnenkomt.
export const inviteAfnameSchema = z.object({
  name: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  organisatieId: z.number().int().positive().optional(),
  // De beheerder kiest de afname-taal bij het aanmaken van de uitnodiging.
  taal: taalSchema.optional(),
});
export type InviteAfname = z.infer<typeof inviteAfnameSchema>;

// Wanneer de deelnemer via zijn link start: toestemming + baseline + (optioneel)
// het aanvullen/bevestigen van zijn identiteit als die nog niet ingevuld was.
export const startViaLinkSchema = z.object({
  name: z.string().min(1, "Naam is verplicht"),
  company: z.string().optional(),
  role: z.string().optional(),
  baselineEnergy: z.number().int().min(0).max(10),
  // Veilige escape-hatch: de deelnemer mag op het landingsscherm de taal nog
  // wijzigen vóór deel 1 start. Daarna is de taal bevroren.
  taal: taalSchema.optional(),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Toestemming is verplicht om te starten" }),
  }),
});
export type StartViaLink = z.infer<typeof startViaLinkSchema>;

// ---------------------------------------------------------------------------
// Payload-types voor de afname-keten (niet in de database; API-contracten).
// ---------------------------------------------------------------------------

// Eén blok-antwoord uit deel 1.
export const blockResponseSchema = z.object({
  most: z.string().nullable(),
  least: z.string().nullable(),
  itemEnergy: z.object({
    most: z.number().nullable(),
    least: z.number().nullable(),
  }),
  blockEnergy: z.number().nullable(),
});

export const submitMainSchema = z.object({
  responses: z.record(z.string(), blockResponseSchema),
});
export type SubmitMain = z.infer<typeof submitMainSchema>;

export const submitConnectionSchema = z.object({
  answers: z.object({
    q1: z.number().int().min(0).max(10),
    q2: z.number().int().min(0).max(10),
    q3: z.number().int().min(0).max(10),
    q4: z.number().int().min(0).max(10),
  }),
});
export type SubmitConnection = z.infer<typeof submitConnectionSchema>;


// ---------------------------------------------------------------------------
// TaPas Platform — Fase C1: organisaties & creditmodel
//
// Commerciële laag. Quasi uitsluitend B2B (bedrijven, scholen, coaches met
// eigen bedrijf). Een ORGANISATIE koopt credits; elke afname (link) verbruikt
// één credit. Reservering bij aanmaak, definitief verbruik bij voltooiing,
// vrijgave bij verval.
//
// De BILLER (facturerende entiteit) is een configureerbaar DB-record, niet
// hardcoded: het platform start onder 2BQ CONSULT en kan later overschakelen
// naar een nieuwe entiteit (PMV-traject) zonder herbouw. Credits zijn
// overdraagbaar tussen billers (boekhoudkundige overdracht).
//
// Het creditgrootboek (credit_transacties) is append-only: het saldo is altijd
// reconstrueerbaar uit de som van de transacties. credit_saldi is een
// gecachte momentopname die atomair met elke transactie wordt bijgewerkt.
// ---------------------------------------------------------------------------

// De facturerende entiteit. Eén record is actief; oude records blijven bestaan
// voor reeds uitgestuurde facturen (10 jaar bewaarplicht).
export const billerEntiteiten = sqliteTable("biller_entiteiten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  vennootschapsnaam: text("vennootschapsnaam").notNull(),
  adres: text("adres"),
  postcode: text("postcode"),
  gemeente: text("gemeente"),
  land: text("land").notNull().default("België"),
  btwNummer: text("btw_nummer"),
  kboNummer: text("kbo_nummer"),
  peppolId: text("peppol_id"),
  iban: text("iban"),
  logo: text("logo"),
  factuurPrefix: text("factuur_prefix").notNull().default("INV"),
  btwTarief: integer("btw_tarief").notNull().default(21),
  geldigVan: text("geldig_van").notNull(),
  geldigTot: text("geldig_tot"),
  actief: integer("actief", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const insertBillerSchema = createInsertSchema(billerEntiteiten)
  .omit({ id: true, createdAt: true, geldigVan: true })
  .extend({
    naam: z.string().min(1, "Naam is verplicht"),
    vennootschapsnaam: z.string().min(1, "Vennootschapsnaam is verplicht"),
    factuurPrefix: z.string().min(1, "Factuurprefix is verplicht"),
    btwTarief: z.number().int().min(0).max(100).default(21),
  });
export type InsertBiller = z.infer<typeof insertBillerSchema>;
export type BillerEntiteit = typeof billerEntiteiten.$inferSelect;

// De koper/afnemer. B2B-first: bedrijven, scholen, coaches met eigen bedrijf.
export const organisaties = sqliteTable("organisaties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  type: text("type").notNull().default("bedrijf"),
  btwNummer: text("btw_nummer"),
  kboNummer: text("kbo_nummer"),
  peppolId: text("peppol_id"),
  peppolBereikbaar: integer("peppol_bereikbaar", { mode: "boolean" }).notNull().default(false),
  factuurType: text("factuur_type").notNull().default("pdf"),
  contactpersoon: text("contactpersoon"),
  email: text("email"),
  adres: text("adres"),
  postcode: text("postcode"),
  gemeente: text("gemeente"),
  land: text("land").notNull().default("België"),
  createdAt: text("created_at").notNull(),
});

export const insertOrganisatieSchema = createInsertSchema(organisaties)
  .omit({ id: true, createdAt: true, factuurType: true })
  .extend({
    naam: z.string().min(1, "Naam is verplicht"),
    type: z.enum(["bedrijf", "school", "coach", "particulier"]).default("bedrijf"),
    email: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
    btwNummer: z.string().optional(),
    kboNummer: z.string().optional(),
    peppolId: z.string().optional(),
    peppolBereikbaar: z.boolean().default(false),
  });
export type InsertOrganisatie = z.infer<typeof insertOrganisatieSchema>;
export type Organisatie = typeof organisaties.$inferSelect;

// Gecacht saldo per organisatie (momentopname; atomair bijgehouden).
export const creditSaldi = sqliteTable("credit_saldi", {
  organisatieId: integer("organisatie_id").primaryKey(),
  beschikbaar: integer("beschikbaar").notNull().default(0),
  gereserveerd: integer("gereserveerd").notNull().default(0),
  verbruikt: integer("verbruikt").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
export type CreditSaldo = typeof creditSaldi.$inferSelect;

// Append-only creditgrootboek. Elke mutatie is een onveranderlijke regel.
// type: 'aankoop' | 'reservering' | 'verbruik' | 'vrijgave' | 'correctie' | 'overdracht'
export const creditTransacties = sqliteTable("credit_transacties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organisatieId: integer("organisatie_id").notNull(),
  type: text("type").notNull(),
  aantal: integer("aantal").notNull(),
  afnameId: integer("afname_id"),
  billerEntiteitId: integer("biller_entiteit_id"),
  omschrijving: text("omschrijving"),
  createdAt: text("created_at").notNull(),
});
export type CreditTransactie = typeof creditTransacties.$inferSelect;

// Payload: handmatig credits opladen (aankoop registreren).
export const laadCreditsSchema = z.object({
  organisatieId: z.number().int().positive(),
  aantal: z.number().int().positive("Aantal moet groter dan 0 zijn"),
  omschrijving: z.string().optional(),
});
export type LaadCredits = z.infer<typeof laadCreditsSchema>;

// Payload: credits overdragen tussen organisaties (boekhoudkundige overdracht).
export const overdrachtSchema = z.object({
  vanOrganisatieId: z.number().int().positive(),
  naarOrganisatieId: z.number().int().positive(),
  aantal: z.number().int().positive("Aantal moet groter dan 0 zijn"),
  omschrijving: z.string().optional(),
});
export type Overdracht = z.infer<typeof overdrachtSchema>;

// ---------------------------------------------------------------------------
// TaPas Platform — Fase C2-C3: betalingen, e-facturatie & rapportgeneratie
//
// C2  — Betaalintegratie (Mollie): credits opladen via online betaling.
//        Provider-neutraal opgeslagen (betalingen-tabel) zodat een latere
//        wissel van PSP geen herbouw vereist. In dit prototype simuleren we
//        de Mollie-redirect + webhook (sandbox kan de echte Mollie-API niet
//        bereiken zonder sleutels); de flow is identiek aan productie.
// C2-C3 — Peppol e-facturatie: bij een geslaagde betaling wordt automatisch
//        een uitgaande factuur aangemaakt. De factuur wordt PROVIDER-NEUTRAAL
//        opgeslagen (alle UBL-relevante velden in de eigen DB), zodat later
//        kan worden overgeschakeld naar e-invoice.be. Kanaal = 'peppol' als de
//        organisatie Peppol-bereikbaar is, anders 'pdf'.
// C3  — Rapportgeneratie: het bevroren generator-contract -> afgewerkt
//        TaPas-rapport (Kompas of Coachatlas) per mastertemplate.
//
// BTW: single-purpose voucher, BTW bij aankoop, één credittype, één tarief.
//      De BTW-classificatie moet door de boekhouder bevestigd worden vóór
//      livegang.
// ---------------------------------------------------------------------------

// Een betaling = één online betaalpoging om credits op te laden.
// status: 'open' -> 'betaald' | 'mislukt' | 'verlopen'
export const betalingen = sqliteTable("betalingen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organisatieId: integer("organisatie_id").notNull(),
  // Provider-neutrale velden. providerRef = referentie bij de PSP (Mollie id).
  provider: text("provider").notNull().default("mollie"),
  providerRef: text("provider_ref"),
  methode: text("methode"), // bancontact | creditcard | ideal | ...
  // Wat er gekocht wordt.
  pakketId: text("pakket_id"),
  credits: integer("credits").notNull(),
  bedragExclBtw: integer("bedrag_excl_btw_cent").notNull(), // in eurocent
  btwTarief: integer("btw_tarief").notNull().default(21),
  btwBedrag: integer("btw_bedrag_cent").notNull(), // in eurocent
  bedragInclBtw: integer("bedrag_incl_btw_cent").notNull(), // in eurocent
  munt: text("munt").notNull().default("EUR"),
  status: text("status").notNull().default("open"),
  // Koppeling naar de credit-aankooptransactie en de factuur (na bevestiging).
  creditTransactieId: integer("credit_transactie_id"),
  factuurId: integer("factuur_id"),
  checkoutUrl: text("checkout_url"),
  createdAt: text("created_at").notNull(),
  betaaldAt: text("betaald_at"),
});
export type Betaling = typeof betalingen.$inferSelect;

// Payload: een betaling starten (credits opladen via betaling).
export const startBetalingSchema = z.object({
  organisatieId: z.number().int().positive(),
  pakketId: z.string().optional(),
  credits: z.number().int().positive("Aantal credits moet groter dan 0 zijn").optional(),
}).refine((d) => !!d.pakketId || !!d.credits, {
  message: "Geef een pakket of een aantal credits op",
});
export type StartBetaling = z.infer<typeof startBetalingSchema>;

// Een factuur = één uitgaande verkoop, provider-neutraal opgeslagen.
// Alle velden die een UBL/Peppol-document nodig heeft, staan in de eigen DB.
export const facturen = sqliteTable("facturen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  factuurnummer: text("factuurnummer").notNull().unique(),
  billerEntiteitId: integer("biller_entiteit_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  betalingId: integer("betaling_id"),
  // Bevroren snapshots (een factuur mag nooit wijzigen als de org/biller wijzigt).
  billerSnapshot: text("biller_snapshot").notNull(), // JSON
  klantSnapshot: text("klant_snapshot").notNull(), // JSON
  // Factuurregels als JSON: [{ omschrijving, aantal, eenheidsprijsExclCent, btwTarief, totaalExclCent }]
  regels: text("regels").notNull(),
  bedragExclBtw: integer("bedrag_excl_btw_cent").notNull(),
  btwBedrag: integer("btw_bedrag_cent").notNull(),
  bedragInclBtw: integer("bedrag_incl_btw_cent").notNull(),
  munt: text("munt").notNull().default("EUR"),
  // Kanaal + Peppol-status. kanaal: 'peppol' | 'pdf'
  kanaal: text("kanaal").notNull().default("pdf"),
  // peppolStatus: 'n.v.t.' | 'klaar' | 'verzonden' | 'mislukt'
  peppolStatus: text("peppol_status").notNull().default("n.v.t."),
  peppolDocument: text("peppol_document"), // provider-neutrale UBL-payload (JSON)
  factuurdatum: text("factuurdatum").notNull(),
  createdAt: text("created_at").notNull(),
});
export type Factuur = typeof facturen.$inferSelect;

// Een rapport = een afgewerkt TaPas-document, afgeleid van het bevroren
// generator-contract van een voltooide afname. variant: 'kompas' | 'coachatlas'
export const rapporten = sqliteTable("rapporten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  afnameId: integer("afname_id").notNull(),
  variant: text("variant").notNull().default("kompas"),
  titel: text("titel").notNull(),
  // De gegenereerde inhoud, gestructureerd als JSON (secties) + HTML-render.
  inhoud: text("inhoud").notNull(), // JSON
  html: text("html").notNull(),
  // Optioneel: een echt, definitief PDF-document (base64). Wanneer aanwezig
  // wordt dit document getoond/gedownload i.p.v. de gegenereerde HTML. Zo
  // krijgt een T4P Business Kompas met een echt document altijd dat document.
  pdfBase64: text("pdf_base64"),
  contractVersie: text("contract_versie").notNull(),
  createdAt: text("created_at").notNull(),
});
export type Rapport = typeof rapporten.$inferSelect;

// Payload: een rapport genereren voor een voltooide afname.
export const genereerRapportSchema = z.object({
  afnameId: z.number().int().positive(),
  variant: z.enum(["kompas", "coachatlas"]).default("kompas"),
});
export type GenereerRapport = z.infer<typeof genereerRapportSchema>;

// ---------------------------------------------------------------------------
// TaPas Platform — Fase C4: boekhoudkundige sluitstukken, bestuursrapportage
// & GDPR-operationalisering.
//
// C4a Boekhouding — Creditnota's: een factuur kan nooit worden gewijzigd of
//      verwijderd (onveranderlijkheid). Een correctie gebeurt via een aparte
//      creditnota die naar de oorspronkelijke factuur verwijst. Eigen
//      doorlopende nummerreeks (PREFIX-CN-JAAR-NNNN).
// C4b Bestuur — KPI-momentopname voor de Raad van Bestuur/investeerders,
//      afgeleid uit het grootboek + facturen + afnames (geen aparte opslag
//      nodig; alles is reconstrueerbaar).
// C4c GDPR — betrokkenenrechten: data-export (inzage/overdraagbaarheid) en
//      anonimisering (vergetelheid) draaien op de bestaande afname-tabel.
// ---------------------------------------------------------------------------

// Een creditnota = een boekhoudkundige correctie op een bestaande factuur.
// status: 'open' (uitgegeven). Het bedrag staat negatief t.o.v. de factuur.
export const creditnotas = sqliteTable("creditnotas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  creditnotanummer: text("creditnotanummer").notNull().unique(),
  factuurId: integer("factuur_id").notNull(),
  billerEntiteitId: integer("biller_entiteit_id").notNull(),
  organisatieId: integer("organisatie_id").notNull(),
  reden: text("reden"),
  // Bevroren snapshots (identiek principe als facturen).
  billerSnapshot: text("biller_snapshot").notNull(),
  klantSnapshot: text("klant_snapshot").notNull(),
  regels: text("regels").notNull(),
  // Negatieve bedragen (in eurocent), spiegel van de oorspronkelijke factuur.
  bedragExclBtw: integer("bedrag_excl_btw_cent").notNull(),
  btwBedrag: integer("btw_bedrag_cent").notNull(),
  bedragInclBtw: integer("bedrag_incl_btw_cent").notNull(),
  munt: text("munt").notNull().default("EUR"),
  kanaal: text("kanaal").notNull().default("pdf"),
  peppolStatus: text("peppol_status").notNull().default("n.v.t."),
  peppolDocument: text("peppol_document"),
  // Boekt de bijbehorende credits terug? (true = credits worden teruggenomen)
  creditsTeruggeboekt: integer("credits_teruggeboekt", { mode: "boolean" }).notNull().default(false),
  creditnotaDatum: text("creditnota_datum").notNull(),
  createdAt: text("created_at").notNull(),
});
export type Creditnota = typeof creditnotas.$inferSelect;

// Payload: creditnota op een factuur uitgeven.
export const creditnotaSchema = z.object({
  factuurId: z.number().int().positive(),
  reden: z.string().min(1, "Reden is verplicht"),
  // Boek de credits terug (verlaag het beschikbare saldo)? Default true.
  creditsTerugboeken: z.boolean().default(true),
});
export type CreditnotaInput = z.infer<typeof creditnotaSchema>;

// Payload: GDPR-bewaartermijn instellen op een afname.
export const bewaartermijnSchema = z.object({
  afnameId: z.number().int().positive(),
  bewaartotDatum: z.string().min(1, "Datum is verplicht"),
});
export type BewaartermijnInput = z.infer<typeof bewaartermijnSchema>;

// ---------------------------------------------------------------------------
// TaPas Persoonlijk — Fase 1: deelnemer-account & persoonlijk dashboard
//
// Een DEELNEMER is de natuurlijke persoon die één of meer vragenlijsten invulde.
// Identificatie gebeurt via e-mail (geen wachtwoord — login via magic-link).
// Het dashboardToken is een lange, onraadbare sleutel die als persoonlijke
// toegangs-URL dient (/#/dashboard/:token). Eén deelnemer is via zijn e-mail
// gekoppeld aan al zijn afnames (afnames.deelnemer_email).
//
// mailCadans: 'uit' | 'wekelijks' | 'tweewekelijks' | 'maandelijks' — bepaalt
// hoe vaak de deelnemer een inspirerend mailtje ontvangt (Fase 3).
// ---------------------------------------------------------------------------
export const deelnemers = sqliteTable("deelnemers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  naam: text("naam"),
  // Geüploade profielfoto, opgeslagen als data-URL (base64) of pad.
  fotoUrl: text("foto_url"),
  taal: text("taal").notNull().default("nl"),
  // Langlevende, onraadbare sleutel voor de persoonlijke dashboard-URL.
  dashboardToken: text("dashboard_token").notNull().unique(),
  mailCadans: text("mail_cadans").notNull().default("uit"),
  mailUitgeschrevenAt: text("mail_uitgeschreven_at"),
  // --- AI-chatbot (Fase 2) ---
  // Aantal chatvragen dat deze deelnemer al stelde. De gratis limiet en de
  // pakketgrootte staan centraal in CHAT_CONFIG (server) en zijn instelbaar.
  vragenGebruikt: integer("vragen_gebruikt").notNull().default(0),
  // Extra bijgekocht tegoed bovenop de gratis limiet (per pakket opgehoogd).
  vragenTegoed: integer("vragen_tegoed").notNull().default(0),
  // --- Gesproken profieluitleg (audio) ---
  // Twee onafhankelijke tellers/tegoeden: één voor de deelnemer (warme toon)
  // en één voor de coach (zakelijker, coaching-gericht). Elke toon heeft een
  // eigen 10-gratis-dan-betalen limiet; de coach betaalt apart.
  uitlegGebruiktDeelnemer: integer("uitleg_gebruikt_deelnemer").notNull().default(0),
  uitlegTegoedDeelnemer: integer("uitleg_tegoed_deelnemer").notNull().default(0),
  uitlegGebruiktCoach: integer("uitleg_gebruikt_coach").notNull().default(0),
  uitlegTegoedCoach: integer("uitleg_tegoed_coach").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
export type Deelnemer = typeof deelnemers.$inferSelect;

// Eén chatbericht in het gesprek tussen deelnemer en de AI-profielassistent.
// rol: 'user' (deelnemer) of 'assistant' (AI). veiligheid: optioneel label
// ('coach') wanneer het zorg-kompas naar een coach verwees.
export const chatBerichten = sqliteTable("chat_berichten", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deelnemerId: integer("deelnemer_id").notNull(),
  rol: text("rol").notNull(),
  inhoud: text("inhoud").notNull(),
  veiligheid: text("veiligheid"),
  createdAt: text("created_at").notNull(),
});
export type ChatBericht = typeof chatBerichten.$inferSelect;

export const mailCadansSchema = z.enum(["uit", "wekelijks", "tweewekelijks", "maandelijks"]);
export type MailCadans = z.infer<typeof mailCadansSchema>;

// Payload: magic-link aanvragen (login via e-mail).
export const deelnemerLoginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  taal: taalSchema.optional(),
});
export type DeelnemerLogin = z.infer<typeof deelnemerLoginSchema>;

// Payload: profiel bijwerken vanuit het dashboard.
export const updateDeelnemerSchema = z.object({
  naam: z.string().optional(),
  fotoUrl: z.string().optional(),
  taal: taalSchema.optional(),
  mailCadans: mailCadansSchema.optional(),
});
export type UpdateDeelnemer = z.infer<typeof updateDeelnemerSchema>;

// Payload: een nieuwe chatvraag stellen aan de profielassistent.
export const chatVraagSchema = z.object({
  vraag: z.string().min(1, "Stel een vraag").max(2000),
});
export type ChatVraag = z.infer<typeof chatVraagSchema>;

// ---------------------------------------------------------------------------
// T4Recruitment — Fase 2: collaboratief instrument (inpluggen)
//
// T4Recruitment is GEEN individuele vragenlijst maar een COLLABORATIEF
// beslissingsinstrument: een GESLOTEN stakeholderkring bouwt samen één
// virtueel TaPas-rolprofiel. Daarom een eigen datamodel NAAST de bestaande
// `afnames` (die volledig ongewijzigd blijft).
//
// Bewuste keuzes (afgestemd met Marc):
//  • Inhoud/logica van T4Recruitment wijzigt NIET. De volledige collaboratieve
//    toestand, de vergelijkende studie en het virtuele rolprofiel worden als
//    JSON-contracten ("black boxes") één-op-één overgenomen uit de stand-alone
//    app. Daardoor hoeft de inhoudelijke logica niet te worden herschreven.
//  • Rekeneenheid = PER SESSIE (rolprofiel), niet per persoon: standaard 20
//    credits per sessie, instelbaar. De vergelijkende studie kost 0 credits.
//  • Observer-rol bestaat (alleen lezen). De kring kan ná vergrendeling toch
//    heropend worden, maar dat kost extra credits (standaard 10, instelbaar).
//  • Omwisselbare toegangslaag: een sessie draait OF op platform-credits
//    (organisatieId) OF op een losse LICENTIESLEUTEL (licentieId) voor
//    verkoop buiten het platform. Een licentie legt zélf vast hoeveel
//    profielen mogen worden afgenomen en tegen welke prijs per profiel.
// ---------------------------------------------------------------------------

// Een LICENTIE = losse, buiten-platform toegang tot T4Recruitment. De twee
// instelbare commerciële variabelen staan hier: max. aantal profielen en de
// prijs per profiel. status: 'actief' | 'ingetrokken'.
export const licenties = sqliteTable("licenties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sleutel: text("sleutel").notNull().unique(),
  klantnaam: text("klantnaam").notNull(),
  klantEmail: text("klant_email"),
  // Instelbare variabele 1: hoeveel T4Recruitment-profielen (sessies) mogen er
  // worden afgenomen. null = onbeperkt binnen de geldigheidsduur.
  maxProfielen: integer("max_profielen"),
  // Instelbare variabele 2: prijs per profiel (in eurocent, BTW-excl.).
  prijsPerProfielCent: integer("prijs_per_profiel_cent").notNull().default(0),
  munt: text("munt").notNull().default("EUR"),
  // Hoeveel profielen reeds afgenomen (verhoogd bij finalisatie van een sessie).
  gebruikteProfielen: integer("gebruikte_profielen").notNull().default(0),
  geldigVan: text("geldig_van").notNull(),
  geldigTot: text("geldig_tot"),
  status: text("status").notNull().default("actief"),
  notities: text("notities"),
  createdAt: text("created_at").notNull(),
});
export type Licentie = typeof licenties.$inferSelect;

// Payload: een licentiesleutel aanmaken. De sleutel zelf wordt server-side
// gegenereerd (onraadbaar); de beheerder zet de twee commerciële variabelen.
export const maakLicentieSchema = z.object({
  klantnaam: z.string().min(1, "Klantnaam is verplicht"),
  klantEmail: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
  // Instelbare variabele 1 — aantal profielen (leeg/0 => onbeperkt).
  maxProfielen: z.number().int().positive().optional(),
  // Instelbare variabele 2 — prijs per profiel in euro (wordt naar cent omgezet).
  prijsPerProfiel: z.number().min(0).default(0),
  geldigTot: z.string().optional(),
  notities: z.string().optional(),
});
export type MaakLicentie = z.infer<typeof maakLicentieSchema>;

// Een SESSIE = één rolprofiel-traject van een gesloten stakeholderkring.
// De 8 statussen komen één-op-één uit de stand-alone T4R-app.
// status: 'draft' | 'stakeholders-bevestigd' | 'sessie-geopend'
//       | 'individuele-input' | 'alignment-vereist' | 'conflict-open'
//       | 'finalisatie-gereed' | 'vergrendeld'
export const sessies = sqliteTable("sessies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  instrumentId: text("instrument_id").notNull().default("t4recruitment"),
  // Precies één betaalbron is gezet: organisatieId (platform-credits) OF
  // licentieId (losse verkoop). De ander is null.
  organisatieId: integer("organisatie_id"),
  licentieId: integer("licentie_id"),
  titel: text("titel").notNull(),
  facilitatorNaam: text("facilitator_naam"),
  facilitatorEmail: text("facilitator_email"),
  taal: text("taal").notNull().default("nl"),
  status: text("status").notNull().default("draft"),
  // Zodra de input start ligt de kring vast (geen leden/rollen meer wijzigen),
  // tenzij de facilitator betaald heropent.
  kringVergrendeld: integer("kring_vergrendeld", { mode: "boolean" }).notNull().default(false),
  // Hoe vaak de kring (betaald) heropend werd — voor grootboek/transparantie.
  heropeningen: integer("heropeningen").notNull().default(0),
  // De volledige collaboratieve toestand, één-op-één overgenomen (JSON).
  sessieState: text("sessie_state"),
  // Het bevroren virtuele TaPas-rolprofiel na finalisatie (JSON).
  rolprofielContract: text("rolprofiel_contract"),
  createdAt: text("created_at").notNull(),
  vergrendeldAt: text("vergrendeld_at"),
  gefinaliseerdAt: text("gefinaliseerd_at"),
});
export type Sessie = typeof sessies.$inferSelect;

// Payload: een nieuwe sessie aanmaken. Exact één betaalbron verplicht.
export const maakSessieSchema = z.object({
  titel: z.string().min(1, "Een titel is verplicht"),
  facilitatorNaam: z.string().optional(),
  facilitatorEmail: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
  taal: taalSchema.optional(),
  organisatieId: z.number().int().positive().optional(),
  licentieSleutel: z.string().optional(),
}).refine((d) => !!d.organisatieId || !!d.licentieSleutel, {
  message: "Geef een organisatie (platform-credits) of een licentiesleutel op",
}).refine((d) => !(d.organisatieId && d.licentieSleutel), {
  message: "Een sessie heeft precies één betaalbron: organisatie OF licentie",
});
export type MaakSessie = z.infer<typeof maakSessieSchema>;

// Een KRINGLID = één deelnemer aan een sessie, met een rol.
// rol: 'facilitator' | 'stakeholder' (stemgerechtigd) | 'observer' (leest mee)
// status: 'uitgenodigd' | 'toegetreden' | 'input-klaar'
export const sessieDeelnemers = sqliteTable("sessie_deelnemers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessieId: integer("sessie_id").notNull(),
  rol: text("rol").notNull().default("stakeholder"),
  naam: text("naam"),
  email: text("email"),
  // Onraadbaar token voor de persoonlijke link /r/:token.
  inviteToken: text("invite_token").notNull().unique(),
  status: text("status").notNull().default("uitgenodigd"),
  // De individuele input van dit kringlid vóór de alignmentsessie (JSON).
  individueleInput: text("individuele_input"),
  uitgenodigdAt: text("uitgenodigd_at"),
  toegetredenAt: text("toegetreden_at"),
  createdAt: text("created_at").notNull(),
});
export type SessieDeelnemer = typeof sessieDeelnemers.$inferSelect;

export const rolSchema = z.enum(["facilitator", "stakeholder", "observer"]);
export type SessieRol = z.infer<typeof rolSchema>;

// Payload: een kringlid toevoegen aan een sessie (vóór vergrendeling).
export const voegKringlidSchema = z.object({
  rol: rolSchema.default("stakeholder"),
  naam: z.string().optional(),
  email: z.string().email("Ongeldig e-mailadres").optional().or(z.literal("")),
});
export type VoegKringlid = z.infer<typeof voegKringlidSchema>;

// Een vergelijkende STUDIE = kandidaatrapport vs. het rolprofiel (0 credits).
// Het delta-resultaat (need-lijnen, 2MINSCAN-energiekoppeling, waakpunten)
// wordt één-op-één overgenomen als JSON-contract.
export const sessieStudies = sqliteTable("sessie_studies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessieId: integer("sessie_id").notNull(),
  kandidaatLabel: text("kandidaat_label").notNull(),
  studieContract: text("studie_contract"),
  createdAt: text("created_at").notNull(),
});
export type SessieStudie = typeof sessieStudies.$inferSelect;

// ---------------------------------------------------------------------------
// Toegang & accreditatie (Fase: governance).
//
// Het platform bundelt meerdere instrumenten. Niet elke organisatie koopt
// alles: het HDD-deel kan los verkocht worden, en het zelf aanmaken van T4P
// Business-profielen vereist een aparte ACCREDITATIE. We verwijderen nooit een
// beheerder of een toegang uit de applicatie; we DISABLEN ze (commercieel
// zichtbaar maar geblokkeerd), zodat een upgrade enkel een omschakeling is.
//
// Drie tabellen:
//   • beheerders   = personen die het platform (of een deel ervan) beheren.
//                    Een "prior beheerder" hoort altijd bij TaPasCity en is de
//                    enige die toegang mag toekennen of intrekken.
//   • toegangen    = per beheerder x platformdeel: toegestaan of niet.
//   • (platformdelen zelf staan als statische registry in shared/platformdelen.)
// ---------------------------------------------------------------------------

export const beheerders = sqliteTable("beheerders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  email: text("email").notNull().unique(),
  // Organisatie waartoe de beheerder behoort (vrije tekst zodat de demo geen
  // harde organisatie-FK nodig heeft). Prior beheerders horen bij TaPasCity.
  organisatie: text("organisatie").notNull().default("TaPasCity"),
  // Prior beheerder = mag andere beheerders toevoegen en toegang beslissen.
  // ALTIJD iemand van TaPasCity.
  isPrior: integer("is_prior", { mode: "boolean" }).notNull().default(false),
  // Wie heeft deze beheerder toegevoegd (naam van de prior beheerder). Voor de
  // twee voorbeeld-priors leeg ("systeem").
  toegevoegdDoor: text("toegevoegd_door"),
  // Gedisabled i.p.v. verwijderd. actief=false => geen toegang, maar blijft in
  // de lijst staan zodat heractivatie eenvoudig is.
  actief: integer("actief", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});
export type Beheerder = typeof beheerders.$inferSelect;

export const insertBeheerderSchema = createInsertSchema(beheerders)
  .omit({ id: true, createdAt: true })
  .extend({
    naam: z.string().min(1, "Naam is verplicht"),
    email: z.string().email("Ongeldig e-mailadres"),
    organisatie: z.string().min(1).default("TaPasCity"),
    isPrior: z.boolean().default(false),
    actief: z.boolean().default(true),
  });
export type InsertBeheerder = z.infer<typeof insertBeheerderSchema>;

export const toegangen = sqliteTable("toegangen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  beheerderId: integer("beheerder_id").notNull(),
  // Verwijst naar een platformdeel-id uit shared/platformdelen.ts.
  platformdeel: text("platformdeel").notNull(),
  // Toegestaan = true (groen) of geblokkeerd = false (zichtbaar maar disabled).
  toegestaan: integer("toegestaan", { mode: "boolean" }).notNull().default(false),
  // Wie heeft deze toegang het laatst gewijzigd (naam prior beheerder).
  gewijzigdDoor: text("gewijzigd_door"),
  updatedAt: text("updated_at").notNull(),
});
export type Toegang = typeof toegangen.$inferSelect;

export const zetToegangSchema = z.object({
  beheerderId: z.number().int().positive(),
  platformdeel: z.string().min(1),
  toegestaan: z.boolean(),
});
export type ZetToegang = z.infer<typeof zetToegangSchema>;

// ---------------------------------------------------------------------------
// Tarieven (prior-only) — bewerkbare credit-tarifering per instrument.
//
// Twee soorten rijen leven in dezelfde tabel:
//   • OVERRIDE   = een rij waarvan `instrumentId` overeenkomt met een instrument
//                  uit de registry. De rij overschrijft het code-default tarief
//                  van dat instrument. isCustom = false.
//   • LOSSE REGEL = een rij die niet aan een registry-instrument hangt (bv. een
//                  losse dienst of toekomstig product). isCustom = true, dus
//                  vrij verwijderbaar.
//
// Tariferingsmodel:
//   • "per-stuk" → creditCost credits per afname.
//   • "bundel"   → bundelCredits credits per bundelGrootte afnames
//                  (bv. impact-roos: 10 stuks = 5 credits).
// ---------------------------------------------------------------------------
export const tarieven = sqliteTable("tarieven", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Stabiele sleutel. Voor overrides = het registry-instrumentId; voor losse
  // regels = een gegenereerde slug (bv. "custom-1718...").
  instrumentId: text("instrument_id").notNull().unique(),
  naam: text("naam").notNull(),
  omschrijving: text("omschrijving").notNull().default(""),
  // "individual" | "collaborative" | "journey" (vrije tekst i.f.v. registry).
  flowType: text("flow_type").notNull().default("individual"),
  // "per-stuk" | "bundel".
  model: text("model").notNull().default("per-stuk"),
  // Per-stuk-tarief (credits per afname). Bij bundel puur informatief.
  creditCost: integer("credit_cost").notNull().default(1),
  // Bundelvelden (enkel relevant bij model "bundel").
  bundelGrootte: integer("bundel_grootte"),
  bundelCredits: integer("bundel_credits"),
  // Losse regel (verwijderbaar) versus registry-override.
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  gewijzigdDoor: text("gewijzigd_door"),
  updatedAt: text("updated_at").notNull(),
});
export type Tarief = typeof tarieven.$inferSelect;

// Invoer voor het instellen/bewerken van één tarief-regel.
export const zetTariefSchema = z
  .object({
    instrumentId: z.string().min(1),
    naam: z.string().min(1, "Naam is verplicht"),
    omschrijving: z.string().default(""),
    flowType: z.enum(["individual", "collaborative", "journey"]).default("individual"),
    model: z.enum(["per-stuk", "bundel"]).default("per-stuk"),
    creditCost: z.number().int().min(0).default(1),
    bundelGrootte: z.number().int().positive().optional(),
    bundelCredits: z.number().int().min(0).optional(),
    isCustom: z.boolean().default(false),
  })
  .refine(
    (d) =>
      d.model !== "bundel" ||
      (typeof d.bundelGrootte === "number" &&
        d.bundelGrootte > 0 &&
        typeof d.bundelCredits === "number"),
    { message: "Een bundeltarief vereist een bundelgrootte (> 0) en een aantal credits." },
  );
export type ZetTarief = z.infer<typeof zetTariefSchema>;
