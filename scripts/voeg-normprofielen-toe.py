#!/usr/bin/env python3
"""Voegt de naamruimte `normprofielen` toe aan server/bekwaamheid/storage.ts.

Als script en niet met de bewerkfunctie, omdat die faalt op de samengestelde
accentvormen in de Nederlandse commentaren.
"""
import io
import sys

PAD = "server/bekwaamheid/storage.ts"

ANKER = "  return {\n    register,\n    licenties,\n"
VERVANG = "  return {\n    register,\n    licenties,\n    normprofielen,\n"

BLOK = '''  // -------------------------------------------------------------------------
  // De normprofielen
  //
  // Bouwplan blok 3: "Bevriezing wordt in de datalaag afgedwongen, niet in de
  // UI: een update op een rij met `bevrorenOp != null` gooit. Een nieuwe cesuur
  // is een nieuwe versie."
  //
  // Waarom de datalaag en niet een knop die grijs wordt. Een bevroren cesuur is
  // de enige reden waarom een beslissing over iemands bekwaamheid achteraf te
  // verdedigen is: ze bewijst dat de lat er al lag voordat er gemeten werd. Een
  // controle in de gebruikersinterface bewijst dat niet, want ze is te omzeilen
  // door een tweede schrijfweg, een script of een latere route. Alleen een
  // controle op de plek waar de rij daadwerkelijk verandert, geldt voor alle
  // schrijfwegen tegelijk. Dit is dezelfde reden waarom de overgang
  // `oefenen -> meten` bij de items hier wordt tegengehouden en niet in een
  // formulier.
  // -------------------------------------------------------------------------

  const normprofielen = {
    /**
     * Zoekt een normprofiel op nummer.
     */
    vindOp(id: number): NormprofielRecord | undefined {
      const rij = db
        .prepare("SELECT * FROM bekwaamheid_normprofielen WHERE id = ?")
        .get(id) as NormprofielRij | undefined;
      return rij ? leesNormprofiel(rij) : undefined;
    },

    /**
     * Zoekt een bepaalde versie voor een instrument.
     */
    vindVersie(instrumentId: string, versie: number): NormprofielRecord | undefined {
      const rij = db
        .prepare(
          `SELECT * FROM bekwaamheid_normprofielen
           WHERE instrument_id = ? AND versie = ?`,
        )
        .get(instrumentId, versie) as NormprofielRij | undefined;
      return rij ? leesNormprofiel(rij) : undefined;
    },

    /**
     * Geeft het geldende normprofiel voor een instrument.
     *
     * Uitdrukkelijk: het hoogste BEVROREN versienummer, niet simpelweg het
     * hoogste. Een normprofiel dat nog niet bevroren is, is een concept en mag
     * geen enkele beslissing raken. Zou deze functie het hoogste nummer geven,
     * dan zou iemand die aan een nieuwe cesuur werkt onbedoeld de lopende
     * rondes op een half ingevulde lat zetten.
     */
    geldend(instrumentId: string): NormprofielRecord | undefined {
      const rij = db
        .prepare(
          `SELECT * FROM bekwaamheid_normprofielen
           WHERE instrument_id = ? AND bevroren_op IS NOT NULL
           ORDER BY versie DESC LIMIT 1`,
        )
        .get(instrumentId) as NormprofielRij | undefined;
      return rij ? leesNormprofiel(rij) : undefined;
    },

    /**
     * Alle versies voor een instrument, nieuwste eerst.
     */
    lijst(instrumentId: string): NormprofielRecord[] {
      const rijen = db
        .prepare(
          `SELECT * FROM bekwaamheid_normprofielen
           WHERE instrument_id = ? ORDER BY versie DESC`,
        )
        .all(instrumentId) as NormprofielRij[];
      return rijen.map(leesNormprofiel);
    },

    /**
     * Legt een nieuw normprofiel neer als concept, dus zonder bevriezing.
     *
     * Het versienummer wordt hier bepaald en niet door de aanroeper: wie het
     * nummer meegeeft, kan een bestaande versie overschrijven en daarmee de
     * geschiedenis herschrijven. Het nieuwe nummer is altijd het hoogste plus
     * een, ook wanneer de vorige versie een concept was.
     */
    zetNeer(invoer: {
      instrumentId: string;
      weging: Weging;
      drempelTotaal: number;
      drempelPerAs: DrempelPerAs;
      activiteitsdrempel: number;
      activiteitsvensterMaanden: number;
      methode: string;
      paneelOmschrijving?: string | null;
      vastgesteldDoor: string;
      onderbouwing: string;
      doorBeheerderId?: number | null;
    }): NormprofielRecord {
      const bevindingen = valideerNormprofiel(invoer);
      if (bevindingen.length) {
        throw new Error(
          "Normprofiel afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      const hoogste = db
        .prepare(
          `SELECT MAX(versie) AS m FROM bekwaamheid_normprofielen
           WHERE instrument_id = ?`,
        )
        .get(invoer.instrumentId) as { m: number | null };
      const versie = (hoogste?.m ?? 0) + 1;

      const res = db
        .prepare(
          `INSERT INTO bekwaamheid_normprofielen
             (instrument_id, versie, weging, drempel_totaal, drempel_per_as,
              activiteitsdrempel, activiteitsvenster_maanden, methode,
              paneel_omschrijving, vastgesteld_op, vastgesteld_door,
              bevroren_op, onderbouwing)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .run(
          invoer.instrumentId,
          versie,
          JSON.stringify(invoer.weging),
          invoer.drempelTotaal,
          JSON.stringify(invoer.drempelPerAs),
          invoer.activiteitsdrempel,
          invoer.activiteitsvensterMaanden,
          invoer.methode,
          invoer.paneelOmschrijving ?? null,
          vandaag(),
          invoer.vastgesteldDoor,
          invoer.onderbouwing,
        );

      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_normprofiel_vastgelegd",
        afnameId: null,
        detail:
          `Normprofiel ${invoer.instrumentId} versie ${versie} vastgelegd als concept ` +
          `(totaaldrempel ${invoer.drempelTotaal}, activiteitsdrempel ` +
          `${invoer.activiteitsdrempel} per ${invoer.activiteitsvensterMaanden} maanden).`,
      });

      return normprofielen.vindOp(res.lastInsertRowid as number)!;
    },

    /**
     * Bevriest een normprofiel. Onomkeerbaar.
     *
     * Er is met opzet geen tegenhanger die ontdooit. Dat is geen vergetelheid:
     * een cesuur die terug open kan, is geen cesuur. Wie de lat wil verleggen,
     * legt een nieuwe versie neer; de oude blijft staan omdat elke beslissing
     * die eronder is genomen ernaar verwijst.
     */
    bevries(id: number, doorBeheerderId?: number | null): NormprofielRecord {
      const bestaand = normprofielen.vindOp(id);
      if (!bestaand) {
        throw new Error(`Normprofiel ${id} bestaat niet.`);
      }
      if (bestaand.bevrorenOp) {
        throw new Error(
          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} is al ` +
            `bevroren op ${bestaand.bevrorenOp}. Een bevroren cesuur wijzigt niet; ` +
            `leg een nieuwe versie neer.`,
        );
      }
      db.prepare("UPDATE bekwaamheid_normprofielen SET bevroren_op = ? WHERE id = ?").run(
        nu(),
        id,
      );
      audit({
        adminId: doorBeheerderId ?? null,
        actie: "bekwaamheid_normprofiel_bevroren",
        afnameId: null,
        detail:
          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} bevroren. ` +
          `Vanaf nu onwijzigbaar.`,
      });
      return normprofielen.vindOp(id)!;
    },

    /**
     * Wijzigt een normprofiel dat nog concept is.
     *
     * Gooit op een bevroren rij. Dit is de poort die het bouwplan bedoelt: ze
     * staat hier, in de datalaag, en niet in een formulier.
     */
    wijzig(
      id: number,
      invoer: {
        weging?: Weging;
        drempelTotaal?: number;
        drempelPerAs?: DrempelPerAs;
        activiteitsdrempel?: number;
        activiteitsvensterMaanden?: number;
        methode?: string;
        paneelOmschrijving?: string | null;
        onderbouwing?: string;
        doorBeheerderId?: number | null;
      },
    ): NormprofielRecord {
      const bestaand = normprofielen.vindOp(id);
      if (!bestaand) {
        throw new Error(`Normprofiel ${id} bestaat niet.`);
      }
      if (bestaand.bevrorenOp) {
        throw new Error(
          `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} is bevroren ` +
            `op ${bestaand.bevrorenOp} en wijzigt niet. Leg een nieuwe versie neer.`,
        );
      }

      const samengevoegd = {
        weging: invoer.weging ?? bestaand.weging,
        drempelTotaal: invoer.drempelTotaal ?? bestaand.drempelTotaal,
        drempelPerAs: invoer.drempelPerAs ?? bestaand.drempelPerAs,
        activiteitsdrempel: invoer.activiteitsdrempel ?? bestaand.activiteitsdrempel,
        activiteitsvensterMaanden:
          invoer.activiteitsvensterMaanden ?? bestaand.activiteitsvensterMaanden,
        onderbouwing: invoer.onderbouwing ?? bestaand.onderbouwing,
      };
      const bevindingen = valideerNormprofiel(samengevoegd);
      if (bevindingen.length) {
        throw new Error(
          "Normprofiel afgekeurd: " +
            bevindingen.map((b) => `${b.veld}: ${b.melding}`).join(" | "),
        );
      }

      db.prepare(
        `UPDATE bekwaamheid_normprofielen
           SET weging = ?, drempel_totaal = ?, drempel_per_as = ?,
               activiteitsdrempel = ?, activiteitsvenster_maanden = ?,
               methode = ?, paneel_omschrijving = ?, onderbouwing = ?
         WHERE id = ? AND bevroren_op IS NULL`,
      ).run(
        JSON.stringify(samengevoegd.weging),
        samengevoegd.drempelTotaal,
        JSON.stringify(samengevoegd.drempelPerAs),
        samengevoegd.activiteitsdrempel,
        samengevoegd.activiteitsvensterMaanden,
        invoer.methode ?? bestaand.methode,
        invoer.paneelOmschrijving !== undefined
          ? invoer.paneelOmschrijving
          : bestaand.paneelOmschrijving,
        samengevoegd.onderbouwing,
        id,
      );

      audit({
        adminId: invoer.doorBeheerderId ?? null,
        actie: "bekwaamheid_normprofiel_gewijzigd",
        afnameId: null,
        detail: `Normprofiel ${bestaand.instrumentId} versie ${bestaand.versie} gewijzigd als concept.`,
      });
      return normprofielen.vindOp(id)!;
    },
  };

'''

