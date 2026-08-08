import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { beheerders, organisaties } from "@shared/schema";

/**
 * Vastgelegde fasen van het trajectprotocol. Een nieuw traject krijgt telkens
 * alle negen rijen, in deze volgorde, zodat de poorten vanaf het begin zichtbaar
 * en auditbaar zijn.
 */
export const FASEN_VAN_TRAJECT = [
  {
    volgnummer: 1,
    naam: "Verkenning",
    poortomschrijving: "Geheimhouding getekend en de kring 0 samengesteld.",
  },
  {
    volgnummer: 2,
    naam: "Kaderafspraak",
    poortomschrijving: "Het charter is door beide ankerpunten bevestigd.",
  },
  {
    volgnummer: 3,
    naam: "Intentie",
    poortomschrijving: "De structuur ligt vast en de wettelijke verplichtingen zijn benoemd.",
  },
  {
    volgnummer: 4,
    naam: "Onderzoek",
    poortomschrijving:
      "Alle werkstromen hebben voorlopige bevindingen ingediend en niets is buiten de onderzoekskring geraakt.",
  },
  {
    volgnummer: 5,
    naam: "Terugkoppeling en scharnier",
    poortomschrijving: "Beide ankerpunten hebben de teruggave punt per punt vrijgegeven.",
  },
  {
    volgnummer: 6,
    naam: "Gedeelde vaststelling en onderhandeling",
    poortomschrijving:
      "Er ligt een gedeelde vaststelling met beide namen, inclusief blijvende onenigheid.",
  },
  {
    volgnummer: 7,
    naam: "Overeenkomst en wettelijk overleg",
    poortomschrijving: "Het overleg is gevoerd en gedocumenteerd.",
  },
  {
    volgnummer: 8,
    naam: "Aankondiging",
    poortomschrijving: "Elke kring is bereikt binnen het afgesproken tijdvenster.",
  },
  {
    volgnummer: 9,
    naam: "De eerste honderd dagen en afronding",
    poortomschrijving: "Trajectverslag opgeleverd en gegevensbeslissing genomen.",
  },
] as const;

export const NAMEN_VAN_WERKSTROMEN = [
  "financieel",
  "juridisch",
  "fiscaal",
  "commercieel",
  "technisch",
  "menselijk",
] as const;

export const trajecten = sqliteTable(
  "traject",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    naam: text("naam").notNull(),
    organisatieId: integer("organisatie_id")
      .notNull()
      .references(() => organisaties.id),
    aangemaaktDoorBeheerderId: integer("aangemaakt_door_beheerder_id")
      .notNull()
      .references(() => beheerders.id),
    huidigeFase: integer("huidige_fase").notNull().default(1),
    zekerheidstrap: integer("zekerheidstrap").notNull().default(1),
    status: text("status").notNull().default("open"),
    aangemaaktOp: integer("aangemaakt_op").notNull(),
  },
  (tabel) => [
    index("idx_traject_organisatie").on(tabel.organisatieId),
    check("traject_huidige_fase_bereik", sql`${tabel.huidigeFase} BETWEEN 1 AND 9`),
    check("traject_zekerheidstrap_bereik", sql`${tabel.zekerheidstrap} BETWEEN 1 AND 4`),
  ],
);

export const trajectFasen = sqliteTable(
  "traject_fasen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trajectId: integer("traject_id")
      .notNull()
      .references(() => trajecten.id),
    volgnummer: integer("volgnummer").notNull(),
    naam: text("naam").notNull(),
    poortomschrijving: text("poortomschrijving").notNull(),
    poortstatus: text("poortstatus").notNull().default("gesloten"),
    poortGeopendOp: integer("poort_geopend_op"),
    poortGeopendDoorBeheerderId: integer("poort_geopend_door_beheerder_id").references(
      () => beheerders.id,
    ),
  },
  (tabel) => [
    index("idx_traject_fasen_traject").on(tabel.trajectId),
    uniqueIndex("uq_traject_fasen_volgnummer").on(tabel.trajectId, tabel.volgnummer),
    check("traject_fasen_volgnummer_bereik", sql`${tabel.volgnummer} BETWEEN 1 AND 9`),
  ],
);

export const trajectPartijen = sqliteTable(
  "traject_partijen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trajectId: integer("traject_id")
      .notNull()
      .references(() => trajecten.id),
    soort: text("soort").notNull(),
    naam: text("naam").notNull(),
    ankerpunt: text("ankerpunt").notNull(),
    kring: integer("kring").notNull(),
    rol: text("rol").notNull(),
  },
  (tabel) => [
    index("idx_traject_partijen_traject").on(tabel.trajectId),
    check("traject_partijen_kring_bereik", sql`${tabel.kring} BETWEEN 0 AND 4`),
  ],
);

