import { isDemoModus } from "../demomodus";
import { storage as platformOpslag } from "../storage";
import { trajectOpslag } from "./storage";

const DAG = 24 * 60 * 60 * 1000;
const DEMO_ORGANISATIE = "DEMO Regiekamer";
const DEMO_TRAJECT = "DEMO - Overname Asterra Machines";

type PlatformDemoOpslag = Pick<
  typeof platformOpslag,
  "listBeheerders" | "listOrganisaties" | "createOrganisatie"
>;

export async function seedDemonstratietraject(
  platform: PlatformDemoOpslag = platformOpslag,
  opslag: typeof trajectOpslag = trajectOpslag,
  demoActief: () => boolean = isDemoModus,
): Promise<void> {
  if (!demoActief()) return;

  try {
    const beheerders = await platform.listBeheerders();
    const beheerder = beheerders.find(
      (kandidaat) => kandidaat.actief && kandidaat.isPrior,
    );
    if (!beheerder) {
      console.warn(
        "[regiekamer-demo] Geen actieve prior gevonden; demonstratietraject niet aangemaakt.",
      );
      return;
    }

    const organisaties = await platform.listOrganisaties();
    const bestaandeOrganisatie = organisaties.find(
      (kandidaat) => kandidaat.naam === DEMO_ORGANISATIE,
    );
    const organisatieId =
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

    const bestaand = opslag
      .haalTrajectenVoorBeheerder(beheerder.id)
      .some(
        (traject) =>
          traject.organisatieId === organisatieId &&
          traject.naam === DEMO_TRAJECT,
      );
    if (bestaand) return;

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

    console.log("[regiekamer-demo] Demonstratietraject aangemaakt.");
  } catch (fout) {
    console.warn(
      "[regiekamer-demo] Demonstratietraject kon niet worden aangemaakt:",
      fout instanceof Error ? fout.message : fout,
    );
  }
}
