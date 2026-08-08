import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { maakTrajectOpslag } from "../server/traject/storage";
import {
  isOpenstaandeVraag,
  TOESTANDEN_OPENSTAAND,
  VRAAGTOESTANDEN,
} from "../server/traject/afleiding";
import type { VraagToestand } from "../server/traject/afleiding";

const beheerdersVoorScope = vi.hoisted(() => new Map<number, any>());

vi.mock("../server/storage", () => ({
  storage: {
    getBeheerder: async (id: number) => beheerdersVoorScope.get(id),
  },
}));

const { registerTrajectRoutes } = await import("../server/traject/routes");

const migratie = readFileSync(
  "migrations/0002_clammy_talisman.sql",
  "utf8",
).replaceAll("--> statement-breakpoint", "");
const NU = Date.parse("2026-08-08T10:00:00.000Z");
const DAG = 24 * 60 * 60 * 1000;

type TrajectRoute = { methode: "GET" | "POST" | "PATCH"; pad: string };

let databank: Database.Database;
let opslag: ReturnType<typeof maakTrajectOpslag>;

function maakProefdatabank(): Database.Database {
  const proefdatabank = new Database(":memory:");
  proefdatabank.pragma("foreign_keys = ON");
  proefdatabank.exec(`
    CREATE TABLE organisaties (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL
    );
    CREATE TABLE beheerders (
      id INTEGER PRIMARY KEY,
      organisatie_id INTEGER,
      is_prior INTEGER NOT NULL DEFAULT 0
    );
  `);
  proefdatabank.exec(migratie);
  proefdatabank
    .prepare("INSERT INTO organisaties (id, naam) VALUES (?, ?)")
    .run(1, "Organisatie A");
  proefdatabank
    .prepare("INSERT INTO organisaties (id, naam) VALUES (?, ?)")
    .run(2, "Organisatie B");
  proefdatabank
    .prepare(
      "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
    )
    .run(10, 1, 0);
  proefdatabank
    .prepare(
      "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
    )
    .run(11, 1, 0);
  proefdatabank
    .prepare(
      "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
    )
    .run(20, 2, 0);
  proefdatabank
    .prepare(
      "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
    )
    .run(1, null, 1);
  proefdatabank
    .prepare(
      "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
    )
    .run(30, 1, 1);
  return proefdatabank;
}

function zetBeheerdersVoorScope(): void {
  beheerdersVoorScope.clear();
  beheerdersVoorScope.set(1, {
    id: 1,
    actief: true,
    isPrior: true,
    organisatie: "TaPasCity",
    organisatieId: null,
  });
  beheerdersVoorScope.set(10, {
    id: 10,
    actief: true,
    isPrior: false,
    organisatie: "Organisatie A",
    organisatieId: 1,
  });
  beheerdersVoorScope.set(11, {
    id: 11,
    actief: true,
    isPrior: false,
    organisatie: "Organisatie A",
    organisatieId: 1,
  });
  beheerdersVoorScope.set(20, {
    id: 20,
    actief: true,
    isPrior: false,
    organisatie: "Organisatie B",
    organisatieId: 2,
  });
  beheerdersVoorScope.set(30, {
    id: 30,
    actief: true,
    isPrior: true,
    organisatie: "Organisatie A",
    organisatieId: 1,
  });
}

function maakApp(aanmelding: "geen" | "prior" | "a" | "a2" | "b" | "pseudo") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const adminId = {
      prior: 1,
      a: 10,
      a2: 11,
      b: 20,
      pseudo: 30,
    }[aanmelding];
    if (adminId) (req as any).session = { adminId };
    next();
  });
  registerTrajectRoutes(app, opslag);
  return app;
}

function geregistreerdeTrajectRoutes(app: express.Express): TrajectRoute[] {
  const router = (app as any).router;
  return (router?.stack ?? [])
    .filter((laag: any) => laag.route?.path?.startsWith("/api/traject/"))
    .flatMap((laag: any) =>
      Object.keys(laag.route.methods)
        .filter((methode) => laag.route.methods[methode])
        .map((methode) => ({
          methode: methode.toUpperCase(),
          pad: laag.route.path,
        })),
    ) as TrajectRoute[];
}

