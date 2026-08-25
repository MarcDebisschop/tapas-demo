import { useEffect, useMemo, useState } from "react";
import { KLEUR, KLEUR_HEX } from "@/twominscan/theme";
import { maakT, type Taal, type Vertaler } from "@/twominscan/i18n";
import {
  POSITIES,
  KLEURWOORD,
  Temperamentenwiel,
  aanwezigeKleuren,
  analyseerTeam,
  individueleLezing,
  initialenVan,
  overlegOntwerp,
  positieByWielpositie,
  sectorLabel,
  teamEnergie,
  type EnergieKleur,
  type Inzicht,
  type WielDeelnemer,
} from "@/temperamentenwiel";
import { DEELNEMERS_PER_BLAD, bladenVoor, individueleBladen } from "@/temperamentenwiel/bladen";
import { verkleinAfbeeldingNaarDataUrl } from "@/lib/afbeelding";
import {
  controleerTeamwiel,
  koopTeamwiel,
  type AankoopUitkomst,
} from "@/twominscan/teamwiel-aankoop";
import { TEAMWIEL_CREDITS_STANDAARD } from "@shared/twominscan-teamwiel";

// =============================================================================
// 2MINSCAN teamwiel — meerdere afnames samen op één Temperamentenwiel.
// -----------------------------------------------------------------------------
// Twee standen op één pagina:
//   samenstellen  de coach zet de deelnemers klaar (naam + wielpositie, en
//                 optioneel een portret);
//   rapport       de vaste bladstructuur van het goedgekeurde teamprofiel:
//                 cover, leeswijzer, teamwiel, deelnemersoverzicht, individuele
//                 energie (drie deelnemers per blad), teamdynamiek, in energie
//                 blijven per energiekleur, overleg en afspraken, en tot slot
//                 verantwoorde toepassing. Bij vijf deelnemers zijn dat tien
//                 bladen. De structuur staat vast in BLADEN/bladenVoor() en
//                 wordt door tests/twominscan-teamrapport-bladen.test.ts
//                 bewaakt, zodat er nooit stil bladen kunnen wegvallen.
//
// De wielposities komen uit de bestaande 24 profielen; het wiel zelf komt uit
// client/src/temperamentenwiel/ en blijft ongewijzigd bronwaarheid van de mat.
//
// Vooraf gevulde lijst kan via /2minscan/teamwiel?d=<encodeURIComponent(JSON)>
// met { organisatie, datum, taal, deelnemers: [{ naam, wielpositie, rol }] }.
//
// Portretten zijn altijd optioneel. Wie geen foto heeft, staat gewoon zonder
// foto in het rapport: geen leeg kader en geen melding dat er iets ontbreekt.
//
// AUTOMATISCH INLADEN
//   Wie een 2MINSCAN afrondt, kan die met één knop bewaren voor het teamrapport
//   (server/twominscan/afname-opslag.ts). Het paneel "Deelnemers uit bewaarde
//   afnames" haalt die lijst op, zodat wielposities niet meer overgetypt worden.
//   Lezen vraagt een beheerderssessie; met de hand invullen blijft mogelijk.
//
// TALEN
//   NL, FR en EN. De berekening blijft identiek; alleen de zichtbare tekst gaat
//   door de bestaande 2MINSCAN-vertaallaag (client/src/twominscan/i18n.ts), met
//   het Nederlands als bron en terugval.
// =============================================================================

const CONTACT = { web: "www.tapascity.com", mail: "info@tapascity.com" };

const TEAMTALEN: { code: Taal; label: string }[] = [
  { code: "nl", label: "NL" },
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
];

const DATUM_LOCALE: Record<string, string> = { nl: "nl-BE", fr: "fr-BE", en: "en-GB" };

function normaliseerTaal(ruw: unknown): Taal {
  const kort = String(ruw ?? "").slice(0, 2).toLowerCase();
  return (TEAMTALEN.some((t) => t.code === kort) ? kort : "nl") as Taal;
}

interface Portret {
  src: string;
  bron?: string;
}

interface Teamlid {
  naam: string;
  rol: string;
  wielpositie: string;
  foto: Portret | null;
}

interface FotoKandidaat {
  url: string;
  dataUrl: string;
  alt: string;
  tekst: string;
  naamGok: string | null;
  score: number;
}

interface BewaardeAfname {
  id: number;
  organisatie: string;
  naam: string;
  rol: string;
  egCode: string;
  wielpositie: string;
  taal: string;
  datum: string;
  bewaardOp: string;
}

function leegTeamlid(): Teamlid {
  return { naam: "", rol: "", wielpositie: POSITIES[0].wielpositie, foto: null };
}

function leesPayload(): { organisatie: string; datum: string; taal: Taal; leden: Teamlid[] } | null {
  const params = new URLSearchParams(window.location.search);
  const ruw = params.get("d");
  if (!ruw) return null;
  try {
    const p = JSON.parse(decodeURIComponent(ruw));
    const leden: Teamlid[] = Array.isArray(p?.deelnemers)
      ? p.deelnemers
          .filter((d: any) => positieByWielpositie(String(d?.wielpositie ?? "")))
          .map((d: any) => ({
            naam: String(d?.naam ?? ""),
            rol: String(d?.rol ?? ""),
            wielpositie: String(d.wielpositie),
            foto:
              typeof d?.foto?.src === "string" && /^data:image\//i.test(d.foto.src)
                ? { src: d.foto.src, bron: typeof d.foto.bron === "string" ? d.foto.bron : undefined }
                : null,
          }))
      : [];
    return {
      organisatie: String(p?.organisatie ?? ""),
      datum: String(p?.datum ?? ""),
      taal: normaliseerTaal(p?.taal ?? params.get("taal")),
      leden,
    };
  } catch {
    return null;
  }
}

