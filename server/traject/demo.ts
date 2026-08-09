import { storage as platformOpslag } from "../storage";
import { voorbeelddossierGevraagd } from "../voorbeelddossier";
import type { TrajectRolnaam } from "./schema";
import { trajectOpslag } from "./storage";

const DAG = 24 * 60 * 60 * 1000;
const DEMO_ORGANISATIE = "DEMO Regiekamer";
const DEMO_TRAJECT = "DEMO - Overname Asterra Machines";

/**
 * Stand van elke werkstroom in het demonstratietraject. Alle vier de standen
 * komen minstens een keer voor. Waar een oplevering zinvol is, staat ze in
 * dagen vanaf nu.
 */
const DEMO_WERKSTROMEN = [
  {
    naam: "financieel",
    status: "lopend",
    oplevering: "Tussentijdse cijferbundel",
    dagenTotOplevering: 6,
  },
  {
    naam: "juridisch",
    status: "lopend",
    oplevering: "Ontwerp van de kaderafspraak",
    dagenTotOplevering: 12,
  },
  {
    naam: "fiscaal",
    status: "niet_gestart",
    oplevering: null,
    dagenTotOplevering: null,
  },
  {
    naam: "commercieel",
    status: "geblokkeerd",
    oplevering: null,
    dagenTotOplevering: null,
  },
  {
    naam: "technisch",
    status: "lopend",
    oplevering: "Verslag van de technische doorlichting",
    dagenTotOplevering: 20,
  },
  {
    naam: "menselijk",
    status: "afgerond",
    oplevering: null,
    dagenTotOplevering: null,
  },
] as const;

/**
 * Zet de standen van de zes werkstromen. Deze handeling werkt bij, dus ze mag
 * ook lopen op een demonstratietraject dat al in de databank staat.
 */
function zetWerkstroomstanden(
  opslag: typeof trajectOpslag,
  trajectId: number,
  beheerderId: number,
  nu: number,
): void {
  for (const werkstroom of DEMO_WERKSTROMEN) {
    opslag.werkWerkstroomBij({
      trajectId,
      beheerderId,
      naam: werkstroom.naam,
      status: werkstroom.status,
      eerstvolgendeOplevering: werkstroom.oplevering,
      eerstvolgendeOpleveringOp:
        werkstroom.dagenTotOplevering === null
          ? null
          : new Date(nu + werkstroom.dagenTotOplevering * DAG).toISOString(),
    });
  }
}

/**
 * De mensen van het demonstratiedossier, met de partij waar ze bij horen en de
 * rollen die ze dragen. De facilitator hoort bij geen enkele partij: het
 * protocol vraagt iemand zonder belang bij de uitkomst. Elk van de zes
 * werkstromen heeft een leider, en er is een ankerpunt aan beide zijden.
 */
const DEMO_PERSONEN: ReadonlyArray<{
  naam: string;
  email: string;
  partij: string | null;
  rollen: ReadonlyArray<{ rol: TrajectRolnaam; werkstroom?: string }>;
}> = [
  {
    naam: "Ruth Vandewalle",
    email: "ruth@regiekamer.example",
    partij: null,
    rollen: [{ rol: "facilitator" }],
  },
  {
    naam: "Sofie Van Loon",
    email: "sofie@noordzee.example",
    partij: "Noordzee Participaties",
    rollen: [{ rol: "ankerpunt_investeerder" }],
  },
  {
    naam: "Tom Aerts",
    email: "tom@asterra.example",
    partij: "Asterra Machines",
    rollen: [{ rol: "ankerpunt_onderneming" }],
  },
  {
    naam: "Bram Coppens",
    email: "bram@asterra.example",
    partij: "Asterra Machines",
    rollen: [
      { rol: "werkstroomleider", werkstroom: "financieel" },
      { rol: "werkstroomleider", werkstroom: "fiscaal" },
    ],
  },
  {
    naam: "Joris Baeten",
    email: "joris@noordzee.example",
    partij: "Noordzee Participaties",
    rollen: [
      { rol: "werkstroomleider", werkstroom: "juridisch" },
      { rol: "werkstroomleider", werkstroom: "commercieel" },
    ],
  },
  {
    naam: "Wim Claes",
    email: "wim@asterra.example",
    partij: "Asterra Machines",
    rollen: [{ rol: "werkstroomleider", werkstroom: "technisch" }],
  },
  {
    naam: "Amira El Haddad",
    email: "amira@asterra.example",
    partij: "Kernteam Asterra",
    rollen: [{ rol: "werkstroomleider", werkstroom: "menselijk" }],
  },
  {
    naam: "Lina Mertens",
    email: "lina@helder.example",
    partij: "Helder & Partners",
    rollen: [{ rol: "adviseur" }],
  },
  {
    naam: "Jens Peeters",
    email: "jens@metaalco.example",
    partij: "Metaalco BV",
    rollen: [{ rol: "betrokkene" }],
  },
];

