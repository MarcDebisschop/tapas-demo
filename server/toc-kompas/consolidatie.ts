// ---------------------------------------------------------------------------
// server/toc-kompas/consolidatie.ts
//
// De consolidatie van de vier ingediende vragenlijsten, zoals de neutrale
// facilitator die volgens sectie 10 van het kompas voorbereidt. Pure functies:
// geen databank, geen klok, geen willekeur. Dezelfde indieningen geven altijd
// dezelfde signalen (regelversie TOC_KOMPAS_REGELVERSIE).
//
// WAT HIER GEBEURT. Capaciteit per Captain, de A/R/C/I per domein naast
// elkaar, en de vier signalen van sectie 9:
//   ROOD    kritiek domein zonder A-owner of zonder capaciteit;
//   ORANJE  meer dan een A-owner (huidig of gewenst);
//   GEEL    geplande uren boven capaciteit minus buffer;
//   BLAUW   kritische kennis zonder back-up.
// Daarnaast de aandachtspunten uit de workshopvoorbereiding: geplande
// capaciteit boven 90% en een buffer onder 10%.
//
// WAT HIER NIET GEBEURT. Er wordt geen dekkingsscore berekend en geen
// gemiddelde. De score 0 tot 4 per domein stelt het TOC samen vast in de
// workshop (Coverage Matrix). Een signaal is een vraag voor de workshop, geen
// oordeel over een persoon.
// ---------------------------------------------------------------------------
import {
  CAPTAIN_ROL_INFO,
  DOMEINEN,
  TOC_KOMPAS_REGELVERSIE,
  beschikbareUren,
  bedrijfsleidingRijenGevuld,
  capaciteitSom,
  deliveryRijenGevuld,
  isLeeg,
  urenVoor,
  type Antwoorden,
  type CaptainRol,
  type SignaalSoort,
} from "@shared/toc-kompas";

export interface CaptainInvoer {
  captainId: number;
  rol: CaptainRol;
  naam: string;
  antwoorden: Antwoorden;
}

export interface Signaal {
  soort: SignaalSoort | "aandacht";
  domein: string | null;
  captainId: number | null;
  tekst: string;
}

export interface CapaciteitRij {
  captainId: number;
  rol: CaptainRol;
  naam: string;
  titel: string;
  beschikbareUren: number | null;
  zekerheid: string;
  deliveryPct: number | null;
  bedrijfsleidingPct: number | null;
  bufferPct: number | null;
  som: number | null;
  deliveryUren: number | null;
  bedrijfsleidingUren: number | null;
  bufferUren: number | null;
  geplandeUren: number;
  inzetbaarUren: number | null;
  benutting: number | null;
  aantalDelivery: number;
  aantalBedrijfsleiding: number;
}

export interface DomeinRij {
  domein: string;
  naam: string;
  rollen: Array<{ captainId: number; mijnRol: string; gewensteRol: string; urenPerMaand: number | null; zekerheid: number | null; ontbrekend: string }>;
  aOwnersHuidig: number[];
  aOwnersGewenst: number[];
  signalen: SignaalSoort[];
}

export interface Consolidatie {
  regelversie: string;
  capaciteit: CapaciteitRij[];
  domeinen: DomeinRij[];
  signalen: Signaal[];
  tellingen: Record<SignaalSoort | "aandacht", number>;
}

function rond(n: number): number {
  return Math.round(n * 10) / 10;
}

function som(rijen: Array<{ uren: number | null }>): number {
  return rond(rijen.reduce((t, r) => t + (r.uren ?? 0), 0));
}

