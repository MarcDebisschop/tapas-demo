import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  bepaalLijntoestand,
  berekenLijndikte,
  berekenStiltemeter,
  berekenVraagtermijn,
  isOpenstaandeVraag,
  VRAAGTOESTANDEN,
} from "./afleiding";
import type { VraagToestand } from "./afleiding";
import { seedDemonstratietraject } from "./demo";
import { trajectOpslag } from "./storage";
import type { VolledigTraject } from "./storage";
import {
  schrijfOrganisatieId,
  scopeVanVerzoek,
  vereisScope,
  verzenderVanVerzoek,
} from "../scope-guard";

type TrajectOpslag = typeof trajectOpslag;

const positiefGetal = z.coerce.number().int().positive();
const tekst = z.string().trim().min(1);
const tijdstip = z.number().finite();

const maakTrajectSchema = z
  .object({
    naam: tekst,
    organisatieId: positiefGetal.optional(),
    zekerheidstrap: z.number().int().min(1).max(4).optional(),
  })
  .strict();

const partijSchema = z
  .object({
    soort: tekst,
    naam: tekst,
    ankerpunt: tekst,
    kring: z.number().int().min(0).max(4),
    rol: tekst,
  })
  .strict();

const lijnSchema = z
  .object({
    partijEenId: positiefGetal,
    partijTweeId: positiefGetal,
    stiltedrempelDagen: z.number().int().min(0),
  })
  .strict();

const gebeurtenisSchema = z
  .object({
    lijnId: positiefGetal,
    tijdstip,
    soort: z.enum(["gesprek", "bericht", "rechtstreeks_contact"]),
    vaststelling: tekst,
    indruk: z.string().trim().optional(),
  })
  .strict();

const vraagkaartSchema = z
  .object({
    lijnId: positiefGetal,
    vragerPartijId: positiefGetal,
    ontvangerPartijId: positiefGetal,
    werkstroomId: positiefGetal,
    vraagtekst: tekst,
    kader: tekst,
    antwoordtermijnOp: tijdstip,
    antwoordKring: z.number().int().min(0).max(4),
  })
  .strict();

const toestandSchema = z
  .object({
    toestand: z.enum(VRAAGTOESTANDEN),
    zijdeVrijgave: z.enum(["vrager", "ontvanger"]).optional(),
  })
  .strict();

function leesPositiefRoutegetal(waarde: string, naam: string): number {
  const uitkomst = positiefGetal.safeParse(waarde);
  if (!uitkomst.success) throw new Error(`${naam} is ongeldig.`);
  return uitkomst.data;
}

function wilIndrukZien(req: Request): boolean {
  return req.query.metIndruk === "true";
}

function zonderIndruk<T extends { indruk: string }>(
  gebeurtenissen: T[],
  metIndruk: boolean,
) {
  if (metIndruk) return gebeurtenissen;
  return gebeurtenissen.map(
    ({ indruk: _indruk, ...vaststelling }) => vaststelling,
  );
}