export default function TwominscanTeamwiel() {
  const vooraf = useMemo(leesPayload, []);
  const [taal, setTaal] = useState<Taal>(vooraf?.taal ?? "nl");
  const tr = useMemo(() => maakT(taal), [taal]);
  const [organisatie, setOrganisatie] = useState(vooraf?.organisatie ?? "");
  const [datum, setDatum] = useState(
    vooraf?.datum || new Date().toLocaleDateString(DATUM_LOCALE[vooraf?.taal ?? "nl"] ?? "nl-BE"),
  );
  const [leden, setLeden] = useState<Teamlid[]>(
    vooraf?.leden.length ? vooraf.leden : [leegTeamlid(), leegTeamlid(), leegTeamlid()],
  );
  const [modus, setModus] = useState<"samenstellen" | "rapport">("samenstellen");

  const geldig = leden.filter((l) => l.naam.trim() && positieByWielpositie(l.wielpositie));

  function wijzig(i: number, deel: Partial<Teamlid>) {
    setLeden((cur) => cur.map((l, j) => (j === i ? { ...l, ...deel } : l)));
  }

  // -------------------------------------------------------------------------
  // AFREKENING
  //   Eén temperamentenwiel kost credits van de organisatie. Het rapport wordt
  //   dus pas getoond nadat de server de aankoop bevestigt (of vaststelt dat
  //   precies deze ploeg al betaald werd). De pagina beslist niets zelf: ze
  //   toont wat de server antwoordt.
  // -------------------------------------------------------------------------
  const [betaald, setBetaald] = useState(false);
  const [aankoop, setAankoop] = useState<AankoopUitkomst | null>(null);
  const [aankoopBezig, setAankoopBezig] = useState(false);

  function deelnemersVoorAankoop() {
    return geldig.map((l) => ({ naam: l.naam.trim(), wielpositie: l.wielpositie }));
  }

  // Klik op "Toon teamrapport": eerst kijken of dit wiel al betaald is. Zo niet,
  // dan verschijnt de aankoopstap; er wordt nooit stil afgeboekt.
  async function vraagRapport() {
    if (geldig.length < 2 || aankoopBezig) return;
    if (betaald) {
      setModus("rapport");
      return;
    }
    setAankoopBezig(true);
    const uitkomst = await controleerTeamwiel(deelnemersVoorAankoop());
    setAankoopBezig(false);
    setAankoop(uitkomst);
    if (uitkomst.vrijgegeven) {
      setBetaald(true);
      setModus("rapport");
    }
  }

  // De bevestigde aankoop: hier wordt het tarief werkelijk afgeboekt.
  async function bevestigAankoop() {
    if (geldig.length < 2 || aankoopBezig) return;
    setAankoopBezig(true);
    const uitkomst = await koopTeamwiel(deelnemersVoorAankoop());
    setAankoopBezig(false);
    setAankoop(uitkomst);
    if (uitkomst.vrijgegeven) {
      setBetaald(true);
      setModus("rapport");
    }
  }

  // Een vooraf gevulde lijst (?d=...) mag het rapport niet gratis openen: ook
  // dan loopt de weg via dezelfde controle.
  useEffect(() => {
    if (vooraf?.leden.length) void vraagRapport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Een gewijzigde ploeg is een ander teamwiel: de eerdere vrijgave vervalt.
  const samenstelling = geldig.map((l) => `${l.naam.trim()}|${l.wielpositie}`).sort().join("\n");
  useEffect(() => {
    setBetaald(false);
    setAankoop(null);
  }, [samenstelling]);

  return (
    <div className="twominscan-pagina" style={{ minHeight: "100vh", background: modus === "rapport" ? "#e8e6df" : KLEUR.zacht, color: KLEUR.inkt }}>
      <style>{printCss}</style>
      <Balk
        modus={modus}
        setModus={setModus}
        aantal={geldig.length}
        tr={tr}
        taal={taal}
        setTaal={setTaal}
        naarRapport={vraagRapport}
        bezig={aankoopBezig}
      />
      {modus === "samenstellen" ? (
        <Samensteller
          organisatie={organisatie}
          setOrganisatie={setOrganisatie}
          datum={datum}
          setDatum={setDatum}
          leden={leden}
          setLeden={setLeden}
          wijzig={wijzig}
          geldigAantal={geldig.length}
          naarRapport={vraagRapport}
          tr={tr}
          aankoop={aankoop}
          aankoopBezig={aankoopBezig}
          bevestigAankoop={bevestigAankoop}
        />
      ) : (
        <Teamrapport organisatie={organisatie} datum={datum} leden={geldig} tr={tr} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Balk
// ---------------------------------------------------------------------------
function Balk({
  modus,
  setModus,
  aantal,
  tr,
  taal,
  setTaal,
  naarRapport,
  bezig,
}: {
  modus: "samenstellen" | "rapport";
  setModus: (m: "samenstellen" | "rapport") => void;
  aantal: number;
  tr: Vertaler;
  taal: Taal;
  setTaal: (t: Taal) => void;
  naarRapport: () => void;
  bezig: boolean;
}) {
  return (
    <div
      className="geen-print"
      style={{
        background: "#fff",
        borderBottom: `1px solid ${KLEUR.lijn}`,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontWeight: 800, color: KLEUR.petrol }}>2MINSCAN · {tr("ui.tw.teamwiel", "teamwiel")}</span>
      <span style={{ fontSize: 13, color: "#6b6b6b" }}>
        {aantal} {tr("ui.tw.klaar", "deelnemer(s) klaar")}
      </span>
      <Taalkeuze taal={taal} setTaal={setTaal} />
      <div style={{ flex: 1 }} />
      {modus === "rapport" ? (
        <>
          <Knop soort="rand" onClick={() => setModus("samenstellen")}>
            {tr("ui.tw.aanpassen", "Deelnemers aanpassen")}
          </Knop>
          <Knop soort="vol" onClick={() => window.print()}>
            {tr("ui.tw.afdrukken", "Rapport afdrukken / PDF")}
          </Knop>
        </>
      ) : (
        <Knop soort="vol" onClick={naarRapport} uit={aantal < 2 || bezig}>
          {tr("ui.tw.toon_rapport", "Toon teamrapport →")}
        </Knop>
      )}
    </div>
  );
}

function Taalkeuze({ taal, setTaal }: { taal: Taal; setTaal: (t: Taal) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {TEAMTALEN.map((optie) => {
        const aan = optie.code === taal;
        return (
          <button
            key={optie.code}
            onClick={() => setTaal(optie.code)}
            aria-pressed={aan}
            style={{
              padding: "5px 10px",
              borderRadius: 7,
              border: `1.5px solid ${aan ? KLEUR.petrol : KLEUR.lijn}`,
              background: aan ? KLEUR.petrol : "transparent",
              color: aan ? "#fff" : KLEUR.petrol,
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {optie.label}
          </button>
        );
      })}
    </div>
  );
}

function Knop({
  children,
  onClick,
  soort,
  uit,
}: {
  children: React.ReactNode;
  onClick: () => void;
  soort: "vol" | "rand";
  uit?: boolean;
}) {
  const vol = soort === "vol";
  return (
    <button
      onClick={onClick}
      disabled={uit}
      style={{
        padding: "9px 16px",
        borderRadius: 9,
        border: `1.5px solid ${KLEUR.petrol}`,
        background: vol ? KLEUR.petrol : "transparent",
        color: vol ? "#fff" : KLEUR.petrol,
        fontWeight: 700,
        fontSize: 13.5,
        cursor: uit ? "not-allowed" : "pointer",
        opacity: uit ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Samensteller
// ---------------------------------------------------------------------------
function Samensteller({
  organisatie,
  setOrganisatie,
  datum,
  setDatum,
  leden,
  setLeden,
  wijzig,
  geldigAantal,
  naarRapport,
  tr,
  aankoop,
  aankoopBezig,
  bevestigAankoop,
}: {
  organisatie: string;
  setOrganisatie: (v: string) => void;
  datum: string;
  setDatum: (v: string) => void;
  leden: Teamlid[];
  setLeden: (fn: (cur: Teamlid[]) => Teamlid[]) => void;
  wijzig: (i: number, deel: Partial<Teamlid>) => void;
  geldigAantal: number;
  naarRapport: () => void;
  tr: Vertaler;
  aankoop: AankoopUitkomst | null;
  aankoopBezig: boolean;
  bevestigAankoop: () => void;
}) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "26px 20px 70px" }}>
      <div style={{ color: KLEUR.goud, fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>
        {tr("ui.tw.kicker", "TEAMWIEL")}
      </div>
      <h1 style={{ color: KLEUR.petrol, fontSize: 34, lineHeight: 1.1, margin: "8px 0 12px", fontWeight: 800 }}>
        {tr("ui.tw.titel", "Zet de afgenomen 2MINSCANs samen op één wiel")}
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, maxWidth: 680 }}>
        {tr(
          "ui.tw.intro",
          "Laad de deelnemers uit de bewaarde afnames, of vul per deelnemer de naam en de wielpositie in zoals die uit de 2MINSCAN kwam. Het wiel zelf blijft onveranderd: elke positie houdt haar eigen kleurvolgorde.",
        )}
      </p>

      <Afnamepaneel setLeden={setLeden} setOrganisatie={setOrganisatie} tr={tr} />

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "22px 0 10px" }}>
        <Veldje label={tr("ui.tw.organisatie", "Organisatie (optioneel)")}>
          <input value={organisatie} onChange={(e) => setOrganisatie(e.target.value)} placeholder="bv. Newco" style={veldStijl} />
        </Veldje>
        <Veldje label={tr("ui.tw.datum", "Datum")}>
          <input value={datum} onChange={(e) => setDatum(e.target.value)} style={veldStijl} />
        </Veldje>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {leden.map((lid, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              border: `1px solid ${KLEUR.lijn}`,
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              gap: 14,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            {lid.foto ? (
              <img
                src={lid.foto.src}
                alt=""
                style={{ width: 48, height: 60, objectFit: "cover", borderRadius: 6, border: `1px solid ${KLEUR.lijn}` }}
              />
            ) : null}
            <Veldje label={tr("ui.tw.naam", "Naam")}>
              <input value={lid.naam} onChange={(e) => wijzig(i, { naam: e.target.value })} placeholder="bv. Ilse Verhoeven" style={{ ...veldStijl, maxWidth: 230 }} />
            </Veldje>
            <Veldje label={tr("ui.tw.rol", "Rol (optioneel)")}>
              <input value={lid.rol} onChange={(e) => wijzig(i, { rol: e.target.value })} placeholder="bv. algemeen directeur" style={{ ...veldStijl, maxWidth: 200 }} />
            </Veldje>
            <Veldje label={tr("ui.tw.wielpositie", "Wielpositie")}>
              <select value={lid.wielpositie} onChange={(e) => wijzig(i, { wielpositie: e.target.value })} style={{ ...veldStijl, maxWidth: 220 }}>
                {POSITIES.map((p) => (
                  <option key={p.wielpositie} value={p.wielpositie}>
                    {p.wielpositie} — {p.acroniem}
                  </option>
                ))}
              </select>
            </Veldje>
            <Veldje label={tr("ui.tw.foto", "Foto (optioneel)")}>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const bestand = e.target.files?.[0];
                  if (!bestand) return;
                  try {
                    wijzig(i, { foto: { src: await verkleinAfbeeldingNaarDataUrl(bestand, 256) } });
                  } catch {
                    wijzig(i, { foto: null });
                  }
                }}
                style={{ fontSize: 12.5, maxWidth: 190 }}
              />
            </Veldje>
            <button
              onClick={() => setLeden((cur) => cur.filter((_, j) => j !== i))}
              style={{ marginLeft: "auto", border: "none", background: "transparent", color: "#a4462e", fontSize: 13, cursor: "pointer" }}
            >
              {tr("ui.tw.verwijderen", "verwijderen")}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Knop soort="rand" onClick={() => setLeden((cur) => [...cur, leegTeamlid()])}>
          {tr("ui.tw.toevoegen", "+ Deelnemer toevoegen")}
        </Knop>
        <Knop soort="vol" onClick={naarRapport} uit={geldigAantal < 2 || aankoopBezig}>
          {tr("ui.tw.toon_rapport", "Toon teamrapport →")}
        </Knop>
        <span style={{ alignSelf: "center", fontSize: 13, color: "#6b6b6b" }}>
          {tr("ui.tw.tarief_hint", "Eén teamwiel kost")}{" "}
          {aankoop?.tarief ?? TEAMWIEL_CREDITS_STANDAARD} credits
        </span>
      </div>

      <Aankooppaneel
        aankoop={aankoop}
        bezig={aankoopBezig}
        bevestig={bevestigAankoop}
        tr={tr}
      />

      <Fotopaneel leden={leden} wijzig={wijzig} tr={tr} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aankooppaneel
//   Verschijnt zodra de server zegt dat dit teamwiel nog niet betaald is. Drie
//   uitkomsten, elk met een eigen weg vooruit: kopen kan, saldo volstaat niet,
//   of er is geen organisatie aangemeld die kan betalen.
// ---------------------------------------------------------------------------
function Aankooppaneel({
  aankoop,
  bezig,
  bevestig,
  tr,
}: {
  aankoop: AankoopUitkomst | null;
  bezig: boolean;
  bevestig: () => void;
  tr: Vertaler;
}) {
  if (!aankoop || aankoop.vrijgegeven) return null;
  const tarief = aankoop.tarief;
  const kanKopen = aankoop.status === "te-koop" && !aankoop.melding;
  return (
    <div
      className="geen-print"
      data-testid="paneel-teamwiel-aankoop"
      style={{
        marginTop: 18,
        background: "#fff",
        border: `1.5px solid ${KLEUR.lijn}`,
        borderRadius: 12,
        padding: "16px 18px",
        maxWidth: 680,
      }}
    >
      <div style={{ fontWeight: 800, color: KLEUR.petrol, fontSize: 15.5 }}>
        {tr("ui.tw.aankoop_titel", "Dit teamwiel wordt met credits betaald")}
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: "8px 0 0" }}>
        {tr(
          "ui.tw.aankoop_uitleg",
          "Een temperamentenwiel is een eigen product: het brengt de afgenomen 2MINSCANs samen in één teamrapport.",
        )}{" "}
        {tr("ui.tw.aankoop_tarief", "Kostprijs:")} <strong>{tarief} credits</strong>.
        {typeof aankoop.saldo === "number" ? (
          <>
            {" "}
            {tr("ui.tw.aankoop_saldo", "Beschikbaar saldo:")} <strong>{aankoop.saldo}</strong>.
          </>
        ) : null}
      </p>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "6px 0 0", color: "#6b6b6b" }}>
        {tr(
          "ui.tw.aankoop_eenmalig",
          "Je betaalt één keer per teamsamenstelling. Hetzelfde wiel opnieuw openen of in een andere taal afdrukken kost niets extra.",
        )}
      </p>
      {aankoop.melding ? (
        <p
          data-testid="tekst-teamwiel-aankoop-fout"
          style={{ fontSize: 14, lineHeight: 1.6, margin: "10px 0 0", color: "#a4462e" }}
        >
          {aankoop.melding}
        </p>
      ) : null}
      {kanKopen ? (
        <div style={{ marginTop: 14 }}>
          <Knop soort="vol" onClick={bevestig} uit={bezig}>
            {bezig
              ? tr("ui.tw.aankoop_bezig", "Bezig met afrekenen")
              : `${tr("ui.tw.aankoop_knop", "Koop dit teamwiel voor")} ${tarief} credits`}
          </Knop>
        </div>
      ) : null}
    </div>
  );
}

function Veldje({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: KLEUR.petrol, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}

const veldStijl: React.CSSProperties = {
  width: "100%",
  maxWidth: 260,
  padding: "9px 12px",
  fontSize: 14.5,
  border: `1px solid ${KLEUR.lijn}`,
  borderRadius: 9,
  background: "#fff",
  outline: "none",
};

// ---------------------------------------------------------------------------
// Deelnemers uit bewaarde afnames
// ---------------------------------------------------------------------------
// De afnames die deelnemers zelf bewaarden na hun 2MINSCAN. Lezen vraagt een
// beheerderssessie: het is een lijst met namen. Wie niet aangemeld is, ziet dat
// en kan gewoon met de hand verder werken.
function Afnamepaneel({
  setLeden,
  setOrganisatie,
  tr,
}: {
  setLeden: (fn: (cur: Teamlid[]) => Teamlid[]) => void;
  setOrganisatie: (v: string) => void;
  tr: Vertaler;
}) {
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [afnames, setAfnames] = useState<BewaardeAfname[]>([]);
  const [organisaties, setOrganisaties] = useState<{ organisatie: string; aantal: number }[]>([]);
  const [gekozenOrg, setGekozenOrg] = useState("");
  const [aangevinkt, setAangevinkt] = useState<Record<number, boolean>>({});

  async function haal(org: string) {
    setBezig(true);
    setFout("");
    try {
      const vraag = org ? `?organisatie=${encodeURIComponent(org)}` : "";
      const antwoord = await fetch(`/api/twominscan/afnames${vraag}`, { credentials: "same-origin" });
      if (antwoord.status === 401 || antwoord.status === 403) {
        throw new Error(
          tr(
            "ui.tw.afnames_aanmelden",
            "Meld je aan als beheerder om de bewaarde afnames te zien. Je kan de deelnemers ook met de hand invullen.",
          ),
        );
      }
      const data = await antwoord.json();
      if (!antwoord.ok) throw new Error(data?.error ?? tr("ui.tw.afnames_fout", "Kon de afnames niet ophalen."));
      setAfnames(Array.isArray(data.afnames) ? data.afnames : []);
      setOrganisaties(Array.isArray(data.organisaties) ? data.organisaties : []);
      setAangevinkt({});
      if (!data.afnames?.length) {
        setFout(tr("ui.tw.afnames_leeg", "Er zijn nog geen afnames bewaard voor deze keuze."));
      }
    } catch (e: any) {
      setAfnames([]);
      setFout(e?.message ?? tr("ui.tw.afnames_fout", "Kon de afnames niet ophalen."));
    } finally {
      setBezig(false);
    }
  }

  function voegToe() {
    const gekozen = afnames.filter((a) => aangevinkt[a.id]);
    if (!gekozen.length) return;
    const nieuw: Teamlid[] = gekozen.map((a) => ({
      naam: a.naam,
      rol: a.rol,
      wielpositie: a.wielpositie,
      foto: null,
    }));
    // Lege rijen uit de begintoestand vervangen; ingevulde rijen blijven staan.
    setLeden((cur) => [...cur.filter((l) => l.naam.trim()), ...nieuw]);
    const org = gekozen.find((a) => a.organisatie)?.organisatie;
    if (org) setOrganisatie(org);
    setAangevinkt({});
  }

  const aantalGekozen = afnames.filter((a) => aangevinkt[a.id]).length;

  return (
    <div style={{ marginTop: 22, background: "#fff", border: `1px solid ${KLEUR.lijn}`, borderRadius: 12, padding: "16px 18px" }}>
      <button
        onClick={() => {
          const nu = !open;
          setOpen(nu);
          if (nu && !afnames.length && !fout) void haal("");
        }}
        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontWeight: 800, color: KLEUR.petrol, fontSize: 15 }}
      >
        {open ? "▾" : "▸"} {tr("ui.tw.afnames_titel", "Deelnemers uit bewaarde afnames")}
      </button>
      {open ? (
        <>
          <p style={{ fontSize: 13, color: "#5b5b5b", lineHeight: 1.55, maxWidth: 700, marginTop: 10 }}>
            {tr(
              "ui.tw.afnames_uitleg",
              "Dit zijn de afnames die deelnemers zelf bewaarden na hun 2MINSCAN. Er is enkel naam, rol, EG-code en wielpositie bewaard — geen antwoorden en geen foto. Vink aan wie in dit teamwiel meegaat.",
            )}
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
            <Veldje label={tr("ui.tw.afnames_org", "Organisatie")}>
              <select
                value={gekozenOrg}
                onChange={(e) => {
                  setGekozenOrg(e.target.value);
                  void haal(e.target.value);
                }}
                style={{ ...veldStijl, maxWidth: 300 }}
              >
                <option value="">{tr("ui.tw.afnames_alle", "Alle organisaties")}</option>
                {organisaties.map((o) => (
                  <option key={o.organisatie || "(leeg)"} value={o.organisatie}>
                    {o.organisatie || tr("ui.tw.afnames_zonder_org", "Zonder organisatie")} ({o.aantal})
                  </option>
                ))}
              </select>
            </Veldje>
            <Knop soort="rand" onClick={() => void haal(gekozenOrg)} uit={bezig}>
              {bezig ? tr("ui.tw.bezig", "Bezig…") : tr("ui.tw.afnames_verversen", "Lijst verversen")}
            </Knop>
            <Knop soort="vol" onClick={voegToe} uit={aantalGekozen === 0}>
              {tr("ui.tw.afnames_toevoegen", "Toevoegen aan het teamwiel")}
              {aantalGekozen ? ` (${aantalGekozen})` : ""}
            </Knop>
          </div>
          {fout ? <p style={{ fontSize: 13, color: "#a4462e", marginTop: 10 }}>{fout}</p> : null}

          {afnames.length ? (
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {afnames.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    border: `1px solid ${KLEUR.lijn}`,
                    borderRadius: 8,
                    padding: "8px 11px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!aangevinkt[a.id]}
                    onChange={(e) => setAangevinkt((cur) => ({ ...cur, [a.id]: e.target.checked }))}
                  />
                  <span style={{ fontWeight: 700 }}>{a.naam}</span>
                  {a.rol ? <span style={{ color: "#6b6b6b" }}>· {a.rol}</span> : null}
                  <span style={{ flex: 1 }} />
                  <span style={{ color: "#6b6b6b" }}>{a.egCode}</span>
                  <span style={{ fontWeight: 700, color: KLEUR.petrol }}>{a.wielpositie}</span>
                  {a.organisatie ? <span style={{ color: "#9a9a9a", fontSize: 11.5 }}>{a.organisatie}</span> : null}
                </label>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portretten van de website van de organisatie zelf
// ---------------------------------------------------------------------------
// Geen zoektocht over het web: één pagina die de organisatie zelf publiceerde,
// en per persoon een bevestiging door de coach. De server weigert zoekmachines,
// sociale netwerken en fotobanken, en respecteert robots.txt.
function Fotopaneel({
  leden,
  wijzig,
  tr,
}: {
  leden: Teamlid[];
  wijzig: (i: number, deel: Partial<Teamlid>) => void;
  tr: Vertaler;
}) {
  const [open, setOpen] = useState(false);
  const [paginaUrl, setPaginaUrl] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [bron, setBron] = useState("");
  const [kandidaten, setKandidaten] = useState<FotoKandidaat[]>([]);

  async function zoek() {
    setBezig(true);
    setFout("");
    setKandidaten([]);
    try {
      const antwoord = await fetch("/api/twominscan/organisatiefotos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paginaUrl, namen: leden.map((l) => l.naam).filter(Boolean) }),
      });
      const data = await antwoord.json();
      if (!antwoord.ok) throw new Error(data?.error ?? tr("ui.tw.foto_fout", "Kon de pagina niet lezen."));
      setBron(data.bron ?? paginaUrl);
      setKandidaten(Array.isArray(data.kandidaten) ? data.kandidaten : []);
      if (!data.kandidaten?.length) {
        setFout(tr("ui.tw.foto_leeg", "Op deze pagina staan geen bruikbare portretten."));
      }
    } catch (e: any) {
      setFout(e?.message ?? tr("ui.tw.foto_fout", "Kon de pagina niet lezen."));
    } finally {
      setBezig(false);
    }
  }

  return (
    <div style={{ marginTop: 30, background: "#fff", border: `1px solid ${KLEUR.lijn}`, borderRadius: 12, padding: "16px 18px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontWeight: 800, color: KLEUR.petrol, fontSize: 15 }}
      >
        {open ? "▾" : "▸"} {tr("ui.tw.foto_titel", "Portretten van de website van de organisatie")}
      </button>
      {open ? (
        <>
          <p style={{ fontSize: 13, color: "#5b5b5b", lineHeight: 1.55, maxWidth: 700, marginTop: 10 }}>
            {tr(
              "ui.tw.foto_uitleg",
              "Geef één pagina op die de organisatie zelf publiceerde, bijvoorbeeld de directie- of teampagina. Je krijgt de portretten van die pagina te zien en bevestigt zelf welke foto bij wie hoort. Er wordt niet op het web gezocht, geen andere pagina gelezen en niets bewaard. De website blijft als bron in het rapport staan. Vraag de betrokkenen of ze het goed vinden dat hun foto in dit teamrapport komt; wie dat niet wil, laat je gewoon zonder foto.",
            )}
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
            <Veldje label={tr("ui.tw.foto_pagina", "Pagina op de website van de organisatie")}>
              <input
                value={paginaUrl}
                onChange={(e) => setPaginaUrl(e.target.value)}
                placeholder="https://www.organisatie.be/over-ons/directie"
                style={{ ...veldStijl, maxWidth: 420 }}
              />
            </Veldje>
            <Knop soort="rand" onClick={zoek} uit={bezig || !paginaUrl.trim()}>
              {bezig ? tr("ui.tw.bezig", "Bezig…") : tr("ui.tw.foto_ophalen", "Portretten ophalen")}
            </Knop>
          </div>
          {fout ? <p style={{ fontSize: 13, color: "#a4462e", marginTop: 10 }}>{fout}</p> : null}

          {kandidaten.length ? (
            <>
            <p style={{ fontSize: 12.5, color: "#6b6b6b", marginTop: 14, marginBottom: 0 }}>
              {tr("ui.tw.foto_bron", "Bron")}: {bron} · {kandidaten.length}{" "}
              {tr(
                "ui.tw.foto_aantal",
                "beeld(en) van deze pagina. Wijs alleen toe wat een portret van die persoon is; deze bron komt in het rapport te staan.",
              )}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
              {kandidaten.map((k) => (
                <div key={k.url} style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 10, padding: 8 }}>
                  <img src={k.dataUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6 }} />
                  <div style={{ fontSize: 11.5, color: "#6b6b6b", margin: "6px 0 4px", minHeight: 28, lineHeight: 1.3 }}>
                    {k.naamGok
                      ? `${tr("ui.tw.foto_waarschijnlijk", "Waarschijnlijk")} ${k.naamGok}`
                      : k.alt || tr("ui.tw.foto_onbekend", "Onbekend portret")}
                  </div>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      if (Number.isInteger(i) && i >= 0) wijzig(i, { foto: { src: k.dataUrl, bron } });
                    }}
                    style={{ ...veldStijl, maxWidth: "100%", fontSize: 12.5, padding: "7px 9px" }}
                  >
                    <option value="">{tr("ui.tw.foto_toewijzen", "Toewijzen aan…")}</option>
                    {leden.map((l, i) =>
                      l.naam.trim() ? (
                        <option key={i} value={i}>
                          {l.naam}
                        </option>
                      ) : null,
                    )}
                  </select>
                </div>
              ))}
            </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rapport
// ---------------------------------------------------------------------------
function Teamrapport({ organisatie, datum, leden, tr }: { organisatie: string; datum: string; leden: Teamlid[]; tr: Vertaler }) {
  const deelnemers: WielDeelnemer[] = useMemo(
    () => leden.map((l) => ({ naam: l.naam, initialen: initialenVan(l.naam), wielpositie: l.wielpositie })),
    [leden],
  );
  const analyse = useMemo(() => analyseerTeam(deelnemers, tr), [deelnemers, tr]);

  const rapportTitel = tr("ui.tw.doc_titel", "Energetisch teamprofiel");
  useEffect(() => {
    document.title = organisatie ? `${rapportTitel} — ${organisatie}` : rapportTitel;
  }, [organisatie, rapportTitel]);

  if (!analyse) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
        <p>
          {tr(
            "ui.tw.te_weinig",
            "Er zijn minstens twee deelnemers met een geldige wielpositie nodig voor een teamrapport.",
          )}
        </p>
      </div>
    );
  }

  // De bladorde komt uit de vaste structuur (client/src/temperamentenwiel/bladen.ts),
  // zodat een blad niet stil kan wegvallen. De nummering volgt die orde.
  const bruikbaar = leden.filter((l) => positieByWielpositie(l.wielpositie));
  const bladen = bladenVoor(bruikbaar.length);
  const aanwezig = aanwezigeKleuren(analyse.dominant);
  let individueelTeller = 0;
  const totaalIndividueel = individueleBladen(bruikbaar.length);

  return (
    <div className="rapport-doc" style={docStyle}>
      {bladen.map((soort, i) => {
        const nr = i + 1;
        switch (soort) {
          case "cover":
            return <Cover key="cover" organisatie={organisatie} datum={datum} aantal={leden.length} tr={tr} />;
          case "leeswijzer":
            return <Leeswijzerpagina key="leeswijzer" organisatie={organisatie} nr={nr} tr={tr} />;
          case "teamwiel":
            return <Wielpagina key="teamwiel" deelnemers={deelnemers} organisatie={organisatie} nr={nr} tr={tr} />;
          case "deelnemers":
            return <Deelnemerspagina key="deelnemers" leden={leden} analyse={analyse} organisatie={organisatie} nr={nr} tr={tr} />;
          case "individueel": {
            const deel = individueelTeller++;
            return (
              <Individueelpagina
                key={`individueel-${deel}`}
                leden={bruikbaar.slice(deel * DEELNEMERS_PER_BLAD, (deel + 1) * DEELNEMERS_PER_BLAD)}
                deelnr={deel + 1}
                totaal={totaalIndividueel}
                organisatie={organisatie}
                nr={nr}
                tr={tr}
              />
            );
          }
          case "dynamiek":
            return <Dynamiekpagina key="dynamiek" analyse={analyse} organisatie={organisatie} nr={nr} tr={tr} />;
          case "kleuren":
            return <Kleurenpagina key="kleuren" analyse={analyse} aanwezig={aanwezig} organisatie={organisatie} nr={nr} tr={tr} />;
          case "overleg":
            return (
              <Overlegpagina
                key="overleg"
                analyse={analyse}
                aanwezig={aanwezig}
                leden={bruikbaar}
                organisatie={organisatie}
                nr={nr}
                tr={tr}
              />
            );
          case "slot":
            return <Slotpagina key="slot" organisatie={organisatie} nr={nr} tr={tr} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function Cover({ organisatie, datum, aantal, tr }: { organisatie: string; datum: string; aantal: number; tr: Vertaler }) {
  return (
    <section className="pagina" style={{ padding: "60px 54px 50px", minHeight: 560, display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 20, color: KLEUR.petrol }}>TaPasCity</span>
        <div style={{ flex: 1, height: 2, background: KLEUR.petrol }} />
      </div>

      <div style={{ marginTop: 70 }}>
        <div style={{ fontFamily: "Arial, sans-serif", color: KLEUR.goud, fontWeight: 800, letterSpacing: 4, fontSize: 14 }}>2MINSCAN</div>
        <h1 style={{ fontFamily: "Arial, sans-serif", fontSize: 52, fontWeight: 800, color: KLEUR.petrol, margin: "6px 0 4px", lineHeight: 1 }}>
          {tr("ui.tw.cover_regel1", "Energetisch")}
        </h1>
        <h1 style={{ fontFamily: "Arial, sans-serif", fontSize: 52, fontWeight: 800, color: KLEUR.petrol, margin: 0, lineHeight: 1 }}>
          {tr("ui.tw.cover_regel2", "Teamprofiel")}
        </h1>
        <p style={{ fontStyle: "italic", color: "#5b5b5b", fontSize: 17, marginTop: 14 }}>
          {tr("ui.tw.cover_onder", "Hoe de energie van dit team samen beweegt")}
        </p>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 40 }}>
        <div style={{ height: 1, background: KLEUR.lijn, marginBottom: 18 }} />
        {organisatie ? <Veld label={tr("ui.tw.label_org", "ORGANISATIE")} waarde={organisatie} /> : null}
        <Veld label={tr("ui.tw.label_datum", "DATUM")} waarde={datum} />
        <Veld label={tr("ui.tw.label_deelnemers", "DEELNEMERS")} waarde={String(aantal)} />
        <div style={{ height: 1, background: KLEUR.lijn, margin: "18px 0 10px" }} />
        <div style={{ fontFamily: "Arial, sans-serif", letterSpacing: 2, fontSize: 11.5, color: KLEUR.teal, fontWeight: 700 }}>
          {tr("ui.tw.vertrouwelijk", "VERTROUWELIJK TEAMRAPPORT")}
        </div>
      </div>
    </section>
  );
}

function Veld({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
      <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: 1.5, color: "#9a9a9a", width: 130, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 700, color: KLEUR.inkt, fontSize: 15 }}>{waarde}</span>
    </div>
  );
}

function Pagina({ kicker, titel, organisatie, nr, tr, children }: { kicker: string; titel: string; organisatie: string; nr: number; tr: Vertaler; children: React.ReactNode }) {
  return (
    <section className="pagina" style={{ padding: "44px 54px 40px", minHeight: 560, display: "flex", flexDirection: "column", background: "#fff", borderTop: `1px solid ${KLEUR.lijn}` }}>
      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10.5, letterSpacing: 2.5, color: KLEUR.goud, fontWeight: 800 }}>{kicker}</div>
      <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 28, fontWeight: 800, color: KLEUR.petrol, margin: "6px 0 8px", lineHeight: 1.15 }}>{titel}</h2>
      <div style={{ height: 2, background: KLEUR.petrol, marginBottom: 16 }} />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <Voet organisatie={organisatie} nr={nr} tr={tr} />
    </section>
  );
}

function Voet({ organisatie, nr, tr }: { organisatie: string; nr: number; tr: Vertaler }) {
  return (
    <div style={{ marginTop: 22, paddingTop: 10, borderTop: `1px solid ${KLEUR.lijn}`, display: "flex", gap: 12, alignItems: "baseline", fontFamily: "Arial, sans-serif", fontSize: 9, color: "#9a9a9a" }}>
      <span>
        2MINSCAN · {tr("ui.tw.voet", "energetisch teamprofiel")}
        {organisatie ? ` · ${organisatie}` : ""}
      </span>
      <span style={{ flex: 1 }} />
      <a href={`https://${CONTACT.web}`} style={{ color: "#9a9a9a", textDecoration: "none" }}>{CONTACT.web}</a>
      <a href={`mailto:${CONTACT.mail}`} style={{ color: "#9a9a9a", textDecoration: "none" }}>{CONTACT.mail}</a>
      <span>{nr}</span>
    </div>
  );
}

function Leeswijzerpagina({ organisatie, nr, tr }: { organisatie: string; nr: number; tr: Vertaler }) {
  const lijstStijl: React.CSSProperties = { margin: "6px 0 0", paddingLeft: 16, fontSize: 11.5, lineHeight: 1.55, color: "#4a4a4a" };
  return (
    <Pagina
      kicker={tr("ui.tw.lees_kicker", "LEESWIJZER")}
      titel={tr("ui.tw.lees_titel", "Wat dit teamwiel wel en niet doet")}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#4a4a4a", margin: "0 0 8px" }}>
        {tr(
          "ui.tw.lees_lead",
          "Elke deelnemer vulde de 2MINSCAN in. Die scan beschrijft geen talent, geen potentieel en geen geschiktheid. Ze beschrijft hoe iemand energie geeft in samenwerking, welke context energie oplevert en waar energie voorspelbaar weglekt.",
        )}
      </p>
      <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "0 0 12px" }}>
        {tr(
          "ui.tw.lees_tekst",
          "Door alle deelnemers samen op één wiel te plaatsen, wordt zichtbaar wat in een team meestal onbenoemd blijft: welke energie hier vanzelf op gang komt, welke energie iemand elke keer bewust moet opbrengen, en tussen wie de grootste afstand zit. Dat zegt iets over de dynamiek van deze groep, niet over de waarde van de mensen erin.",
        )}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: KLEUR.petrol }}>
            {tr("ui.tw.lees_hoe_kop", "Hoe je het wiel leest")}
          </div>
          <ul style={lijstStijl}>
            <li>{tr("ui.tw.lees_hoe_1", "Elke positie op het wiel heeft haar eigen kleurvolgorde. Van buiten naar binnen: eerste, tweede en derde energiekleur, en in het hart de kleur die energie kost.")}</li>
            <li>{tr("ui.tw.lees_hoe_2", "De initialen staan in de positie van die deelnemer.")}</li>
            <li>{tr("ui.tw.lees_hoe_3", "Dichtbij elkaar staan betekent: elkaar snel begrijpen. Ver van elkaar staan betekent: elkaar aanvullen en elkaar sneller energie kosten.")}</li>
            <li>{tr("ui.tw.lees_hoe_4", "Het buitenste getal is de wielpositie, het label ernaast de code van die positie.")}</li>
          </ul>
        </div>
        <div style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px", background: "#f4f2ec" }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: KLEUR.petrol }}>
            {tr("ui.tw.lees_niet_kop", "Wat dit wiel niet doet")}
          </div>
          <ul style={lijstStijl}>
            <li>{tr("ui.tw.lees_niet_1", "Het meet geen talent, potentieel of competentie.")}</li>
            <li>{tr("ui.tw.lees_niet_2", "Het zegt niets over geschiktheid voor een rol of over selectie.")}</li>
            <li>{tr("ui.tw.lees_niet_3", "Het is geen diagnose en geen beschrijving van wie iemand is.")}</li>
            <li>{tr("ui.tw.lees_niet_4", "Het verklaart niet waarom iemand dit voorkeursgedrag toont.")}</li>
          </ul>
        </div>
      </div>
      <div style={{ marginTop: 12, border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: KLEUR.petrol }}>
          {tr("ui.tw.lees_samen_kop", "Waarom energie en teamdynamiek samenhangen")}
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "6px 0 0" }}>
          {tr(
            "ui.tw.lees_samen_tekst",
            "Teamdynamiek is grotendeels een energiekwestie. Waar de energie van mensen samenvalt, gaat het snel en voelt het licht. Waar energie tegen de stroom in moet, ontstaat vertraging, irritatie of stilte, vaak zonder dat iemand het over energie heeft. Dit rapport maakt die beweging bespreekbaar en geeft concrete afspraken, zodat de verschillen in deze groep niet slijten maar renderen.",
          )}
        </p>
      </div>
    </Pagina>
  );
}

function Wielpagina({ deelnemers, organisatie, nr, tr }: { deelnemers: WielDeelnemer[]; organisatie: string; nr: number; tr: Vertaler }) {
  return (
    <Pagina
      kicker={tr("ui.tw.wiel_kicker", "HET TEAM OP HET WIEL")}
      titel={tr("ui.tw.wiel_titel", "Waar ieders energie vandaan komt")}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#4a4a4a", margin: "0 0 10px", maxWidth: 660 }}>
        {tr(
          "ui.tw.wiel_tekst",
          "Elke positie op dit wiel heeft haar eigen kleurvolgorde: de buitenste band is de eerste energie, daarbinnen de tweede en de derde, en de kern toont de kleur die energie kost. De initialen staan op de positie die uit de 2MINSCAN van die persoon kwam.",
        )}
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 470 }}>
          <Temperamentenwiel deelnemers={deelnemers} acroniemen wielposities sectoren />
        </div>
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.55, color: "#6b6b6b", margin: "10px 0 0", textAlign: "center" }}>
        {deelnemers.map((d) => `${d.initialen} = ${d.naam}`).join(" · ")}
      </p>
    </Pagina>
  );
}