function padVoorRoute(pad: string): string {
  return pad
    .replace(":trajectId", "1")
    .replace(":lijnId", "1")
    .replace(":vraagId", "1");
}

async function metServer<T>(
  app: express.Express,
  actie: (basis: string) => Promise<T>,
): Promise<T> {
  const server = createServer(app);
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    return await actie(`http://127.0.0.1:${poort}`);
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

async function verzoek(
  aanmelding: "geen" | "prior" | "a" | "a2" | "b" | "pseudo",
  methode: "GET" | "POST" | "PATCH",
  pad: string,
  lichaam?: unknown,
): Promise<{ status: number; lichaam: any }> {
  return metServer(maakApp(aanmelding), async (basis) => {
    const heeftLichaam = lichaam !== undefined && methode !== "GET";
    const antwoord = await fetch(`${basis}${pad}`, {
      method: methode,
      headers: heeftLichaam
        ? { "Content-Type": "application/json" }
        : undefined,
      body: heeftLichaam ? JSON.stringify(lichaam) : undefined,
    });
    return {
      status: antwoord.status,
      lichaam: await antwoord.json().catch(() => null),
    };
  });
}

function maakTrajectMetLijn(
  beheerderId: number,
  organisatieId: number,
  naam: string,
) {
  const traject = opslag.maakTraject({
    naam,
    beheerderId,
    organisatieId,
    aangemaaktOp: NU - 42 * DAG,
  });
  const partijEen = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId,
    soort: "investeerder",
    naam: `${naam} Invest`,
    ankerpunt: "Ankerpunt investeerder",
    kring: 0,
    rol: "ankerpunt_investeerder",
  });
  const partijTwee = opslag.voegPartijToe({
    trajectId: traject.id,
    beheerderId,
    soort: "onderneming",
    naam: `${naam} Onderneming`,
    ankerpunt: "Ankerpunt onderneming",
    kring: 0,
    rol: "ankerpunt_onderneming",
  });
  const lijn = opslag.voegLijnToe({
    trajectId: traject.id,
    beheerderId,
    partijEenId: partijEen.id,
    partijTweeId: partijTwee.id,
    stiltedrempelDagen: 7,
    aangemaaktOp: NU - 42 * DAG,
  });
  return { traject, partijEen, partijTwee, lijn };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NU);
  zetBeheerdersVoorScope();
  databank = maakProefdatabank();
  opslag = maakTrajectOpslag(databank, () => undefined);
});

afterEach(() => {
  databank.close();
  vi.useRealTimers();
});

