// ---------------------------------------------------------------------------
// server/uitnodigingsmail.ts - de uitnodiging en de herinnering versturen
//
// WAAROM DIT BESTAAT. Een beheerder die één deelnemer uitnodigde, kreeg alleen een
// link te zien en moest die zelf in een bericht zetten. De bulk-import kon al wel
// mailen, met sjablonen per taal, met simulatiemodus en met een verzendlogboek.
// Die weg bestond dus, maar was nergens aangesloten op de dialoog voor één
// deelnemer. Deze module is die aansluiting, en niets meer: ze beslist niet wie
// mag ontvangen (dat doet shared/uitnodigingsontvanger.ts) en ze verstuurt niet
// zelf (dat doet server/bulk-import/mailer.ts).
//
// WAT ZE WEL DOET. Ze bouwt de deelnemerslink, zoekt de leesbare naam van het
// instrument op, laat het bericht versturen en legt de uitkomst vast op de afname
// zelf. Die laatste stap is de reden dat het beheeroverzicht een eerlijke stand
// kan tonen: "verstuurd", "gesimuleerd" of "fout", en niets als er nooit een
// bericht is vertrokken.
//
// VERSTUREN MAG NOOIT DE UITNODIGING BREKEN. De link blijft de weg naar binnen.
// Loopt het versturen mis, dan is dat een stand en geen uitzondering: de
// uitnodiging bestaat, de beheerder ziet wat er misging en kan de link alsnog
// zelf doorgeven.
// ---------------------------------------------------------------------------

import { storage } from "./storage";
import { getDescriptor } from "./registry";
import {
  verstuurUitnodiging,
  verstuurHerinnering,
  isSimulatiemodus,
  type MailStatus,
} from "./bulk-import/mailer";
import type { Afname } from "@shared/schema";
import type { Ontvangerrol } from "@shared/uitnodigingsontvanger";

/**
 * De persoonlijke deelnemerslink.
 *
 * Dezelfde vorm als in de bulk-import en in het beheerscherm: het publieke adres
 * komt van het scherm mee, want de server kent het niet uit zichzelf. Zonder dat
 * adres blijft er een relatieve link over; die is in een bericht niet bruikbaar,
 * dus dan wordt er niet verstuurd.
 */
export function bouwDeelnemerLink(origin: string, token: string | null | undefined): string {
  const schoon = (origin ?? "").trim().replace(/\/+$/, "");
  const t = token ?? "";
  return schoon ? `${schoon}#/deelnemer/${t}` : "";
}

/** De leesbare naam van het instrument, voor in de tekst van het bericht. */
export function instrumentTitel(instrumentId: string | null | undefined): string {
  if (!instrumentId) return "je TaPas-vragenlijst";
  return getDescriptor(instrumentId)?.name ?? instrumentId;
}

export interface UitnodigingsmailInvoer {
  afname: Afname;
  /** Het adres waarnaar verstuurd mag worden; al beoordeeld door de ontvangerregel. */
  naar: string;
  /** Naar wie het bericht gaat: de deelnemer zelf, of een ouder, voogd of begeleider. */
  rol: Ontvangerrol;
  /** Het publieke adres van het scherm, nodig om een bruikbare link te bouwen. */
  origin: string;
  /** Een eerste uitnodiging of een herinnering aan een uitnodiging die openstaat. */
  soort: "uitnodiging" | "herinnering";
  /** Org-eigen afzender, wanneer de organisatie er een heeft. */
  afzender?: string | null;
}

export interface UitnodigingsmailUitkomst {
  status: MailStatus;
  gesimuleerd: boolean;
  melding: string;
  /** De link die verstuurd is of, bij een fout, alsnog met de hand doorgegeven kan worden. */
  link: string;
}

/**
 * Verstuurt de uitnodiging of de herinnering en legt de stand vast op de afname.
 *
 * Een bericht aan een ouder, voogd of begeleider krijgt dezelfde tekst als een
 * bericht aan de deelnemer. Dat is een bewuste keuze: de link is dezelfde, en een
 * aparte tekst zou de indruk geven dat een verantwoordelijke de vragenlijst zelf
 * invult. Wie het bericht kreeg, staat wel vast op de afname.
 */
export async function verstuurUitnodigingsmail(
  invoer: UitnodigingsmailInvoer,
): Promise<UitnodigingsmailUitkomst> {
  const link = bouwDeelnemerLink(invoer.origin, invoer.afname.inviteToken);
  if (!link) {
    const melding =
      "Er is geen publiek adres meegegeven, dus er kon geen bruikbare link in het bericht staan.";
    await bewaarStand(invoer.afname.id, "fout", invoer.rol);
    return { status: "fout", gesimuleerd: false, melding, link: "" };
  }

  const naam = invoer.afname.name && invoer.afname.name !== "(nog niet ingevuld)" ? invoer.afname.name : "";
  const gegevens = {
    naar: invoer.naar,
    taal: invoer.afname.taal,
    naam,
    link,
    instrument: instrumentTitel(invoer.afname.instrumentId),
    from: invoer.afzender ?? null,
  };

  let uitkomst: { status: MailStatus; gesimuleerd: boolean; melding?: string };
  try {
    uitkomst =
      invoer.soort === "herinnering"
        ? await verstuurHerinnering(gegevens)
        : await verstuurUitnodiging(gegevens);
  } catch (e) {
    // De verzendmodule vangt haar eigen fouten al af; dit is het net eronder,
    // zodat een onverwachte fout de uitnodiging niet meesleurt.
    const melding = e instanceof Error ? e.message : "Onbekende fout bij het versturen.";
    console.warn(`[uitnodigingsmail] versturen mislukt (afname ${invoer.afname.id}):`, e);
    await bewaarStand(invoer.afname.id, "fout", invoer.rol);
    return { status: "fout", gesimuleerd: false, melding, link };
  }

  await bewaarStand(invoer.afname.id, uitkomst.status, invoer.rol);
  return {
    status: uitkomst.status,
    gesimuleerd: uitkomst.gesimuleerd,
    melding: uitkomst.melding ?? standaardmelding(uitkomst.status),
    link,
  };
}

function standaardmelding(status: MailStatus): string {
  if (status === "gesimuleerd") {
    return "Er staat geen verzendweg ingesteld, dus het bericht is niet verstuurd. Geef de link zelf door.";
  }
  if (status === "fout") return "Het bericht is niet verstuurd.";
  return "Het bericht is verstuurd.";
}

/**
 * Bewaart de laatste stand op de afname. Mislukt dat, dan is dat geen reden om de
 * verzending te laten mislukken: het volledige spoor staat in mail_verzendlog.
 */
async function bewaarStand(afnameId: number, stand: MailStatus, rol: Ontvangerrol): Promise<void> {
  try {
    await storage.updateAfname(afnameId, {
      mailStand: stand,
      mailStandAt: new Date().toISOString(),
      mailOntvangerRol: rol,
    });
  } catch (e) {
    console.warn(`[uitnodigingsmail] stand niet bewaard (afname ${afnameId}):`, e);
  }
}

/** Of er op dit moment een verzendweg is ingesteld. Voor het scherm, dat niets mag beloven. */
export function mailwegIngesteld(): boolean {
  return !isSimulatiemodus();
}
