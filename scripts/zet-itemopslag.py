#!/usr/bin/env python3
"""Voegt de naamruimten `items` en `itemsets` toe aan de bekwaamheidsopslag,
en de vijf bijhorende auditacties aan server/audit-log.ts.

Ankergestuurd: elk anker moet exact één keer voorkomen, anders stopt het script.
"""
import io
import sys

FOUT = 0


def bewerk(pad, paren):
    global FOUT
    s = io.open(pad, encoding="utf-8").read()
    for anker, nieuw in paren:
        n = s.count(anker)
        if n != 1:
            print("FOUT %s: anker komt %d keer voor: %r" % (pad, n, anker[:70]))
            FOUT = 1
            return
        s = s.replace(anker, nieuw, 1)
    io.open(pad, "w", encoding="utf-8").write(s)
    print("OK %s -> %d regels" % (pad, s.count("\n") + 1))


# ---------------------------------------------------------------------------
# 1. De auditacties
# ---------------------------------------------------------------------------

AUDIT_ANKER = '''  "bekwaamheid_normprofiel_bevroren",
] as const;'''

AUDIT_NIEUW = '''  "bekwaamheid_normprofiel_bevroren",
  // Itembank en kennischeck. Het wijzigen van `gebruik` staat er apart in en
  // niet als gewone itemwijziging: dat is de enige handeling die een item uit de
  // meting haalt of erin houdt, en bij een bezwaar over een itemset is de vraag
  // altijd wanneer welk item van status wisselde.
  "bekwaamheid_item_neergezet",
  "bekwaamheid_item_gewijzigd",
  "bekwaamheid_item_gebruik_gewijzigd",
  "bekwaamheid_itemset_samengesteld",
  "bekwaamheid_itemset_ingeleverd",
] as const;'''

bewerk("server/audit-log.ts", [(AUDIT_ANKER, AUDIT_NIEUW)])

# ---------------------------------------------------------------------------
# 2. De invoer van storage.ts
# ---------------------------------------------------------------------------

IMPORT_ANKER = '''import type {
  Agendasoort,
  Coachingsplanuitkomst,
  Licentiestatus,
  Toetsuitkomst,
} from "./schema";'''

IMPORT_NIEUW = '''import type {
  Agendasoort,
  Coachingsplanuitkomst,
  Kennischeckblok,
  Licentiestatus,
  Toetsuitkomst,
} from "./schema";
import { BLOKNAMEN } from "./schema";
import { magOvergang, valideerItem, blokdekking } from "./itembank";
import type { Itemgebruik } from "./schema";
import {
  keurKennischeckNa,
  stelKennischeckSamen,
  volledigPlan,
  type Nakijkresultaat,
} from "./kennischeck";'''

# ---------------------------------------------------------------------------
# 3. De rijvormen en records
# ---------------------------------------------------------------------------

RIJ_ANKER = '''/**
 * Zet een rij om naar een record.
 *
 * De JSON-velden worden hier geparseerd en niet bij de aanroeper: zou elke'''