describe("opslag voor routes van de Regiekamer", () => {
  it("leest uitsluitend trajecten van de beheerder en lijngebeurtenissen nieuw naar oud", () => {
    const a = maakTrajectMetLijn(10, 1, "Traject A");
    const b = maakTrajectMetLijn(20, 2, "Traject B");
    opslag.voegGebeurtenisToe({
      trajectId: a.traject.id,
      beheerderId: 10,
      lijnId: a.lijn.id,
      tijdstip: NU - 2 * DAG,
      soort: "bericht",
      vaststelling: "Eerste bericht.",
      indruk: "Voorzichtig positief.",
    });
    opslag.voegGebeurtenisToe({
      trajectId: a.traject.id,
      beheerderId: 10,
      lijnId: a.lijn.id,
      tijdstip: NU - DAG,
      soort: "gesprek",
      vaststelling: "Tweede gesprek.",
      indruk: "Meer duidelijkheid.",
    });

    expect(
      opslag.haalTrajectenVoorBeheerder(10).map((traject) => traject.id),
    ).toEqual([a.traject.id]);
    expect(
      opslag.haalTrajectenVoorBeheerder(20).map((traject) => traject.id),
    ).toEqual([b.traject.id]);
    expect(
      opslag
        .haalGebeurtenissenVanLijn(a.lijn.id, 10)
        .map((gebeurtenis) => gebeurtenis.vaststelling),
    ).toEqual(["Tweede gesprek.", "Eerste bericht."]);
    expect(() => opslag.haalGebeurtenissenVanLijn(a.lijn.id, 20)).toThrow(
      /organisatiegrens/i,
    );
  });

  it("maakt de stap naar gedeeld pas na twee servermatig vastgelegde vrijgaven", () => {
    const { traject, partijEen, partijTwee, lijn } = maakTrajectMetLijn(
      10,
      1,
      "Vrijgave",
    );
    const werkstroom = opslag.haalTrajectOp(traject.id, 10).werkstromen[0]!;
    const vraag = opslag.maakVraagkaart({
      trajectId: traject.id,
      beheerderId: 10,
      lijnId: lijn.id,
      vragerPartijId: partijEen.id,
      ontvangerPartijId: partijTwee.id,
      werkstroomId: werkstroom.id,
      vraagtekst: "Kan de planning worden gedeeld?",
      kader: "Nodig voor de volgende werkstroom.",
      antwoordtermijnOp: NU + 3 * DAG,
      antwoordKring: 1,
      aangemaaktOp: NU - DAG,
    });
    opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: "erkend",
    });
    opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: "in_behandeling",
    });
    opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: "beantwoord",
    });

    const naEersteVrijgave = opslag.vraagkaartVrijgeven({
      vraagId: vraag.id,
      beheerderId: 10,
      zijde: "vrager",
      vrijgegevenOp: NU,
    });
    expect(naEersteVrijgave.toestand).toBe("beantwoord");
    expect(naEersteVrijgave.vrijgaveVragerDoorBeheerderId).toBe(10);
    expect(naEersteVrijgave.vrijgaveOntvangerDoorBeheerderId).toBeNull();
    expect(() =>
      opslag.vraagkaartVrijgeven({
        vraagId: vraag.id,
        beheerderId: 10,
        zijde: "ontvanger",
        vrijgegevenOp: NU,
      }),
    ).toThrow(/twee verschillende beheerders/i);

    const gedeeld = opslag.vraagkaartVrijgeven({
      vraagId: vraag.id,
      beheerderId: 11,
      zijde: "ontvanger",
      vrijgegevenOp: NU,
    });
    expect(gedeeld.toestand).toBe("gedeeld");
    expect(gedeeld.vrijgaveVragerDoorBeheerderId).toBe(10);
    expect(gedeeld.vrijgaveOntvangerDoorBeheerderId).toBe(11);
  });
});