export function consolideer(captains: CaptainInvoer[]): Consolidatie {
  const signalen: Signaal[] = [];
  const naamVan = new Map(captains.map((c) => [c.captainId, c.naam]));

  // ---- Capaciteit per Captain en GEEL -------------------------------------------------
  const capaciteit: CapaciteitRij[] = captains.map((c) => {
    const a = c.antwoorden;
    const uren = beschikbareUren(a);
    const d = deliveryRijenGevuld(a);
    const b = bedrijfsleidingRijenGevuld(a);
    const gepland = rond(som(d) + som(b));
    const buffer = a.capaciteit.buffer;
    const inzetbaar = uren !== null && buffer !== null ? rond(uren * (1 - buffer / 100)) : null;
    const benutting = uren !== null && uren > 0 ? Math.round((gepland / uren) * 100) : null;
    const s = capaciteitSom(a);

    if (s === null) {
      signalen.push({ soort: "aandacht", domein: null, captainId: c.captainId, tekst: `${c.naam}: de verdeling delivery, bedrijfsleiding en buffer is niet volledig ingevuld.` });
    } else if (Math.abs(s - 100) > 0.01) {
      signalen.push({ soort: "aandacht", domein: null, captainId: c.captainId, tekst: `${c.naam}: delivery, bedrijfsleiding en buffer tellen op tot ${s}% in plaats van 100%.` });
    }
    if (inzetbaar !== null && gepland > inzetbaar) {
      signalen.push({
        soort: "geel",
        domein: null,
        captainId: c.captainId,
        tekst: `${c.naam}: ${gepland} geplande uren per week tegenover ${inzetbaar} inzetbare uren (capaciteit ${uren} min buffer ${buffer}%).`,
      });
    }
    if (benutting !== null && benutting > 90) {
      signalen.push({ soort: "aandacht", domein: null, captainId: c.captainId, tekst: `${c.naam}: geplande capaciteit op ${benutting}% van de beschikbare uren, boven de grens van 90%.` });
    }
    if (buffer !== null && buffer < 10) {
      signalen.push({ soort: "aandacht", domein: null, captainId: c.captainId, tekst: `${c.naam}: buffer van ${buffer}% ligt onder 10%; onvoorzien werk wordt dan verborgen capaciteit.` });
    }

    return {
      captainId: c.captainId,
      rol: c.rol,
      naam: c.naam,
      titel: CAPTAIN_ROL_INFO[c.rol].titel,
      beschikbareUren: uren,
      zekerheid: a.velden?.capaciteitszekerheid ?? "",
      deliveryPct: a.capaciteit.delivery,
      bedrijfsleidingPct: a.capaciteit.bedrijfsleiding,
      bufferPct: buffer,
      som: s,
      deliveryUren: urenVoor(a.capaciteit.delivery, uren),
      bedrijfsleidingUren: urenVoor(a.capaciteit.bedrijfsleiding, uren),
      bufferUren: urenVoor(buffer, uren),
      geplandeUren: gepland,
      inzetbaarUren: inzetbaar,
      benutting,
      aantalDelivery: d.length,
      aantalBedrijfsleiding: b.length,
    };
  });

  // ---- Domeinen: ROOD, ORANJE en BLAUW ----------------------------------------------
  const domeinen: DomeinRij[] = DOMEINEN.map((dom) => {
    const rollen = captains.map((c) => {
      const r = c.antwoorden.dekking?.[dom.sleutel];
      return {
        captainId: c.captainId,
        mijnRol: r?.mijnRol ?? "",
        gewensteRol: r?.gewensteRol ?? "",
        urenPerMaand: r?.urenPerMaand ?? null,
        zekerheid: r?.zekerheid ?? null,
        ontbrekend: r?.ontbrekend ?? "",
      };
    });
    const aHuidig = rollen.filter((r) => r.mijnRol === "A").map((r) => r.captainId);
    const aGewenst = rollen.filter((r) => r.gewensteRol === "A").map((r) => r.captainId);
    const eigen: SignaalSoort[] = [];

    if (aHuidig.length === 0) {
      eigen.push("rood");
      signalen.push({ soort: "rood", domein: dom.sleutel, captainId: null, tekst: `${dom.naam}: geen enkele Captain geeft aan hier vandaag A-owner te zijn.` });
    } else if (aHuidig.every((id) => {
      const r = rollen.find((x) => x.captainId === id)!;
      return r.urenPerMaand === null || r.urenPerMaand === 0;
    })) {
      eigen.push("rood");
      signalen.push({ soort: "rood", domein: dom.sleutel, captainId: null, tekst: `${dom.naam}: er is een A-owner maar geen capaciteit in uren per maand.` });
    }
    if (aHuidig.length > 1) {
      eigen.push("oranje");
      signalen.push({ soort: "oranje", domein: dom.sleutel, captainId: null, tekst: `${dom.naam}: ${aHuidig.length} Captains geven aan vandaag A-owner te zijn (${aHuidig.map((id) => naamVan.get(id)).join(", ")}).` });
    }
    if (aGewenst.length > 1) {
      if (!eigen.includes("oranje")) eigen.push("oranje");
      signalen.push({ soort: "oranje", domein: dom.sleutel, captainId: null, tekst: `${dom.naam}: ${aGewenst.length} Captains wensen A-owner te worden (${aGewenst.map((id) => naamVan.get(id)).join(", ")}).` });
    }
    const dragers = rollen.filter((r) => r.mijnRol === "A" || r.mijnRol === "R");
    if (aHuidig.length === 1 && dragers.length === 1 && captains.length > 1) {
      eigen.push("blauw");
      signalen.push({ soort: "blauw", domein: dom.sleutel, captainId: aHuidig[0], tekst: `${dom.naam}: enkel ${naamVan.get(aHuidig[0])} draagt dit domein; geen andere Captain is R.` });
    }
    return { domein: dom.sleutel, naam: dom.naam, rollen, aOwnersHuidig: aHuidig, aOwnersGewenst: aGewenst, signalen: eigen };
  });

  // BLAUW op Captainniveau: A-owner van minstens een domein zonder opvolging.
  for (const c of captains) {
    const aantalA = DOMEINEN.filter((d) => c.antwoorden.dekking?.[d.sleutel]?.mijnRol === "A").length;
    if (aantalA > 0 && isLeeg(c.antwoorden.velden?.opvolging)) {
      signalen.push({ soort: "blauw", domein: null, captainId: c.captainId, tekst: `${c.naam}: A-owner van ${aantalA} domein(en) zonder benoemde opvolging bij tijdelijke afwezigheid.` });
    }
  }

  const tellingen = { rood: 0, oranje: 0, geel: 0, blauw: 0, aandacht: 0 } as Record<SignaalSoort | "aandacht", number>;
  for (const s of signalen) tellingen[s.soort] += 1;

  return { regelversie: TOC_KOMPAS_REGELVERSIE, capaciteit, domeinen, signalen, tellingen };
}

