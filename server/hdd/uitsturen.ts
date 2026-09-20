/**
 * server/hdd/uitsturen.ts
 *
 * Het echte uitsturen van een HDD-fase.
 * ---------------------------------------------------------------------------
 * Tot nu toe zetten start-fase1 en start-fase2 enkel de status van het traject
 * en gaven ze een tekstje "todo" terug. Er ging niets de deur uit. Dit bestand
 * maakt per board member de uitnodigingen aan die de fase nodig heeft, bewaart
 * de tokens op het lid (hddStorage.setTokens) en geeft de links terug.
 *
 * Twee soorten uitnodiging, want de instrumenten werken verschillend:
 *
 *   1. tapas-teamscan is een collaboratief instrument: EEN sessie per team met
 *      per deelnemer een token. Het teamrapport aggregeert per sessie, dus alle
 *      board members van een traject horen in dezelfde sessie. Het sessie-id
 *      staat op het traject, zodat een tweede start dezelfde sessie hergebruikt.
 *
 *   2. twominscan en t4p-business-kompas lopen over de gewone afnameweg: een rij
 *      in de tabel afnames met een inviteToken (storage.maakUitnodiging), precies
 *      zoals POST /api/uitnodigingen dat doet.
 *
 * Idempotent op drie niveaus: bestaat er voor een lid al een token voor dat
 * instrument, dan wordt dat token hergebruikt; staat er geen token op het lid
 * maar bestaat er al een afname voor diezelfde naam, hetzelfde instrument en
 * hetzelfde organisatielabel (bijvoorbeeld een uitnodiging die eerder buiten
 * het traject om is aangemaakt, of een reeds voltooide afname), dan wordt het
 * token daarvan overgenomen; en de credits worden hoogstens een keer geboekt.
 * Zo levert een tweede start nooit een tweede uitnodiging of een tweede
 * afboeking op, en verliest een traject geen bestaande antwoorden.
 *
 * Credits: de registry rekent HDD af per TRAJECT (creditCost van "hdd",
 * standaard 50, instelbaar via HDD_TRAJECT_CREDITS), niet per uitgestuurde link.
 * Daarom boeken we de trajectprijs eenmalig af met storage.verbruikVoorProduct
 * (hetzelfde pad dat het teamwiel gebruikt voor een product dat geen afname is)
 * en reserveren we GEEN credit per onderliggende uitnodiging. Zou elke
 * uitnodiging ook nog eens storage.reserveer doen, dan betaalde de klant twee
 * keer: een keer voor het traject en een keer per lid per instrument.
 */

import { storage, CreditError } from "../storage";
import { hddStorage } from "./storage";
import { getDescriptor } from "../registry";
import type { HddTraject, HddBoardLid } from "./schema";
import type { Scope } from "../scope-guard";

export const TEAMSCAN_INSTRUMENT = "tapas-teamscan";
export const TWOMINSCAN_INSTRUMENT = "twominscan";
export const T4P_INSTRUMENT = "t4p-business-kompas";

export interface UitgestuurdeLink {
  instrumentId: string;
  token: string;
  link: string;
  /** Vers aangemaakt in deze aanroep, of hergebruikt uit een eerdere start. */
  nieuw: boolean;
}

export interface LidUitsturing {
  lidId: number;
  naam: string;
  email: string;
  links: UitgestuurdeLink[];
}

export interface CreditBoeking {
  /** geboekt = nu afgeboekt, reeds-geboekt = eerder al, geen-verrekening = prior. */
  status: "geboekt" | "reeds-geboekt" | "geen-verrekening";
  credits: number;
}

export interface UitstuurResultaat {
  fase: number;
  instrumenten: string[];
  teamscanSessieId: number | null;
  leden: LidUitsturing[];
  credits: CreditBoeking;
}

/** De instrumenten van een fase komen uit de registry, niet uit een tweede lijst. */
export function instrumentenVanFase(fase: number): string[] {
  const descriptor = getDescriptor("hdd");
  const beschrijving = descriptor?.journey?.fases.find((f) => f.fase === fase);
  return beschrijving?.instrumenten ?? [];
}

/**
 * De deelnemerslink per instrument.
 *
 * De 2MINSCAN-pagina leest ?uitnodiging= uit, haalt de uitnodiging op via
 * GET /api/uitnodigingen/:token en zet naam en organisatie vast. Dat is nodig
 * omdat een bewaarde 2MINSCAN later op naam binnen de organisatie wordt
 * teruggevonden: een zelf getypte variant zou daar niet op aansluiten.
 */
export function linkVoor(instrumentId: string, token: string): string {
  if (instrumentId === TEAMSCAN_INSTRUMENT) return `/teamscan/r/${token}`;
  // De korte vorm voor de 2MINSCAN. De server zet het token terug in de
  // zoekreeks (zie server/static.ts); zo blijft de link in een bericht onder de
  // 76 tekens waarna platte tekst zijn regels breekt.
  if (instrumentId === TWOMINSCAN_INSTRUMENT) return `/s/${token}`;
  return `/deelnemer/${token}`;
}

