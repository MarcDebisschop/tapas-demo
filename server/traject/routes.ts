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
import { filterTrajectVoorOproeper, magLijnZien } from "./rechten";
import type { OproeperVanTraject } from "./rechten";
import { ROLLEN_VAN_TRAJECT, SOORTEN_VAN_GEBEURTENIS } from "./schema";
import { trajectOpslag } from "./storage";
import type { PersoonInTraject, VolledigTraject } from "./storage";
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

/**
 * Het vastleggen van een gebeurtenis.
 *
 * Twee velden zijn hier bewust anders dan in de andere schema's van dit
 * bestand.
 *
 * `tijdstip` is optioneel. Het scherm geeft er geen mee en dan zet de server
 * het moment van vastleggen. De bestaande aanroepen die wel een tijdstip
 * meesturen blijven werken, want de opslaglaag valt met `tijdstipOfNu` al terug
 * op de klok wanneer het veld ontbreekt.
 *
 * `vastgelegdDoorPersoonId` is verplicht, en de reden staat in rechtenregel 3:
 * een gebeurtenis zonder bekende auteur geeft haar indruk aan niemand meer,
 * ook niet aan wie ze opschreef. Zo een gebeurtenis toelaten is stil
 * gegevensverlies. Weigeren is dan het minste kwaad.
 *
 * De boodschap bij een ontbrekende auteur staat er met de hand bij. De gewone
 * weg, `stuurValidatiefout`, stuurt de tabel van zod door, en dat is geen zin
 * die iemand op een scherm wil lezen.
 */