describe("Regiekamer routes", () => {
  it("weigert zonder aanmelding elke geregistreerde route onder /api/traject", async () => {
    const routes = geregistreerdeTrajectRoutes(maakApp("geen"));
    expect(routes).toHaveLength(9);
    for (const route of routes) {
      const antwoord = await verzoek(
        "geen",
        route.methode,
        padVoorRoute(route.pad),
        {},
      );
      expect(antwoord.status, `${route.methode} ${route.pad}`).toBe(403);
    }
  });

  it("houdt een echt trajectnummer strikt binnen de organisatiegrens", async () => {
    const a = maakTrajectMetLijn(10, 1, "Traject A");
    const b = maakTrajectMetLijn(20, 2, "Traject B");

    const lijst = await verzoek("a", "GET", "/api/traject/trajecten");
    expect(lijst.status).toBe(200);
    expect(lijst.lichaam.map((traject: { id: number }) => traject.id)).toEqual([
      a.traject.id,
    ]);

    expect(
      (await verzoek("a", "GET", `/api/traject/trajecten/${b.traject.id}`))
        .status,
    ).toBe(404);
    const pseudoPriorLijst = await verzoek(
      "pseudo",
      "GET",
      "/api/traject/trajecten",
    );
    expect(pseudoPriorLijst.status).toBe(200);
    expect(
      pseudoPriorLijst.lichaam.map((traject: { id: number }) => traject.id),
    ).toEqual([a.traject.id]);
    expect(
      (
        await verzoek(
          "pseudo",
          "GET",
          `/api/traject/trajecten/${b.traject.id}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await verzoek(
          "a",
          "POST",
          `/api/traject/trajecten/${b.traject.id}/partijen`,
          {
            soort: "adviseur",
            naam: "Onbevoegd",
            ankerpunt: "Geen",
            kring: 1,
            rol: "adviseur",
          },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await verzoek(
          "a",
          "GET",
          `/api/traject/trajecten/${b.traject.id}/lijnen/${b.lijn.id}/gebeurtenissen`,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await verzoek("a", "POST", "/api/traject/trajecten", {
          naam: "Geen traject voor B",
          organisatieId: 2,
        })
      ).status,
    ).toBe(403);
  });

  it("levert indruk nooit standaard uit en alleen na een uitdrukkelijk verzoek van een bevoegde beheerder", async () => {
    const { traject, lijn } = maakTrajectMetLijn(10, 1, "Indrukken");
    opslag.voegGebeurtenisToe({
      trajectId: traject.id,
      beheerderId: 10,
      lijnId: lijn.id,
      tijdstip: NU - DAG,
      soort: "gesprek",
      vaststelling: "De termijn is besproken.",
      indruk: "De toon was gespannen.",
    });

    const standaard = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${traject.id}/lijnen/${lijn.id}/gebeurtenissen`,
    );
    expect(standaard.status).toBe(200);
    expect(standaard.lichaam[0]).not.toHaveProperty("indruk");
    expect(standaard.lichaam[0].vaststelling).toBe("De termijn is besproken.");

    const metIndruk = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${traject.id}/lijnen/${lijn.id}/gebeurtenissen?metIndruk=true`,
    );
    expect(metIndruk.status).toBe(200);
    expect(metIndruk.lichaam[0].indruk).toBe("De toon was gespannen.");

    const volledigStandaard = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${traject.id}`,
    );
    expect(volledigStandaard.lichaam.gebeurtenissen[0]).not.toHaveProperty(
      "indruk",
    );
    const volledigMetIndruk = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${traject.id}?metIndruk=true`,
    );
    expect(volledigMetIndruk.lichaam.gebeurtenissen[0].indruk).toBe(
      "De toon was gespannen.",
    );
  });

  it("vult het hoofdscherm in een antwoord met afgeleide lijn- en vraagwaarden", async () => {
    const { traject, partijEen, partijTwee, lijn } = maakTrajectMetLijn(
      10,
      1,
      "Hoofdscherm",
    );
    opslag.voegGebeurtenisToe({
      trajectId: traject.id,
      beheerderId: 10,
      lijnId: lijn.id,
      tijdstip: NU - DAG,
      soort: "bericht",
      vaststelling: "De documenten zijn ontvangen.",
    });
    const werkstroom = opslag.haalTrajectOp(traject.id, 10).werkstromen[0]!;
    opslag.maakVraagkaart({
      trajectId: traject.id,
      beheerderId: 10,
      lijnId: lijn.id,
      vragerPartijId: partijEen.id,
      ontvangerPartijId: partijTwee.id,
      werkstroomId: werkstroom.id,
      vraagtekst: "Wanneer volgt de antwoordenbundel?",
      kader: "Nodig voor de planning.",
      antwoordtermijnOp: NU - 1,
      antwoordKring: 1,
      aangemaaktOp: NU - 2 * DAG,
    });

    const antwoord = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${traject.id}`,
    );
    expect(antwoord.status).toBe(200);
    expect(antwoord.lichaam.fasen).toHaveLength(9);
    expect(antwoord.lichaam.partijen).toHaveLength(2);
    expect(antwoord.lichaam.werkstromen).toHaveLength(6);
    expect(antwoord.lichaam.werkstromen[0]).toMatchObject({
      aantalVragen: 1,
      aantalAfgehandeld: 0,
      voortgang: 0,
    });
    expect(antwoord.lichaam.lijnen[0]).toMatchObject({
      id: lijn.id,
      toestand: "aandacht",
      dikte: 1,
      stiltemeter: 1,
    });
    expect(antwoord.lichaam.vragen[0]).toMatchObject({
      resterendeDagen: 0,
      isOverschreden: true,
    });
  });

  it("schrijft via gevalideerde routes en legt gedeeld vast na twee verschillende sessiebeheerders", async () => {
    const nieuw = await verzoek("a", "POST", "/api/traject/trajecten", {
      naam: "Nieuw via route",
      zekerheidstrap: 2,
    });
    expect(nieuw.status).toBe(201);
    expect(nieuw.lichaam.organisatieId).toBe(1);
    const trajectId = nieuw.lichaam.id as number;

    const eerstePartij = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${trajectId}/partijen`,
      {
        soort: "investeerder",
        naam: "Korenberg Participaties",
        ankerpunt: "Mila Vercammen",
        kring: 0,
        rol: "ankerpunt_investeerder",
      },
    );
    const tweedePartij = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${trajectId}/partijen`,
      {
        soort: "onderneming",
        naam: "Veldeman Machines",
        ankerpunt: "Raf De Winter",
        kring: 0,
        rol: "ankerpunt_onderneming",
      },
    );
    expect(eerstePartij.status).toBe(201);
    expect(tweedePartij.status).toBe(201);
    const lijn = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${trajectId}/lijnen`,
      {
        partijEenId: eerstePartij.lichaam.id,
        partijTweeId: tweedePartij.lichaam.id,
        stiltedrempelDagen: 7,
      },
    );
    expect(lijn.status).toBe(201);
    const gebeurtenis = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${trajectId}/gebeurtenissen`,
      {
        lijnId: lijn.lichaam.id,
        tijdstip: NU - DAG,
        soort: "gesprek",
        vaststelling: "De eerste afstemming is bevestigd.",
        indruk: "De partijen zijn zorgvuldig gestart.",
      },
    );
    expect(gebeurtenis.status).toBe(201);
    const volledig = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${trajectId}`,
    );
    const vraag = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${trajectId}/vragen`,
      {
        lijnId: lijn.lichaam.id,
        vragerPartijId: eerstePartij.lichaam.id,
        ontvangerPartijId: tweedePartij.lichaam.id,
        werkstroomId: volledig.lichaam.werkstromen[0].id,
        vraagtekst: "Kan de planning gedeeld worden?",
        kader: "Nodig voor de gezamenlijke planning.",
        antwoordtermijnOp: NU + 3 * DAG,
        antwoordKring: 1,
      },
    );
    expect(vraag.status).toBe(201);

    for (const toestand of ["erkend", "in_behandeling", "beantwoord"]) {
      expect(
        (
          await verzoek(
            "a",
            "PATCH",
            `/api/traject/vragen/${vraag.lichaam.id}/toestand`,
            {
              toestand,
            },
          )
        ).status,
      ).toBe(200);
    }
    const eersteVrijgave = await verzoek(
      "a",
      "PATCH",
      `/api/traject/vragen/${vraag.lichaam.id}/toestand`,
      { toestand: "gedeeld", zijdeVrijgave: "vrager" },
    );
    expect(eersteVrijgave.lichaam.toestand).toBe("beantwoord");
    expect(eersteVrijgave.lichaam.vrijgaveVragerDoorBeheerderId).toBe(10);
    const tweedeVrijgave = await verzoek(
      "a2",
      "PATCH",
      `/api/traject/vragen/${vraag.lichaam.id}/toestand`,
      { toestand: "gedeeld", zijdeVrijgave: "ontvanger" },
    );
    expect(tweedeVrijgave.lichaam).toMatchObject({
      toestand: "gedeeld",
      vrijgaveVragerDoorBeheerderId: 10,
      vrijgaveOntvangerDoorBeheerderId: 11,
    });
  });
});

