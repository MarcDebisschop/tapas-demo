/**
 * server/hdd/uitnodigingsmail.ts
 *
 * De uitnodigingsmail van een HDD-fase.
 * ---------------------------------------------------------------------------
 * AANLEIDING. Op 12 september werd een board-traject uitgestuurd naar drie
 * mensen. Het scherm gaf drie namen met hun links terug, de trajectprijs ging
 * eraf, en er kwam bij niemand een bericht aan. De verzendcode was niet stuk en
 * er was niets veranderd bij de mailleverancier: ./uitsturen.ts maakte de tokens
 * aan en gaf per lid naam, e-mailadres en links terug, maar er stond in heel het
 * HDD-pad geen enkele mailaanroep. Het adres reisde mee als gegeven en werd
 * nooit een geadresseerde.
 *
 * Dit bestand is die ontbrekende stap. Eén bericht per board member, met de
 * links van die fase erin, langs dezelfde weg naar buiten als alle andere post
 * van het platform (server/bulk-import/mailer.ts), en met dezelfde eerlijke
 * boekhouding als de bulk-import: uitgestuurd is niet verstuurd, en wat niet
 * vertrok, wordt gezegd.
 *
 * Drie keuzes, met hun reden:
 *
 *   1. Eén bericht per lid, niet één per link. Fase 1 draagt twee instrumenten;
 *      twee losse berichten aan dezelfde persoon in dezelfde minuut ziet die
 *      persoon als een storing, en de leverancier rekent het als twee.
 *
 *   2. Een lid zonder adres levert de stand "-" op, geen fout. Niet elk board
 *      member hoort per mail te horen; wie de link met de hand doorgeeft, mag
 *      daarvoor geen rood scherm krijgen.
 *
 *   3. De links worden hier absoluut gemaakt. De client draait op een
 *      hash-router, dus een pad alleen brengt de ontvanger nergens. Zie
 *      absoluteLink hieronder voor het ene geval dat afwijkt.
 */

import { verstuurBericht } from "../bulk-import/mailer";
import { beoordeelBatch } from "../mailpoort/keuring";
import { TEAMSCAN_INSTRUMENT, TWOMINSCAN_INSTRUMENT, T4P_INSTRUMENT } from "./uitsturen";
import type { LidUitsturing } from "./uitsturen";
import { eenHekje, normaliseerBasis } from "../publieke-basis";

/** Wat de ontvanger leest in plaats van een instrument-id. */
const INSTRUMENTNAMEN: Record<string, string> = {
  [TEAMSCAN_INSTRUMENT]: "Teamscan",
  [TWOMINSCAN_INSTRUMENT]: "2MINSCAN",
  [T4P_INSTRUMENT]: "TaPas Business Kompas",
};

export function instrumentnaam(instrumentId: string): string {
  return INSTRUMENTNAMEN[instrumentId] ?? instrumentId;
}

/**
 * Een pad uit linkVoor() wordt een adres dat een browser kan openen.
 *
 * De client leest zijn route uit de hash, dus het pad hoort achter een hekje.
 * De 2MINSCAN is de uitzondering: die pagina leest het token uit de gewone
 * zoekreeks van het adres, en een zoekreeks achter de hash komt daar niet aan.
 * Voor dat ene geval zet deze functie het token vooraan en de route erachter.
 */
export function absoluteLink(origin: string, pad: string): string {
  // De basis wordt teruggebracht tot de voordeur van het platform. Stond er een
  // pad of een hash in, dan kwamen er twee hekjes in de link en kreeg de
  // deelnemer een foutpagina. Zie ../publieke-basis.ts.
  const basis = normaliseerBasis(origin) || (origin ?? "").replace(/\/+$/, "");
  const vraagteken = pad.indexOf("?");
  if (vraagteken >= 0) {
    const route = pad.slice(0, vraagteken);
    const zoekreeks = pad.slice(vraagteken + 1);
    return eenHekje(basis ? `${basis}/?${zoekreeks}#${route}` : `/?${zoekreeks}#${route}`);
  }
  return eenHekje(basis ? `${basis}#${pad}` : `#${pad}`);
}

export interface LidMailUitslag {
  lidId: number;
  naam: string;
  email: string;
  /** "-" betekent: geen adres, dus geen bericht gevraagd. */
  mailStatus: "verstuurd" | "gesimuleerd" | "fout" | "-";
  melding: string;
}

export interface FaseMailUitslag {
  leden: LidMailUitslag[];
  aantalMailVerstuurd: number;
  aantalZonderMail: number;
  /** Waar wanneer elk gevraagd bericht ook werkelijk vertrok. */
  mailGeslaagd: boolean;
  mailAlarm: string | null;
}

