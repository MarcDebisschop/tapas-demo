import { describe, expect, it } from "vitest";
import {
  filterTrajectVoorOproeper,
  isUitsluitendBetrokkene,
  magIndrukVanGebeurtenisZien,
  magLijnZien,
  magVraagkaartVolgensKring,
  magVraagkaartZien,
} from "../server/traject/rechten";
import type {
  GebeurtenisVoorRechten,
  OproeperVanTraject,
  RolVanTraject,
  VerrijktTrajectVoorRechten,
} from "../server/traject/rechten";

/**
 * Hier hangt de belofte van het hele protocol aan vast, dus deze tests zijn
 * bewust hard. Ze rekenen nergens zelf: elke verwachte uitkomst staat als getal
 * uitgeschreven.
 *
 * Het proefdossier.
 *
 * Vijf partijen, elk in een eigen kring, zodat elke kring van 0 tot 4 aan bod
 * komt:
 *   partij 1 kring 0, partij 2 kring 1, partij 3 kring 2, partij 4 kring 3,
 *   partij 5 kring 4.
 *
 * Twee lijnen: lijn 11 tussen partij 1 en partij 2, lijn 12 tussen partij 3 en
 * partij 4. Partij 5 hangt aan geen enkele lijn.
 *
 * Twee werkstromen: 21 financieel en 22 menselijk.
 *
 * Twee vraagkaarten: kaart 31 op lijn 11, gevraagd door partij 2 aan partij 1,
 * werkstroom 21, antwoordkring 2. Kaart 32 op lijn 12, gevraagd door partij 3
 * aan partij 4, werkstroom 22, antwoordkring 4.
 *
 * Drie gebeurtenissen: 41 op lijn 11 vastgelegd door persoon 51 van partij 1,
 * 42 op lijn 11 zonder bekende auteur, 43 op lijn 12 vastgelegd door persoon 53
 * van partij 3.
 */

const PERSOON_ONDERNEMING = 51;
const PERSOON_BESTUUR = 53;
const PERSOON_OPROEPER = 99;

interface ProefLijn {
  id: number;
  partijEenId: number;
  partijTweeId: number;
  stiltedrempelDagen: number;
}

interface ProefVraag {
  id: number;
  lijnId: number;
  vragerPartijId: number;
  ontvangerPartijId: number;
  werkstroomId: number | null;
  antwoordKring: number;
  vraagtekst: string;
}

interface ProefGebeurtenis extends GebeurtenisVoorRechten {
  soort: string;
  vaststelling: string;
  tijdstip: number;
}

function maakProefdossier(): VerrijktTrajectVoorRechten<
  { id: number; naam: string },
  { volgnummer: number; naam: string },
  { id: number; naam: string; kring: number },
  { id: number; naam: string },
  ProefLijn,
  ProefVraag,
  ProefGebeurtenis
> {
  return {
    traject: { id: 1, naam: "Overname Asterra Machines" },
    fasen: [
      { volgnummer: 1, naam: "Verkenning" },
      { volgnummer: 2, naam: "Kaderafspraak" },
    ],
    partijen: [
      { id: 1, naam: "Asterra Machines", kring: 0 },
      { id: 2, naam: "Kaaidok Partners", kring: 1 },
      { id: 3, naam: "Bestuur Asterra", kring: 2 },
      { id: 4, naam: "Sleutelmensen Asterra", kring: 3 },
      { id: 5, naam: "Bank en pers", kring: 4 },
    ],
    werkstromen: [
      { id: 21, naam: "financieel" },
      { id: 22, naam: "menselijk" },
    ],
    personen: [
      { id: PERSOON_ONDERNEMING, partijId: 1 },
      { id: PERSOON_BESTUUR, partijId: 3 },
      { id: PERSOON_OPROEPER, partijId: null },
    ],
    lijnen: [
      { id: 11, partijEenId: 1, partijTweeId: 2, stiltedrempelDagen: 7 },
      { id: 12, partijEenId: 3, partijTweeId: 4, stiltedrempelDagen: 14 },
    ],
    vragen: [
      {
        id: 31,
        lijnId: 11,
        vragerPartijId: 2,
        ontvangerPartijId: 1,
        werkstroomId: 21,
        antwoordKring: 2,
        vraagtekst: "Graag de openstaande vorderingen per klant.",
      },
      {
        id: 32,
        lijnId: 12,
        vragerPartijId: 3,
        ontvangerPartijId: 4,
        werkstroomId: 22,
        antwoordKring: 4,
        vraagtekst: "Welke sleutelfuncties zijn moeilijk vervangbaar?",
      },
    ],
    gebeurtenissen: [
      {
        id: 41,
        lijnId: 11,
        tijdstip: 1000,
        soort: "gesprek",
        vaststelling: "Kennismaking gehouden op 3 augustus.",
        indruk: "De cijfers werden traag aangeleverd.",
        vastgelegdDoorPersoonId: PERSOON_ONDERNEMING,
      },
      {
        id: 42,
        lijnId: 11,
        tijdstip: 2000,
        soort: "bericht",
        vaststelling: "Vraagkaart 31 verstuurd.",
        indruk: "Deze rij bestond al voor de auteur werd vastgelegd.",
        vastgelegdDoorPersoonId: null,
      },
      {
        id: 43,
        lijnId: 12,
        tijdstip: 3000,
        soort: "gesprek",
        vaststelling: "Overleg met het bestuur gehouden.",
        indruk: "Het bestuur twijfelt over de tijdslijn.",
        vastgelegdDoorPersoonId: PERSOON_BESTUUR,
      },
    ],
  };
}