export const trajectLijnen = sqliteTable(
  "traject_lijnen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trajectId: integer("traject_id")
      .notNull()
      .references(() => trajecten.id),
    partijEenId: integer("partij_een_id")
      .notNull()
      .references(() => trajectPartijen.id),
    partijTweeId: integer("partij_twee_id")
      .notNull()
      .references(() => trajectPartijen.id),
    stiltedrempelDagen: integer("stiltedrempel_dagen").notNull(),
    aangemaaktOp: integer("aangemaakt_op").notNull(),
  },
  (tabel) => [
    index("idx_traject_lijnen_traject").on(tabel.trajectId),
    uniqueIndex("uq_traject_lijnen_partijen").on(
      tabel.trajectId,
      tabel.partijEenId,
      tabel.partijTweeId,
    ),
    check("traject_lijnen_partijvolgorde", sql`${tabel.partijEenId} < ${tabel.partijTweeId}`),
    check("traject_lijnen_stiltedrempel", sql`${tabel.stiltedrempelDagen} >= 0`),
  ],
);

export const trajectWerkstromen = sqliteTable(
  "traject_werkstromen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trajectId: integer("traject_id")
      .notNull()
      .references(() => trajecten.id),
    naam: text("naam").notNull(),
    leiderPartijId: integer("leider_partij_id").references(() => trajectPartijen.id),
    status: text("status").notNull().default("niet_gestart"),
    eerstvolgendeOplevering: text("eerstvolgende_oplevering"),
    eerstvolgendeOpleveringOp: text("eerstvolgende_oplevering_op"),
  },
  (tabel) => [
    index("idx_traject_werkstromen_traject").on(tabel.trajectId),
    uniqueIndex("uq_traject_werkstromen_naam").on(tabel.trajectId, tabel.naam),
  ],
);

export const trajectVragen = sqliteTable(
  "traject_vragen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trajectId: integer("traject_id")
      .notNull()
      .references(() => trajecten.id),
    lijnId: integer("lijn_id")
      .notNull()
      .references(() => trajectLijnen.id),
    vragerPartijId: integer("vrager_partij_id")
      .notNull()
      .references(() => trajectPartijen.id),
    ontvangerPartijId: integer("ontvanger_partij_id")
      .notNull()
      .references(() => trajectPartijen.id),
    werkstroomId: integer("werkstroom_id")
      .notNull()
      .references(() => trajectWerkstromen.id),
    vraagtekst: text("vraagtekst").notNull(),
    kader: text("kader").notNull(),
    antwoordtermijnOp: integer("antwoordtermijn_op").notNull(),
    antwoordKring: integer("antwoord_kring").notNull(),
    toestand: text("toestand").notNull().default("gesteld"),
    vrijgaveVragerDoorBeheerderId: integer("vrijgave_vrager_door_beheerder_id").references(
      () => beheerders.id,
    ),
    vrijgaveOntvangerDoorBeheerderId: integer("vrijgave_ontvanger_door_beheerder_id").references(
      () => beheerders.id,
    ),
    vrijgaveVragerOp: integer("vrijgave_vrager_op"),
    vrijgaveOntvangerOp: integer("vrijgave_ontvanger_op"),
    aangemaaktOp: integer("aangemaakt_op").notNull(),
  },
  (tabel) => [
    index("idx_traject_vragen_traject").on(tabel.trajectId),
    index("idx_traject_vragen_lijn").on(tabel.lijnId),
    check("traject_vragen_antwoordkring_bereik", sql`${tabel.antwoordKring} BETWEEN 0 AND 4`),
    check(
      "traject_vragen_toestand_geldig",
      sql`${tabel.toestand} IN ('gesteld', 'erkend', 'in_behandeling', 'beantwoord', 'gedeeld')`,
    ),
  ],
);

export const trajectGebeurtenissen = sqliteTable(
  "traject_gebeurtenissen",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trajectId: integer("traject_id")
      .notNull()
      .references(() => trajecten.id),
    lijnId: integer("lijn_id")
      .notNull()
      .references(() => trajectLijnen.id),
    tijdstip: integer("tijdstip").notNull(),
    soort: text("soort").notNull(),
    vaststelling: text("vaststelling").notNull(),
    indruk: text("indruk").notNull().default(""),
  },
  (tabel) => [
    index("idx_traject_gebeurtenissen_lijn_tijdstip").on(tabel.lijnId, tabel.tijdstip),
    check(
      "traject_gebeurtenissen_soort_geldig",
      sql`${tabel.soort} IN ('gesprek', 'bericht', 'rechtstreeks_contact')`,
    ),
  ],
);

export type Traject = typeof trajecten.$inferSelect;
export type TrajectFase = typeof trajectFasen.$inferSelect;
export type TrajectPartij = typeof trajectPartijen.$inferSelect;
export type TrajectLijn = typeof trajectLijnen.$inferSelect;
export type TrajectWerkstroom = typeof trajectWerkstromen.$inferSelect;
export type TrajectVraag = typeof trajectVragen.$inferSelect;
export type TrajectGebeurtenis = typeof trajectGebeurtenissen.$inferSelect;
