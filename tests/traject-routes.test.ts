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

/**
 * De zeven beheerders van organisatie A die in de rollentests elk aan een eigen
 * persoon van het traject hangen. Zo loopt elke rol door het echte webadres en
 * niet enkel door de module.
 */
const ROLBEHEERDERS = {
  facilitator: 12,
  ankerpuntInvesteerder: 13,
  ankerpuntOnderneming: 14,
  werkstroomleider: 15,
  adviseur: 16,
  overlegorgaan: 17,
  betrokkene: 18,
} as const;

vi.mock("../server/storage", () => ({
  storage: {
    getBeheerder: async (id: number) => beheerdersVoorScope.get(id),
  },
}));

const { registerTrajectRoutes } = await import("../server/traject/routes");

const migratie = [
  "migrations/0002_clammy_talisman.sql",
  "migrations/0003_smiling_shape.sql",
  "migrations/0004_supreme_freak.sql",
  "migrations/0005_soorten_gebeurtenis.sql",
]
  .map((pad) => readFileSync(pad, "utf8"))
  .join("\n")
  .replaceAll("--> statement-breakpoint", "");
const NU = Date.parse("2026-08-08T10:00:00.000Z");
const DAG = 24 * 60 * 60 * 1000;

type TrajectRoute = { methode: "GET" | "POST" | "PATCH"; pad: string };

let databank: Database.Database;
let opslag: ReturnType<typeof maakTrajectOpslag>;
/** Alles wat er tijdens een test in het auditspoor geschreven wordt. */
let auditregels: Array<{
  adminId: number | null;
  actie: string;
  afnameId: number | null;
  detail?: string | null;
}> = [];

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
    CREATE TABLE deelnemers (
      id INTEGER PRIMARY KEY,
      naam TEXT NOT NULL
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
  for (const beheerderId of Object.values(ROLBEHEERDERS)) {
    proefdatabank
      .prepare(
        "INSERT INTO beheerders (id, organisatie_id, is_prior) VALUES (?, ?, ?)",
      )
      .run(beheerderId, 1, 0);
  }
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
  for (const [rol, beheerderId] of Object.entries(ROLBEHEERDERS)) {
    beheerdersVoorScope.set(beheerderId, {
      id: beheerderId,
      naam: `Beheerder ${rol}`,
      actief: true,
      isPrior: false,
      organisatie: "Organisatie A",
      organisatieId: 1,
    });
  }
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
    .replace(":vraagId", "1")
    .replace(":persoonId", "1")
    .replace(":rolId", "1");
}

/** Dezelfde app, maar aangemeld met een willekeurig beheerdersnummer. */
function maakAppVoorBeheerder(beheerderId: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { adminId: beheerderId };
    next();
  });
  registerTrajectRoutes(app, opslag);
  return app;
}

async function verzoekAlsBeheerder(
  beheerderId: number,
  methode: "GET" | "POST" | "PATCH",
  pad: string,
  lichaam?: unknown,
): Promise<{ status: number; lichaam: any; kop: Headers }> {
  return metServer(maakAppVoorBeheerder(beheerderId), async (basis) => {
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
      kop: antwoord.headers,
    };
  });
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
  auditregels = [];
  opslag = maakTrajectOpslag(databank, (invoer) => {
    auditregels.push(invoer);
  });
});