function Deelnemerspagina({
  leden,
  analyse,
  organisatie,
  nr,
  tr,
}: {
  leden: Teamlid[];
  analyse: NonNullable<ReturnType<typeof analyseerTeam>>;
  organisatie: string;
  nr: number;
  tr: Vertaler;
}) {
  const metFoto = leden.some((l) => l.foto);
  return (
    <Pagina
      kicker={tr("ui.tw.deel_kicker", "DE DEELNEMERS")}
      titel={tr("ui.tw.deel_titel", "Wie staat waar op het wiel")}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <div style={{ display: "grid", gap: 8 }}>
        {leden.map((lid) => {
          const positie = positieByWielpositie(lid.wielpositie);
          if (!positie) return null;
          return (
            <div
              key={`${lid.naam}-${lid.wielpositie}`}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                border: `1px solid ${KLEUR.lijn}`,
                borderRadius: 8,
                padding: "9px 12px",
              }}
            >
              {lid.foto ? (
                <img
                  src={lid.foto.src}
                  alt={lid.naam}
                  style={{ width: 42, height: 52, objectFit: "cover", borderRadius: 4, border: `1px solid ${KLEUR.lijn}`, flexShrink: 0 }}
                />
              ) : metFoto ? (
                // Zonder foto blijft de rij even breed uitgelijnd, zonder leeg kader
                // of enige aanwijzing dat er iets zou ontbreken.
                <div style={{ width: 42, flexShrink: 0 }} />
              ) : null}
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: KLEUR.petrol,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Arial, sans-serif",
                  fontWeight: 800,
                  fontSize: 12.5,
                  flexShrink: 0,
                }}
              >
                {initialenVan(lid.naam)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: KLEUR.inkt }}>
                  {lid.naam}
                  {lid.rol ? <span style={{ fontWeight: 400, color: "#6b6b6b" }}> · {lid.rol}</span> : null}
                </div>
                <div style={{ fontSize: 11, color: "#6b6b6b", marginTop: 2 }}>
                  {tr("ui.tw.wielpositie_label", "Wielpositie")} {positie.wielpositie} · {sectorLabel(positie, tr)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                {positie.volgorde.map((kleur, i) => (
                  <span
                    key={kleur}
                    title={tr(`wiel.kleur.${kleur}.titel`, KLEURWOORD[kleur].titel)}
                    style={{
                      width: i === 3 ? 9 : 13,
                      height: i === 3 ? 9 : 13,
                      borderRadius: "50%",
                      background: KLEUR_HEX[kleur] ?? "#999",
                      opacity: i === 3 ? 0.5 : 1,
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 10.5, lineHeight: 1.5, color: "#6b6b6b", marginTop: 12 }}>
        {tr(
          "ui.tw.deel_voetnoot",
          "De bolletjes volgen de kleurvolgorde van de positie: eerste, tweede en derde energie, en daarna kleiner de kleur die energie kost.",
        )}
      </p>
      <div style={{ marginTop: 10, background: "#f4f2ec", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: KLEUR.petrol }}>
          {tr("ui.tw.deel_spreiding_kop", "Wat de spreiding van deze groep laat zien")}
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "6px 0 0" }}>
          {vulIn(
            tr(
              "ui.tw.deel_spreiding_tekst",
              "{kleuren} van de 4 energiekleuren komen als eerste kleur voor, verspreid over {sectoren} van de 8 sectoren. De gemiddelde onderlinge afstand op het wiel is {gem}°, de grootste afstand {max}°. Hoe groter die afstand, hoe meer dit team vanzelf verschillende invalshoeken binnenbrengt, en hoe meer expliciete afstemming nodig is om iedereen in energie te houden.",
            ),
            {
              kleuren: analyse.gedektKleuren,
              sectoren: analyse.bezetteSectoren,
              gem: analyse.gemAfstand,
              max: analyse.maxAfstand,
            },
          )}
        </p>
      </div>
    </Pagina>
  );
}

/** Vult {plaatshouders} in een vertaalde tekst. */
function vulIn(sjabloon: string, waarden: Record<string, string | number>): string {
  return sjabloon.replace(/\{(\w+)\}/g, (heel, naam) =>
    Object.prototype.hasOwnProperty.call(waarden, naam) ? String(waarden[naam]) : heel,
  );
}

function Individueelpagina({
  leden,
  deelnr,
  totaal,
  organisatie,
  nr,
  tr,
}: {
  leden: Teamlid[];
  deelnr: number;
  totaal: number;
  organisatie: string;
  nr: number;
  tr: Vertaler;
}) {
  return (
    <Pagina
      kicker={tr("ui.tw.ind_kicker", "PER DEELNEMER")}
      titel={`${tr("ui.tw.ind_titel", "Individuele energie")}${totaal > 1 ? ` (${deelnr}/${totaal})` : ""}`}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <div style={{ display: "grid", gap: 10 }}>
        {leden.map((lid) => {
          const positie = positieByWielpositie(lid.wielpositie);
          if (!positie) return null;
          const lezing = individueleLezing(positie, tr);
          const eerste = KLEUR_HEX[positie.volgorde[0]] ?? "#999";
          const regels: [string, string][] = [
            [tr("ui.tw.ind_stroomt", "Stroomt"), lezing.flow],
            [tr("ui.tw.ind_steunt", "Steunt"), lezing.steun],
            [tr("ui.tw.ind_vraagt", "Vraagt"), lezing.inspanning],
            [tr("ui.tw.ind_lekt", "Lekt"), lezing.kost],
          ];
          return (
            <div
              key={`${lid.naam}-${lid.wielpositie}`}
              style={{
                display: "grid",
                gridTemplateColumns: "138px 1fr",
                gap: 14,
                border: `1px solid ${KLEUR.lijn}`,
                borderLeft: `4px solid ${eerste}`,
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: KLEUR.inkt, lineHeight: 1.25 }}>{lid.naam}</div>
                <div style={{ fontSize: 10.5, color: "#6b6b6b", marginTop: 3 }}>
                  {tr("ui.tw.wielpositie_label", "Wielpositie")} <b>{positie.wielpositie}</b>
                </div>
                <div style={{ fontSize: 10.5, color: "#6b6b6b" }}>{positie.acroniem}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
                  {positie.volgorde.map((kleur, i) => (
                    <span
                      key={kleur}
                      style={{
                        width: i === 3 ? 8 : 11,
                        height: i === 3 ? 8 : 11,
                        borderRadius: "50%",
                        background: KLEUR_HEX[kleur] ?? "#999",
                        opacity: i === 3 ? 0.5 : 1,
                        alignSelf: "center",
                      }}
                    />
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "#8a8a8a", marginTop: 5, lineHeight: 1.35 }}>
                  {sectorLabel(positie, tr)}
                </div>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                {regels.map(([label, tekst]) => (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: 8 }}>
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 9.5, letterSpacing: 1, color: "#8a8a8a", fontWeight: 700, paddingTop: 2 }}>
                      {label.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, lineHeight: 1.5, color: "#4a4a4a" }}>{tekst}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Pagina>
  );
}

const INZICHT_KLEUR: Record<Inzicht["soort"], string> = {
  sterk: "#2f6f5e",
  gat: "#a4462e",
  "let-op": "#8a6d1f",
  wrijving: "#7a4b6b",
};

function Dynamiekpagina({ analyse, organisatie, nr, tr }: { analyse: NonNullable<ReturnType<typeof analyseerTeam>>; organisatie: string; nr: number; tr: Vertaler }) {
  return (
    <Pagina
      kicker={tr("ui.tw.dyn_kicker", "TEAMDYNAMIEK")}
      titel={tr("ui.tw.dyn_titel", "Hoe de energie van dit team samen beweegt")}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Cijfer label={tr("ui.tw.cijfer_deelnemers", "Deelnemers")} waarde={String(analyse.n)} />
        <Cijfer label={tr("ui.tw.cijfer_kleuren", "Kleuren aanwezig")} waarde={`${analyse.gedektKleuren}/4`} />
        <Cijfer label={tr("ui.tw.cijfer_sectoren", "Sectoren bezet")} waarde={`${analyse.bezetteSectoren}/8`} />
        <Cijfer label={tr("ui.tw.cijfer_gem", "Gem. afstand")} waarde={`${analyse.gemAfstand}°`} />
        <Cijfer label={tr("ui.tw.cijfer_max", "Grootste afstand")} waarde={`${analyse.maxAfstand}°`} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["rood", "geel", "groen", "blauw"] as const).map((kleur) => (
          <div key={kleur} style={{ flex: 1, border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: KLEUR_HEX[kleur] ?? "#999" }} />
              <span style={{ fontWeight: 700, fontSize: 12 }}>{tr(`wiel.kleur.${kleur}.titel`, KLEURWOORD[kleur].titel)}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: KLEUR.petrol, marginTop: 4 }}>{analyse.pct[kleur]}%</div>
            <div style={{ fontSize: 10, color: "#6b6b6b", lineHeight: 1.35 }}>
              {tr("ui.tw.eerste_energie", "eerste energie")} · {tr(`wiel.kleur.${kleur}.kern`, KLEURWOORD[kleur].kern)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {analyse.inzichten.map((inzicht, i) => (
          <div key={i} style={{ border: `1px solid ${KLEUR.lijn}`, borderLeft: `3px solid ${INZICHT_KLEUR[inzicht.soort]}`, borderRadius: 6, padding: "9px 12px" }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: KLEUR.inkt }}>{inzicht.titel}</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.55, color: "#4a4a4a", marginTop: 3 }}>{inzicht.tekst}</div>
          </div>
        ))}
      </div>
    </Pagina>
  );
}

function Cijfer({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div style={{ flex: 1, minWidth: 90, background: "#f4f2ec", borderRadius: 8, padding: "9px 11px" }}>
      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 9.5, letterSpacing: 1.2, color: "#8a8a8a", fontWeight: 700 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: KLEUR.petrol, lineHeight: 1.1, marginTop: 2 }}>{waarde}</div>
    </div>
  );
}

