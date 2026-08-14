#!/usr/bin/env python3
"""
Voegt de kennischeckblokken toe aan server/bekwaamheid/schema.ts.

Ankergestuurd met een harde assertie per anker, omdat het `edit`-gereedschap op
samengestelde accenttekens valt en dit bestand vol Nederlands commentaar staat.
"""

import io
import os
import sys

WORTEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAD = os.path.join(WORTEL, "server", "bekwaamheid", "schema.ts")


def vervang_een(s: str, anker: str, nieuw: str, naam: str) -> str:
    n = s.count(anker)
    if n != 1:
        print(f"FOUT: anker '{naam}' komt {n}x voor, verwacht 1x")
        sys.exit(1)
    return s.replace(anker, nieuw, 1)


s = io.open(PAD, encoding="utf-8").read()

# --- 1. de constanten ------------------------------------------------------
s = vervang_een(
    s,
    """/** Itemsoorten in de bank. */
export const ITEMSOORTEN = [\"scenario\", \"meerkeuze\", \"juistfout\", \"open\"] as const;
export type Itemsoort = (typeof ITEMSOORTEN)[number];""",
    """/** Itemsoorten in de bank. */
export const ITEMSOORTEN = [\"scenario\", \"meerkeuze\", \"juistfout\", \"open\"] as const;
export type Itemsoort = (typeof ITEMSOORTEN)[number];

/**
 * De soorten die een machine kan nakijken.
 *
 * Bij `scenario`, `meerkeuze` en `juistfout` staat er in `sleutel` een antwoord
 * dat met het gegeven antwoord te vergelijken is. Bij `open` staat er een
 * scoringssleutel: een omschrijving van wat het antwoord moet bevatten. Dat is
 * geen vergelijking maar een beoordeling, en die hoort bij een mens.
 *
 * Deze lijst bestaat om het onderscheid \u00e9\u00e9n plaats te geven. Zonder deze
 * constante zou op drie plaatsen een eigen opsomming staan, en zou een zesde
 * itemsoort er stil buiten vallen.
 */
export const AUTOMATISCH_SCOORBARE_SOORTEN = [
  \"scenario\",
  \"meerkeuze\",
  \"juistfout\",
] as const;
export type AutomatischScoorbareSoort = (typeof AUTOMATISCH_SCOORBARE_SOORTEN)[number];

/**
 * De vijf blokken van de kennischeck, uit draaiboek \u00a74.3.
 *
 * A Constructen \u00b7 B Scoring en rapportlogica \u00b7 C Grenzen \u00b7 D
 * Interpretatiefouten herkennen \u00b7 E Ethiek, consent en GDPR.
 *
 * De letters staan in de databank en niet de namen, om dezelfde reden waarom
 * `as` de waarde `weten` bevat en niet `Weten \u2014 kennis van het instrument`: een
 * naam die zichtbaar is voor de kandidaat mag veranderen zonder dat er een
 * migratie aan te pas komt. `BLOKNAMEN` hieronder is de leeslaag.
 */
export const KENNISCHECKBLOKKEN = [\"A\", \"B\", \"C\", \"D\", \"E\"] as const;
export type Kennischeckblok = (typeof KENNISCHECKBLOKKEN)[number];

/** De leesbare namen van de vijf blokken. Alleen voor weergave. */
export const BLOKNAMEN: Record<Kennischeckblok, string> = {
  A: \"Constructen\",
  B: \"Scoring en rapportlogica\",
  C: \"Grenzen\",
  D: \"Interpretatiefouten herkennen\",
  E: \"Ethiek, consent en GDPR\",
};

/**
 * Hoeveel items elk blok in een volledige kennischeck levert. Samen veertig.
 *
 * Deze getallen komen letterlijk uit draaiboek \u00a74.3 en zijn geen instelling. Het
 * draaiboek geeft er een reden bij die in de code hoort te staan, omdat ze
 * anders bij de eerste krappe itembank sneuvelt:
 *
 *   \"Blok C en E zijn samen 40% van de check. Dat is opzettelijk: de meeste
 *   schade in dit vak komt niet van iets niet weten, maar van iets beweren wat je
 *   niet mag beweren.\"
 *
 * Wie deze verdeling wil wijzigen, wijzigt de meting. Dat is een beslissing van
 * het Angoff-panel en niet van wie de bank vult. `BLOKPLAN_TOTAAL` en de
 * bijbehorende test staan er zodat een aanpassing die de som breekt, opvalt.
 */
export const BLOKPLAN: Record<Kennischeckblok, number> = {
  A: 10,
  B: 6,
  C: 8,
  D: 8,
  E: 8,
};

/** Het aantal items in een volledige kennischeck: veertig. */
export const BLOKPLAN_TOTAAL = 40;

/**
 * De verkorte kennischeck: twintig items, instrumentspecifiek.
 *
 * Draaiboek \u00a7\u201creactivatietraject\u201d en de hercertificeringsronde vragen een
 * verkorte check van twintig items. De verdeling halveert het volledige plan en
 * houdt daarbij de verhouding tussen de blokken aan: A 5, B 3, C 4, D 4, E 4.
 * Blok C en E blijven samen 40%, want dat is de eis \u2014 niet het aantal.
 */
export const BLOKPLAN_VERKORT: Record<Kennischeckblok, number> = {
  A: 5,
  B: 3,
  C: 4,
  D: 4,
  E: 4,
};

/** Het aantal items in een verkorte kennischeck: twintig. */
export const BLOKPLAN_VERKORT_TOTAAL = 20;""",
    "constanten",
)