function verrijkTraject(volledig: VolledigTraject, metIndruk: boolean) {
  const nu = Date.now();
  const gebeurtenissenPerLijn = new Map<
    number,
    typeof volledig.gebeurtenissen
  >();
  const vragenPerLijn = new Map<number, typeof volledig.vragen>();
  const vragenPerWerkstroom = new Map<number, typeof volledig.vragen>();

  for (const gebeurtenis of volledig.gebeurtenissen) {
    const verzameling = gebeurtenissenPerLijn.get(gebeurtenis.lijnId) ?? [];
    verzameling.push(gebeurtenis);
    gebeurtenissenPerLijn.set(gebeurtenis.lijnId, verzameling);
  }
  for (const vraag of volledig.vragen) {
    const verzameling = vragenPerLijn.get(vraag.lijnId) ?? [];
    verzameling.push(vraag);
    vragenPerLijn.set(vraag.lijnId, verzameling);
    if (vraag.werkstroomId !== null) {
      const werkstroomVragen = vragenPerWerkstroom.get(vraag.werkstroomId) ?? [];
      werkstroomVragen.push(vraag);
      vragenPerWerkstroom.set(vraag.werkstroomId, werkstroomVragen);
    }
  }

  const gebeurtenissen = [...volledig.gebeurtenissen].sort(
    (eerste, tweede) =>
      tweede.tijdstip - eerste.tijdstip || tweede.id - eerste.id,
  );

  return {
    traject: volledig.traject,
    fasen: volledig.fasen,
    partijen: volledig.partijen,
    lijnen: volledig.lijnen.map((lijn) => {
      const lijnGebeurtenissen = gebeurtenissenPerLijn.get(lijn.id) ?? [];
      const lijnVragen = vragenPerLijn.get(lijn.id) ?? [];
      const laatsteGebeurtenisOp =
        lijnGebeurtenissen.reduce<number | null>(
          (laatste, gebeurtenis) =>
            laatste === null || gebeurtenis.tijdstip > laatste
              ? gebeurtenis.tijdstip
              : laatste,
          null,
        ) ?? volledig.traject.aangemaaktOp;

      return {
        ...lijn,
        toestand: bepaalLijntoestand({
          nu,
          trajectAangemaaktOp: volledig.traject.aangemaaktOp,
          stiltedrempelDagen: lijn.stiltedrempelDagen,
          gebeurtenissen: lijnGebeurtenissen,
          vragen: lijnVragen as Array<{
            toestand: VraagToestand;
            antwoordtermijnOp: number;
          }>,
        }),
        dikte: berekenLijndikte(lijnGebeurtenissen, nu),
        stiltemeter: berekenStiltemeter(laatsteGebeurtenisOp, nu),
      };
    }),
    werkstromen: volledig.werkstromen.map((werkstroom) => {
      const werkstroomVragen = vragenPerWerkstroom.get(werkstroom.id) ?? [];
      const aantalVragen = werkstroomVragen.length;
      const aantalAfgehandeld = werkstroomVragen.filter(
        (vraag) =>
          vraag.toestand === "beantwoord" || vraag.toestand === "gedeeld",
      ).length;

      return {
        ...werkstroom,
        aantalVragen,
        aantalAfgehandeld,
        voortgang:
          aantalVragen === 0
            ? 0
            : Math.round((aantalAfgehandeld / aantalVragen) * 100),
      };
    }),
    vragen: volledig.vragen.map((vraag) => {
      const termijn = berekenVraagtermijn(vraag.antwoordtermijnOp, nu);
      // Openstaand komt uit isOpenstaandeVraag, de enige bron voor die keuze.
      // Aandacht vragen betekent openstaand en over termijn.
      const isOpenstaand = isOpenstaandeVraag(
        vraag as { toestand: VraagToestand },
      );
      return {
        ...vraag,
        ...termijn,
        isOpenstaand,
        vraagtAandacht: isOpenstaand && termijn.isOverschreden,
      };
    }),
    gebeurtenissen: zonderIndruk(gebeurtenissen, metIndruk),
  };
}

async function leesBeheerder(
  req: Request,
): Promise<{ beheerderId: number; scope: ReturnType<typeof scopeVanVerzoek> }> {
  const scope = scopeVanVerzoek(req);
  const verzender = await verzenderVanVerzoek(req);
  if (verzender.aangemaaktDoorBeheerderId === null) {
    throw new Error("Een aangemelde beheerder is vereist.");
  }
  return { beheerderId: verzender.aangemaaktDoorBeheerderId, scope };
}

function organisatieScopeVanVerzoek(
  scope: ReturnType<typeof scopeVanVerzoek>,
): number | null {
  return scope.soort === "organisatie" ? scope.organisatieId : null;
}

function stuurValidatiefout(res: Response, fout: z.ZodError): void {
  res.status(400).json({ error: fout.flatten() });
}

function stuurFout(res: Response, fout: unknown): void {
  const boodschap =
    fout instanceof Error ? fout.message : "Ongeldige aanvraag.";
  if (
    boodschap.includes("niet gevonden") ||
    boodschap.includes("Niet gevonden") ||
    boodschap.includes("organisatiegrens") ||
    boodschap.includes("hoort niet bij")
  ) {
    res.status(404).json({ error: "Niet gevonden." });
    return;
  }
  if (boodschap === "Een aangemelde beheerder is vereist.") {
    res.status(403).json({ error: boodschap });
    return;
  }
  res.status(400).json({ error: boodschap });
}