/**
 * Zet het proefdossier klaar met een oproeper die zelf ook een persoon in het
 * traject is, zodat de auteur van een gebeurtenis met hem vergeleken kan worden.
 */
function dossierMetOproeperInPartij(partijId: number | null) {
  const dossier = maakProefdossier();
  dossier.personen = dossier.personen.map((persoon) =>
    persoon.id === PERSOON_OPROEPER ? { ...persoon, partijId } : persoon,
  );
  return dossier;
}

function maakOproeper(overschrijving: Partial<OproeperVanTraject> = {}): OproeperVanTraject {
  return {
    scope: "organisatie",
    persoonId: PERSOON_OPROEPER,
    partijId: null,
    kring: null,
    rollen: [],
    werkstroomIds: [],
    ...overschrijving,
  };
}

function idsVan(rijen: Array<{ id: number }>): number[] {
  return rijen.map((rij) => rij.id);
}

function idsMetIndruk(gebeurtenissen: Array<{ id: number }>): number[] {
  return gebeurtenissen
    .filter((gebeurtenis) => "indruk" in gebeurtenis)
    .map((gebeurtenis) => gebeurtenis.id);
}

interface Tabelregel {
  rol: RolVanTraject;
  partijId: number | null;
  kring: number | null;
  werkstroomIds: number[];
  lijnen: number[];
  vragen: number[];
  gebeurtenissen: number[];
  metIndruk: number[];
}

/**
 * Elke combinatie van rol, partij en kring. Zeven rollen, vijf partijen met elk
 * een eigen kring, plus de persoon zonder partij: tweeenveertig regels. De
 * verwachte uitkomst staat per regel uitgeschreven en is nergens berekend.
 *
 * Een werkstroomleider draagt in deze tabel werkstroom 22, waarvan kaart 32 op
 * lijn 12 hangt.
 */
