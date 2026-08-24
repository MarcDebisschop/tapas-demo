// =============================================================================
// server/bulk-import/verzendlog.ts
// -----------------------------------------------------------------------------
// Het blijvende verzendlogboek van uitgaande e-mail.
//
// WAAROM DIT BESTAAT. De verzendmodule hiernaast levert per bericht een stand op:
// verstuurd, gesimuleerd of fout. Die stand werd tot nu enkel in het antwoord van
// een route meegegeven en nergens bewaard. Zodra het scherm gesloten was, was het
// spoor weg. Toen een deelnemer meldde dat een uitnodiging niet aankwam, was
// achteraf niet vast te stellen of het bericht ooit vertrokken was, over welk
// kanaal, en met welke melding van de leverancier. Dit bestand legt precies dat
// vast, in de tabel mail_verzendlog uit migratie 0009.
//
// WAT ER NOOIT IN MAG. De persoonlijke link en de berichttekst. Een link is een
// sleutel tot de gegevens van een deelnemer; wie het logboek kan lezen, mag geen
// deur kunnen openen. De verzendmodule houdt links al buiten elke logregel, en
// dat beginsel geldt hier even hard. Het onderwerp blijft wel staan: dat bevat
// geen sleutel en is nodig om berichten van elkaar te onderscheiden.
//
// SCHRIJVEN MAG NOOIT DE VERZENDING BREKEN. Een logboek is een hulpmiddel, geen
// voorwaarde. Elke schrijffout wordt hier opgevangen en gemeld op de console; de
// verzending zelf loopt door. Zo kan een databank die de tabel nog niet heeft,
// bijvoorbeeld tijdens een toets, geen enkele mail tegenhouden.
// =============================================================================

import { sqlite } from "../storage";

export type VerzendSoort =
  | "uitnodiging"
  | "herinnering"
  | "toegangsmail"
  | "aanmeldlink"
  | "bericht";
export type VerzendStatus = "verstuurd" | "gesimuleerd" | "fout";
export type VerzendKanaal = "brevo-api" | "smtp" | "geen";

export const VERZEND_SOORTEN: VerzendSoort[] = [
  "uitnodiging",
  // Een herinnering staat naast de uitnodiging en niet in plaats daarvan: bij een
  // klacht wil je zien of iemand een eerste bericht kreeg of een tweede.
  "herinnering",
  "toegangsmail",
  "aanmeldlink",
  "bericht",
];
export const VERZEND_STATUSSEN: VerzendStatus[] = ["verstuurd", "gesimuleerd", "fout"];

export interface VerzendregelInvoer {
  soort: VerzendSoort;
  ontvanger: string;
  afzender: string;
  onderwerp: string;
  status: VerzendStatus;
  melding?: string | null;
  taal?: string | null;
  instrument?: string | null;
}

export interface Verzendregel {
  id: number;
  tijdstip: string;
  soort: VerzendSoort;
  ontvanger: string;
  afzender: string;
  onderwerp: string;
  status: VerzendStatus;
  kanaal: VerzendKanaal;
  melding: string | null;
  taal: string | null;
  instrument: string | null;
}

/**
 * Over welke weg gaat een bericht op dit moment naar buiten.
 *
 * Dezelfde volgorde als in de verzendmodule: staat er een Brevo-sleutel, dan
 * gaat alles over de HTTPS-API van Brevo. Staat die niet en wel een SMTP-host,
 * dan over SMTP. Staat geen van beide, dan wordt er niets verstuurd en is het
 * kanaal "geen". Het kanaal wordt bij elke regel opnieuw bepaald, want een
 * omgevingsvariabele kan tussen twee verzendingen wijzigen.
 */
export function kanaalNu(): VerzendKanaal {
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) return "brevo-api";
  if (process.env.SMTP_HOST && process.env.SMTP_HOST.trim()) return "smtp";
  return "geen";
}

/** Kort een tekst af, zodat een uitzonderlijk lange melding het logboek niet vult. */
function kort(waarde: string | null | undefined, max: number): string | null {
  if (waarde === null || waarde === undefined) return null;
  const tekst = String(waarde).trim();
  if (!tekst) return null;
  return tekst.length > max ? tekst.slice(0, max) : tekst;
}

/**
 * Legt één verzendpoging vast. Deze functie werpt nooit; mislukt het schrijven,
 * dan blijft dat een melding op de console en gaat de verzending gewoon door.
 */
