// ---------------------------------------------------------------------------
// server/kwaliteit-evaluaties/mailer.ts
//
// Bouwt de uitnodigingslink en het bericht voor de organisatiecontact
// (§7.2 schermkop/introtekst en §17.2 notificatietekst van de
// bouwspecificatie, woordelijk overgenomen) en verstuurt het via de
// bestaande, generieke `verstuurBericht` uit server/bulk-import/mailer.ts —
// dezelfde weg naar buiten (Brevo via HTTPS wanneer geconfigureerd, anders
// SMTP, gesimuleerd zonder van de twee) als de rest van het platform. Er
// wordt hier geen nieuwe mailweg gebouwd.
// ---------------------------------------------------------------------------
import { verstuurBericht, type MailResultaat } from "../bulk-import/mailer";

export function bouwEvaluatieLink(origin: string, token: string): string {
  const schoon = (origin ?? "").trim().replace(/\/+$/, "");
  return schoon ? `${schoon}/#/evaluatie-organisatie/${token}` : "";
}

export interface OrganisatieUitnodigingInvoer {
  naar: string;
  naamContact: string;
  opleidingTitel: string;
  origin: string;
  token: string;
}

/** §17.2 — Onderwerp: "Uw feedback over [opleidingstitel]". */
export async function verstuurOrganisatieUitnodiging(
  invoer: OrganisatieUitnodigingInvoer,
): Promise<MailResultaat> {
  const link = bouwEvaluatieLink(invoer.origin, invoer.token);
  const voornaam = (invoer.naamContact ?? "").trim().split(/\s+/)[0] || invoer.naamContact || "";

  const tekst = [
    `Beste ${voornaam || "contactpersoon"},`,
    "",
    `Dank voor de samenwerking rond "${invoer.opleidingTitel}".`,
    "",
    "Uw korte feedback helpt ons om de TaPasCity-kwaliteitsstandaard zichtbaar te maken en verder te versterken.",
    "",
    "Invullen duurt ongeveer drie minuten.",
    "",
    link || "(link volgt via de beheerder)",
    "",
    "Met vriendelijke groet,",
    "TaPasCity",
  ].join("\n");

  return verstuurBericht({
    naar: invoer.naar,
    naam: invoer.naamContact,
    onderwerp: `Uw feedback over ${invoer.opleidingTitel}`,
    tekst,
  });
}