function onderwerpVoor(fase: number, boardNaam: string): string {
  const deel = fase === 1 ? "eerste deel" : "tweede deel";
  return `Jouw ${deel} van het HDD-traject voor ${boardNaam}`;
}

/**
 * De berichttekst. Platte tekst, want de mailer zet zelf de opmaak.
 *
 * De toon is die van de andere uitnodigingen: kort zeggen wat er gevraagd wordt,
 * hoeveel tijd het kost en wat de ontvanger moet doen. Geen belofte over wat
 * het platform met de antwoorden doet; dat staat in het traject zelf.
 */
export function berichtVoorLid(opties: {
  naam: string;
  boardNaam: string;
  fase: number;
  links: { instrumentId: string; link: string }[];
}): string {
  const { naam, boardNaam, fase, links } = opties;
  const aanhef = naam.trim() ? `Beste ${naam.trim()},` : "Beste,";
  const regels = links.map((l) => `${instrumentnaam(l.instrumentId)}: ${l.link}`);
  const meervoud = links.length > 1;
  const inleiding =
    fase === 1
      ? `Voor het traject van ${boardNaam} vragen we je om ${meervoud ? "twee korte vragenlijsten" : "een korte vragenlijst"} in te vullen.`
      : `Het traject van ${boardNaam} gaat verder met ${meervoud ? "de volgende vragenlijsten" : "een volgende vragenlijst"}.`;

  return [
    aanhef,
    "",
    inleiding,
    meervoud
      ? "De links hieronder zijn alleen voor jou. Vul ze niet samen met iemand anders in, want dan lopen de antwoorden door elkaar."
      : "De link hieronder is alleen voor jou. Vul hem niet samen met iemand anders in, want dan lopen de antwoorden door elkaar.",
    "",
    ...regels,
    "",
    "Je kan halverwege stoppen en later verdergaan. Wat je al invulde, blijft staan.",
    "Kan je de link niet openen? Antwoord dan op dit bericht.",
    "",
    "Met vriendelijke groeten",
    "TaPasCity",
  ].join("\n");
}

/**
 * Verstuurt de fase naar de board members.
 *
 * Werpt niet: elke uitkomst komt in de lijst terecht. Een traject dat al is
 * uitgestuurd, mag opnieuw verstuurd worden; de links blijven dezelfde, dus een
 * tweede bericht is een herinnering en geen tweede uitnodiging.
 */
export async function mailFaseUit(opties: {
  boardNaam: string;
  fase: number;
  uitsturingen: LidUitsturing[];
  origin: string;
  afzender?: string | null;
}): Promise<FaseMailUitslag> {
  const { boardNaam, fase, uitsturingen, origin } = opties;
  const leden: LidMailUitslag[] = [];

  for (const lid of uitsturingen) {
    const email = (lid.email ?? "").trim();
    if (!email) {
      leden.push({
        lidId: lid.lidId,
        naam: lid.naam,
        email: "",
        mailStatus: "-",
        melding: "Dit lid heeft geen e-mailadres. Geef de link zelf door.",
      });
      continue;
    }
    if (!lid.links.length) {
      leden.push({
        lidId: lid.lidId,
        naam: lid.naam,
        email,
        mailStatus: "-",
        melding: "In deze fase krijgt dit lid geen link, dus er valt niets te versturen.",
      });
      continue;
    }

    const links = lid.links.map((l) => ({
      instrumentId: l.instrumentId,
      link: absoluteLink(origin, l.link),
    }));

    const uitslag = await verstuurBericht({
      naar: email,
      naam: lid.naam,
      onderwerp: onderwerpVoor(fase, boardNaam),
      tekst: berichtVoorLid({ naam: lid.naam, boardNaam, fase, links }),
      from: opties.afzender ?? null,
    });

    leden.push({
      lidId: lid.lidId,
      naam: lid.naam,
      email,
      mailStatus: uitslag.status,
      melding:
        uitslag.melding ??
        (uitslag.gesimuleerd
          ? "De mail is alleen nagebootst, want er is geen verzendkanaal ingesteld."
          : "Bericht verstuurd."),
    });
  }

  // Hetzelfde oordeel als de bulk-import gebruikt, zodat één regel bepaalt wat
  // "geslaagd" betekent. status "ok" hier: het lid is uitgestuurd; of het
  // bericht vertrok, zegt mailStatus.
  const oordeel = beoordeelBatch(
    leden.map((l) => ({ status: "ok" as const, mailStatus: l.mailStatus })),
  );

  return {
    leden,
    aantalMailVerstuurd: oordeel.aantalVerstuurd,
    aantalZonderMail: oordeel.aantalZonderMail,
    mailGeslaagd: oordeel.geslaagd,
    mailAlarm: oordeel.alarm,
  };
}