RIJ_NIEUW = '''interface ItemRij {
  id: number;
  instrument_id: string;
  as: string;
  blok: string | null;
  soort: string;
  stam: string;
  opties: string | null;
  sleutel: string;
  toelichting_goed: string;
  toelichting_fout: string;
  gebruik: string;
  versie: number;
  actief: number;
  p_waarde: number | null;
  discriminatie: number | null;
  bron_verwijzing: string | null;
}

export interface ItemRecord {
  id: number;
  instrumentId: string;
  as: string;
  blok: string | null;
  soort: string;
  stam: string;
  opties: string[] | null;
  sleutel: string;
  toelichtingGoed: string;
  toelichtingFout: string;
  gebruik: Itemgebruik;
  versie: number;
  actief: boolean;
  pWaarde: number | null;
  discriminatie: number | null;
  bronVerwijzing: string | null;
}

interface ItemsetRij {
  id: number;
  ronde_id: number;
  bewijsstuk_nummer: number;
  item_ids: string;
  antwoorden: string | null;
  item_tijden: string | null;
  samengesteld_op: string;
}

export interface ItemsetRecord {
  id: number;
  rondeId: number;
  bewijsstukNummer: number;
  itemIds: number[];
  antwoorden: Record<string, string> | null;
  itemTijden: Record<string, number> | null;
  samengesteldOp: string;
}

/**
 * Zet een itemrij om naar een record.
 *
 * Onleesbare `opties` gooit hier en wordt niet stil op `null` gezet. Een
 * meerkeuze-item zonder mogelijkheden zou anders als item met nul opties door de
 * samensteller glippen en op het scherm van een kandidaat belanden als vraag
 * zonder antwoorden.
 */
function leesItem(rij: ItemRij): ItemRecord {
  let opties: string[] | null = null;
  if (rij.opties !== null) {
    try {
      opties = JSON.parse(rij.opties) as string[];
    } catch (e) {
      throw new Error(
        `Item ${rij.id} heeft onleesbare JSON in opties: ${(e as Error).message}`,
      );
    }
  }
  return {
    id: rij.id,
    instrumentId: rij.instrument_id,
    as: rij.as,
    blok: rij.blok,
    soort: rij.soort,
    stam: rij.stam,
    opties,
    sleutel: rij.sleutel,
    toelichtingGoed: rij.toelichting_goed,
    toelichtingFout: rij.toelichting_fout,
    gebruik: rij.gebruik as Itemgebruik,
    versie: rij.versie,
    actief: rij.actief === 1,
    pWaarde: rij.p_waarde,
    discriminatie: rij.discriminatie,
    bronVerwijzing: rij.bron_verwijzing,
  };
}

/**
 * Zet een itemsetrij om naar een record.
 *
 * `item_ids` gooit bij onleesbare JSON: een itemset waarvan niet vaststaat welke
 * items erin zaten, is geen bewijsstuk meer. `antwoorden` en `item_tijden` gooien
 * ook, om dezelfde reden — een half gelezen antwoordenblok zou een score
 * opleveren over items waarvan de antwoorden zijn weggevallen.
 */
function leesItemset(rij: ItemsetRij): ItemsetRecord {
  let itemIds: number[];
  let antwoorden: Record<string, string> | null = null;
  let itemTijden: Record<string, number> | null = null;
  try {
    itemIds = JSON.parse(rij.item_ids) as number[];
    if (rij.antwoorden !== null) {
      antwoorden = JSON.parse(rij.antwoorden) as Record<string, string>;
    }
    if (rij.item_tijden !== null) {
      itemTijden = JSON.parse(rij.item_tijden) as Record<string, number>;
    }
  } catch (e) {
    throw new Error(
      `Itemset ${rij.id} heeft onleesbare JSON: ${(e as Error).message}`,
    );
  }
  return {
    id: rij.id,
    rondeId: rij.ronde_id,
    bewijsstukNummer: rij.bewijsstuk_nummer,
    itemIds,
    antwoorden,
    itemTijden,
    samengesteldOp: rij.samengesteld_op,
  };
}

/**
 * Zet een rij om naar een record.
 *
 * De JSON-velden worden hier geparseerd en niet bij de aanroeper: zou elke'''

# ---------------------------------------------------------------------------
# 4. De twee naamruimten, ingevoegd vóór de retour
# ---------------------------------------------------------------------------

RETOUR_ANKER = '''  return {
    register,
    licenties,
    normprofielen,
    tellers,
    agenda,
    toetsen,
    plannen,'''