const TABEL: Tabelregel[] = [
  // Ankerpunt investeerder. Geen eigen regel in de module, dus de partij beslist.
  { rol: "ankerpunt_investeerder", partijId: 1, kring: 0, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [41] },
  { rol: "ankerpunt_investeerder", partijId: 2, kring: 1, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [] },
  { rol: "ankerpunt_investeerder", partijId: 3, kring: 2, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [43] },
  { rol: "ankerpunt_investeerder", partijId: 4, kring: 3, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [] },
  { rol: "ankerpunt_investeerder", partijId: 5, kring: 4, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "ankerpunt_investeerder", partijId: null, kring: null, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },

  // Ankerpunt onderneming. Zelfde beeld: de partij beslist.
  { rol: "ankerpunt_onderneming", partijId: 1, kring: 0, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [41] },
  { rol: "ankerpunt_onderneming", partijId: 2, kring: 1, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [] },
  { rol: "ankerpunt_onderneming", partijId: 3, kring: 2, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [43] },
  { rol: "ankerpunt_onderneming", partijId: 4, kring: 3, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [] },
  { rol: "ankerpunt_onderneming", partijId: 5, kring: 4, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "ankerpunt_onderneming", partijId: null, kring: null, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },

  // Adviseur. Valt terug op de kaarten van zijn eigen partij, want er bestaat
  // geen veld dat hem aan een kaart hangt.
  { rol: "adviseur", partijId: 1, kring: 0, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [41] },
  { rol: "adviseur", partijId: 2, kring: 1, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [] },
  { rol: "adviseur", partijId: 3, kring: 2, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [43] },
  { rol: "adviseur", partijId: 4, kring: 3, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [] },
  { rol: "adviseur", partijId: 5, kring: 4, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "adviseur", partijId: null, kring: null, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },

  // Overlegorgaan. Geen eigen regel, dus de partij beslist.
  { rol: "overlegorgaan", partijId: 1, kring: 0, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [41] },
  { rol: "overlegorgaan", partijId: 2, kring: 1, werkstroomIds: [], lijnen: [11], vragen: [31], gebeurtenissen: [41, 42], metIndruk: [] },
  { rol: "overlegorgaan", partijId: 3, kring: 2, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [43] },
  { rol: "overlegorgaan", partijId: 4, kring: 3, werkstroomIds: [], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [] },
  { rol: "overlegorgaan", partijId: 5, kring: 4, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "overlegorgaan", partijId: null, kring: null, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },

  // Facilitator. Ziet alle lijnen en alle gebeurtenissen, nooit een indruk van
  // iemand anders, en zijn kring blijft een plafond op de kaarten.
  { rol: "facilitator", partijId: 1, kring: 0, werkstroomIds: [], lijnen: [11, 12], vragen: [31, 32], gebeurtenissen: [41, 42, 43], metIndruk: [] },
  { rol: "facilitator", partijId: 2, kring: 1, werkstroomIds: [], lijnen: [11, 12], vragen: [31, 32], gebeurtenissen: [41, 42, 43], metIndruk: [] },
  { rol: "facilitator", partijId: 3, kring: 2, werkstroomIds: [], lijnen: [11, 12], vragen: [31, 32], gebeurtenissen: [41, 42, 43], metIndruk: [] },
  { rol: "facilitator", partijId: 4, kring: 3, werkstroomIds: [], lijnen: [11, 12], vragen: [32], gebeurtenissen: [41, 42, 43], metIndruk: [] },
  { rol: "facilitator", partijId: 5, kring: 4, werkstroomIds: [], lijnen: [11, 12], vragen: [32], gebeurtenissen: [41, 42, 43], metIndruk: [] },
  { rol: "facilitator", partijId: null, kring: null, werkstroomIds: [], lijnen: [11, 12], vragen: [31, 32], gebeurtenissen: [41, 42, 43], metIndruk: [] },

  // Werkstroomleider van werkstroom 22. Ziet daardoor lijn 12 en kaart 32, ook
  // wanneer zijn partij niet aan die lijn hangt.
  { rol: "werkstroomleider", partijId: 1, kring: 0, werkstroomIds: [22], lijnen: [11, 12], vragen: [31, 32], gebeurtenissen: [41, 42, 43], metIndruk: [41] },
  { rol: "werkstroomleider", partijId: 2, kring: 1, werkstroomIds: [22], lijnen: [11, 12], vragen: [31, 32], gebeurtenissen: [41, 42, 43], metIndruk: [] },
  { rol: "werkstroomleider", partijId: 3, kring: 2, werkstroomIds: [22], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [43] },
  { rol: "werkstroomleider", partijId: 4, kring: 3, werkstroomIds: [22], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [] },
  { rol: "werkstroomleider", partijId: 5, kring: 4, werkstroomIds: [22], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [] },
  { rol: "werkstroomleider", partijId: null, kring: null, werkstroomIds: [22], lijnen: [12], vragen: [32], gebeurtenissen: [43], metIndruk: [] },

  // Betrokkene. Ziet het geraamte en verder niets, want er bestaat geen veld dat
  // zegt waarover een gebeurtenis of een kaart gaat.
  { rol: "betrokkene", partijId: 1, kring: 0, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "betrokkene", partijId: 2, kring: 1, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "betrokkene", partijId: 3, kring: 2, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "betrokkene", partijId: 4, kring: 3, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "betrokkene", partijId: 5, kring: 4, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
  { rol: "betrokkene", partijId: null, kring: null, werkstroomIds: [], lijnen: [], vragen: [], gebeurtenissen: [], metIndruk: [] },
];

describe("Rechten in een traject: de tabel van rol, partij en kring", () => {
  it("legt tweeenveertig combinaties vast", () => {
    expect(TABEL).toHaveLength(42);
  });

  for (const regel of TABEL) {
    const partijnaam = regel.partijId === null ? "zonder partij" : `partij ${regel.partijId}`;
    const kringnaam = regel.kring === null ? "zonder kring" : `kring ${regel.kring}`;
    it(`${regel.rol} bij ${partijnaam} in ${kringnaam}`, () => {
      const dossier = dossierMetOproeperInPartij(regel.partijId);
      const uitkomst = filterTrajectVoorOproeper(
        maakOproeper({
          partijId: regel.partijId,
          kring: regel.kring,
          rollen: [regel.rol],
          werkstroomIds: regel.werkstroomIds,
        }),
        dossier,
      );

      expect(idsVan(uitkomst.lijnen)).toEqual(regel.lijnen);
      expect(idsVan(uitkomst.vragen)).toEqual(regel.vragen);
      expect(idsVan(uitkomst.gebeurtenissen)).toEqual(regel.gebeurtenissen);
      expect(idsMetIndruk(uitkomst.gebeurtenissen)).toEqual(regel.metIndruk);
      expect(uitkomst.indrukVrijgegevenVoor).toEqual(regel.metIndruk);

      // Het geraamte blijft altijd volledig staan.
      expect(uitkomst.traject).toEqual(dossier.traject);
      expect(uitkomst.fasen).toHaveLength(2);
      expect(uitkomst.partijen).toHaveLength(5);
      expect(uitkomst.werkstromen).toHaveLength(2);
    });
  }
});

describe("Regel 1: de indruk blijft binnen de partij", () => {
  it("geeft de indruk aan iemand van dezelfde partij als de auteur", () => {
    const dossier = dossierMetOproeperInPartij(1);
    const gebeurtenis = dossier.gebeurtenissen[0];
    expect(
      magIndrukVanGebeurtenisZien(
        maakOproeper({ partijId: 1, kring: 0 }),
        gebeurtenis,
        dossier.personen,
      ),
    ).toBe(true);
  });

  it("houdt de indruk weg bij iemand van een andere partij", () => {
    const dossier = dossierMetOproeperInPartij(2);
    const gebeurtenis = dossier.gebeurtenissen[0];
    expect(
      magIndrukVanGebeurtenisZien(
        maakOproeper({ partijId: 2, kring: 1 }),
        gebeurtenis,
        dossier.personen,
      ),
    ).toBe(false);
  });

  it("houdt de indruk weg bij een oproeper die geen persoon in het traject is", () => {
    const dossier = maakProefdossier();
    expect(
      magIndrukVanGebeurtenisZien(
        maakOproeper({ persoonId: null, partijId: null, kring: null }),
        dossier.gebeurtenissen[0],
        dossier.personen,
      ),
    ).toBe(false);
  });

  it("houdt de indruk weg wanneer beide partijen leeg zijn en het niet dezelfde persoon is", () => {
    const dossier = dossierMetOproeperInPartij(null);
    dossier.personen = dossier.personen.map((persoon) =>
      persoon.id === PERSOON_ONDERNEMING ? { ...persoon, partijId: null } : persoon,
    );
    expect(
      magIndrukVanGebeurtenisZien(
        maakOproeper({ partijId: null, kring: null }),
        dossier.gebeurtenissen[0],
        dossier.personen,
      ),
    ).toBe(false);
  });
});

describe("Regel 2: de facilitator ziet geen indrukken van anderen", () => {
  it("houdt de indruk weg bij een facilitator die aan dezelfde partij hangt als de auteur", () => {
    const dossier = dossierMetOproeperInPartij(1);
    expect(
      magIndrukVanGebeurtenisZien(
        maakOproeper({ partijId: 1, kring: 0, rollen: ["facilitator"] }),
        dossier.gebeurtenissen[0],
        dossier.personen,
      ),
    ).toBe(false);
  });

  it("geeft de facilitator wel zijn eigen indruk", () => {
    const dossier = dossierMetOproeperInPartij(null);
    const eigenGebeurtenis = {
      ...dossier.gebeurtenissen[0],
      vastgelegdDoorPersoonId: PERSOON_OPROEPER,
    };
    expect(
      magIndrukVanGebeurtenisZien(
        maakOproeper({ rollen: ["facilitator"] }),
        eigenGebeurtenis,
        dossier.personen,
      ),
    ).toBe(true);
  });

  it("laat de eigen indruk ook in de gefilterde uitkomst staan", () => {
    const dossier = dossierMetOproeperInPartij(null);
    dossier.gebeurtenissen = dossier.gebeurtenissen.map((gebeurtenis) =>
      gebeurtenis.id === 41
        ? { ...gebeurtenis, vastgelegdDoorPersoonId: PERSOON_OPROEPER }
        : gebeurtenis,
    );
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ rollen: ["facilitator"] }),
      dossier,
    );
    expect(idsMetIndruk(uitkomst.gebeurtenissen)).toEqual([41]);
  });
});