function Kleurenpagina({
  analyse,
  aanwezig,
  organisatie,
  nr,
  tr,
}: {
  analyse: NonNullable<ReturnType<typeof analyseerTeam>>;
  aanwezig: EnergieKleur[];
  organisatie: string;
  nr: number;
  tr: Vertaler;
}) {
  return (
    <Pagina
      kicker={tr("ui.tw.kleur_kicker", "OMGAAN MET DE DYNAMIEK")}
      titel={tr("ui.tw.kleur_titel", "In energie blijven, kleur per kleur")}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <p style={{ fontSize: 12, lineHeight: 1.6, color: "#4a4a4a", margin: "0 0 10px" }}>
        {tr(
          "ui.tw.kleur_lead",
          "Elke energie in dit team heeft iets nodig om te blijven stromen, en iets waar ze op leegloopt. Hieronder staat per aanwezige energiekleur wat werkt, wat lekt, welke afspraak helpt en welk signaal je ziet wanneer de energie zakt.",
        )}
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {aanwezig.map((kleur) => {
          const blok = teamEnergie(kleur, tr);
          const regels: [string, string][] = [
            [tr("ui.tw.kleur_geeft", "Geeft"), blok.geeft],
            [tr("ui.tw.kleur_lekt", "Lekt op"), blok.lekt],
            [tr("ui.tw.kleur_afspraak", "Afspraak"), blok.afspraak],
            [tr("ui.tw.kleur_signaal", "Signaal"), blok.signaal],
          ];
          return (
            <div
              key={kleur}
              style={{
                border: `1px solid ${KLEUR.lijn}`,
                borderLeft: `4px solid ${KLEUR_HEX[kleur] ?? "#999"}`,
                borderRadius: 8,
                padding: "9px 12px",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12.5, color: KLEUR.inkt }}>
                {tr(`wiel.kleur.${kleur}.titel`, KLEURWOORD[kleur].titel)}
                <span style={{ fontWeight: 400, color: "#6b6b6b" }}>
                  {" · "}
                  {tr(`wiel.kleur.${kleur}.kern`, KLEURWOORD[kleur].kern)} ·{" "}
                  {vulIn(tr("ui.tw.kleur_aantal", "{n} van {totaal} als eerste kleur"), {
                    n: analyse.dominant[kleur],
                    totaal: analyse.n,
                  })}
                </span>
              </div>
              <div style={{ display: "grid", gap: 3, marginTop: 5 }}>
                {regels.map(([label, tekst]) => (
                  <div key={label} style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: 8 }}>
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 9.5, letterSpacing: 1, color: "#8a8a8a", fontWeight: 700, paddingTop: 2 }}>
                      {label.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, lineHeight: 1.5, color: "#4a4a4a" }}>{tekst}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {analyse.ontbrekend.length ? (
        <div style={{ marginTop: 10, background: "#f4f2ec", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: KLEUR.petrol }}>
            {vulIn(tr("ui.tw.kleur_geen_kop", "Niet aanwezig als eerste kleur: {kleuren}"), {
              kleuren: analyse.ontbrekend
                .map((k) => tr(`wiel.kleur.${k}.laag`, KLEURWOORD[k].titel.toLowerCase()))
                .join(", "),
            })}
          </div>
          <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "5px 0 0" }}>
            {vulIn(
              tr(
                "ui.tw.kleur_geen_tekst",
                "Werk dat vraagt om {kernen} kost dit team energie in plaats van dat het energie geeft. Dat is geen tekort. Het betekent dat je het bewust moet plannen, verdelen en begrenzen, en dat je het niet stilzwijgend bij dezelfde persoon laat landen.",
              ),
              {
                kernen: analyse.ontbrekend
                  .map((k) => tr(`wiel.kleur.${k}.kern`, KLEURWOORD[k].kern))
                  .join(tr("wiel.lijst.of", " of ")),
              },
            )}
          </p>
        </div>
      ) : null}
    </Pagina>
  );
}