/**
 * Wie welke gebeurtenis heeft neergeschreven. Zonder auteur kan een indruk bij
 * niemand terechtkomen, en dan valt in het demonstratiedossier niet te zien dat
 * de afscherming werkt. De auteur hoort altijd bij een van de twee partijen van
 * de lijn waarop de gebeurtenis staat.
 */
const DEMO_AUTEURS: ReadonlyArray<{ vaststelling: string; email: string }> = [
  {
    vaststelling: "De eerste documentlijst is bevestigd.",
    email: "sofie@noordzee.example",
  },
  {
    vaststelling: "De termijn voor de eigendomsstructuur is verlopen.",
    email: "tom@asterra.example",
  },
  {
    vaststelling: "De adviseur heeft de financiële werkstroom toegelicht.",
    email: "lina@helder.example",
  },
  {
    vaststelling: "Een aanvulling op de cijfers is aangekondigd.",
    email: "joris@noordzee.example",
  },
  {
    vaststelling: "De leverancier heeft de contractlijst ontvangen.",
    email: "jens@metaalco.example",
  },
  {
    vaststelling: "De vertegenwoordiging heeft de uitgangspunten ontvangen.",
    email: "amira@asterra.example",
  },
  {
    vaststelling: "Het kernteam heeft zijn contactpersoon bevestigd.",
    email: "wim@asterra.example",
  },
  {
    vaststelling: "De technische risicoanalyse is gedeeld.",
    email: "lina@helder.example",
  },
  {
    vaststelling: "De volgende technische afstemming staat gepland.",
    email: "amira@asterra.example",
  },
];

/**
 * Zet de personen, hun rollen en de auteurs van de gebeurtenissen. Deze
 * handeling mag zo vaak lopen als nodig: wat er al staat blijft staan en wordt
 * niet opnieuw aangemaakt. Dat is nodig omdat de databank een adres maar een
 * keer per dossier toelaat en per dossier maar een facilitator.
 */
function zorgVoorPersonenEnRollen(
  opslag: typeof trajectOpslag,
  trajectId: number,
  beheerderId: number,
): void {
  const volledig = opslag.haalTrajectOp(trajectId, beheerderId);
  const partijPerNaam = new Map(
    volledig.partijen.map((partij) => [partij.naam, partij.id]),
  );
  const werkstroomPerNaam = new Map(
    volledig.werkstromen.map((werkstroom) => [werkstroom.naam, werkstroom.id]),
  );
  const bestaandePersonen = opslag.haalPersonenVanTraject(trajectId, beheerderId);
  const nummerPerAdres = new Map(
    bestaandePersonen.map((persoon) => [persoon.email, persoon.id]),
  );

  for (const opgave of DEMO_PERSONEN) {
    let persoonId = nummerPerAdres.get(opgave.email);
    if (persoonId === undefined) {
      persoonId = opslag.voegPersoonToe({
        trajectId,
        beheerderId,
        naam: opgave.naam,
        email: opgave.email,
        partijId:
          opgave.partij === null ? null : partijPerNaam.get(opgave.partij) ?? null,
      }).id;
      nummerPerAdres.set(opgave.email, persoonId);
    }
    const alGedragenRollen =
      bestaandePersonen.find((persoon) => persoon.id === persoonId)?.rollen ?? [];
    for (const rolOpgave of opgave.rollen) {
      const werkstroomId =
        rolOpgave.werkstroom === undefined
          ? null
          : werkstroomPerNaam.get(rolOpgave.werkstroom) ?? null;
      const staatEr = alGedragenRollen.some(
        (rol) => rol.rol === rolOpgave.rol && rol.werkstroomId === werkstroomId,
      );
      if (staatEr) continue;
      opslag.kenRolToe({
        trajectId,
        beheerderId,
        persoonId,
        rol: rolOpgave.rol,
        werkstroomId,
      });
    }
  }

  for (const gebeurtenis of volledig.gebeurtenissen) {
    if (gebeurtenis.vastgelegdDoorPersoonId !== null) continue;
    const opgave = DEMO_AUTEURS.find(
      (kandidaat) => kandidaat.vaststelling === gebeurtenis.vaststelling,
    );
    if (opgave === undefined) continue;
    const persoonId = nummerPerAdres.get(opgave.email);
    if (persoonId === undefined) continue;
    opslag.zetAuteurVanGebeurtenis({
      gebeurtenisId: gebeurtenis.id,
      persoonId,
      beheerderId,
    });
  }
}