export function schrijfVerzendregel(invoer: VerzendregelInvoer): void {
  try {
    sqlite
      .prepare(
        `INSERT INTO mail_verzendlog
           (tijdstip, soort, ontvanger, afzender, onderwerp, status, kanaal, melding, taal, instrument)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        new Date().toISOString(),
        invoer.soort,
        kort(invoer.ontvanger, 320) ?? "",
        kort(invoer.afzender, 320) ?? "",
        kort(invoer.onderwerp, 500) ?? "",
        invoer.status,
        kanaalNu(),
        kort(invoer.melding, 1000),
        kort(invoer.taal, 8),
        kort(invoer.instrument, 200),
      );
  } catch (e) {
    const melding = e instanceof Error ? e.message : "onbekende fout";
    console.error(`[verzendlog] Regel niet vastgelegd: ${melding}`);
  }
}

export interface VerzendlogFilter {
  status?: string | null;
  soort?: string | null;
  /** Zoekt op een deel van het adres van de ontvanger. */
  zoek?: string | null;
  limiet?: number | null;
}

export interface VerzendlogUitkomst {
  regels: Verzendregel[];
  /** Aantal regels dat aan de filter voldoet, ook als er meer zijn dan de limiet. */
  totaal: number;
  /** Aantal regels per stand over het volledige logboek, zonder filter. */
  telling: Record<VerzendStatus, number>;
  kanaal: VerzendKanaal;
  /** Waar wanneer de tabel nog niet bestaat; het scherm meldt dat dan eerlijk. */
  logboekOntbreekt: boolean;
}

const STANDAARD_LIMIET = 100;
const MAX_LIMIET = 500;

/**
 * Leest het logboek, jongste regel eerst.
 *
 * De filters worden hier gecontroleerd tegen de toegestane waarden en niet
 * doorgegeven zoals ze binnenkomen. Een onbekende waarde wordt genegeerd in
 * plaats van in de vraag te belanden.
 */
export function leesVerzendlog(filter: VerzendlogFilter = {}): VerzendlogUitkomst {
  const leeg: VerzendlogUitkomst = {
    regels: [],
    totaal: 0,
    telling: { verstuurd: 0, gesimuleerd: 0, fout: 0 },
    kanaal: kanaalNu(),
    logboekOntbreekt: true,
  };

  const voorwaarden: string[] = [];
  const waarden: unknown[] = [];
  const status = VERZEND_STATUSSEN.find((s) => s === filter.status);
  if (status) {
    voorwaarden.push("status = ?");
    waarden.push(status);
  }
  const soort = VERZEND_SOORTEN.find((s) => s === filter.soort);
  if (soort) {
    voorwaarden.push("soort = ?");
    waarden.push(soort);
  }
  const zoek = (filter.zoek ?? "").trim();
  if (zoek) {
    voorwaarden.push("ontvanger LIKE ?");
    waarden.push(`%${zoek}%`);
  }
  const waar = voorwaarden.length ? `WHERE ${voorwaarden.join(" AND ")}` : "";
  const gevraagd = Number(filter.limiet ?? STANDAARD_LIMIET);
  const limiet =
    Number.isFinite(gevraagd) && gevraagd > 0 ? Math.min(Math.floor(gevraagd), MAX_LIMIET) : STANDAARD_LIMIET;

  try {
    const regels = sqlite
      .prepare(
        `SELECT id, tijdstip, soort, ontvanger, afzender, onderwerp, status, kanaal, melding, taal, instrument
           FROM mail_verzendlog ${waar}
          ORDER BY tijdstip DESC, id DESC
          LIMIT ?`,
      )
      .all(...waarden, limiet) as Verzendregel[];
    const totaalRij = sqlite
      .prepare(`SELECT COUNT(*) AS n FROM mail_verzendlog ${waar}`)
      .get(...waarden) as { n: number };
    const tellingRijen = sqlite
      .prepare("SELECT status, COUNT(*) AS n FROM mail_verzendlog GROUP BY status")
      .all() as { status: VerzendStatus; n: number }[];

    const telling: Record<VerzendStatus, number> = { verstuurd: 0, gesimuleerd: 0, fout: 0 };
    for (const rij of tellingRijen) {
      if (rij.status in telling) telling[rij.status] = rij.n;
    }

    return {
      regels,
      totaal: totaalRij?.n ?? regels.length,
      telling,
      kanaal: kanaalNu(),
      logboekOntbreekt: false,
    };
  } catch (e) {
    const melding = e instanceof Error ? e.message : "onbekende fout";
    console.error(`[verzendlog] Logboek niet te lezen: ${melding}`);
    return leeg;
  }
}