function Overlegpagina({
  analyse,
  aanwezig,
  leden,
  organisatie,
  nr,
  tr,
}: {
  analyse: NonNullable<ReturnType<typeof analyseerTeam>>;
  aanwezig: EnergieKleur[];
  leden: Teamlid[];
  organisatie: string;
  nr: number;
  tr: Vertaler;
}) {
  const blokken = overlegOntwerp(aanwezig, tr);
  return (
    <Pagina
      kicker={tr("ui.tw.overleg_kicker", "OMGAAN MET DE DYNAMIEK")}
      titel={tr("ui.tw.overleg_titel", "Samenwerken zonder energie te verliezen")}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <div style={{ fontWeight: 700, fontSize: 12.5, color: KLEUR.petrol, marginBottom: 6 }}>
        {tr("ui.tw.overleg_vorm_kop", "Een overlegvorm die bij deze groep past")}
      </div>
      <div style={{ display: "grid", gap: 4, marginBottom: 14 }}>
        {blokken.map((blok) => (
          <div key={blok.titel} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 10, borderBottom: `1px solid ${KLEUR.lijn}`, paddingBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 11.5, color: KLEUR.inkt }}>{blok.titel}</span>
            <span style={{ fontSize: 11, lineHeight: 1.5, color: "#4a4a4a" }}>{blok.tekst}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: KLEUR.petrol }}>
            {tr("ui.tw.overleg_afspraken_kop", "Vaste afspraken voor dit team")}
          </div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11, lineHeight: 1.55, color: "#4a4a4a" }}>
            {analyse.afspraken.map((afspraak, i) => (
              <li key={i}>{afspraak}</li>
            ))}
          </ul>
        </div>
        <div style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px", background: "#f4f2ec" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: KLEUR.petrol }}>
            {tr("ui.tw.overleg_hygiene_kop", "Energie per persoon, kort")}
          </div>
          <div style={{ display: "grid", gap: 3, marginTop: 6 }}>
            {leden.map((lid) => {
              const positie = positieByWielpositie(lid.wielpositie);
              if (!positie) return null;
              return (
                <div key={`${lid.naam}-${lid.wielpositie}`} style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 10.5, color: KLEUR.inkt }}>{lid.naam.split(" ")[0]}</span>
                  <span style={{ fontSize: 10.5, lineHeight: 1.45, color: "#4a4a4a" }}>
                    {vulIn(tr("ui.tw.overleg_hygiene_regel", "Werkt op {geeft}; loopt leeg op {kost}."), {
                      geeft: tr(`wiel.kleur.${positie.volgorde[0]}.kern`, KLEURWOORD[positie.volgorde[0]].kern),
                      kost: tr(`wiel.kleur.${positie.volgorde[3]}.kern`, KLEURWOORD[positie.volgorde[3]].kern),
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: KLEUR.petrol }}>
          {tr("ui.tw.overleg_momenten_kop", "Drie momenten om dit gesprek te herhalen")}
        </div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11, lineHeight: 1.55, color: "#4a4a4a" }}>
          <li>{tr("ui.tw.overleg_moment_1", "Bij de start van een project: benoem welke energie het meest gevraagd wordt en wie daarvoor in de stroom zit.")}</li>
          <li>{tr("ui.tw.overleg_moment_2", "Halverwege: vraag expliciet waar energie weglekt. Niet of het goed gaat, maar wat op dit moment het meest kost.")}</li>
          <li>{tr("ui.tw.overleg_moment_3", "Na een spanning: leg de spanning naast het wiel. Meestal blijkt het een energieverschil in tempo, detail of contact, en geen kwestie van onwil.")}</li>
        </ul>
      </div>
    </Pagina>
  );
}