/**
 * Boekt de trajectprijs af, precies een keer per traject.
 *
 * Een prior-scope (het platform zelf) heeft geen creditrekening; daar gebeurt
 * hetzelfde als bij het teamwiel: geen verrekening. Gooit CreditError door
 * wanneer het saldo niet volstaat, zodat de route er 402 van kan maken.
 */
export async function boekTrajectCredits(
  traject: HddTraject,
  scope: Scope,
): Promise<CreditBoeking> {
  if (traject.creditsGeboekt > 0) {
    return { status: "reeds-geboekt", credits: traject.creditsGeboekt };
  }
  const organisatieId = scope.soort === "organisatie" ? scope.organisatieId : null;
  if (organisatieId == null) return { status: "geen-verrekening", credits: 0 };

  const kost = getDescriptor("hdd")?.creditCost ?? 0;
  if (kost <= 0) return { status: "geen-verrekening", credits: 0 };

  await storage.verbruikVoorProduct(
    organisatieId,
    kost,
    `HDD-traject ${traject.id} (${traject.boardNaam})`,
  );
  hddStorage.markeerCreditsGeboekt(traject.id, kost);
  return { status: "geboekt", credits: kost };
}

/** Naam vergelijken zoals mensen ze schrijven: zonder hoofdletters, zonder dubbele spaties. */
function naamSleutel(naam: string): string {
  return (naam ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Een afnamerij zoals deze module ze nodig heeft om te herkennen. */
export interface AfnameKandidaat {
  id: number;
  name: string | null;
  company: string | null;
  deelnemerEmail?: string | null;
  instrumentId: string | null;
  inviteToken: string | null;
}

/**
 * Welke instrumentId's mag een afname hebben om voor dit instrument te gelden?
 *
 * Voor het Kompas staan er twee in de lijst. Het traject werd een tijd lang als
 * gewoon instrument uitgestuurd, via Bulk-import. Zo'n uitnodiging kreeg
 * instrumentId "hdd" en een link naar /deelnemer/TOKEN, en achter die link zat
 * de standaardvragenlijst: het TaPas Business Kompas. Die rijen bevatten dus
 * echte Kompas-antwoorden. Wie ze niet meerekent, laat een board member zijn
 * Kompas een tweede keer invullen. Sinds server/traject-poort.ts kunnen er geen
 * nieuwe bijkomen; de bestaande blijven gelden.
 */
function aanvaardeInstrumenten(instrumentId: string): string[] {
  if (instrumentId === T4P_INSTRUMENT) return [T4P_INSTRUMENT, "hdd"];
  return [instrumentId];
}

/**
 * Zoekt een bestaande afname voor dit lid en dit instrument.
 *
 * Waarom dit nodig is: het token op het lid is de eerste bron, maar een
 * organisatie kan een board member ook los hebben uitgenodigd (of de afname al
 * hebben laten afwerken) voordat het traject werd uitgestuurd. Zonder deze
 * controle maakte start-fase2 dan een tweede, lege afname aan en keek de brug
 * naar de verkeerde rij.
 *
 * Twee sleutels, in deze volgorde. Het e-mailadres van het lid weegt het zwaarst:
 * dat adres is uniek en het bedrijfslabel mag er dan van afwijken, want een
 * beheerder typt dat label zelden twee keer gelijk. Staat er geen adres, dan
 * geldt de naam binnen hetzelfde bedrijfslabel. In beide gevallen wint de
 * jongste rij.
 */
export function zoekBestaandeAfname(
  afnamesVanScope: AfnameKandidaat[],
  lid: { naam: string; email?: string | null },
  instrumentId: string,
  orgLabel: string,
): { id: number; instrumentId: string | null; inviteToken: string | null } | undefined {
  const instrumenten = aanvaardeInstrumenten(instrumentId);
  const metToken = afnamesVanScope.filter(
    (a) => instrumenten.includes(a.instrumentId ?? "") && !!a.inviteToken,
  );
  const jongsteEerst = (rijen: AfnameKandidaat[]) => rijen.sort((a, b) => b.id - a.id)[0];

  const adres = (lid.email ?? "").trim().toLowerCase();
  if (adres) {
    const opAdres = metToken.filter((a) => (a.deelnemerEmail ?? "").trim().toLowerCase() === adres);
    const treffer = jongsteEerst(opAdres);
    if (treffer) return treffer;
  }

  const sleutel = naamSleutel(lid.naam);
  const labelSleutel = naamSleutel(orgLabel);
  const opNaam = metToken.filter(
    (a) =>
      naamSleutel(a.name ?? "") === sleutel &&
      (!labelSleutel || naamSleutel(a.company ?? "") === labelSleutel),
  );
  return jongsteEerst(opNaam);
}

/** Maakt (of hergebruikt) de Teamscan-sessie van dit traject. */
function teamscanSessieVan(traject: HddTraject): number {
  const bestaand = traject.teamscanSessieId;
  if (bestaand && hddStorage.getTeamscanSessie(bestaand)) return bestaand;
  // De sessie krijgt het orgLabel van het traject mee: zo hangt een
  // Teamscan-sessie aan de organisatie van de opdrachtgever in plaats van aan
  // een leeg label.
  const sessieId = hddStorage.maakTeamscanSessie(
    traject.boardNaam,
    traject.orgLabel ?? "",
    traject.platformSessieId ?? undefined,
  );
  hddStorage.setTeamscanSessie(traject.id, sessieId);
  return sessieId;
}

/**
 * Stuurt een fase uit: per lid per instrument een uitnodiging, idempotent.
 *
 * De credits worden hier NIET geboekt; dat doet de route eenmalig via
 * boekTrajectCredits, vóór het uitsturen, zodat een leeg saldo geen halve
 * uitsturing achterlaat.
 */
export async function stuurFaseUit(opties: {
  traject: HddTraject;
  leden: HddBoardLid[];
  fase: number;
  scope: Scope;
  /** Uit verzenderVanVerzoek(req): wie stuurt uit. Komt uit de sessie. */
  verzender: {
    aangemaaktDoorBeheerderId: number | null;
    aangemaaktDoorOrganisatieId: number | null;
  };
  taal?: string;
}): Promise<Omit<UitstuurResultaat, "credits">> {
  const { traject, leden, fase, scope, verzender } = opties;
  const taal = opties.taal ?? "nl";
  const instrumenten = instrumentenVanFase(fase);
  const organisatieId = scope.soort === "organisatie" ? scope.organisatieId : null;

  let teamscanSessieId: number | null = traject.teamscanSessieId ?? null;
  const uitsturingen: LidUitsturing[] = [];

  // Een keer opvragen in plaats van per lid per instrument: deze lijst dient
  // enkel om bestaande afnames te herkennen (zie zoekBestaandeAfname).
  const heeftAfnameInstrument = instrumenten.some((i) => i !== TEAMSCAN_INSTRUMENT);
  const afnamesVanScope = heeftAfnameInstrument ? await storage.listAfnames(scope) : [];

  for (const lid of leden) {
    const bestaandeTokens = hddStorage.getTokens(lid.id);
    const nieuweTokens: Record<string, string> = {};
    const links: UitgestuurdeLink[] = [];

    for (const instrumentId of instrumenten) {
      const bestaand = bestaandeTokens[instrumentId];
      if (bestaand) {
        links.push({ instrumentId, token: bestaand, link: linkVoor(instrumentId, bestaand), nieuw: false });
        continue;
      }

      if (instrumentId === TEAMSCAN_INSTRUMENT) {
        if (!hddStorage.teamscanTabellenAanwezig()) {
          throw new Error(
            "De Teamscan-tabellen ontbreken in dit databestand; Teamscan kan niet uitgestuurd worden.",
          );
        }
        if (teamscanSessieId == null) teamscanSessieId = teamscanSessieVan(traject);
        const deelnemer = hddStorage.maakTeamscanDeelnemer(teamscanSessieId, lid.naam);
        nieuweTokens[instrumentId] = deelnemer.token;
        links.push({
          instrumentId,
          token: deelnemer.token,
          link: linkVoor(instrumentId, deelnemer.token),
          nieuw: true,
        });
        continue;
      }

      // Bestaat er al een afname voor dit lid en dit instrument? Dan nemen we
      // dat token over in plaats van een tweede uitnodiging te maken.
      const bestaandeAfname = zoekBestaandeAfname(
        afnamesVanScope as any,
        { naam: lid.naam, email: lid.email },
        instrumentId,
        traject.orgLabel ?? "",
      );
      if (bestaandeAfname?.inviteToken) {
        const token = bestaandeAfname.inviteToken;
        // Een overgenomen rij van het oude traject-als-vragenlijst draagt nog
        // instrumentId "hdd". Zij bevat Kompas-antwoorden, dus zet het
        // instrument recht: anders blijft een traject in de afnamelijst staan
        // waar een Kompas hoort.
        if (bestaandeAfname.instrumentId !== instrumentId) {
          await storage.updateAfname(bestaandeAfname.id, { instrumentId });
        }
        nieuweTokens[instrumentId] = token;
        links.push({ instrumentId, token, link: linkVoor(instrumentId, token), nieuw: false });
        continue;
      }

      // Gewone afnameweg. Geen storage.reserveer: de trajectprijs is al geboekt.
      const uitnodiging = await storage.maakUitnodiging({
        organisatieId,
        name: lid.naam,
        company: traject.orgLabel ?? null,
        role: null,
        taal,
        instrumentId,
        ...verzender,
      });
      const token = uitnodiging.inviteToken ?? "";
      nieuweTokens[instrumentId] = token;
      links.push({ instrumentId, token, link: linkVoor(instrumentId, token), nieuw: true });
    }

    if (Object.keys(nieuweTokens).length) hddStorage.setTokens(lid.id, nieuweTokens);
    uitsturingen.push({ lidId: lid.id, naam: lid.naam, email: lid.email, links });
  }

  return { fase, instrumenten, teamscanSessieId, leden: uitsturingen };
}

export { CreditError };
