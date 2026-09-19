// ---------------------------------------------------------------------------
// server/notulen-toc/routes.ts  -  NIEUW BESTAND
//
// registerNotulenTocRoutes(app): de beheerwegen voor de omzetting van beknopte
// notulen naar het vaste verslagmodel van het Team of Captains.
//
//   POST /api/admin/notulen-toc/omzetten   beknopte notulen (.docx) omzetten
//   GET  /api/admin/notulen-toc/invulblad  leeg invulblad beknopte notulen (.docx)
//
// De module bewaart niets. Een verslag van het Team of Captains draagt namen van
// aanwezigen en gaat naar aandeelhouders en investeringspartners; het hoort dus
// niet op de server te blijven staan. Het bestand komt binnen, het verslag gaat
// terug, en daarmee is de zaak af. Dat spaart ook een tabel en een migratie uit.
//
// Het bestand komt als base64 in het lichaam van het verzoek, net als bij de
// bulk-import. Zo blijft de weg gewoon json en hangt er geen extra
// bestandsverwerking in de server.
// ---------------------------------------------------------------------------
import type { Express, Request, Response } from "express";
import { adminIdVanSessie, vereisAdmin } from "../admin-guard";
import { schrijfAuditLog } from "../audit-log";
import { herken } from "./herkennen";
import { InleesFout, leesDocx } from "./inlezen";
import { bestandsnaamVoor, bouwInvulblad, bouwVerslag } from "./verslag";
import { redigeerVerslag } from "./redactie";

const MAX_BYTES = 8 * 1024 * 1024;

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Haalt de ruwe bytes uit een base64-veld, met of zonder data-voorvoegsel. */
function bytesUitBase64(ruw: unknown): Buffer | null {
  if (typeof ruw !== "string" || ruw.trim() === "") return null;
  const zonderKop = ruw.includes(",") && ruw.slice(0, 64).includes("base64") ? ruw.slice(ruw.indexOf(",") + 1) : ruw;
  try {
    const buffer = Buffer.from(zonderKop.replace(/\s/g, ""), "base64");
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

export function registerNotulenTocRoutes(app: Express): void {
  // -------------------------------------------------------------------------
  // Omzetten van beknopte notulen naar het vaste verslagmodel.
  // -------------------------------------------------------------------------
  app.post("/api/admin/notulen-toc/omzetten", vereisAdmin, async (req: Request, res: Response) => {
    const adminId = adminIdVanSessie(req);
    const lichaam = (req.body ?? {}) as Record<string, unknown>;
    const bestandsnaam =
      typeof lichaam.bestandsnaam === "string" && lichaam.bestandsnaam.trim() !== ""
        ? lichaam.bestandsnaam.trim()
        : "beknopte-notulen.docx";

    const bytes = bytesUitBase64(lichaam.bestandBase64);
    if (!bytes) {
      res.status(400).json({ error: "Geen bestand ontvangen. Kies een Word-bestand (.docx) met de beknopte notulen." });
      return;
    }
    if (bytes.length > MAX_BYTES) {
      res.status(413).json({
        error: `Het bestand is te groot (${Math.round(bytes.length / 1024 / 1024)} MB). De grens ligt op 8 MB; beknopte notulen blijven daar ruim onder.`,
      });
      return;
    }

    try {
      const ingelezen = await leesDocx(bytes);
      if (ingelezen.blokken.length === 0) {
        res.status(400).json({ error: "Het Word-bestand bevat geen tekst." });
        return;
      }

      const { inhoud, rapport } = herken(ingelezen, bestandsnaam);
      rapport.bestandsnaam = bestandsnaam;

      // De redactieronde staat tussen het herkennen en het opmaken, en niet
      // erna. Redigeren in de opmaak kost een uur en redigeren in de gegevens
      // kost een seconde; dat is dezelfde regel als in de redactiepoort van het
      // huis. Wie de ronde niet wil, stuurt redactie:false mee; dan blijft de
      // taal van de beknopte notulen letterlijk staan.
      const redactieGevraagd = (lichaam as { redactie?: unknown }).redactie !== false;
      const redactie = redactieGevraagd ? redigeerVerslag(inhoud) : null;

      const verslag = await bouwVerslag(inhoud);
      const naam = bestandsnaamVoor(inhoud);

      schrijfAuditLog({
        adminId,
        actie: "notulen_toc_omgezet",
        afnameId: null,
        detail:
          `bestand=${bestandsnaam}; alineas=${rapport.alineas}; tabellen=${rapport.tabellen}; ` +
          `besluiten=${rapport.aantallen.besluiten}; acties=${rapport.aantallen.acties}; ` +
          `nietGeplaatst=${rapport.aantallen.nietGeplaatst}; ` +
          `redactie=${redactie ? `${redactie.aantalWijzigingen} wijziging(en), ${redactie.aandacht.length} melding(en)` : "niet gevraagd"}`,
      });

      res.json({
        rapport,
        redactie,
        bestandsnaam: naam,
        bestandBase64: verslag.toString("base64"),
      });
    } catch (e) {
      if (e instanceof InleesFout) {
        res.status(400).json({ error: e.message });
        return;
      }
      console.error("[notulen-toc] omzetting mislukt:", e);
      res.status(500).json({ error: "De omzetting is mislukt. Het bestand is mogelijk op een ongewone manier opgemaakt." });
    }
  });

  // -------------------------------------------------------------------------
  // Leeg invulblad voor beknopte notulen.
  // -------------------------------------------------------------------------
  app.get("/api/admin/notulen-toc/invulblad", vereisAdmin, async (_req: Request, res: Response) => {
    try {
      const blad = await bouwInvulblad();
      res.setHeader("Content-Type", DOCX_TYPE);
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="TaPasCity-Beknopte-notulen-invulblad.docx"',
      );
      res.send(blad);
    } catch (e) {
      console.error("[notulen-toc] invulblad mislukt:", e);
      res.status(500).json({ error: "Het invulblad maken lukte niet." });
    }
  });
}