// ---- Acceptatiecriteria die de databank kan toetsen (sectie 13) --------------------------
export interface CommitmentKern {
  code: string;
  objective: string;
  deliverable: string;
  acceptatiebewijs: string;
  deadline: string;
  capaciteit: string;
  urenPerWeek: number | null;
  beslissingsrecht: string;
  stopkeuze: string;
}

export function ontbrekendeKaartvelden(c: CommitmentKern): string[] {
  const uit: string[] = [];
  if (isLeeg(c.objective) && isLeeg(c.deliverable)) uit.push("outcome");
  if (isLeeg(c.acceptatiebewijs)) uit.push("bewijs");
  if (isLeeg(c.deadline)) uit.push("datum");
  if (isLeeg(c.capaciteit) && (c.urenPerWeek === null || c.urenPerWeek <= 0)) uit.push("capaciteit");
  if (isLeeg(c.beslissingsrecht)) uit.push("mandaat");
  if (isLeeg(c.stopkeuze)) uit.push("stopkeuze");
  return uit;
}

export interface AutomatischeToets {
  sleutel: string;
  voldaan: boolean;
  toelichting: string;
}

export function toetsAutomatisch(
  consolidatie: Consolidatie,
  commitments: CommitmentKern[],
  coverage: Array<{ domein: string; aOwner: string; aOwnerCaptainId: number | null }>,
  belegdDomeinen: readonly string[],
): AutomatischeToets[] {
  const cap = consolidatie.capaciteit.filter((c) => c.som === null || Math.abs(c.som - 100) > 0.01 || c.beschikbareUren === null);
  const dubbel = consolidatie.domeinen.filter((d) => d.aOwnersHuidig.length > 1);
  const onvolledig = commitments.map((c) => ({ code: c.code, mist: ontbrekendeKaartvelden(c) })).filter((x) => x.mist.length > 0);
  const nietBelegd = belegdDomeinen.filter((d) => {
    const r = coverage.find((x) => x.domein === d);
    return !r || (isLeeg(r.aOwner) && r.aOwnerCaptainId === null);
  });
  const naam = (s: string) => DOMEINEN.find((d) => d.sleutel === s)?.naam ?? s;
  return [
    {
      sleutel: "capaciteit100",
      voldaan: consolidatie.capaciteit.length > 0 && cap.length === 0,
      toelichting: cap.length === 0 ? "Alle Captains hebben uren en een verdeling van 100%." : `Nog niet in orde bij: ${cap.map((c) => c.naam).join(", ")}.`,
    },
    {
      sleutel: "aOwners",
      voldaan: dubbel.length === 0,
      toelichting: dubbel.length === 0 ? "Geen domein met meer dan een A-owner. Domeinen zonder A-owner staan rood in de consolidatie." : `Meer dan een A-owner bij: ${dubbel.map((d) => d.naam).join(", ")}.`,
    },
    {
      sleutel: "commitmentsVolledig",
      voldaan: commitments.length > 0 && onvolledig.length === 0,
      toelichting:
        commitments.length === 0
          ? "Er staan nog geen commitments in het register."
          : onvolledig.length === 0
            ? "Elk commitment heeft outcome, bewijs, datum, capaciteit, mandaat en stopkeuze."
            : `Onvolledig: ${onvolledig.map((x) => `${x.code} (${x.mist.join(", ")})`).join("; ")}.`,
    },
    {
      sleutel: "belegd",
      voldaan: nietBelegd.length === 0,
      toelichting: nietBelegd.length === 0 ? "Alle vereiste domeinen hebben een vastgestelde A-owner in de Coverage Matrix." : `Nog niet belegd in de Coverage Matrix: ${nietBelegd.map(naam).join(", ")}.`,
    },
  ];
}