/**
 * Kiest de beheerder die het voorbeelddossier op zijn naam krijgt.
 *
 * Bij voorkeur de prior: die kijkt over alle organisaties heen en ziet het
 * voorbeelddossier dus hoe dan ook.
 *
 * Is er geen actieve prior, dan valt de keuze op de eerste actieve beheerder
 * die aan een organisatie hangt. Die beperking is geen detail: een beheerder
 * zonder priorstatus mag uitsluitend dossiers van zijn eigen organisatie zien.
 * Iemand kiezen die aan geen enkele organisatie hangt, levert dus een dossier
 * op dat niemand kan openen, en dat is precies het lege scherm dat we willen
 * vermijden. Het dossier wordt in dat geval in de eigen organisatie van die
 * beheerder gezet, niet in een aparte demonstratieorganisatie.
 */
function kiesEigenaar<
  T extends { actief: boolean; isPrior: boolean; organisatieId?: number | null },
>(
  beheerders: ReadonlyArray<T>,
  meld: (regel: string) => void = console.warn,
): T | undefined {
  const actieven = beheerders.filter((kandidaat) => kandidaat.actief);
  const prior = actieven.find((kandidaat) => kandidaat.isPrior);
  if (prior) return prior;

  const metOrganisatie = actieven.find(
    (kandidaat) =>
      kandidaat.organisatieId !== null && kandidaat.organisatieId !== undefined,
  );
  if (metOrganisatie) {
    meld(
      "[regiekamer-demo] Geen actieve prior gevonden; het voorbeelddossier komt " +
        "in de organisatie van de eerste actieve beheerder te staan.",
    );
    return metOrganisatie;
  }

  if (actieven.length > 0) {
    meld(
      "[regiekamer-demo] Geen actieve prior en geen beheerder met een " +
        "organisatie; een voorbeelddossier zou voor niemand zichtbaar zijn en " +
        "wordt daarom niet aangemaakt.",
    );
  }
  return undefined;
}

type PlatformDemoOpslag = Pick<
  typeof platformOpslag,
  "listBeheerders" | "listOrganisaties" | "createOrganisatie"
>;