TYPEN = '''
/** Een normprofielrij zoals SQLite hem teruggeeft. */
type NormprofielRij = {
  id: number;
  instrument_id: string;
  versie: number;
  weging: string;
  drempel_totaal: number;
  drempel_per_as: string;
  activiteitsdrempel: number;
  activiteitsvenster_maanden: number;
  methode: string;
  paneel_omschrijving: string | null;
  vastgesteld_op: string;
  vastgesteld_door: string;
  bevroren_op: string | null;
  onderbouwing: string;
};

/** Een normprofiel met geparseerde JSON-velden. */
export type NormprofielRecord = Normprofiel & {
  id: number;
  instrumentId: string;
  versie: number;
  methode: string;
  paneelOmschrijving: string | null;
  vastgesteldOp: string;
  vastgesteldDoor: string;
  bevrorenOp: string | null;
  onderbouwing: string;
};

/**
 * Zet een rij om naar een record.
 *
 * De JSON-velden worden hier geparseerd en niet bij de aanroeper: zou elke
 * aanroeper zelf parsen, dan zou een enkele vergeten `JSON.parse` een weging als
 * tekenreeks in de berekening laten belanden, waar `"0.2" * 0.3` stilzwijgend
 * een getal oplevert. Onleesbare JSON gooit hier, want een normprofiel waarvan
 * de weging niet te lezen is, mag geen beslissing raken.
 */
function leesNormprofiel(rij: NormprofielRij): NormprofielRecord {
  let weging: Weging;
  let drempelPerAs: DrempelPerAs;
  try {
    weging = JSON.parse(rij.weging) as Weging;
    drempelPerAs = JSON.parse(rij.drempel_per_as) as DrempelPerAs;
  } catch (e) {
    throw new Error(
      `Normprofiel ${rij.instrument_id} versie ${rij.versie} heeft onleesbare ` +
        `JSON in weging of drempelPerAs: ${(e as Error).message}`,
    );
  }
  return {
    id: rij.id,
    instrumentId: rij.instrument_id,
    versie: rij.versie,
    weging,
    drempelTotaal: rij.drempel_totaal,
    drempelPerAs,
    activiteitsdrempel: rij.activiteitsdrempel,
    activiteitsvensterMaanden: rij.activiteitsvenster_maanden,
    methode: rij.methode,
    paneelOmschrijving: rij.paneel_omschrijving,
    vastgesteldOp: rij.vastgesteld_op,
    vastgesteldDoor: rij.vastgesteld_door,
    bevrorenOp: rij.bevroren_op,
    onderbouwing: rij.onderbouwing,
  };
}

'''