describe("Regel 3: geen bekende auteur betekent geen indruk", () => {
  it("houdt de indruk van een gebeurtenis zonder auteur weg bij ieder van de partijen", () => {
    for (const partijId of [1, 2, 3, 4, 5]) {
      const dossier = dossierMetOproeperInPartij(partijId);
      const zonderAuteur = dossier.gebeurtenissen[1];
      expect(zonderAuteur.vastgelegdDoorPersoonId).toBeNull();
      expect(
        magIndrukVanGebeurtenisZien(
          maakOproeper({ partijId, kring: 0 }),
          zonderAuteur,
          dossier.personen,
        ),
      ).toBe(false);
    }
  });

  it("houdt de indruk weg wanneer de auteur niet in de lijst van personen staat", () => {
    const dossier = dossierMetOproeperInPartij(1);
    const onbekendeAuteur = { ...dossier.gebeurtenissen[0], vastgelegdDoorPersoonId: 777 };
    expect(
      magIndrukVanGebeurtenisZien(
        maakOproeper({ partijId: 1, kring: 0 }),
        onbekendeAuteur,
        dossier.personen,
      ),
    ).toBe(false);
  });
});

describe("Regel 4: de vaststellingen op een lijn", () => {
  const dossier = maakProefdossier();
  const hoofdlijn = dossier.lijnen[0];
  const zijlijn = dossier.lijnen[1];

  it("geeft de lijn aan wie bij een van de twee partijen hoort", () => {
    expect(magLijnZien(maakOproeper({ partijId: 1, kring: 0 }), hoofdlijn, dossier.vragen)).toBe(
      true,
    );
    expect(magLijnZien(maakOproeper({ partijId: 2, kring: 1 }), hoofdlijn, dossier.vragen)).toBe(
      true,
    );
  });

  it("weigert de lijn aan wie bij geen van de twee partijen hoort", () => {
    expect(magLijnZien(maakOproeper({ partijId: 5, kring: 4 }), hoofdlijn, dossier.vragen)).toBe(
      false,
    );
  });

  it("geeft elke lijn aan de facilitator", () => {
    const facilitator = maakOproeper({ partijId: null, rollen: ["facilitator"] });
    expect(magLijnZien(facilitator, hoofdlijn, dossier.vragen)).toBe(true);
    expect(magLijnZien(facilitator, zijlijn, dossier.vragen)).toBe(true);
  });

  it("geeft de lijn aan de leider van een werkstroom met een kaart op die lijn", () => {
    const leider = maakOproeper({
      partijId: 5,
      kring: 4,
      rollen: ["werkstroomleider"],
      werkstroomIds: [22],
    });
    expect(magLijnZien(leider, zijlijn, dossier.vragen)).toBe(true);
    expect(magLijnZien(leider, hoofdlijn, dossier.vragen)).toBe(false);
  });
});