# --- 2. de kolom in de tabel ----------------------------------------------
s = vervang_een(
    s,
    """    instrumentId: text(\"instrument_id\").notNull(),
    as: text(\"as\").notNull(),
    soort: text(\"soort\").notNull(),
    stam: text(\"stam\").notNull(),""",
    """    instrumentId: text(\"instrument_id\").notNull(),
    as: text(\"as\").notNull(),
    // Het kennischeckblok, of leeg. Leeg betekent precies \u00e9\u00e9n ding: dit item
    // hoort niet in de blokstructuur van de kennischeck. Zie migratie
    // 0008_itemblokken voor waarom de kolom er is en waarom hij leeg mag zijn.
    blok: text(\"blok\"),
    soort: text(\"soort\").notNull(),
    stam: text(\"stam\").notNull(),""",
    "kolom",
)

# --- 3. de twee CHECKs en de verruimde index ------------------------------
s = vervang_een(
    s,
    """    index(\"idx_bekwaamheid_item_instrument\").on(tabel.instrumentId, tabel.as),
    index(\"idx_bekwaamheid_item_gebruik\").on(tabel.gebruik),
    check(\"bekwaamheid_item_as\", inLijst(\"as\", ASSEN)),
    check(\"bekwaamheid_item_soort\", inLijst(\"soort\", ITEMSOORTEN)),
    check(\"bekwaamheid_item_gebruik\", inLijst(\"gebruik\", ITEMGEBRUIKEN)),""",
    """    index(\"idx_bekwaamheid_item_instrument\").on(tabel.instrumentId, tabel.as, tabel.blok),
    index(\"idx_bekwaamheid_item_gebruik\").on(tabel.gebruik),
    check(\"bekwaamheid_item_as\", inLijst(\"as\", ASSEN)),
    check(\"bekwaamheid_item_soort\", inLijst(\"soort\", ITEMSOORTEN)),
    check(\"bekwaamheid_item_gebruik\", inLijst(\"gebruik\", ITEMGEBRUIKEN)),
    check(
      \"bekwaamheid_item_blok\",
      sql`${tabel.blok} IS NULL OR ${inLijst(\"blok\", KENNISCHECKBLOKKEN)}`,
    ),
    // Blok A tot E is de indeling van de kennischeck, en de kennischeck meet de
    // as WETEN. Een blok-D-item op de as ZORGEN zou in geen enkele check
    // terechtkomen en toch als blokdekking meetellen.
    check(\"bekwaamheid_item_blok_alleen_weten\", sql`${tabel.blok} IS NULL OR ${tabel.as} = 'weten'`),""",
    "checks",
)

io.open(PAD, "w", encoding="utf-8").write(s)
print("OK — schema bijgewerkt, regels:", s.count("\n") + 1)