function auditregelsMetActie(actie: string) {
  return auditregels.filter((regel) => regel.actie === actie);
}

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
    expect(routes).toHaveLength(14);
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

  it("levert indruk nooit uit, ook niet na een uitdrukkelijk verzoek van een bevoegde beheerder", async () => {
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
    expect(metIndruk.lichaam[0]).not.toHaveProperty("indruk");

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
    expect(volledigMetIndruk.lichaam.gebeurtenissen[0]).not.toHaveProperty(
      "indruk",
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
    // Een gebeurtenis vastleggen kan sinds het vastlegscherm niet meer zonder
    // te zeggen wie ze opschreef: zonder auteur zou de indruk volgens
    // rechtenregel 3 aan niemand meer toekomen, ook niet aan de schrijver.
    const auteur = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${trajectId}/personen`,
      {
        naam: "Mila Vercammen",
        email: "mila@korenberg.be",
        partijId: eerstePartij.lichaam.id,
      },
    );
    expect(auteur.status).toBe(201);
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
        vastgelegdDoorPersoonId: auteur.lichaam.id,
      },
    );
    expect(gebeurtenis.status).toBe(201);
    expect(gebeurtenis.lichaam.vastgelegdDoorPersoonId).toBe(auteur.lichaam.id);
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

// ---------------------------------------------------------------------------
// Het proefdossier voor de rechten, de rollen en de zichtbaarheidsbril.
//
// Drie partijen: de investeerder en de onderneming in kring 0, de adviseur in
// kring 1. Twee lijnen: een tussen investeerder en onderneming, een tussen
// onderneming en adviseur. Zeven personen, elk met een eigen aanmelding, zodat
// elke rol door het echte webadres heen gemeten kan worden.
// ---------------------------------------------------------------------------

function maakRechtendossier() {
  const basis = maakTrajectMetLijn(10, 1, "Rechtendossier");
  const trajectId = basis.traject.id;
  const werkstromen = opslag.haalTrajectOp(trajectId, 10).werkstromen;
  const partijAdviseur = opslag.voegPartijToe({
    trajectId,
    beheerderId: 10,
    soort: "adviseur",
    naam: "Helder en Partners",
    ankerpunt: "Lina Mertens",
    kring: 1,
    rol: "financieel_adviseur",
  });
  const tweedeLijn = opslag.voegLijnToe({
    trajectId,
    beheerderId: 10,
    partijEenId: basis.partijTwee.id,
    partijTweeId: partijAdviseur.id,
    stiltedrempelDagen: 10,
    aangemaaktOp: NU - 40 * DAG,
  });

  const voegPersoon = (
    naam: string,
    email: string,
    partijId: number | null,
    persoonBeheerderId: number,
  ) =>
    opslag.voegPersoonToe({
      trajectId,
      beheerderId: 10,
      naam,
      email,
      partijId,
      persoonBeheerderId,
      aangemaaktOp: NU - 30 * DAG,
    });

  const facilitator = voegPersoon(
    "Ruth Vandewalle",
    "ruth@buitenstaander.be",
    null,
    ROLBEHEERDERS.facilitator,
  );
  const ankerpuntInvesteerder = voegPersoon(
    "Sofie Van Loon",
    "sofie@noordzee.be",
    basis.partijEen.id,
    ROLBEHEERDERS.ankerpuntInvesteerder,
  );
  const ankerpuntOnderneming = voegPersoon(
    "Tom Aerts",
    "tom@asterra.be",
    basis.partijTwee.id,
    ROLBEHEERDERS.ankerpuntOnderneming,
  );
  const werkstroomleider = voegPersoon(
    "Bram Coppens",
    "bram@asterra.be",
    null,
    ROLBEHEERDERS.werkstroomleider,
  );
  const adviseur = voegPersoon(
    "Lina Mertens",
    "lina@helder.be",
    partijAdviseur.id,
    ROLBEHEERDERS.adviseur,
  );
  const overlegorgaan = voegPersoon(
    "Amira El Haddad",
    "amira@asterra.be",
    null,
    ROLBEHEERDERS.overlegorgaan,
  );
  const betrokkene = voegPersoon(
    "Jens Peeters",
    "jens@asterra.be",
    basis.partijTwee.id,
    ROLBEHEERDERS.betrokkene,
  );

  const kenToe = (persoonId: number, rol: string, werkstroomId?: number) =>
    opslag.kenRolToe({
      trajectId,
      beheerderId: 10,
      persoonId,
      rol: rol as any,
      werkstroomId: werkstroomId ?? null,
      toegekendOp: NU - 29 * DAG,
    });
  kenToe(facilitator.id, "facilitator");
  kenToe(ankerpuntInvesteerder.id, "ankerpunt_investeerder");
  kenToe(ankerpuntOnderneming.id, "ankerpunt_onderneming");
  kenToe(werkstroomleider.id, "werkstroomleider", werkstromen[0]!.id);
  kenToe(adviseur.id, "adviseur");
  kenToe(overlegorgaan.id, "overlegorgaan");
  kenToe(betrokkene.id, "betrokkene");

  const eersteGebeurtenis = opslag.voegGebeurtenisToe({
    trajectId,
    beheerderId: 10,
    lijnId: basis.lijn.id,
    tijdstip: NU - 5 * DAG,
    soort: "gesprek",
    vaststelling: "De documentlijst is bevestigd.",
    indruk: "Indruk van de investeerder.",
    vastgelegdDoorPersoonId: ankerpuntInvesteerder.id,
  });
  const tweedeGebeurtenis = opslag.voegGebeurtenisToe({
    trajectId,
    beheerderId: 10,
    lijnId: basis.lijn.id,
    tijdstip: NU - 4 * DAG,
    soort: "bericht",
    vaststelling: "De termijn is besproken.",
    indruk: "Indruk van de onderneming.",
    vastgelegdDoorPersoonId: ankerpuntOnderneming.id,
  });
  const derdeGebeurtenis = opslag.voegGebeurtenisToe({
    trajectId,
    beheerderId: 10,
    lijnId: tweedeLijn.id,
    tijdstip: NU - 3 * DAG,
    soort: "bericht",
    vaststelling: "De cijferbundel is toegelicht.",
    indruk: "Indruk van de adviseur.",
    vastgelegdDoorPersoonId: adviseur.id,
  });

  const eersteVraag = opslag.maakVraagkaart({
    trajectId,
    beheerderId: 10,
    lijnId: basis.lijn.id,
    vragerPartijId: basis.partijEen.id,
    ontvangerPartijId: basis.partijTwee.id,
    werkstroomId: werkstromen[0]!.id,
    vraagtekst: "Kan de eigendomsstructuur bevestigd worden?",
    kader: "Nodig voor de financiele beoordeling.",
    antwoordtermijnOp: NU + 3 * DAG,
    antwoordKring: 1,
    aangemaaktOp: NU - 8 * DAG,
  });
  const tweedeVraag = opslag.maakVraagkaart({
    trajectId,
    beheerderId: 10,
    lijnId: tweedeLijn.id,
    vragerPartijId: basis.partijTwee.id,
    ontvangerPartijId: partijAdviseur.id,
    werkstroomId: werkstromen[5]!.id,
    vraagtekst: "Wie verzorgt de terugkoppeling aan het kernteam?",
    kader: "Nodig voor de menselijke werkstroom.",
    antwoordtermijnOp: NU + 6 * DAG,
    antwoordKring: 0,
    aangemaaktOp: NU - 7 * DAG,
  });

  return {
    ...basis,
    trajectId,
    werkstromen,
    partijAdviseur,
    tweedeLijn,
    personen: {
      facilitator,
      ankerpuntInvesteerder,
      ankerpuntOnderneming,
      werkstroomleider,
      adviseur,
      overlegorgaan,
      betrokkene,
    },
    gebeurtenissen: {
      eerste: eersteGebeurtenis,
      tweede: tweedeGebeurtenis,
      derde: derdeGebeurtenis,
    },
    vragen: { eerste: eersteVraag, tweede: tweedeVraag },
  };
}

describe("de webadressen voor personen en rollen van een traject", () => {
  it("geeft de lijst met kring en geldende rollen, weigert een andere organisatie en een ongeldig nummer", async () => {
    const dossier = maakRechtendossier();

    const lijst = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}/personen`,
    );
    expect(lijst.status).toBe(200);
    expect(lijst.lichaam).toHaveLength(7);
    const perNaam = new Map<string, any>(
      lijst.lichaam.map((persoon: any) => [persoon.naam, persoon]),
    );
    expect(perNaam.get("Sofie Van Loon")).toMatchObject({
      kring: 0,
      partijNaam: "Rechtendossier Invest",
      actief: true,
      aanduiding: null,
    });
    expect(
      perNaam.get("Sofie Van Loon").rollen.map((rol: any) => rol.rol),
    ).toEqual(["ankerpunt_investeerder"]);
    expect(perNaam.get("Lina Mertens").kring).toBe(1);
    expect(perNaam.get("Ruth Vandewalle").kring).toBeNull();
    expect(perNaam.get("Bram Coppens").rollen[0]).toMatchObject({
      rol: "werkstroomleider",
      werkstroomNaam: "financieel",
    });

    expect(auditregelsMetActie("traject_personen_ingekeken")).toHaveLength(1);
    expect(auditregelsMetActie("traject_personen_ingekeken")[0]).toMatchObject({
      adminId: 10,
      afnameId: dossier.trajectId,
    });

    expect(
      (
        await verzoek(
          "b",
          "GET",
          `/api/traject/trajecten/${dossier.trajectId}/personen`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await verzoek("a", "GET", "/api/traject/trajecten/nul/personen")).status,
    ).toBe(400);
  });

  it("voegt een persoon toe, weigert een andere organisatie en weigert ongeldige invoer", async () => {
    const dossier = maakRechtendossier();

    const gelukt = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${dossier.trajectId}/personen`,
      {
        naam: "Wim Claes",
        email: "Wim@Asterra.BE",
        partijId: dossier.partijTwee.id,
      },
    );
    expect(gelukt.status).toBe(201);
    expect(gelukt.lichaam).toMatchObject({
      naam: "Wim Claes",
      email: "wim@asterra.be",
      partijId: dossier.partijTwee.id,
      actief: 1,
    });
    // Zeven personen komen uit het dossier zelf, de achtste is deze toevoeging.
    expect(auditregelsMetActie("traject_persoon_toegevoegd")).toHaveLength(8);

    expect(
      (
        await verzoek(
          "b",
          "POST",
          `/api/traject/trajecten/${dossier.trajectId}/personen`,
          { naam: "Onbevoegd", email: "onbevoegd@b.be" },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await verzoek(
          "a",
          "POST",
          `/api/traject/trajecten/${dossier.trajectId}/personen`,
          { naam: "Geen adres" },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await verzoek(
          "a",
          "POST",
          `/api/traject/trajecten/${dossier.trajectId}/personen`,
          { naam: "Zonder apenstaartje", email: "geenadres" },
        )
      ).status,
    ).toBe(400);
  });

  it("zet een persoon op inactief, weigert een andere organisatie en weigert een ongeldig nummer", async () => {
    const dossier = maakRechtendossier();

    const gelukt = await verzoek(
      "a",
      "PATCH",
      `/api/traject/personen/${dossier.personen.betrokkene.id}/inactief`,
      {},
    );
    expect(gelukt.status).toBe(200);
    expect(gelukt.lichaam.actief).toBe(0);
    expect(auditregelsMetActie("traject_persoon_inactief_gezet")).toHaveLength(
      1,
    );
    expect(
      auditregelsMetActie("traject_persoon_inactief_gezet")[0],
    ).toMatchObject({ adminId: 10, afnameId: dossier.trajectId });

    expect(
      (
        await verzoek(
          "b",
          "PATCH",
          `/api/traject/personen/${dossier.personen.adviseur.id}/inactief`,
          {},
        )
      ).status,
    ).toBe(404);
    expect(
      (await verzoek("a", "PATCH", "/api/traject/personen/nul/inactief", {}))
        .status,
    ).toBe(400);
    expect(
      (
        await verzoek(
          "a",
          "PATCH",
          `/api/traject/personen/${dossier.personen.adviseur.id}/inactief`,
          { actief: true },
        )
      ).status,
    ).toBe(400);
  });

  it("kent een rol toe, geeft de waarschuwing over belang mee en weigert wat niet mag", async () => {
    const dossier = maakRechtendossier();

    const gelukt = await verzoek(
      "a",
      "POST",
      `/api/traject/personen/${dossier.personen.overlegorgaan.id}/rollen`,
      { rol: "werkstroomleider", werkstroomId: dossier.werkstromen[1]!.id },
    );
    expect(gelukt.status).toBe(201);
    expect(gelukt.lichaam.rol).toMatchObject({
      rol: "werkstroomleider",
      werkstroomId: dossier.werkstromen[1]!.id,
      ingetrokkenOp: null,
    });
    expect(gelukt.lichaam.waarschuwing).toBeNull();
    // Zeven toekenningen komen uit het dossier zelf, de achtste is deze rol.
    expect(auditregelsMetActie("traject_rol_toegekend")).toHaveLength(8);

    // De waarschuwing over belang is geen fout: de handeling slaagt.
    const nieuweFacilitator = await verzoek(
      "a",
      "POST",
      `/api/traject/trajecten/${dossier.trajectId}/personen`,
      { naam: "Karel Dhondt", email: "karel@asterra.be", partijId: dossier.partijTwee.id },
    );
    const metWaarschuwing = await verzoek(
      "a",
      "POST",
      `/api/traject/personen/${nieuweFacilitator.lichaam.id}/rollen`,
      { rol: "facilitator" },
    );
    expect(metWaarschuwing.status).toBe(400);

    // Eerst de zittende facilitator intrekken, dan slaagt het met waarschuwing.
    const rollen = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}/personen`,
    );
    const zittend = rollen.lichaam.find(
      (persoon: any) => persoon.naam === "Ruth Vandewalle",
    );
    expect(
      (
        await verzoek(
          "a",
          "PATCH",
          `/api/traject/rollen/${zittend.rollen[0].id}/intrekken`,
          {},
        )
      ).status,
    ).toBe(200);
    const tweedePoging = await verzoek(
      "a",
      "POST",
      `/api/traject/personen/${nieuweFacilitator.lichaam.id}/rollen`,
      { rol: "facilitator" },
    );
    expect(tweedePoging.status).toBe(201);
    expect(tweedePoging.lichaam.waarschuwing).toMatch(/belang/i);
    expect(
      auditregelsMetActie("traject_rol_belangwaarschuwing"),
    ).toHaveLength(1);

    expect(
      (
        await verzoek(
          "b",
          "POST",
          `/api/traject/personen/${dossier.personen.adviseur.id}/rollen`,
          { rol: "adviseur" },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await verzoek(
          "a",
          "POST",
          `/api/traject/personen/${dossier.personen.adviseur.id}/rollen`,
          { rol: "drijvende_kracht" },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await verzoek(
          "a",
          "POST",
          `/api/traject/personen/${dossier.personen.adviseur.id}/rollen`,
          { rol: "werkstroomleider" },
        )
      ).status,
    ).toBe(400);
  });

  it("trekt een rol in, weigert een andere organisatie en weigert een ongeldig nummer", async () => {
    const dossier = maakRechtendossier();
    const lijst = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}/personen`,
    );
    const rolId = lijst.lichaam.find(
      (persoon: any) => persoon.naam === "Lina Mertens",
    ).rollen[0].id;

    const gelukt = await verzoek(
      "a",
      "PATCH",
      `/api/traject/rollen/${rolId}/intrekken`,
      {},
    );
    expect(gelukt.status).toBe(200);
    expect(gelukt.lichaam.ingetrokkenOp).toBeGreaterThan(0);
    expect(gelukt.lichaam.ingetrokkenDoorBeheerderId).toBe(10);
    expect(auditregelsMetActie("traject_rol_ingetrokken")).toHaveLength(1);

    expect(
      (await verzoek("a", "PATCH", `/api/traject/rollen/${rolId}/intrekken`, {}))
        .status,
    ).toBe(400);
    expect(
      (await verzoek("a", "PATCH", "/api/traject/rollen/nul/intrekken", {}))
        .status,
    ).toBe(400);

    const tweedeDossier = maakTrajectMetLijn(20, 2, "Traject van B");
    const persoonVanB = opslag.voegPersoonToe({
      trajectId: tweedeDossier.traject.id,
      beheerderId: 20,
      naam: "Iemand van B",
      email: "iemand@b.be",
    });
    const rolVanB = opslag.kenRolToe({
      trajectId: tweedeDossier.traject.id,
      beheerderId: 20,
      persoonId: persoonVanB.id,
      rol: "adviseur",
    });
    expect(
      (
        await verzoek(
          "a",
          "PATCH",
          `/api/traject/rollen/${rolVanB.rol.id}/intrekken`,
          {},
        )
      ).status,
    ).toBe(404);
  });
});

describe("wat elke rol via het echte webadres van een traject ziet", () => {
  const verwacht = [
    {
      rol: "facilitator",
      beheerder: ROLBEHEERDERS.facilitator,
      lijnen: ["eerste", "tweede"],
      vragen: ["eerste", "tweede"],
      gebeurtenissen: ["eerste", "tweede", "derde"],
      indrukken: [] as string[],
    },
    {
      rol: "ankerpunt_investeerder",
      beheerder: ROLBEHEERDERS.ankerpuntInvesteerder,
      lijnen: ["eerste"],
      vragen: ["eerste"],
      gebeurtenissen: ["eerste", "tweede"],
      indrukken: ["Indruk van de investeerder."],
    },
    {
      rol: "ankerpunt_onderneming",
      beheerder: ROLBEHEERDERS.ankerpuntOnderneming,
      lijnen: ["eerste", "tweede"],
      vragen: ["eerste", "tweede"],
      gebeurtenissen: ["eerste", "tweede", "derde"],
      indrukken: ["Indruk van de onderneming."],
    },
    {
      rol: "werkstroomleider",
      beheerder: ROLBEHEERDERS.werkstroomleider,
      lijnen: ["eerste"],
      vragen: ["eerste"],
      gebeurtenissen: ["eerste", "tweede"],
      indrukken: [],
    },
    {
      rol: "adviseur",
      beheerder: ROLBEHEERDERS.adviseur,
      lijnen: ["tweede"],
      vragen: [],
      gebeurtenissen: ["derde"],
      indrukken: ["Indruk van de adviseur."],
    },
    {
      rol: "overlegorgaan",
      beheerder: ROLBEHEERDERS.overlegorgaan,
      lijnen: [],
      vragen: [],
      gebeurtenissen: [],
      indrukken: [],
    },
    {
      rol: "betrokkene",
      beheerder: ROLBEHEERDERS.betrokkene,
      lijnen: [],
      vragen: [],
      gebeurtenissen: [],
      indrukken: [],
    },
  ] as const;

  for (const geval of verwacht) {
    it(`toont aan de rol ${geval.rol} precies wat het protocol toelaat`, async () => {
      const dossier = maakRechtendossier();
      const antwoord = await verzoekAlsBeheerder(
        geval.beheerder,
        "GET",
        `/api/traject/trajecten/${dossier.trajectId}`,
      );
      expect(antwoord.status).toBe(200);
      // Het geraamte blijft altijd staan: negen fasen, drie partijen, zes
      // werkstromen.
      expect(antwoord.lichaam.fasen).toHaveLength(9);
      expect(antwoord.lichaam.partijen).toHaveLength(3);
      expect(antwoord.lichaam.werkstromen).toHaveLength(6);

      const verwachteLijnen = geval.lijnen.map((naam) =>
        naam === "eerste" ? dossier.lijn.id : dossier.tweedeLijn.id,
      );
      expect(
        antwoord.lichaam.lijnen.map((lijn: any) => lijn.id).sort(),
      ).toEqual([...verwachteLijnen].sort());
      const verwachteVragen = geval.vragen.map(
        (naam) => (dossier.vragen as any)[naam].id,
      );
      expect(
        antwoord.lichaam.vragen.map((vraag: any) => vraag.id).sort(),
      ).toEqual([...verwachteVragen].sort());
      const verwachteGebeurtenissen = geval.gebeurtenissen.map(
        (naam) => (dossier.gebeurtenissen as any)[naam].id,
      );
      expect(
        antwoord.lichaam.gebeurtenissen.map((g: any) => g.id).sort(),
      ).toEqual([...verwachteGebeurtenissen].sort());
      expect(
        antwoord.lichaam.gebeurtenissen
          .filter((g: any) => "indruk" in g)
          .map((g: any) => g.indruk)
          .sort(),
      ).toEqual([...geval.indrukken].sort());

      // Ook met de oude vraagparameter erbij verandert er niets meer.
      const metParameter = await verzoekAlsBeheerder(
        geval.beheerder,
        "GET",
        `/api/traject/trajecten/${dossier.trajectId}?metIndruk=true`,
      );
      expect(
        metParameter.lichaam.gebeurtenissen
          .filter((g: any) => "indruk" in g)
          .map((g: any) => g.indruk)
          .sort(),
      ).toEqual([...geval.indrukken].sort());
    });
  }

  it("opent met metIndruk=true niets meer, op geen enkel adres", async () => {
    const dossier = maakRechtendossier();
    for (const schrijfwijze of [
      "?metIndruk=true",
      "?metIndruk=TRUE",
      "?metIndruk=1",
      "?metindruk=true",
    ]) {
      const volledig = await verzoekAlsBeheerder(
        ROLBEHEERDERS.werkstroomleider,
        "GET",
        `/api/traject/trajecten/${dossier.trajectId}${schrijfwijze}`,
      );
      expect(volledig.status, schrijfwijze).toBe(200);
      expect(
        volledig.lichaam.gebeurtenissen.filter((g: any) => "indruk" in g),
        schrijfwijze,
      ).toHaveLength(0);

      const perLijn = await verzoekAlsBeheerder(
        ROLBEHEERDERS.werkstroomleider,
        "GET",
        `/api/traject/trajecten/${dossier.trajectId}/lijnen/${dossier.lijn.id}/gebeurtenissen${schrijfwijze}`,
      );
      expect(perLijn.status, schrijfwijze).toBe(200);
      expect(perLijn.lichaam, schrijfwijze).toHaveLength(2);
      expect(
        perLijn.lichaam.filter((g: any) => "indruk" in g),
        schrijfwijze,
      ).toHaveLength(0);
    }
  });

  it("geeft een beheerder zonder persoon het geraamte zonder een enkele indruk", async () => {
    const dossier = maakRechtendossier();
    const antwoord = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}`,
    );
    expect(antwoord.status).toBe(200);
    expect(antwoord.lichaam.lijnen).toHaveLength(2);
    expect(antwoord.lichaam.vragen).toHaveLength(2);
    expect(antwoord.lichaam.gebeurtenissen).toHaveLength(3);
    expect(
      antwoord.lichaam.gebeurtenissen.filter((g: any) => "indruk" in g),
    ).toHaveLength(0);
    expect(auditregelsMetActie("traject_indruk_vrijgegeven")).toHaveLength(0);
  });

  it("laat prior alles zien en legt elke vrijgegeven indruk vast in het auditspoor", async () => {
    const dossier = maakRechtendossier();
    const antwoord = await verzoek(
      "prior",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}`,
    );
    expect(antwoord.status).toBe(200);
    expect(
      antwoord.lichaam.gebeurtenissen.map((g: any) => g.indruk).sort(),
    ).toEqual([
      "Indruk van de adviseur.",
      "Indruk van de investeerder.",
      "Indruk van de onderneming.",
    ]);
    const spoor = auditregelsMetActie("traject_indruk_vrijgegeven");
    expect(spoor).toHaveLength(1);
    expect(spoor[0]).toMatchObject({ adminId: 1, afnameId: dossier.trajectId });
    expect(spoor[0]!.detail).toContain("3");
    for (const gebeurtenis of Object.values(dossier.gebeurtenissen)) {
      expect(spoor[0]!.detail).toContain(String(gebeurtenis.id));
    }
  });

  it("laat de lijst van trajecten door dezelfde bril lopen en houdt de organisatiegrens", async () => {
    const dossier = maakRechtendossier();
    maakTrajectMetLijn(20, 2, "Traject van B");
    const lijst = await verzoekAlsBeheerder(
      ROLBEHEERDERS.betrokkene,
      "GET",
      "/api/traject/trajecten",
    );
    expect(lijst.status).toBe(200);
    expect(lijst.lichaam.map((traject: any) => traject.id)).toEqual([
      dossier.trajectId,
    ]);
  });
});

describe("de zichtbaarheidsbril op de server", () => {
  it("toont door de ogen van een ander minder dan zonder bril", async () => {
    const dossier = maakRechtendossier();
    const zonderBril = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}`,
    );
    expect(zonderBril.lichaam.lijnen).toHaveLength(2);
    expect(zonderBril.lichaam.vragen).toHaveLength(2);
    expect(zonderBril.lichaam.bril).toBeNull();

    const metBril = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}?alsPersoon=${dossier.personen.adviseur.id}`,
    );
    expect(metBril.status).toBe(200);
    expect(metBril.lichaam.lijnen.map((lijn: any) => lijn.id)).toEqual([
      dossier.tweedeLijn.id,
    ]);
    expect(metBril.lichaam.vragen).toHaveLength(0);
    expect(metBril.lichaam.gebeurtenissen.map((g: any) => g.id)).toEqual([
      dossier.gebeurtenissen.derde.id,
    ]);
    expect(metBril.lichaam.bril).toMatchObject({
      actief: true,
      persoonId: dossier.personen.adviseur.id,
      persoonNaam: "Lina Mertens",
    });
  });

  it("toont door de bril nooit meer dan de beheerder zelf mag zien", async () => {
    const dossier = maakRechtendossier();

    // De adviseur kijkt door de ogen van het ankerpunt van de onderneming, dat
    // ruimer mag zien. De doorsnede blijft het eigen, kleinere zicht.
    const doorRuimereOgen = await verzoekAlsBeheerder(
      ROLBEHEERDERS.adviseur,
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}?alsPersoon=${dossier.personen.ankerpuntOnderneming.id}`,
    );
    expect(doorRuimereOgen.status).toBe(200);
    expect(doorRuimereOgen.lichaam.lijnen.map((lijn: any) => lijn.id)).toEqual([
      dossier.tweedeLijn.id,
    ]);
    expect(doorRuimereOgen.lichaam.vragen).toHaveLength(0);
    expect(doorRuimereOgen.lichaam.gebeurtenissen.map((g: any) => g.id)).toEqual(
      [dossier.gebeurtenissen.derde.id],
    );
    // De indruk van de adviseur staat in geen van beide zichten samen: het
    // ankerpunt van de onderneming mag ze niet zien, dus door de bril ook niet.
    expect(
      doorRuimereOgen.lichaam.gebeurtenissen.filter((g: any) => "indruk" in g),
    ).toHaveLength(0);

    // Een beheerder van een andere organisatie komt met de bril nergens.
    const andereOrganisatie = await verzoek(
      "b",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}?alsPersoon=${dossier.personen.ankerpuntOnderneming.id}`,
    );
    expect(andereOrganisatie.status).toBe(404);
    expect(auditregelsMetActie("traject_bril_gebruikt")).toHaveLength(1);
  });

  it("weigert de bril bij een persoon van een ander traject", async () => {
    const dossier = maakRechtendossier();
    const ander = maakTrajectMetLijn(10, 1, "Ander traject");
    const persoonElders = opslag.voegPersoonToe({
      trajectId: ander.traject.id,
      beheerderId: 10,
      naam: "Iemand elders",
      email: "elders@a.be",
    });

    const antwoord = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}?alsPersoon=${persoonElders.id}`,
    );
    expect(antwoord.status).toBe(404);
    expect(auditregelsMetActie("traject_bril_gebruikt")).toHaveLength(0);

    expect(
      (
        await verzoek(
          "a",
          "GET",
          `/api/traject/trajecten/${dossier.trajectId}?alsPersoon=nul`,
        )
      ).status,
    ).toBe(400);
  });

  it("laat van elk gebruik van de bril een spoor achter met beide namen", async () => {
    const dossier = maakRechtendossier();
    await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}?alsPersoon=${dossier.personen.adviseur.id}`,
    );
    const spoor = auditregelsMetActie("traject_bril_gebruikt");
    expect(spoor).toHaveLength(1);
    expect(spoor[0]).toMatchObject({ adminId: 10, afnameId: dossier.trajectId });
    expect(spoor[0]!.detail).toContain("Lina Mertens");
    expect(spoor[0]!.detail).toContain(
      String(dossier.personen.adviseur.id),
    );
  });

  it("werkt ook op de gebeurtenissen van een lijn en meldt dat de bril aanstond", async () => {
    const dossier = maakRechtendossier();
    const zonderBril = await verzoek(
      "a",
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}/lijnen/${dossier.tweedeLijn.id}/gebeurtenissen`,
    );
    expect(zonderBril.status).toBe(200);
    expect(zonderBril.lichaam).toHaveLength(1);

    const metBril = await verzoekAlsBeheerder(
      10,
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}/lijnen/${dossier.lijn.id}/gebeurtenissen?alsPersoon=${dossier.personen.adviseur.id}`,
    );
    expect(metBril.status).toBe(404);

    const eigenLijn = await verzoekAlsBeheerder(
      10,
      "GET",
      `/api/traject/trajecten/${dossier.trajectId}/lijnen/${dossier.tweedeLijn.id}/gebeurtenissen?alsPersoon=${dossier.personen.adviseur.id}`,
    );
    expect(eigenLijn.status).toBe(200);
    expect(eigenLijn.lichaam).toHaveLength(1);
    expect(eigenLijn.kop.get("x-regiekamer-bril")).toBe(
      String(dossier.personen.adviseur.id),
    );
  });

  it("weigert de bril op de lijst van trajecten, want die gaat over meer dan een traject", async () => {
    maakRechtendossier();
    const antwoord = await verzoek(
      "a",
      "GET",
      "/api/traject/trajecten?alsPersoon=1",
    );
    expect(antwoord.status).toBe(400);
  });
});