describe("Regel 5: de vraagkaarten", () => {
  const dossier = maakProefdossier();
  const kaartFinancieel = dossier.vragen[0];
  const kaartMenselijk = dossier.vragen[1];

  it("geeft de kaart aan de vragende en aan de ontvangende partij", () => {
    expect(magVraagkaartZien(maakOproeper({ partijId: 2, kring: 1 }), kaartFinancieel)).toBe(true);
    expect(magVraagkaartZien(maakOproeper({ partijId: 1, kring: 0 }), kaartFinancieel)).toBe(true);
  });

  it("geeft de kaart aan de leider van de betrokken werkstroom", () => {
    expect(
      magVraagkaartZien(
        maakOproeper({
          partijId: 1,
          kring: 0,
          rollen: ["werkstroomleider"],
          werkstroomIds: [22],
        }),
        kaartMenselijk,
      ),
    ).toBe(true);
  });

  it("geeft de kaart aan de facilitator", () => {
    expect(
      magVraagkaartZien(
        maakOproeper({ partijId: null, rollen: ["facilitator"] }),
        kaartMenselijk,
      ),
    ).toBe(true);
  });

  it("weigert de kaart aan een buitenstaande partij", () => {
    expect(magVraagkaartZien(maakOproeper({ partijId: 5, kring: 0 }), kaartFinancieel)).toBe(false);
  });
});