export function registerTrajectRoutes(
  app: Express,
  opslag: TrajectOpslag = trajectOpslag,
): void {
  void seedDemonstratietraject();
  app.use("/api/traject", vereisScope);

  app.get("/api/traject/trajecten", async (req, res) => {
    try {
      const { beheerderId, scope } = await leesBeheerder(req);
      res.json(
        opslag.haalTrajectenVoorBeheerder(
          beheerderId,
          organisatieScopeVanVerzoek(scope),
        ),
      );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.get("/api/traject/trajecten/:trajectId", async (req, res) => {
    try {
      const trajectId = leesPositiefRoutegetal(req.params.trajectId, "Traject");
      const { beheerderId, scope } = await leesBeheerder(req);
      const volledig = opslag.haalTrajectOp(
        trajectId,
        beheerderId,
        organisatieScopeVanVerzoek(scope),
      );
      res.json(verrijkTraject(volledig, wilIndrukZien(req)));
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.get(
    "/api/traject/trajecten/:trajectId/lijnen/:lijnId/gebeurtenissen",
    async (req, res) => {
      try {
        const trajectId = leesPositiefRoutegetal(
          req.params.trajectId,
          "Traject",
        );
        const lijnId = leesPositiefRoutegetal(req.params.lijnId, "Lijn");
        const { beheerderId, scope } = await leesBeheerder(req);
        const organisatieScope = organisatieScopeVanVerzoek(scope);
        const volledig = opslag.haalTrajectOp(
          trajectId,
          beheerderId,
          organisatieScope,
        );
        if (!volledig.lijnen.some((lijn) => lijn.id === lijnId)) {
          res.status(404).json({ error: "Niet gevonden." });
          return;
        }
        const gebeurtenissen = opslag.haalGebeurtenissenVanLijn(
          lijnId,
          beheerderId,
          organisatieScope,
        );
        res.json(zonderIndruk(gebeurtenissen, wilIndrukZien(req)));
      } catch (fout) {
        stuurFout(res, fout);
      }
    },
  );

  app.post("/api/traject/trajecten", async (req, res) => {
    const invoer = maakTrajectSchema.safeParse(req.body);
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const { beheerderId, scope } = await leesBeheerder(req);
      const organisatie = schrijfOrganisatieId(
        scope,
        invoer.data.organisatieId,
      );
      if (!organisatie.ok) {
        res.status(403).json({ error: organisatie.fout });
        return;
      }
      if (organisatie.organisatieId === null) {
        res
          .status(400)
          .json({ error: "Een traject heeft een organisatie nodig." });
        return;
      }
      const traject = opslag.maakTraject({
        ...invoer.data,
        organisatieId: organisatie.organisatieId,
        beheerderId,
      });
      res.status(201).json(traject);
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.post("/api/traject/trajecten/:trajectId/partijen", async (req, res) => {
    const invoer = partijSchema.safeParse(req.body);
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const trajectId = leesPositiefRoutegetal(req.params.trajectId, "Traject");
      const { beheerderId, scope } = await leesBeheerder(req);
      res
        .status(201)
        .json(
          opslag.voegPartijToe({
            ...invoer.data,
            trajectId,
            beheerderId,
            organisatieScope: organisatieScopeVanVerzoek(scope),
          }),
        );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.post("/api/traject/trajecten/:trajectId/lijnen", async (req, res) => {
    const invoer = lijnSchema.safeParse(req.body);
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const trajectId = leesPositiefRoutegetal(req.params.trajectId, "Traject");
      const { beheerderId, scope } = await leesBeheerder(req);
      res
        .status(201)
        .json(
          opslag.voegLijnToe({
            ...invoer.data,
            trajectId,
            beheerderId,
            organisatieScope: organisatieScopeVanVerzoek(scope),
          }),
        );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.post(
    "/api/traject/trajecten/:trajectId/gebeurtenissen",
    async (req, res) => {
      const invoer = gebeurtenisSchema.safeParse(req.body);
      if (!invoer.success) {
        stuurValidatiefout(res, invoer.error);
        return;
      }
      try {
        const trajectId = leesPositiefRoutegetal(
          req.params.trajectId,
          "Traject",
        );
        const { beheerderId, scope } = await leesBeheerder(req);
        res.status(201).json(
          opslag.voegGebeurtenisToe({
            ...invoer.data,
            trajectId,
            beheerderId,
            organisatieScope: organisatieScopeVanVerzoek(scope),
          }),
        );
      } catch (fout) {
        stuurFout(res, fout);
      }
    },
  );

  app.post("/api/traject/trajecten/:trajectId/vragen", async (req, res) => {
    const invoer = vraagkaartSchema.safeParse(req.body);
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const trajectId = leesPositiefRoutegetal(req.params.trajectId, "Traject");
      const { beheerderId, scope } = await leesBeheerder(req);
      res
        .status(201)
        .json(
          opslag.maakVraagkaart({
            ...invoer.data,
            trajectId,
            beheerderId,
            organisatieScope: organisatieScopeVanVerzoek(scope),
          }),
        );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.patch("/api/traject/vragen/:vraagId/toestand", async (req, res) => {
    const invoer = toestandSchema.safeParse(req.body);
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const vraagId = leesPositiefRoutegetal(req.params.vraagId, "Vraagkaart");
      const { beheerderId, scope } = await leesBeheerder(req);
      const organisatieScope = organisatieScopeVanVerzoek(scope);
      if (invoer.data.toestand === "gedeeld") {
        if (!invoer.data.zijdeVrijgave) {
          res.status(400).json({ error: "Kies de zijde voor deze vrijgave." });
          return;
        }
        res.json(
          opslag.vraagkaartVrijgeven({
            vraagId,
            beheerderId,
            zijde: invoer.data.zijdeVrijgave,
            organisatieScope,
          }),
        );
        return;
      }
      if (invoer.data.zijdeVrijgave) {
        res
          .status(400)
          .json({ error: "Een zijde is alleen toegestaan bij delen." });
        return;
      }
      res.json(
        opslag.veranderVraagtoestand({
          vraagId,
          beheerderId,
          toestand: invoer.data.toestand,
          organisatieScope,
        }),
      );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });
}