IMPORT_ANKER = 'import { schrijfAuditLog } from "../audit-log";\n'
IMPORT_NIEUW = (
    'import { schrijfAuditLog } from "../audit-log";\n'
    "import {\n"
    "  valideerNormprofiel,\n"
    "  type Normprofiel,\n"
    "  type Weging,\n"
    "  type DrempelPerAs,\n"
    '} from "./normprofiel";\n'
)

FUNCTIE_ANKER = "export function maakBekwaamheidOpslag(\n"


def main() -> int:
    with io.open(PAD, encoding="utf-8") as f:
        bron = f.read()

    for naam, anker in (
        ("retour-anker", ANKER),
        ("import-anker", IMPORT_ANKER),
        ("functie-anker", FUNCTIE_ANKER),
    ):
        if bron.count(anker) != 1:
            print(f"FOUT: {naam} komt {bron.count(anker)} keer voor, verwacht 1")
            return 1

    if "normprofielen" in bron:
        print("FOUT: 'normprofielen' staat er al in; niets gedaan")
        return 1

    uit = bron.replace(IMPORT_ANKER, IMPORT_NIEUW, 1)
    uit = uit.replace(FUNCTIE_ANKER, TYPEN.lstrip("\n") + FUNCTIE_ANKER, 1)
    uit = uit.replace(ANKER, BLOK + VERVANG, 1)

    with io.open(PAD, "w", encoding="utf-8") as f:
        f.write(uit)
    print(f"toegevoegd: {len(uit.splitlines()) - len(bron.splitlines())} regels")
    return 0


if __name__ == "__main__":
    sys.exit(main())