function Slotpagina({ organisatie, nr, tr }: { organisatie: string; nr: number; tr: Vertaler }) {
  return (
    <Pagina
      kicker={tr("ui.tw.slot_kicker2", "TOT SLOT")}
      titel={tr("ui.tw.slot_titel2", "Verantwoorde toepassing")}
      organisatie={organisatie}
      nr={nr}
      tr={tr}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: KLEUR.petrol }}>{tr("ui.tw.slot_wel_kop", "Wel gebruiken voor")}</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11, lineHeight: 1.55, color: "#4a4a4a" }}>
            <li>{tr("ui.tw.slot_wel_1", "gesprek over samenwerking en energie")}</li>
            <li>{tr("ui.tw.slot_wel_2", "overlegvormen en werkafspraken")}</li>
            <li>{tr("ui.tw.slot_wel_3", "begrijpen waar spanning vandaan komt")}</li>
            <li>{tr("ui.tw.slot_wel_4", "bewust omgaan met eigen energie")}</li>
          </ul>
        </div>
        <div style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "10px 12px", background: "#f4f2ec" }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: KLEUR.petrol }}>{tr("ui.tw.slot_niet_kop", "Niet gebruiken voor")}</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11, lineHeight: 1.55, color: "#4a4a4a" }}>
            <li>{tr("ui.tw.slot_niet_1", "selectie, promotie of beoordeling")}</li>
            <li>{tr("ui.tw.slot_niet_2", "uitspraken over talent of potentieel")}</li>
            <li>{tr("ui.tw.slot_niet_3", "diagnose of persoonlijkheidsoordeel")}</li>
            <li>{tr("ui.tw.slot_niet_4", "vaste labels op mensen plakken")}</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 12, background: "#f4f2ec", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10.5, letterSpacing: 2, color: KLEUR.teal, fontWeight: 800 }}>
          {tr("ui.tw.eerlijk_kop", "EERLIJK OVER WAT DIT WEL EN NIET IS")}
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "8px 0 0" }}>
          {tr(
            "ui.tw.eerlijk_1",
            "De 2MINSCAN vertrekt vanuit Jungiaans geïnspireerde voorkeuren. Die theorie heeft niet dezelfde validatiestatus als moderne psychometrische modellen. Toch geeft ze een bruikbare taal om samenwerking en energiemanagement bespreekbaar te maken. Dit teamprofiel zegt niets over wie iemand is, over talent of potentieel, en het is geen basis voor selectie of beoordeling. Gaat de vraag over het waarom van voorkeursgedrag of over talentpotentieel, dan is een TaPas Kompas een zorgvuldiger vervolgstap.",
          )}
        </p>
        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "10px 0 0" }}>
          {tr(
            "ui.tw.eerlijk_2",
            "Energie is geen vast etiket. Het is een beweging tussen jullie, elkaar en de context waarin jullie werken. Blijf bewegen met de energie van dit team door te blijven benoemen wat elk van jullie nodig heeft om erin te blijven.",
          )}
        </p>
      </div>

      <div style={{ marginTop: 16, fontFamily: "Arial, sans-serif", fontSize: 10.5, color: "#6b6b6b" }}>
        {tr("ui.tw.product", "2MINSCAN is een product van TaPasCity")} ·{" "}
        <a href={`https://${CONTACT.web}`} style={{ color: KLEUR.teal, textDecoration: "none" }}>{CONTACT.web}</a> ·{" "}
        <a href={`mailto:${CONTACT.mail}`} style={{ color: KLEUR.teal, textDecoration: "none" }}>{CONTACT.mail}</a>
      </div>
    </Pagina>
  );
}

const docStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  background: "#fff",
  boxShadow: "0 2px 18px rgba(0,0,0,.08)",
};

const printCss = `
@page { size: A4; margin: 0; }
@media print {
  .geen-print { display: none !important; }
  body { background: #fff !important; }
  .rapport-doc { max-width: none !important; margin: 0 !important; box-shadow: none !important; }
  .pagina { page-break-after: always; break-after: page; border-top: none !important; }
  .pagina:last-child { page-break-after: auto; break-after: auto; }
}
`;