describe("Regel 6: de kring is een plafond", () => {
  const dossier = maakProefdossier();
  const kaartFinancieel = dossier.vragen[0];

  it("laat een ruimere kring dan de antwoordkring niet door", () => {
    // Kaart 31 mag tot kring 2 reiken. Kring 3 en 4 zitten daarbuiten.
    expect(
      magVraagkaartVolgensKring(maakOproeper({ kring: 3 }), kaartFinancieel),
    ).toBe(false);
    expect(
      magVraagkaartVolgensKring(maakOproeper({ kring: 4 }), kaartFinancieel),
    ).toBe(false);
  });

  it("laat een kleinere of gelijke kring wel door", () => {
    for (const kring of [0, 1, 2]) {
      expect(
        magVraagkaartVolgensKring(maakOproeper({ kring }), kaartFinancieel),
      ).toBe(true);
    }
  });

  it("werkt bovenop regel 5: wie volgens de rol mag maar volgens de kring niet, ziet niet", () => {
    const facilitatorInKringDrie = maakOproeper({
      partijId: 4,
      kring: 3,
      rollen: ["facilitator"],
    });
    expect(magVraagkaartZien(facilitatorInKringDrie, kaartFinancieel)).toBe(false);
    const uitkomst = filterTrajectVoorOproeper(facilitatorInKringDrie, maakProefdossier());
    expect(idsVan(uitkomst.vragen)).toEqual([32]);
  });

  it("legt geen plafond op wanneer de kring leeg is", () => {
    expect(magVraagkaartVolgensKring(maakOproeper({ kring: null }), kaartFinancieel)).toBe(true);
  });
});

describe("Regel 7: prior ziet alles en laat een spoor na", () => {
  it("geeft prior elke lijn, elke kaart en elke indruk", () => {
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ scope: "prior", persoonId: null, partijId: null, kring: null }),
      maakProefdossier(),
    );
    expect(idsVan(uitkomst.lijnen)).toEqual([11, 12]);
    expect(idsVan(uitkomst.vragen)).toEqual([31, 32]);
    expect(idsVan(uitkomst.gebeurtenissen)).toEqual([41, 42, 43]);
    expect(idsMetIndruk(uitkomst.gebeurtenissen)).toEqual([41, 42, 43]);
  });

  it("vult de lijst voor de auditregel met de vrijgegeven indrukken", () => {
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ scope: "prior", persoonId: null, partijId: null, kring: null }),
      maakProefdossier(),
    );
    expect(uitkomst.indrukVrijgegevenVoor).toEqual([41, 42, 43]);
  });

  it("houdt de lijst leeg wanneer er geen enkele indruk werd vrijgegeven", () => {
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ partijId: 2, kring: 1 }),
      dossierMetOproeperInPartij(2),
    );
    expect(uitkomst.indrukVrijgegevenVoor).toEqual([]);
  });

  it("laat de kring van prior geen plafond zijn", () => {
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ scope: "prior", persoonId: null, partijId: null, kring: 4 }),
      maakProefdossier(),
    );
    expect(idsVan(uitkomst.vragen)).toEqual([31, 32]);
  });
});

describe("Regel 8: een beheerder zonder persoon in het traject", () => {
  const beheerder = maakOproeper({
    scope: "organisatie",
    persoonId: null,
    partijId: null,
    kring: null,
  });

  it("ziet alles behalve de indruk", () => {
    const uitkomst = filterTrajectVoorOproeper(beheerder, maakProefdossier());
    expect(idsVan(uitkomst.lijnen)).toEqual([11, 12]);
    expect(idsVan(uitkomst.vragen)).toEqual([31, 32]);
    expect(idsVan(uitkomst.gebeurtenissen)).toEqual([41, 42, 43]);
    expect(idsMetIndruk(uitkomst.gebeurtenissen)).toEqual([]);
    expect(uitkomst.indrukVrijgegevenVoor).toEqual([]);
  });

  it("verliest niets door zijn lege kring, want leeg is geen kring 4", () => {
    const uitkomst = filterTrajectVoorOproeper(beheerder, maakProefdossier());
    // Kaart 31 reikt tot kring 2. Wie in kring 4 zit, ziet ze niet; deze
    // beheerder heeft geen kring en ziet ze dus wel.
    expect(idsVan(uitkomst.vragen)).toContain(31);
    const inKringVier = filterTrajectVoorOproeper(
      maakOproeper({ persoonId: null, partijId: null, kring: 4 }),
      maakProefdossier(),
    );
    expect(idsVan(inKringVier.vragen)).toEqual([32]);
  });
});