NAAMRUIMTEN = '''  // -------------------------------------------------------------------------
  // De itembank
  // -------------------------------------------------------------------------

  const items = {
    /** Zoekt één item op nummer. */
    vindOp(id: number): ItemRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_items WHERE id = ?")
        .get(id) as ItemRij | undefined;
      return rij ? leesItem(rij) : undefined;
    },

    /**
     * De items van een instrument, nieuwste eerst.
     *
     * De filters zijn optioneel en werken samen. Standaard komen ook de niet
     * actieve items mee: een beheerscherm dat het bestaan van een gedeactiveerd
     * item verbergt, laat iemand hetzelfde item een tweede keer schrijven.
     */
    lijst(
      instrumentId: string,
      filter: { as?: string; blok?: string; gebruik?: string; alleenActief?: boolean } = {},
    ): ItemRecord[] {
      const voorwaarden = ["instrument_id = ?"];
      const waarden: unknown[] = [instrumentId];
      if (filter.as !== undefined) {
        voorwaarden.push('"as" = ?');
        waarden.push(filter.as);
      }
      if (filter.blok !== undefined) {
        voorwaarden.push("blok = ?");
        waarden.push(filter.blok);
      }
      if (filter.gebruik !== undefined) {
        voorwaarden.push("gebruik = ?");
        waarden.push(filter.gebruik);
      }
      if (filter.alleenActief === true) {
        voorwaarden.push("actief = 1");
      }
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_items
           WHERE ${voorwaarden.join(" AND ")}
           ORDER BY id DESC`,
        )
        .all(...waarden) as ItemRij[];
      return rijen.map(leesItem);
    },

    /**
     * Legt een nieuw item neer.
     *
     * Het gebruik staat standaard op `oefenen` en dat is geen willekeur: de weg
     * van oefenen naar meten is afgesloten, dus een item dat als oefenitem
     * begint, kan nooit meer meetitem worden. Wie een meetitem wil, geeft dat
     * hier expliciet mee. Dat is precies één handeling extra op de plaats waar de
     * beslissing hoort te vallen, in plaats van een stille standaardwaarde die
     * later niet meer te repareren is.
     */
    zetNeer(invoer: {
      instrumentId: string;
      as: string;
      blok?: string | null;
      soort: string;
      stam: string;
      opties?: string[] | null;
      sleutel: string;
      toelichtingGoed: string;
      toelichtingFout: string;
      gebruik?: Itemgebruik;
      bronVerwijzing?: string | null;
      doorBeheerderId?: number | null;
    }): ItemRecord {
      const bevindingen = valideerItem(invoer);
      if (bevindingen.length) {
        throw new Error(
          "Item afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      const uitkomst = db
        .prepare(
          `INSERT INTO bekwaamheid_items
             (instrument_id, "as", blok, soort, stam, opties, sleutel,
              toelichting_goed, toelichting_fout, gebruik, versie, actief,
              bron_verwijzing)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        )
        .run(
          invoer.instrumentId,
          invoer.as,
          invoer.blok ?? null,
          invoer.soort,
          invoer.stam,
          invoer.opties ? JSON.stringify(invoer.opties) : null,
          invoer.sleutel,
          invoer.toelichtingGoed,
          invoer.toelichtingFout,
          invoer.gebruik ?? "oefenen",
          invoer.bronVerwijzing ?? null,
        );

      const id = Number(uitkomst.lastInsertRowid);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_item_neergezet",
        afnameId: null,
        detail:
          `Item ${id} voor ${invoer.instrumentId} neergezet op as ${invoer.as}` +
          `${invoer.blok ? `, blok ${invoer.blok}` : ""} als ${invoer.gebruik ?? "oefenen"}.`,
      });
      return items.vindOp(id)!;
    },

    /**
     * Werkt een item bij.
     *
     * Het gebruik loopt via `magOvergang` en wordt hier geweigerd wanneer de
     * overgang niet mag. Dat gebeurt in de opslaglaag en niet alleen in een route,
     * want dan zou een migratiescript of een tweede route erlangs kunnen.
     *
     * Een gewijzigd item houdt zijn nummer. Een itemset die dit item bevat,
     * verwijst naar dat nummer, en die verwijzing mag niet naar een ander item
     * gaan wijzen. `versie` gaat daarom met één omhoog bij elke inhoudelijke
     * wijziging: zo is bij een bezwaar te zien dat de tekst na de afname is
     * aangepast, ook al is het nummer hetzelfde.
     */
    wijzig(
      id: number,
      invoer: {
        blok?: string | null;
        stam?: string;
        opties?: string[] | null;
        sleutel?: string;
        toelichtingGoed?: string;
        toelichtingFout?: string;
        gebruik?: Itemgebruik;
        actief?: boolean;
        pWaarde?: number | null;
        discriminatie?: number | null;
        bronVerwijzing?: string | null;
        doorBeheerderId?: number | null;
      },
    ): ItemRecord {
      const bestaand = items.vindOp(id);
      if (!bestaand) {
        throw new Error(`Item ${id} bestaat niet.`);
      }

      let gebruikGewijzigd = false;
      if (invoer.gebruik !== undefined && invoer.gebruik !== bestaand.gebruik) {
        const uitspraak = magOvergang(bestaand.gebruik, invoer.gebruik);
        if (!uitspraak.toegestaan) {
          throw new Error(`Item ${id}: ${uitspraak.reden}`);
        }
        gebruikGewijzigd = true;
      }

      const samengevoegd = {
        instrumentId: bestaand.instrumentId,
        as: bestaand.as,
        blok: invoer.blok !== undefined ? invoer.blok : bestaand.blok,
        soort: bestaand.soort,
        stam: invoer.stam ?? bestaand.stam,
        opties: invoer.opties !== undefined ? invoer.opties : bestaand.opties,
        sleutel: invoer.sleutel ?? bestaand.sleutel,
        toelichtingGoed: invoer.toelichtingGoed ?? bestaand.toelichtingGoed,
        toelichtingFout: invoer.toelichtingFout ?? bestaand.toelichtingFout,
        gebruik: invoer.gebruik ?? bestaand.gebruik,
      };

      const bevindingen = valideerItem(samengevoegd);
      if (bevindingen.length) {
        throw new Error(
          "Item afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      // Een gewijzigde p-waarde of discriminatie is uitkomst van itemanalyse en
      // geen inhoudelijke wijziging van het item; die verhoogt de versie niet.
      const inhoudelijk =
        invoer.stam !== undefined ||
        invoer.opties !== undefined ||
        invoer.sleutel !== undefined ||
        invoer.toelichtingGoed !== undefined ||
        invoer.toelichtingFout !== undefined ||
        invoer.blok !== undefined;

      db.prepare(
        `UPDATE bekwaamheid_items
         SET blok = ?, stam = ?, opties = ?, sleutel = ?, toelichting_goed = ?,
             toelichting_fout = ?, gebruik = ?, actief = ?, versie = ?,
             p_waarde = ?, discriminatie = ?, bron_verwijzing = ?
         WHERE id = ?`,
      ).run(
        samengevoegd.blok,
        samengevoegd.stam,
        samengevoegd.opties ? JSON.stringify(samengevoegd.opties) : null,
        samengevoegd.sleutel,
        samengevoegd.toelichtingGoed,
        samengevoegd.toelichtingFout,
        samengevoegd.gebruik,
        invoer.actief !== undefined ? (invoer.actief ? 1 : 0) : bestaand.actief ? 1 : 0,
        inhoudelijk ? bestaand.versie + 1 : bestaand.versie,
        invoer.pWaarde !== undefined ? invoer.pWaarde : bestaand.pWaarde,
        invoer.discriminatie !== undefined ? invoer.discriminatie : bestaand.discriminatie,
        invoer.bronVerwijzing !== undefined ? invoer.bronVerwijzing : bestaand.bronVerwijzing,
        id,
      );

      if (gebruikGewijzigd) {
        audit({
          adminId: invoer.doorBeheerderId ?? null,
          actie: "bekwaamheid_item_gebruik_gewijzigd",
          afnameId: null,
          detail: `Item ${id} van ${bestaand.gebruik} naar ${samengevoegd.gebruik}.`,
        });
      }
      if (inhoudelijk || invoer.actief !== undefined) {
        audit({
          adminId: invoer.doorBeheerderId ?? null,
          actie: "bekwaamheid_item_gewijzigd",
          afnameId: null,
          detail:
            `Item ${id} gewijzigd naar versie ` +
            `${inhoudelijk ? bestaand.versie + 1 : bestaand.versie}.`,
        });
      }
      return items.vindOp(id)!;
    },

    /**
     * Hoeveel meetbare items er per kennischeckblok zijn.
     *
     * Voor het beheerscherm en voor wie wil weten of een kennischeck te maken is
     * vóór hij het probeert.
     */
    dekking(instrumentId: string): Record<Kennischeckblok, number> {
      return blokdekking(items.lijst(instrumentId, { as: "weten" }));
    },
  };

  // -------------------------------------------------------------------------
  // De itemsets
  // -------------------------------------------------------------------------

  const itemsets = {
    /** Zoekt één itemset op nummer. */
    vindOp(id: number): ItemsetRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_itemsets WHERE id = ?")
        .get(id) as ItemsetRij | undefined;
      return rij ? leesItemset(rij) : undefined;
    },

    /** De itemset van één bewijsstuk in één ronde. Er is er hoogstens één. */
    vindVoorBewijsstuk(rondeId: number, bewijsstukNummer: number): ItemsetRecord | undefined {
      const rij = db
        .prepare(
          `SELECT * FROM bekwaamheid_itemsets
           WHERE ronde_id = ? AND bewijsstuk_nummer = ?`,
        )
        .get(rondeId, bewijsstukNummer) as ItemsetRij | undefined;
      return rij ? leesItemset(rij) : undefined;
    },

    /**
     * Welke item-ids deze persoon eerder in een itemset kreeg.
     *
     * Over alle rondes van die persoon heen, niet alleen de vorige. Bij een derde
     * ronde na twee mislukte pogingen moeten beide eerdere sets uitgesloten
     * blijven; wie alleen de vorige ronde uitsluit, biedt in ronde drie de items
     * van ronde één opnieuw aan.
     */
    eerdereItemIds(geaccrediteerdeId: number, bewijsstukNummer: number): number[] {
      const rijen = db
        .prepare(
          `SELECT s.item_ids AS item_ids
           FROM bekwaamheid_itemsets s
           JOIN bekwaamheid_rondes r ON r.id = s.ronde_id
           WHERE r.geaccrediteerde_id = ? AND s.bewijsstuk_nummer = ?`,
        )
        .all(geaccrediteerdeId, bewijsstukNummer) as { item_ids: string }[];
      const uit = new Set<number>();
      for (const rij of rijen) {
        let lijst: number[];
        try {
          lijst = JSON.parse(rij.item_ids) as number[];
        } catch (e) {
          // Een onleesbare eerdere set mag deze samenstelling niet blokkeren,
          // maar hij mag ook niet stil verdwijnen: dan zou de kandidaat items
          // kunnen terugkrijgen die hij al zag. Gooien is hier het veiligste.
          throw new Error(
            `Een eerdere itemset van persoon ${geaccrediteerdeId} is onleesbaar: ` +
              `${(e as Error).message}`,
          );
        }
        for (const id of lijst) uit.add(id);
      }
      return [...uit].sort((a, b) => a - b);
    },

    /**
     * Stelt de kennischeck van een ronde samen en legt hem vast.
     *
     * Het rekenwerk zit in `kennischeck.ts`; dit is de weg naar de databank. Wat
     * hier gebeurt en niet daar: de bank ophalen, de eerdere item-ids van deze
     * persoon ophalen, en het resultaat wegschrijven.
     *
     * De unieke index op (ronde_id, bewijsstuk_nummer) maakt een tweede
     * samenstelling voor hetzelfde bewijsstuk onmogelijk. Dat is de bedoeling:
     * opnieuw samenstellen zou betekenen dat een kandidaat die de eerste set al
     * heeft gezien een nieuwe krijgt, en dan is de eerste set uitgelekt zonder dat
     * er iemand van weet. Wie werkelijk een nieuwe set nodig heeft, opent een
     * nieuwe ronde; dan komt de uitsluiting op eerdere items automatisch mee.
     */
    stelSamen(invoer: {
      rondeId: number;
      bewijsstukNummer?: number;
      plan?: Record<Kennischeckblok, number>;
      zaad?: number;
      doorBeheerderId?: number | null;
    }): ItemsetRecord {
      const bewijsstukNummer = invoer.bewijsstukNummer ?? 1;

      const ronde = db
        .prepare(
          `SELECT id, geaccrediteerde_id, instrument_id
           FROM bekwaamheid_rondes WHERE id = ?`,
        )
        .get(invoer.rondeId) as
        | { id: number; geaccrediteerde_id: number; instrument_id: string }
        | undefined;
      if (!ronde) {
        throw new Error(`Ronde ${invoer.rondeId} bestaat niet.`);
      }

      const bestaand = itemsets.vindVoorBewijsstuk(invoer.rondeId, bewijsstukNummer);
      if (bestaand) {
        throw new Error(
          `Ronde ${invoer.rondeId} heeft voor bewijsstuk ${bewijsstukNummer} al een ` +
            `itemset (nummer ${bestaand.id}). Een tweede samenstelling zou de eerste ` +
            `set laten uitlekken zonder spoor; open een nieuwe ronde.`,
        );
      }

      const bank = items.lijst(ronde.instrument_id, { as: "weten" });
      const uitsluiten = itemsets.eerdereItemIds(ronde.geaccrediteerde_id, bewijsstukNummer);
      const plan = invoer.plan ?? volledigPlan();

      const samenstelling = stelKennischeckSamen({
        bank,
        plan,
        uitsluiten,
        zaad: invoer.zaad,
      });

      if (!samenstelling.gelukt) {
        const uitleg = samenstelling.tekorten
          .map(
            (t) =>
              `blok ${t.blok} (${BLOKNAMEN[t.blok]}): ${t.beschikbaar} van ${t.gevraagd}`,
          )
          .join("; ");
        throw new Error(
          `De kennischeck voor ${ronde.instrument_id} is niet samen te stellen. ` +
            `Tekort per blok: ${uitleg}. Er is geen verkorte set gemaakt: de drempel ` +
            `van 60% is vastgesteld op de volledige verdeling, en een kleinere set ` +
            `levert een score op die niet met die drempel te vergelijken is.`,
        );
      }

      const uitkomst = db
        .prepare(
          `INSERT INTO bekwaamheid_itemsets
             (ronde_id, bewijsstuk_nummer, item_ids, samengesteld_op)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          invoer.rondeId,
          bewijsstukNummer,
          JSON.stringify(samenstelling.itemIds),
          nu(),
        );

      const id = Number(uitkomst.lastInsertRowid);
      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_itemset_samengesteld",
        afnameId: null,
        detail:
          `Itemset ${id} voor ronde ${invoer.rondeId} bewijsstuk ${bewijsstukNummer}: ` +
          `${samenstelling.itemIds.length} items, zaad ${samenstelling.zaad}, ` +
          `${uitsluiten.length} eerder gezien uitgesloten.`,
      });
      return itemsets.vindOp(id)!;
    },

    /**
     * Neemt de antwoorden van een kandidaat aan. Eenmalig.
     *
     * Een tweede inlevering wordt geweigerd en niet stil genegeerd. Draaiboek
     * §4.3: één inleverbeweging. Zonder die weigering kan een kandidaat na het
     * zien van zijn score opnieuw inleveren, en dan meet de check niet meer wat
     * iemand wist maar hoe vaak hij het probeerde. De weigering komt uit de
     * databank en niet uit een vlag in het geheugen: twee gelijktijdige verzoeken
     * moeten er ook op stuklopen.
     */
    leverIn(invoer: {
      itemsetId: number;
      antwoorden: Record<string, string>;
      itemTijden?: Record<string, number> | null;
      doorBeheerderId?: number | null;
    }): ItemsetRecord {
      const bestaand = itemsets.vindOp(invoer.itemsetId);
      if (!bestaand) {
        throw new Error(`Itemset ${invoer.itemsetId} bestaat niet.`);
      }

      // Het patroon van `server/routes/afnames.ts`: lege tijden overschrijven
      // bewaarde tijden niet. Een oudere client die het veld niet kent, stuurt een
      // leeg object mee, en dat mag geen meetgegevens wissen.
      const tijden =
        invoer.itemTijden && Object.keys(invoer.itemTijden).length > 0
          ? JSON.stringify(invoer.itemTijden)
          : null;

      const uitkomst = db
        .prepare(
          `UPDATE bekwaamheid_itemsets
           SET antwoorden = ?,
               item_tijden = COALESCE(?, item_tijden)
           WHERE id = ? AND antwoorden IS NULL`,
        )
        .run(JSON.stringify(invoer.antwoorden), tijden, invoer.itemsetId);

      if (uitkomst.changes === 0) {
        throw new Error(
          `Itemset ${invoer.itemsetId} is al ingeleverd. Een tweede inlevering wordt ` +
            `niet aangenomen: de check meet wat iemand wist, niet hoe vaak hij het ` +
            `probeerde.`,
        );
      }

      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_itemset_ingeleverd",
        afnameId: null,
        detail:
          `Itemset ${invoer.itemsetId} ingeleverd met ` +
          `${Object.keys(invoer.antwoorden).length} antwoorden op ` +
          `${bestaand.itemIds.length} items.`,
      });
      return itemsets.vindOp(invoer.itemsetId)!;
    },

    /**
     * Kijkt een ingeleverde itemset na.
     *
     * Leest, rekent en schrijft niets. Het resultaat gaat niet vanzelf naar het
     * bewijsstuk: dat is een handeling van blok 5, waar ook de wachtrij voor de
     * open items hangt. Zou deze functie de score wegschrijven, dan zou nakijken
     * en vaststellen dezelfde handeling worden, en dan is er geen moment meer
     * waarop een beoordelaar naar een open item kan kijken vóór er een uitkomst
     * ligt.
     *
     * De items komen in de bewaarde volgorde terug en niet in de volgorde van de
     * databank: `perItem` moet naast de itemset te leggen zijn.
     */
    keurNa(invoer: {
      itemsetId: number;
      handmatigeScores?: Record<string, number>;
      uitsluiten?: readonly number[];
      redenUitsluiting?: string;
    }): Nakijkresultaat {
      const set = itemsets.vindOp(invoer.itemsetId);
      if (!set) {
        throw new Error(`Itemset ${invoer.itemsetId} bestaat niet.`);
      }
      if (set.antwoorden === null) {
        throw new Error(
          `Itemset ${invoer.itemsetId} is nog niet ingeleverd; er is niets na te kijken.`,
        );
      }

      const opNummer = new Map<number, ItemRecord>();
      for (const id of set.itemIds) {
        const item = items.vindOp(id);
        if (!item) {
          throw new Error(
            `Itemset ${invoer.itemsetId} verwijst naar item ${id}, dat niet bestaat. ` +
              `Nakijken met een ontbrekend item zou een score opleveren over een ` +
              `andere set dan de kandidaat kreeg.`,
          );
        }
        opNummer.set(id, item);
      }

      return keurKennischeckNa({
        items: set.itemIds.map((id) => {
          const item = opNummer.get(id)!;
          return { id: item.id, soort: item.soort, sleutel: item.sleutel, blok: item.blok };
        }),
        antwoorden: set.antwoorden,
        handmatigeScores: invoer.handmatigeScores,
        uitsluiten: invoer.uitsluiten,
        redenUitsluiting: invoer.redenUitsluiting,
      });
    },
  };

  return {
    register,
    licenties,
    normprofielen,
    tellers,
    agenda,
    toetsen,
    plannen,
    items,
    itemsets,'''

bewerk(
    "server/bekwaamheid/storage.ts",
    [
        (IMPORT_ANKER, IMPORT_NIEUW),
        (RIJ_ANKER, RIJ_NIEUW),
        (RETOUR_ANKER, NAAMRUIMTEN),
    ],
)

sys.exit(FOUT)