function zetVraagInToestand(
  basis: ReturnType<typeof maakTrajectMetLijn>,
  toestand: VraagToestand,
  antwoordtermijnOp: number,
  vraagtekst: string,
) {
  const werkstroom = opslag.haalTrajectOp(basis.traject.id, 10).werkstromen[0]!;
  const vraag = opslag.maakVraagkaart({
    trajectId: basis.traject.id,
    beheerderId: 10,
    lijnId: basis.lijn.id,
    vragerPartijId: basis.partijEen.id,
    ontvangerPartijId: basis.partijTwee.id,
    werkstroomId: werkstroom.id,
    vraagtekst,
    kader: "Nodig voor de aandachtsmeting.",
    antwoordtermijnOp,
    antwoordKring: 1,
    aangemaaktOp: NU - 10 * DAG,
  });

  const doelplaats = VRAAGTOESTANDEN.indexOf(toestand);
  for (const stap of ["erkend", "in_behandeling", "beantwoord"] as const) {
    if (VRAAGTOESTANDEN.indexOf(stap) > doelplaats) break;
    opslag.veranderVraagtoestand({
      vraagId: vraag.id,
      beheerderId: 10,
      toestand: stap,
    });
  }
  if (toestand === "gedeeld") {
    opslag.vraagkaartVrijgeven({
      vraagId: vraag.id,
      beheerderId: 10,
      zijde: "vrager",
      vrijgegevenOp: NU,
    });
    opslag.vraagkaartVrijgeven({
      vraagId: vraag.id,
      beheerderId: 11,
      zijde: "ontvanger",
      vrijgegevenOp: NU,
    });
  }
  return vraag;
}