describe("Het veld indruk ontbreekt werkelijk", () => {
  it("laat de sleutel indruk volledig weg in plaats van hem leeg te maken", () => {
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ partijId: 2, kring: 1 }),
      dossierMetOproeperInPartij(2),
    );
    const gebeurtenis = uitkomst.gebeurtenissen[0];
    expect("indruk" in gebeurtenis).toBe(false);
    expect(Object.keys(gebeurtenis)).not.toContain("indruk");
    expect(Object.prototype.hasOwnProperty.call(gebeurtenis, "indruk")).toBe(false);
    // De vaststelling blijft wel staan.
    expect(Object.keys(gebeurtenis)).toContain("vaststelling");
  });

  it("houdt de sleutel wel wanneer de oproeper er recht op heeft", () => {
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ partijId: 1, kring: 0 }),
      dossierMetOproeperInPartij(1),
    );
    const metRecht = uitkomst.gebeurtenissen.find((rij) => rij.id === 41);
    expect(metRecht && "indruk" in metRecht).toBe(true);
  });

  it("raakt de gebeurtenissen van het ingevoerde dossier niet aan", () => {
    const dossier = dossierMetOproeperInPartij(2);
    filterTrajectVoorOproeper(maakOproeper({ partijId: 2, kring: 1 }), dossier);
    expect(dossier.gebeurtenissen.every((rij) => "indruk" in rij)).toBe(true);
  });
});

describe("De drie gaten, eerlijk vastgelegd", () => {
  it("gat een: wie alleen betrokkene is, ziet geen gebeurtenis en geen kaart", () => {
    const dossier = dossierMetOproeperInPartij(1);
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ partijId: 1, kring: 0, rollen: ["betrokkene"] }),
      dossier,
    );
    expect(uitkomst.gebeurtenissen).toEqual([]);
    expect(uitkomst.vragen).toEqual([]);
    expect(uitkomst.lijnen).toEqual([]);
    // Het geraamte van het dossier blijft wel zichtbaar.
    expect(uitkomst.fasen).toHaveLength(2);
    expect(uitkomst.partijen).toHaveLength(5);
    expect(uitkomst.werkstromen).toHaveLength(2);
    expect(isUitsluitendBetrokkene(maakOproeper({ rollen: ["betrokkene"] }))).toBe(true);
  });

  it("gat een: wie naast betrokkene nog een andere rol draagt, valt niet onder de weigering", () => {
    const dossier = dossierMetOproeperInPartij(1);
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ partijId: 1, kring: 0, rollen: ["betrokkene", "adviseur"] }),
      dossier,
    );
    expect(idsVan(uitkomst.vragen)).toEqual([31]);
    expect(
      isUitsluitendBetrokkene(maakOproeper({ rollen: ["betrokkene", "adviseur"] })),
    ).toBe(false);
  });

  it("gat twee: de adviseur ziet de kaarten van zijn eigen partij, niet meer en niet minder", () => {
    const dossier = dossierMetOproeperInPartij(3);
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ partijId: 3, kring: 2, rollen: ["adviseur"] }),
      dossier,
    );
    expect(idsVan(uitkomst.vragen)).toEqual([32]);
  });

  it("gat drie: het kringplafond raakt de gebeurtenissen niet", () => {
    const dossier = dossierMetOproeperInPartij(4);
    const uitkomst = filterTrajectVoorOproeper(
      maakOproeper({ partijId: 4, kring: 3, rollen: ["adviseur"] }),
      dossier,
    );
    // Kaart 31 valt weg voor kring 3, maar de gebeurtenissen op een zichtbare
    // lijn blijven staan, want een gebeurtenis heeft geen kringveld.
    expect(idsVan(uitkomst.gebeurtenissen)).toEqual([43]);
    expect(idsVan(uitkomst.vragen)).toEqual([32]);
  });
});
