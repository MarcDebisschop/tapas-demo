// =============================================================================
// client/src/twominscan/teamwiel-aankoop.ts — het teamwiel afrekenen
// -----------------------------------------------------------------------------
// De browserkant van server/twominscan/teamwiel-aankoop.ts. Eén temperamentenwiel
// kost credits (tarief uit shared/twominscan-teamwiel.ts). Deze module doet twee
// dingen en niets meer:
//
//   controleerTeamwiel  vraagt of dit wiel al betaald is en hoeveel credits er
//                       beschikbaar zijn. Boekt niets af.
//   koopTeamwiel        boekt het tarief af. Antwoordt "al-aangekocht" wanneer
//                       precies dezelfde ploeg eerder al betaald werd, zodat
//                       opnieuw openen of afdrukken in een andere taal niets
//                       extra kost.
//
// De beslissing valt op de server. Deze module vertaalt enkel het antwoord naar
// een vorm die de pagina kan tonen; ze rekent zelf geen saldo na, want een
// browser is geen betrouwbare kassa.
// =============================================================================
import { TEAMWIEL_CREDITS_STANDAARD } from "@shared/twominscan-teamwiel";

export type AankoopStatus =
  | "aangekocht"
  | "al-aangekocht"
  | "te-koop"
  | "geen-verrekening"
  | "onvoldoende-credits"
  | "geen-toegang"
  | "fout";

export interface AankoopUitkomst {
  status: AankoopStatus;
  /** Het tarief van één teamwiel. */
  tarief: number;
  /** Beschikbaar saldo, wanneer de server het meegaf. */
  saldo?: number;
  /** true = het rapport mag getoond worden. */
  vrijgegeven: boolean;
  /** Menselijke uitleg bij een blokkade; leeg wanneer alles in orde is. */
  melding: string;
}

export interface AankoopDeelnemer {
  naam: string;
  wielpositie: string;
}

async function vraag(
  deelnemers: AankoopDeelnemer[],
  controleerAlleen: boolean,
): Promise<AankoopUitkomst> {
  const lijst = deelnemers.map((d) => ({ naam: d.naam, wielpositie: d.wielpositie }));
  try {
    const antwoord = await fetch("/api/twominscan/teamwiel/aankoop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ deelnemers: lijst, controleerAlleen }),
    });
    const data = await antwoord.json().catch(() => ({}) as any);
    const tarief = Number(data?.tarief) > 0 ? Number(data.tarief) : TEAMWIEL_CREDITS_STANDAARD;
    const saldo = Number.isFinite(Number(data?.saldo)) ? Number(data.saldo) : undefined;

    if (antwoord.status === 401 || antwoord.status === 403) {
      return {
        status: "geen-toegang",
        tarief,
        vrijgegeven: false,
        melding:
          "Een teamwiel wordt met credits van je organisatie betaald. Meld je aan als beheerder van je organisatie om het aan te kopen.",
      };
    }
    if (antwoord.status === 402) {
      return {
        status: "onvoldoende-credits",
        tarief,
        saldo,
        vrijgegeven: false,
        melding: String(data?.error ?? "Er zijn niet genoeg credits voor dit teamwiel."),
      };
    }
    if (!antwoord.ok) {
      return {
        status: "fout",
        tarief,
        saldo,
        vrijgegeven: false,
        melding: String(data?.error ?? "De aankoop van het teamwiel is niet gelukt."),
      };
    }

    const status = String(data?.status ?? "") as AankoopStatus;
    if (status === "aangekocht" || status === "al-aangekocht" || status === "geen-verrekening") {
      return { status, tarief, saldo, vrijgegeven: true, melding: "" };
    }
    // "te-koop": nog niet betaald, saldo volstaat of niet.
    const voldoende = data?.voldoende !== false;
    return {
      status: "te-koop",
      tarief,
      saldo,
      vrijgegeven: false,
      melding: voldoende ? "" : "Er zijn niet genoeg credits voor dit teamwiel.",
    };
  } catch {
    return {
      status: "fout",
      tarief: TEAMWIEL_CREDITS_STANDAARD,
      vrijgegeven: false,
      melding: "De server is niet bereikbaar. Het teamwiel kon niet worden afgerekend.",
    };
  }
}

/** Is dit teamwiel al betaald? Boekt niets af. */
export function controleerTeamwiel(deelnemers: AankoopDeelnemer[]): Promise<AankoopUitkomst> {
  return vraag(deelnemers, true);
}

/** Koopt dit teamwiel; een tweede keer voor dezelfde ploeg kost niets. */
export function koopTeamwiel(deelnemers: AankoopDeelnemer[]): Promise<AankoopUitkomst> {
  return vraag(deelnemers, false);
}
