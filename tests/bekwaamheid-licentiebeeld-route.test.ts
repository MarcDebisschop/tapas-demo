// ---------------------------------------------------------------------------
// tests/bekwaamheid-licentiebeeld-route.test.ts
//
// De leesweg van het licentiebeeld, getoetst waar hij fout kan gaan.
//
// Drie dingen staan hier onder toezicht.
//
// 1. De wacht. `GET /api/bekwaamheid/licentiebeeld` hangt achter `vereisAdmin`.
//    Zonder sessie hoort er een 401 te komen en géén lichaam met statussen.
//    Dat is geen theoretisch geval: het antwoord bevat per beheerder hoe zijn
//    licenties ervoor staan, en dat is niet iets om open te zetten.
//
// 2. De peildatum. Een onleesbare datum wordt niet stil vervangen door vandaag.
//    Als dat wel gebeurde, zou het scherm een ander beeld tonen dan waar het om
//    vroeg, zonder dat iemand het merkt. Daarom 400, dezelfde regel als in de
//    regiekamerroute.
//
// 3. De bundeling per platformdeel. `bundelPerPlatformdeel` legt de brug tussen
//    instrumenten (waar licenties op staan) en platformdelen (waar de
//    schakelaars op `/admin/toegang` op staan). Een instrument zonder
//    platformdeel hoort weg te vallen; een beheerderloze registerrij hoort niet
//    in het antwoord te komen. Beide worden hier vastgelegd via de geëxporteerde
//    `leesLicentiebeeld`, met een opslag die alleen de twee gelezen wegen kent.
//
// De 200-weg door het webadres heen staat hier niet: de route leest de globale
// `bekwaamheidOpslag`, en die hangt aan de echte databank. Wat de route met een
// geldige peildatum doet, is `leesLicentiebeeld` aanroepen, en dat is precies
// wat hier los getoetst wordt.
// ---------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  leesLicentiebeeld,
  registerLicentiebeeldRoutes,
} from "/home/user/workspace/core/server/bekwaamheid/routes-licentiebeeld";
import type { BekwaamheidOpslag } from "/home/user/workspace/core/server/bekwaamheid/storage";
import {
  KOLOM_SLEUTELS,
  KOLOM_WOORDEN,
} from "/home/user/workspace/core/client/src/components/bekwaamheid/licentiekolom-teksten";
import { TALEN } from "/home/user/workspace/core/shared/talen";

function maakApp(adminId: number | null) {
  const app = express();
  app.use((req, _res, next) => {
    if (adminId !== null) (req as any).session = { adminId };
    next();
  });
  registerLicentiebeeldRoutes(app);
  return app;
}

async function verzoek(
  adminId: number | null,
  pad: string,
): Promise<{ status: number; lichaam: any }> {
  const server = createServer(maakApp(adminId));
  await new Promise<void>((klaar) => server.listen(0, klaar));
  const poort = (server.address() as AddressInfo).port;
  try {
    const antwoord = await fetch(`http://127.0.0.1:${poort}${pad}`);
    return { status: antwoord.status, lichaam: await antwoord.json().catch(() => null) };
  } finally {
    await new Promise<void>((klaar) => server.close(() => klaar()));
  }
}

/**
 * Een opslag met alleen de twee wegen die `leesLicentiebeeld` gebruikt.
 *
 * Bewust geen echte databank: wat hier getoetst wordt, is de bundeling en het
 * overslaan van rijen, niet of SQLite tekst teruggeeft. Zou hier een databank
 * staan, dan zou een falende test niet vertellen wélke laag stuk is.
 */
function proefopslag(
  personen: Array<{ id: number; beheerderId: number | null }>,
  licentiesPerPersoon: Record<number, Array<Record<string, unknown>>>,
): BekwaamheidOpslag {
  return {
    register: {
      lijst: (_alleenActief: boolean) => personen as any,
    },
    licenties: {
      vanPersoon: (persoonId: number) => (licentiesPerPersoon[persoonId] ?? []) as any,
    },
  } as unknown as BekwaamheidOpslag;
}

function licentie(over: Record<string, unknown> = {}) {
  return {
    instrumentId: "t4p-business-kompas",
    status: "bekrachtigd",
    geldigVan: "2026-01-01",
    geldigTot: "2027-12-31",
    alertActief: false,
    voorwaardeVoor: null,
    ...over,
  };
}

describe("de wacht voor de route", () => {
  it("weigert zonder sessie met 401 en geeft geen statussen mee", async () => {
    const { status, lichaam } = await verzoek(null, "/api/bekwaamheid/licentiebeeld");
    expect(status).toBe(401);
    expect(lichaam?.perBeheerder).toBeUndefined();
  });

  it("weigert ook wanneer er een peildatum bij staat", async () => {
    const { status } = await verzoek(
      null,
      "/api/bekwaamheid/licentiebeeld?peildatum=2026-08-14",
    );
    expect(status).toBe(401);
  });
});