describe("aandacht per vraagkaart in het antwoord van het hoofdscherm", () => {
  it("vraagt alleen aandacht wanneer de vraag openstaat en de termijn voorbij is", async () => {
    const basis = maakTrajectMetLijn(10, 1, "Aandacht");
    const nummers = new Map<VraagToestand, number>();
    for (const toestand of VRAAGTOESTANDEN) {
      nummers.set(
        toestand,
        zetVraagInToestand(
          basis,
          toestand,
          NU - 3 * DAG,
          `Verstreken termijn in toestand ${toestand}`,
        ).id,
      );
    }
    const ruimeTermijn = zetVraagInToestand(
      basis,
      "gesteld",
      NU + 4 * DAG,
      "Termijn ligt nog ruim voor ons",
    );

    const antwoord = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${basis.traject.id}`,
    );
    expect(antwoord.status).toBe(200);
    const perNummer = new Map<number, any>(
      antwoord.lichaam.vragen.map((vraag: any) => [vraag.id, vraag]),
    );

    for (const toestand of VRAAGTOESTANDEN) {
      const vraag = perNummer.get(nummers.get(toestand)!);
      const openstaand = isOpenstaandeVraag({
        toestand,
        antwoordtermijnOp: NU - 3 * DAG,
      });
      expect(vraag, `toestand ${toestand}`).toMatchObject({
        isOverschreden: true,
        isOpenstaand: openstaand,
        vraagtAandacht: openstaand,
      });
    }

    expect(perNummer.get(nummers.get("beantwoord")!)).toMatchObject({
      isOpenstaand: false,
      vraagtAandacht: false,
    });
    expect(perNummer.get(nummers.get("gedeeld")!)).toMatchObject({
      isOpenstaand: false,
      vraagtAandacht: false,
    });
    expect(perNummer.get(nummers.get("gesteld")!)).toMatchObject({
      isOpenstaand: true,
      vraagtAandacht: true,
    });
    expect(perNummer.get(nummers.get("erkend")!)).toMatchObject({
      isOpenstaand: true,
      vraagtAandacht: true,
    });
    expect(perNummer.get(nummers.get("in_behandeling")!)).toMatchObject({
      isOpenstaand: true,
      vraagtAandacht: true,
    });
    expect(perNummer.get(ruimeTermijn.id)).toMatchObject({
      isOverschreden: false,
      isOpenstaand: true,
      vraagtAandacht: false,
    });
  });

  it("beslist op precies een plaats of een vraag openstaat", () => {
    expect([...TOESTANDEN_OPENSTAAND]).toEqual([
      "gesteld",
      "erkend",
      "in_behandeling",
    ]);
    for (const toestand of VRAAGTOESTANDEN) {
      expect(
        isOpenstaandeVraag({ toestand, antwoordtermijnOp: NU }),
        `toestand ${toestand}`,
      ).toBe((TOESTANDEN_OPENSTAAND as readonly string[]).includes(toestand));
    }

    const routesBron = readFileSync("server/traject/routes.ts", "utf8");
    expect(routesBron).toContain("isOpenstaandeVraag");
    for (const toestand of TOESTANDEN_OPENSTAAND) {
      expect(routesBron, `toestand ${toestand} in routes.ts`).not.toContain(
        `"${toestand}"`,
      );
    }

    const afleidingBron = readFileSync("server/traject/afleiding.ts", "utf8");
    expect(
      afleidingBron.match(/TOESTANDEN_OPENSTAAND\s*=/g) ?? [],
    ).toHaveLength(1);
    expect(
      afleidingBron.match(/function isOpenstaandeVraag/g) ?? [],
    ).toHaveLength(1);
  });
});