export async function seedDemonstratietraject(
  platform: PlatformDemoOpslag = platformOpslag,
  opslag: typeof trajectOpslag = trajectOpslag,
  demoActief: () => boolean = voorbeelddossierGevraagd,
): Promise<void> {
  if (!demoActief()) return;

  try {
    const beheerders = await platform.listBeheerders();
    const beheerder = kiesEigenaar(beheerders);
    if (!beheerder) {
      console.warn(
        "[regiekamer-demo] Geen actieve beheerder gevonden; voorbeelddossier niet aangemaakt.",
      );
      return;
    }

    // Een prior kijkt over de organisaties heen en krijgt daarom een eigen,
    // duidelijk afgescheiden demonstratieorganisatie. Een gewone beheerder ziet
    // enkel zijn eigen organisatie; voor hem hoort het voorbeelddossier daar
    // thuis, anders blijft zijn scherm leeg.
    let organisatieId: number;
    if (!beheerder.isPrior && beheerder.organisatieId != null) {
      organisatieId = beheerder.organisatieId;
    } else {
      const organisaties = await platform.listOrganisaties();
      const bestaandeOrganisatie = organisaties.find(
        (kandidaat) => kandidaat.naam === DEMO_ORGANISATIE,
      );
      organisatieId =
        bestaandeOrganisatie?.id ??
        (
          await platform.createOrganisatie({
            naam: DEMO_ORGANISATIE,
            type: "bedrijf",
            contactpersoon: "Demonstratie Regiekamer",
            email: "demo-regiekamer@tapascity.example",
            peppolBereikbaar: false,
          })
        ).id;
    }

    const bestaand = opslag
      .haalTrajectenVoorBeheerder(beheerder.id)
      .find(
        (traject) =>
          traject.organisatieId === organisatieId &&
          traject.naam === DEMO_TRAJECT,
      );
    if (bestaand) {
      // Het traject staat er al. De standen van de werkstromen worden wel
      // bijgewerkt, zodat een bestaande databank hetzelfde beeld geeft.
      zetWerkstroomstanden(opslag, bestaand.id, beheerder.id, Date.now());
      zorgVoorPersonenEnRollen(opslag, bestaand.id, beheerder.id);
      return;
    }

    const nu = Date.now();
    const traject = opslag.maakTraject({
      naam: DEMO_TRAJECT,
      organisatieId,
      beheerderId: beheerder.id,
      zekerheidstrap: 2,
      aangemaaktOp: nu - 42 * DAG,
    });

    const [investeerder, onderneming, adviseur, leverancier, medewerkers] = [
      {
        soort: "investeerder",
        naam: "Noordzee Participaties",
        ankerpunt: "Sofie Van Loon",
        kring: 0,
        rol: "ankerpunt_investeerder",
      },
      {
        soort: "onderneming",
        naam: "Asterra Machines",
        ankerpunt: "Tom Aerts",
        kring: 0,
        rol: "ankerpunt_onderneming",
      },
      {
        soort: "adviseur",
        naam: "Helder & Partners",
        ankerpunt: "Lina Mertens",
        kring: 1,
        rol: "financieel_adviseur",
      },
      {
        soort: "leverancier",
        naam: "Metaalco BV",
        ankerpunt: "Jens Peeters",
        kring: 2,
        rol: "kernleverancier",
      },
      {
        soort: "medewerkers",
        naam: "Kernteam Asterra",
        ankerpunt: "Amira El Haddad",
        kring: 1,
        rol: "vertegenwoordiging",
      },
    ].map((partij) =>
      opslag.voegPartijToe({
        trajectId: traject.id,
        beheerderId: beheerder.id,
        ...partij,
      }),
    );

    const maakLijn = (
      eerste: typeof investeerder,
      tweede: typeof investeerder,
      stiltedrempelDagen: number,
    ) =>
      opslag.voegLijnToe({
        trajectId: traject.id,
        beheerderId: beheerder.id,
        partijEenId: eerste.id,
        partijTweeId: tweede.id,
        stiltedrempelDagen,
        aangemaaktOp: nu - 42 * DAG,
      });
    const aandacht = maakLijn(investeerder, onderneming, 7);
    const lopend = maakLijn(investeerder, adviseur, 10);
    const stil = maakLijn(onderneming, leverancier, 7);
    const inOrde = maakLijn(onderneming, medewerkers, 7);
    const betrokken = maakLijn(adviseur, medewerkers, 14);

    const gebeurtenissen = [
      [
        aandacht,
        35,
        "bericht",
        "De eerste documentlijst is bevestigd.",
        "Beide zijden houden de planning scherp in het oog.",
      ],
      [
        aandacht,
        2,
        "gesprek",
        "De termijn voor de eigendomsstructuur is verlopen.",
        "De druk neemt merkbaar toe.",
      ],
      [
        lopend,
        28,
        "rechtstreeks_contact",
        "De adviseur heeft de financiële werkstroom toegelicht.",
        "Er is werkbaar vertrouwen.",
      ],
      [
        lopend,
        3,
        "bericht",
        "Een aanvulling op de cijfers is aangekondigd.",
        "De toon blijft constructief.",
      ],
      [
        stil,
        16,
        "bericht",
        "De leverancier heeft de contractlijst ontvangen.",
        "Een antwoord blijft uit.",
      ],
      [
        inOrde,
        14,
        "gesprek",
        "De vertegenwoordiging heeft de uitgangspunten ontvangen.",
        "Er was ruimte voor vragen.",
      ],
      [
        inOrde,
        1,
        "rechtstreeks_contact",
        "Het kernteam heeft zijn contactpersoon bevestigd.",
        "De opvolging verloopt rustig.",
      ],
      [
        betrokken,
        40,
        "bericht",
        "De technische risicoanalyse is gedeeld.",
        "De adviseur ziet een heldere basis.",
      ],
      [
        betrokken,
        4,
        "gesprek",
        "De volgende technische afstemming staat gepland.",
        "De partijen zoeken actief naar helderheid.",
      ],
    ] as const;

    for (const [
      lijn,
      dagenGeleden,
      soort,
      vaststelling,
      indruk,
    ] of gebeurtenissen) {
      opslag.voegGebeurtenisToe({
        trajectId: traject.id,
        beheerderId: beheerder.id,
        lijnId: lijn.id,
        tijdstip: nu - dagenGeleden * DAG,
        soort,
        vaststelling,
        indruk,
      });
    }

    const werkstromen = opslag.haalTrajectOp(
      traject.id,
      beheerder.id,
    ).werkstromen;
    const maakVraag = (
      lijnId: number,
      vragerPartijId: number,
      ontvangerPartijId: number,
      werkstroomIndex: number,
      vraagtekst: string,
      kader: string,
      antwoordtermijnOp: number,
    ) =>
      opslag.maakVraagkaart({
        trajectId: traject.id,
        beheerderId: beheerder.id,
        lijnId,
        vragerPartijId,
        ontvangerPartijId,
        werkstroomId: werkstromen[werkstroomIndex]!.id,
        vraagtekst,
        kader,
        antwoordtermijnOp,
        antwoordKring: 1,
        aangemaaktOp: nu - 8 * DAG,
      });

    maakVraag(
      aandacht.id,
      investeerder.id,
      onderneming.id,
      0,
      "Kan de eigendomsstructuur volledig worden bevestigd?",
      "Nodig voor de financiële beoordeling.",
      nu - 2 * DAG,
    );
    const erkendeVraag = maakVraag(
      lopend.id,
      adviseur.id,
      investeerder.id,
      1,
      "Wanneer volgt de aanvulling op de financiële cijfers?",
      "Nodig voor de volgende onderzoeksslag.",
      nu + 5 * DAG,
    );
    opslag.veranderVraagtoestand({
      vraagId: erkendeVraag.id,
      beheerderId: beheerder.id,
      toestand: "erkend",
    });
    const behandeldeVraag = maakVraag(
      betrokken.id,
      medewerkers.id,
      adviseur.id,
      4,
      "Welke technische afhankelijkheden vragen nog opvolging?",
      "Nodig voor de technische werkstroom.",
      nu + 8 * DAG,
    );
    opslag.veranderVraagtoestand({
      vraagId: behandeldeVraag.id,
      beheerderId: beheerder.id,
      toestand: "erkend",
    });
    opslag.veranderVraagtoestand({
      vraagId: behandeldeVraag.id,
      beheerderId: beheerder.id,
      toestand: "in_behandeling",
    });
    const beantwoordeVraag = maakVraag(
      inOrde.id,
      medewerkers.id,
      onderneming.id,
      5,
      "Wie verzorgt de terugkoppeling aan het kernteam?",
      "Nodig voor de menselijke werkstroom.",
      nu - DAG,
    );
    opslag.veranderVraagtoestand({
      vraagId: beantwoordeVraag.id,
      beheerderId: beheerder.id,
      toestand: "erkend",
    });
    opslag.veranderVraagtoestand({
      vraagId: beantwoordeVraag.id,
      beheerderId: beheerder.id,
      toestand: "in_behandeling",
    });
    opslag.veranderVraagtoestand({
      vraagId: beantwoordeVraag.id,
      beheerderId: beheerder.id,
      toestand: "beantwoord",
    });

    zetWerkstroomstanden(opslag, traject.id, beheerder.id, nu);
    zorgVoorPersonenEnRollen(opslag, traject.id, beheerder.id);

    console.log("[regiekamer-demo] Demonstratietraject aangemaakt.");
  } catch (fout) {
    console.warn(
      "[regiekamer-demo] Demonstratietraject kon niet worden aangemaakt:",
      fout instanceof Error ? fout.message : fout,
    );
  }
}