describe("de peildatum", () => {
  it("weigert een onleesbare datum met 400 in plaats van er vandaag van te maken", async () => {
    const { status, lichaam } = await verzoek(
      7,
      "/api/bekwaamheid/licentiebeeld?peildatum=14-08-2026",
    );
    expect(status).toBe(400);
    expect(lichaam?.error).toContain("JJJJ-MM-DD");
  });

  it("weigert een bestaande vorm met een onmogelijke dag", async () => {
    const { status } = await verzoek(7, "/api/bekwaamheid/licentiebeeld?peildatum=2026-13-40");
    expect(status).toBe(400);
  });

  it("weigert twee peildatums in één verzoek", async () => {
    // Express geeft dan een array terug; die is niet één dag en dus geen datum.
    const { status } = await verzoek(
      7,
      "/api/bekwaamheid/licentiebeeld?peildatum=2026-01-01&peildatum=2026-02-01",
    );
    expect(status).toBe(400);
  });
});

describe("het beeld per beheerder", () => {
  it("laat een registerrij zonder beheerder weg", () => {
    const uit = leesLicentiebeeld(
      "2026-08-14",
      proefopslag(
        [
          { id: 1, beheerderId: 11 },
          { id: 2, beheerderId: null },
        ],
        { 1: [licentie()], 2: [licentie()] },
      ),
    );
    expect(Object.keys(uit.perBeheerder)).toEqual(["11"]);
  });

  it("geeft de peildatum terug zoals gevraagd", () => {
    const uit = leesLicentiebeeld("2026-03-01", proefopslag([], {}));
    expect(uit.peildatum).toBe("2026-03-01");
    expect(uit.perBeheerder).toEqual({});
  });

  it("zet een licentie onder het platformdeel waar de poort ook op weigert", () => {
    const uit = leesLicentiebeeld(
      "2026-08-14",
      proefopslag([{ id: 1, beheerderId: 11 }], { 1: [licentie()] }),
    );
    const beeld = uit.perBeheerder["11"];
    expect(Object.keys(beeld.perPlatformdeel)).toEqual(["kompas"]);
    expect(beeld.perPlatformdeel.kompas).toEqual([
      { instrumentId: "t4p-business-kompas", status: "bekrachtigd", afnamerecht: true, reden: null },
    ]);
  });

  it("laat een instrument zonder platformdeel uit de bundeling weg, maar niet uit het beeld", () => {
    const uit = leesLicentiebeeld(
      "2026-08-14",
      proefopslag([{ id: 1, beheerderId: 11 }], {
        1: [licentie({ instrumentId: "t4teens" })],
      }),
    );
    const beeld = uit.perBeheerder["11"];
    expect(beeld.perPlatformdeel).toEqual({});
    expect(beeld.perInstrument.map((r) => r.instrumentId)).toEqual(["t4teens"]);
  });

  it("draagt een weigergrond mee naar de bundeling", () => {
    const uit = leesLicentiebeeld(
      "2026-08-14",
      proefopslag([{ id: 1, beheerderId: 11 }], {
        1: [licentie({ status: "opgeschort" })],
      }),
    );
    const regel = uit.perBeheerder["11"].perPlatformdeel.kompas[0];
    expect(regel.afnamerecht).toBe(false);
    // De reden is een leesbare zin en geen sleutel: hij komt op het scherm te
    // staan in de zwevende uitleg van de cel, en daar hoort geen jargon.
    expect(regel.reden).toBe("status opgeschort");
    expect(regel.status).toBe("opgeschort");
  });

  it("houdt twee instrumenten onder één deel als lijst bij elkaar", () => {
    const uit = leesLicentiebeeld(
      "2026-08-14",
      proefopslag([{ id: 1, beheerderId: 11 }], {
        1: [licentie(), licentie({ instrumentId: "hdd" })],
      }),
    );
    const delen = uit.perBeheerder["11"].perPlatformdeel;
    expect(Object.keys(delen).sort()).toEqual(["hdd", "kompas"]);
    expect(delen.hdd).toHaveLength(1);
  });
});

describe("de woorden van de kolom", () => {
  it("heeft elke sleutel in alle vijf de talen", () => {
    const ontbreekt: string[] = [];
    for (const taal of TALEN) {
      for (const sleutel of KOLOM_SLEUTELS) {
        const woord = KOLOM_WOORDEN[taal]?.[sleutel];
        if (typeof woord !== "string" || woord.trim() === "") {
          ontbreekt.push(`${taal}.${String(sleutel)}`);
        }
      }
    }
    expect(ontbreekt).toEqual([]);
  });

  it("heeft in geen enkele taal een sleutel die het Nederlands niet kent", () => {
    const bekend = new Set(KOLOM_SLEUTELS.map(String));
    const teveel: string[] = [];
    for (const taal of TALEN) {
      for (const sleutel of Object.keys(KOLOM_WOORDEN[taal] ?? {})) {
        if (!bekend.has(sleutel)) teveel.push(`${taal}.${sleutel}`);
      }
    }
    expect(teveel).toEqual([]);
  });

  it("noemt elke licentiestand met woorden en niet met een sleutel", () => {
    // De kleur mag nooit het enige verschil zijn; daarvoor moet er per stand een
    // zin staan die iets zegt. Een sleutel die als tekst doorlekt, valt hier op.
    for (const stand of [
      "buiten_het_register",
      "geen_licenties",
      "in_orde",
      "let_op",
      "geen_afnamerecht",
    ] as const) {
      for (const taal of TALEN) {
        const woord = KOLOM_WOORDEN[taal][stand];
        expect(woord).not.toBe(stand);
        expect(woord.length).toBeGreaterThan(3);
      }
    }
  });
});