const gebeurtenisSchema = z
  .object({
    lijnId: positiefGetal,
    tijdstip: tijdstip.optional(),
    soort: z.enum(SOORTEN_VAN_GEBEURTENIS),
    vaststelling: tekst,
    indruk: z.string().trim().optional(),
    vastgelegdDoorPersoonId: positiefGetal,
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

const persoonSchema = z
  .object({
    naam: tekst,
    email: tekst,
    partijId: positiefGetal.nullable().optional(),
    persoonBeheerderId: positiefGetal.nullable().optional(),
    persoonDeelnemerId: positiefGetal.nullable().optional(),
  })
  .strict();

const rolSchema = z
  .object({
    rol: z.enum(ROLLEN_VAN_TRAJECT),
    werkstroomId: positiefGetal.nullable().optional(),
  })
  .strict();

/** Een verzoek zonder inhoud. Onbekende velden worden geweigerd. */
const leegSchema = z.object({}).strict();

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

/**
 * Leest de vraag om door de ogen van iemand anders te kijken. Leeg wanneer er
 * niet om gevraagd wordt, en een fout bij een onbruikbaar nummer.
 */
function leesBrilVraag(req: Request): number | null {
  const gevraagd = req.query.alsPersoon;
  if (gevraagd === undefined) return null;
  if (typeof gevraagd !== "string") throw new Error("Persoon is ongeldig.");
  return leesPositiefRoutegetal(gevraagd, "Persoon");
}

/**
 * Bouwt de oproeper voor de rechtenmodule. Dit is de enige plaats in de
 * serverlaag waar een oproeper ontstaat, zodat de vraag wie iemand is maar een
 * antwoord kent.
 *
 * De kring, de partij, de rollen en de geleide werkstromen komen alle uit de
 * persoon die in dit traject aan de aangemelde beheerder hangt. Is er geen zo
 * een persoon, dan blijven die velden leeg en beslist regel 8 van de module.
 */
function maakOproeper(
  scope: ReturnType<typeof scopeVanVerzoek>,
  personen: PersoonInTraject[],
  beheerderId: number,
): OproeperVanTraject {
  const eigenPersoon =
    personen.find((persoon) => persoon.beheerderId === beheerderId) ?? null;
  return maakOproeperVanPersoon(
    scope.soort === "prior" ? "prior" : "organisatie",
    eigenPersoon,
  );
}

function maakOproeperVanPersoon(
  scope: "prior" | "organisatie",
  persoon: PersoonInTraject | null,
): OproeperVanTraject {
  if (persoon === null) {
    return {
      scope,
      persoonId: null,
      partijId: null,
      kring: null,
      rollen: [],
      werkstroomIds: [],
    };
  }
  return {
    scope,
    persoonId: persoon.id,
    partijId: persoon.partijId,
    kring: persoon.kring,
    rollen: persoon.rollen.map((rol) => rol.rol),
    werkstroomIds: persoon.rollen
      .filter((rol) => rol.rol === "werkstroomleider" && rol.werkstroomId !== null)
      .map((rol) => rol.werkstroomId as number),
  };
}

/** Haalt het veld indruk werkelijk uit een gebeurtenis weg. */
function zonderIndrukveld<T extends object>(gebeurtenis: T): Omit<T, "indruk"> {
  const { indruk: _indruk, ...rest } = gebeurtenis as T & { indruk?: string };
  return rest as Omit<T, "indruk">;
}

type GefilterdDossier = ReturnType<typeof filterDossier>;

/**
 * De doorsnede van twee zichten. Wie door de ogen van iemand anders kijkt, ziet
 * wat die ander ziet en wat hij zelf al mocht zien, en nooit meer dan dat. Zo
 * kan de bril nooit een weg worden om iets los te wrikken.
 */
function doorsnedeVanZichten(
  eigen: GefilterdDossier,
  door: GefilterdDossier,
): GefilterdDossier {
  const lijnIds = new Set(door.lijnen.map((lijn) => lijn.id));
  const vraagIds = new Set(door.vragen.map((vraag) => vraag.id));
  const gebeurtenisIds = new Set(
    door.gebeurtenissen.map((gebeurtenis) => gebeurtenis.id),
  );
  const indrukInBeide = new Set(
    door.indrukVrijgegevenVoor.filter((id) =>
      eigen.indrukVrijgegevenVoor.includes(id),
    ),
  );

  return {
    ...eigen,
    lijnen: eigen.lijnen.filter((lijn) => lijnIds.has(lijn.id)),
    vragen: eigen.vragen.filter((vraag) => vraagIds.has(vraag.id)),
    gebeurtenissen: eigen.gebeurtenissen
      .filter((gebeurtenis) => gebeurtenisIds.has(gebeurtenis.id))
      .map((gebeurtenis) =>
        indrukInBeide.has(gebeurtenis.id)
          ? gebeurtenis
          : zonderIndrukveld(gebeurtenis),
      ),
    indrukVrijgegevenVoor: door.indrukVrijgegevenVoor.filter((id) =>
      indrukInBeide.has(id),
    ),
  };
}

function filterDossier(
  oproeper: OproeperVanTraject,
  verrijkt: ReturnType<typeof verrijkTraject>,
  personen: PersoonInTraject[],
) {
  return filterTrajectVoorOproeper(oproeper, {
    ...verrijkt,
    personen: personen.map((persoon) => ({
      id: persoon.id,
      partijId: persoon.partijId,
    })),
  });
}

function verrijkTraject(volledig: VolledigTraject) {
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
    gebeurtenissen,
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

/**
 * Stelt het dossier samen zoals deze oproeper het mag zien, met de bril erop
 * wanneer daarom gevraagd wordt. Elke vrijgegeven indruk en elk gebruik van de
 * bril komt hier in het auditspoor terecht.
 */
async function bouwZichtbaarDossier(
  req: Request,
  opslag: TrajectOpslag,
  trajectId: number,
  beheerderId: number,
  scope: ReturnType<typeof scopeVanVerzoek>,
): Promise<{
  dossier: GefilterdDossier;
  bril: { actief: true; persoonId: number; persoonNaam: string } | null;
}> {
  const organisatieScope = organisatieScopeVanVerzoek(scope);
  const brilPersoonId = leesBrilVraag(req);
  const volledig = opslag.haalTrajectOp(trajectId, beheerderId, organisatieScope);
  const personen = opslag.haalPersonenVanTraject(
    trajectId,
    beheerderId,
    organisatieScope,
  );
  const verrijkt = verrijkTraject(volledig);
  const eigenZicht = filterDossier(
    maakOproeper(scope, personen, beheerderId),
    verrijkt,
    personen,
  );

  let dossier = eigenZicht;
  let bril: { actief: true; persoonId: number; persoonNaam: string } | null = null;

  if (brilPersoonId !== null) {
    const doelpersoon =
      personen.find((persoon) => persoon.id === brilPersoonId) ?? null;
    if (doelpersoon === null) {
      // Weigeren bij twijfel: een persoon van een ander dossier bestaat hier
      // niet.
      throw new Error("Persoon niet gevonden.");
    }
    // Door de ogen van een mens kijken geeft nooit de ruimte van prior: een mens
    // in het dossier is geen prior.
    const doorDeBril = filterDossier(
      maakOproeperVanPersoon("organisatie", doelpersoon),
      verrijkt,
      personen,
    );
    dossier = doorsnedeVanZichten(eigenZicht, doorDeBril);
    bril = { actief: true, persoonId: doelpersoon.id, persoonNaam: doelpersoon.naam };
    opslag.schrijfAuditregel(
      beheerderId,
      "traject_bril_gebruikt",
      trajectId,
      `Beheerder ${beheerderId} keek naar dit dossier door de ogen van ` +
        `${doelpersoon.naam} (persoon ${doelpersoon.id}).`,
    );
  }

  if (dossier.indrukVrijgegevenVoor.length > 0) {
    opslag.schrijfAuditregel(
      beheerderId,
      "traject_indruk_vrijgegeven",
      trajectId,
      `De indruk van ${dossier.indrukVrijgegevenVoor.length} gebeurtenissen is ` +
        `vrijgegeven aan beheerder ${beheerderId}: ` +
        `${dossier.indrukVrijgegevenVoor.join(", ")}.`,
    );
  }

  return { dossier, bril };
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
      if (req.query.alsPersoon !== undefined) {
        res.status(400).json({
          error: "De bril werkt op een enkel traject, niet op de lijst.",
        });
        return;
      }
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
      const { dossier, bril } = await bouwZichtbaarDossier(
        req,
        opslag,
        trajectId,
        beheerderId,
        scope,
      );
      const { indrukVrijgegevenVoor: _spoor, ...zichtbaar } = dossier;
      res.json({ ...zichtbaar, bril });
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
        const { dossier, bril } = await bouwZichtbaarDossier(
          req,
          opslag,
          trajectId,
          beheerderId,
          scope,
        );
        // Een lijn die deze oproeper niet mag zien bestaat voor hem niet.
        if (!dossier.lijnen.some((lijn) => lijn.id === lijnId)) {
          res.status(404).json({ error: "Niet gevonden." });
          return;
        }
        if (bril !== null) {
          res.setHeader("X-Regiekamer-Bril", String(bril.persoonId));
        }
        res.json(
          dossier.gebeurtenissen.filter(
            (gebeurtenis) => gebeurtenis.lijnId === lijnId,
          ),
        );
      } catch (fout) {
        stuurFout(res, fout);
      }
    },
  );

  app.get("/api/traject/trajecten/:trajectId/personen", async (req, res) => {
    try {
      const trajectId = leesPositiefRoutegetal(req.params.trajectId, "Traject");
      const { beheerderId, scope } = await leesBeheerder(req);
      const personen = opslag.haalPersonenVanTraject(
        trajectId,
        beheerderId,
        organisatieScopeVanVerzoek(scope),
      );
      // Wie de namenlijst van een dossier inkijkt, laat daarvan een spoor na.
      opslag.schrijfAuditregel(
        beheerderId,
        "traject_personen_ingekeken",
        trajectId,
        `Beheerder ${beheerderId} bekeek de ${personen.length} personen van dit dossier.`,
      );
      res.json(personen);
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.post("/api/traject/trajecten/:trajectId/personen", async (req, res) => {
    const invoer = persoonSchema.safeParse(req.body);
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const trajectId = leesPositiefRoutegetal(req.params.trajectId, "Traject");
      const { beheerderId, scope } = await leesBeheerder(req);
      res.status(201).json(
        opslag.voegPersoonToe({
          trajectId,
          beheerderId,
          naam: invoer.data.naam,
          email: invoer.data.email,
          partijId: invoer.data.partijId ?? null,
          persoonBeheerderId: invoer.data.persoonBeheerderId ?? null,
          persoonDeelnemerId: invoer.data.persoonDeelnemerId ?? null,
          organisatieScope: organisatieScopeVanVerzoek(scope),
        }),
      );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.patch("/api/traject/personen/:persoonId/inactief", async (req, res) => {
    const invoer = leegSchema.safeParse(req.body ?? {});
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const persoonId = leesPositiefRoutegetal(req.params.persoonId, "Persoon");
      const { beheerderId, scope } = await leesBeheerder(req);
      res.json(
        opslag.zetPersoonInactief({
          persoonId,
          beheerderId,
          organisatieScope: organisatieScopeVanVerzoek(scope),
        }),
      );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.post("/api/traject/personen/:persoonId/rollen", async (req, res) => {
    const invoer = rolSchema.safeParse(req.body);
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const persoonId = leesPositiefRoutegetal(req.params.persoonId, "Persoon");
      const { beheerderId, scope } = await leesBeheerder(req);
      const organisatieScope = organisatieScopeVanVerzoek(scope);
      const persoon = opslag.haalPersoonOp(persoonId, beheerderId, organisatieScope);
      // De waarschuwing over belang is geen weigering: de toekenning slaagt en de
      // opmerking gaat mee in het antwoord.
      res.status(201).json(
        opslag.kenRolToe({
          trajectId: persoon.trajectId,
          beheerderId,
          persoonId: persoon.id,
          rol: invoer.data.rol,
          werkstroomId: invoer.data.werkstroomId ?? null,
          organisatieScope,
        }),
      );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

  app.patch("/api/traject/rollen/:rolId/intrekken", async (req, res) => {
    const invoer = leegSchema.safeParse(req.body ?? {});
    if (!invoer.success) {
      stuurValidatiefout(res, invoer.error);
      return;
    }
    try {
      const rolId = leesPositiefRoutegetal(req.params.rolId, "Rol");
      const { beheerderId, scope } = await leesBeheerder(req);
      res.json(
        opslag.trekRolIn({
          rolId,
          beheerderId,
          organisatieScope: organisatieScopeVanVerzoek(scope),
        }),
      );
    } catch (fout) {
      stuurFout(res, fout);
    }
  });

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

  /**
   * Legt een gebeurtenis vast op een lijn.
   *
   * Vier weigeringen, in deze volgorde. Eerst de vorm van het verzoek, dan de
   * lijn, dan de auteur, dan het recht om op deze lijn te schrijven. De
   * volgorde is niet toevallig: er wordt niets over het dossier prijsgegeven
   * voordat vaststaat dat de oproeper de lijn mag zien.
   *
   * De vierde weigering hergebruikt `magLijnZien` uit de rechtenmodule. Dat is
   * met opzet dezelfde functie als voor het lezen, en niet een tweede,
   * gelijkende versie ervan: schrijfrecht mag nooit ruimer worden dan leesrecht,
   * en dat blijft alleen waar wanneer er maar een regel bestaat.
   *
   * Wie mag er vandaag schrijven? Precies wie de lijn leest: beide partijen van
   * de lijn, de facilitator, en de leider van een werkstroom met een kaart op
   * die lijn. Dit is een open punt: het mag later smaller, nooit ruimer.
   */
  app.post(
    "/api/traject/trajecten/:trajectId/gebeurtenissen",
    async (req, res) => {
      const invoer = gebeurtenisSchema.safeParse(req.body);
      if (!invoer.success) {
        // Een ontbrekende auteur krijgt een zin en geen tabel, want dit is de
        // fout die een mens aan het scherm het vaakst zal maken.
        const velden = invoer.error.flatten().fieldErrors;
        if (velden.vastgelegdDoorPersoonId) {
          res
            .status(400)
            .json({ error: "Kies wie deze gebeurtenis vastlegt." });
          return;
        }
        if (velden.vaststelling) {
          res.status(400).json({
            error: "Wat er gebeurd is, mag niet leeg blijven.",
          });
          return;
        }
        if (velden.soort) {
          res.status(400).json({ error: "Kies een geldige soort." });
          return;
        }
        stuurValidatiefout(res, invoer.error);
        return;
      }
      try {
        const trajectId = leesPositiefRoutegetal(
          req.params.trajectId,
          "Traject",
        );
        const { beheerderId, scope } = await leesBeheerder(req);
        const organisatieScope = organisatieScopeVanVerzoek(scope);
        const volledig = opslag.haalTrajectOp(
          trajectId,
          beheerderId,
          organisatieScope,
        );
        const personen = opslag.haalPersonenVanTraject(
          trajectId,
          beheerderId,
          organisatieScope,
        );

        // Weigering 2. De lijn moet bij dit traject horen. De opslaglaag
        // controleert dit ook, maar de rechtenvraag hieronder heeft de lijn
        // zelf nodig, dus ze wordt hier al opgezocht.
        const lijn = volledig.lijnen.find(
          (kandidaat) => kandidaat.id === invoer.data.lijnId,
        );
        if (lijn === undefined) {
          res
            .status(404)
            .json({ error: "Deze lijn hoort niet bij dit dossier." });
          return;
        }

        // Weigering 4, het schrijfrecht. Dezelfde regel als voor het lezen.
        const oproeper = maakOproeper(scope, personen, beheerderId);
        if (!magLijnZien(oproeper, lijn, volledig.vragen)) {
          res.status(403).json({
            error: "U kunt op deze lijn geen gebeurtenis vastleggen.",
          });
          return;
        }

        // Weigering 1. De auteur moet een persoon van dit traject zijn en mag
        // niet op inactief staan. Een inactieve mens schrijft niets meer bij,
        // en zijn indruk zou bij de partij blijven hangen van iemand die niet
        // meer meedoet.
        const auteur = personen.find(
          (persoon) => persoon.id === invoer.data.vastgelegdDoorPersoonId,
        );
        if (auteur === undefined) {
          res.status(404).json({
            error: "Deze persoon hoort niet bij dit dossier.",
          });
          return;
        }
        if (!auteur.actief) {
          res.status(400).json({
            error: `${auteur.naam} is niet meer actief in dit dossier en kan niets vastleggen.`,
          });
          return;
        }

        res.status(201).json(
          opslag.voegGebeurtenisToe({
            ...invoer.data,
            trajectId,
            beheerderId,
            organisatieScope,
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
