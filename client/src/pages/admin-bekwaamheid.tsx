// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid.tsx — scherm 9.6 uit het bouwplan:
// /admin/bekwaamheid — de regiekamer.
//
// Rondes per fase, de agenda met openstaande posten, ICC per bewijsstuk, de
// KPI's uit sectie 13 van het draaiboek, en de poortsimulatie.
//
// Vier dingen die dit scherm bewust NIET doet.
//
// Het rekent niet. Geen ICC, geen werkdagen, geen aandeel: alles komt gerekend
// uit `GET /api/bekwaamheid/regiekamer`. Een scherm dat zijn eigen KPI's uitrekent,
// is een tweede meting die ooit van de eerste gaat afwijken — en dan is niet meer
// te zeggen welke in het jaarverslag stond.
//
// Het schrijft niet. Er staat geen enkele knop op dit scherm die iets vastlegt.
// Ook de poortsimulatie niet: die vraagt wat de poort zóu doen en laat geen
// spoor, ook niet in het auditlog.
//
// Het verbergt geen leemtes. Fasen zonder rondes, agendasoorten zonder posten en
// bewijsstukken zonder berekenbare ICC blijven staan, met de reden erbij. Een
// regiekamer waarin een lege fase verdwijnt, toont precies niet wat je moet zien.
//
// Het maakt van een puntschatting geen norm. Sectie 13.1 toetst de ICC op de
// ondergrens van het betrouwbaarheidsinterval; dat interval wordt niet berekend.
// Het scherm zegt dat, en zet er geen groen vinkje naast.
// ---------------------------------------------------------------------------
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ChevronLeft, RefreshCw, Play } from "lucide-react";

const API_BASE = (() => {
  const _s = "__PORT_5000__";
  return _s.startsWith("__") ? "" : "/" + _s;
})();

const KLEUR = {
  achtergrond: "#f4f1ec",
  donker: "#14213d",
  accent: "#d8c9a3",
  tekst: "#2c2a26",
  zacht: "#7a7468",
  rand: "#ddd6cb",
  wit: "#ffffff",
  aandacht: "#a12c2c",
};

// ---------------------------------------------------------------------------
// De vorm van het antwoord. Gelijk aan `RegiekamerBeeld` op de server.
// ---------------------------------------------------------------------------

type FaseTelling = { fase: string; aantal: number; vensterVerstreken: number };
type AgendaTelling = {
  soort: string;
  aantal: number;
  oudste: string | null;
  dagenOud: number | null;
};
type Normbeeld = "gehaald" | "niet_gehaald" | "onbeslist";
type IccUitkomst = {
  icc: number | null;
  onder: number | null;
  boven: number | null;
  dossiers: number;
  beoordelaars: number;
  reden: string | null;
  intervalGemeten: boolean;
  intervalReden: string | null;
  normbeeld: Normbeeld | null;
};
type IccRegel = {
  bewijsstukNummer: number;
  uitkomst: IccUitkomst;
  beoordelaarsAfgevallen: number;
  dossiersAfgevallen: number;
  kalibratieScores: number;
  dekkingsgraad: number;
  ontbrekendeCellen: number;
};
type OnvolledigBeoordeeld = {
  bewijsstukNummer: number;
  ontbrekendeCellen: number;
  dekkingsgraad: number;
  iccBerekend: boolean;
};
type TermijnKpi = {
  norm: string;
  gemeten: number;
  binnen: number;
  buiten: number[];
  nogOpen: number;
  aandeel: number | null;
  feestdagen: boolean;
  vervangingsdagen: boolean;
};
type ItembankKpi = {
  items: number;
  metPWaarde: number;
  buitenBereik: number[];
  aandeelBuitenBereik: number | null;
  negatieveDiscriminatie: number[];
  pOndergrens: number;
  pBovengrens: number;
};
type Beeld = {
  peildatum: string;
  rondes: FaseTelling[];
  agenda: AgendaTelling[];
  icc: IccRegel[];
  onvolledigBeoordeeld: OnvolledigBeoordeeld[];
  proces: { debrief: TermijnKpi; publicatie: TermijnKpi; bezwaar: TermijnKpi };
  itembank: ItembankKpi;
  nietGemeten: Array<{ indicator: string; waarom: string }>;
};

type Simulatie = {
  mag: boolean;
  toegestaan: boolean;
  zouWeigeren: boolean;
  grond: string;
  stand: string;
  tekst: string;
  toetsbaar: boolean;
  platformdeelLeemte: boolean;
  watNu: { actie: string; url: string | null };
  peildatum: string;
};

const HANDELINGEN = [
  "afname_aanmaken",
  "uitnodiging_aanmaken",
  "afname_voortzetten",
  "rapport_bekijken",
  "historiek_bekijken",
] as const;

const STANDEN = ["handhaaf", "log", "uit"] as const;

/** Leesbare namen. Alleen presentatie; de sleutels blijven die van de server. */
const FASELABEL: Record<string, string> = {
  voorbereiding: "Voorbereiding",
  open: "Open",
  ingeleverd: "Ingeleverd",
  in_beoordeling: "In beoordeling",
  beslissing_voorstel: "Voorstel",
  overleg: "Overleg",
  beslist: "Beslist",
  gedebrieft: "Gedebrieft",
  afgesloten: "Afgesloten",
  bezwaar: "Bezwaar",
  gestaakt: "Gestaakt",
};

const AGENDALABEL: Record<string, string> = {
  bekrachtiging_verwacht: "Bekrachtiging verwacht",
  tussentijdse_toets_verwacht: "Tussentijdse toets verwacht",
  coachingsplan_evaluatie: "Evaluatie coachingsplan",
  voorwaarde_verloopt: "Voorwaarde verloopt",
  venster_sluit: "Venster sluit",
  debrief_openstaand: "Debrief openstaand",
  bezwaartermijn: "Bezwaartermijn",
  activiteit_onder_drempel: "Activiteit onder de drempel",
};

function datum(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" });
}

function aandeel(waarde: number | null): string {
  if (waarde === null) return "—";
  return `${(waarde * 100).toFixed(0)}%`;
}

/** Twee decimalen, komma als scheidingsteken. Ook bij een negatieve ICC. */
function getal(waarde: number | null): string {
  if (waarde === null || !Number.isFinite(waarde)) return "—";
  return waarde.toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Bouwstenen
// ---------------------------------------------------------------------------

function Kaart({
  titel,
  onderschrift,
  children,
}: {
  titel: string;
  onderschrift?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: KLEUR.wit,
        border: `1px solid ${KLEUR.rand}`,
        borderRadius: 6,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 1.5,
          color: KLEUR.zacht,
          margin: 0,
          fontWeight: 600,
        }}
      >
        {titel}
      </h2>
      {onderschrift && (
        <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "6px 0 0", lineHeight: 1.5 }}>
          {onderschrift}
        </p>
      )}
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

const CEL: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: `1px solid ${KLEUR.rand}`,
  fontSize: 14,
  color: KLEUR.tekst,
  textAlign: "left",
  verticalAlign: "top",
};

const KOP: React.CSSProperties = {
  ...CEL,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: KLEUR.zacht,
  fontWeight: 600,
};

function Tabel({ koppen, children }: { koppen: string[]; children: React.ReactNode }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {koppen.map((k) => (
            <th key={k} style={KOP}>
              {k}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

const VELD: React.CSSProperties = {
  border: `1px solid ${KLEUR.rand}`,
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 14,
  background: KLEUR.wit,
  color: KLEUR.tekst,
  fontFamily: "inherit",
  width: "100%",
};

// ---------------------------------------------------------------------------
// De onderdelen van het beeld
// ---------------------------------------------------------------------------

function Rondes({ regels }: { regels: FaseTelling[] }) {
  const totaal = regels.reduce((s, r) => s + r.aantal, 0);
  return (
    <>
      <Tabel koppen={["Fase", "Rondes", "Venster verstreken"]}>
        {regels.map((r) => (
          <tr key={r.fase} data-testid={`fase-${r.fase}`}>
            <td style={CEL}>{FASELABEL[r.fase] ?? r.fase}</td>
            <td style={{ ...CEL, color: r.aantal === 0 ? KLEUR.zacht : KLEUR.tekst }}>{r.aantal}</td>
            <td
              style={{
                ...CEL,
                color: r.vensterVerstreken > 0 ? KLEUR.aandacht : KLEUR.zacht,
                fontWeight: r.vensterVerstreken > 0 ? 600 : 400,
              }}
            >
              {r.vensterVerstreken}
            </td>
          </tr>
        ))}
      </Tabel>
      <p style={{ fontSize: 13, color: KLEUR.zacht, margin: "12px 0 0" }} data-testid="rondes-totaal">
        {totaal === 0
          ? "Er staan nog geen rondes in het register."
          : `${totaal} ronde${totaal === 1 ? "" : "n"} in totaal.`}
      </p>
    </>
  );
}

function Agenda({ regels }: { regels: AgendaTelling[] }) {
  const totaal = regels.reduce((s, r) => s + r.aantal, 0);
  return (
    <>
      <Tabel koppen={["Soort", "Openstaand", "Oudste datum", "Dagen oud"]}>
        {regels.map((r) => (
          <tr key={r.soort} data-testid={`agenda-${r.soort}`}>
            <td style={CEL}>{AGENDALABEL[r.soort] ?? r.soort}</td>
            <td style={{ ...CEL, color: r.aantal === 0 ? KLEUR.zacht : KLEUR.tekst }}>{r.aantal}</td>
            <td style={CEL}>{datum(r.oudste)}</td>
            <td
              style={{
                ...CEL,
                color: (r.dagenOud ?? 0) > 30 ? KLEUR.aandacht : KLEUR.zacht,
                fontWeight: (r.dagenOud ?? 0) > 30 ? 600 : 400,
              }}
            >
              {r.dagenOud === null ? "—" : r.dagenOud}
            </td>
          </tr>
        ))}
      </Tabel>
      <p style={{ fontSize: 13, color: KLEUR.zacht, margin: "12px 0 0" }} data-testid="agenda-totaal">
        {totaal === 0
          ? "Geen openstaande posten op deze peildatum."
          : `${totaal} openstaande post${totaal === 1 ? "" : "en"} op deze peildatum.`}
      </p>
    </>
  );
}

function Icc({ regels }: { regels: IccRegel[] }) {
  if (regels.length === 0) {
    return (
      <p style={{ fontSize: 14, color: KLEUR.zacht, margin: 0 }} data-testid="icc-leeg">
        Er zijn nog geen scores ingevoerd, dus er is nog niets te vergelijken.
      </p>
    );
  }
  return (
    <>
      <Tabel
        koppen={[
          "Bewijsstuk",
          "ICC(2,1)",
          "95%-interval",
          "Norm §13.1",
          "Blok",
          "Dekking",
          "Kalibratie",
        ]}
      >
        {regels.map((r) => (
          <tr key={r.bewijsstukNummer} data-testid={`icc-${r.bewijsstukNummer}`}>
            <td style={CEL}>Bewijsstuk {r.bewijsstukNummer}</td>
            <td style={{ ...CEL, fontWeight: 600 }} data-testid={`icc-punt-${r.bewijsstukNummer}`}>
              {getal(r.uitkomst.icc)}
              {r.uitkomst.reden && (
                <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: KLEUR.zacht }}>
                  {r.uitkomst.reden}
                </span>
              )}
            </td>
            <td style={CEL} data-testid={`icc-interval-${r.bewijsstukNummer}`}>
              {r.uitkomst.intervalGemeten
                ? `${getal(r.uitkomst.onder)} – ${getal(r.uitkomst.boven)}`
                : "—"}
              {!r.uitkomst.intervalGemeten && r.uitkomst.intervalReden && (
                <span style={{ display: "block", fontSize: 12, color: KLEUR.zacht }}>
                  {r.uitkomst.intervalReden}
                </span>
              )}
            </td>
            <td
              style={{
                ...CEL,
                fontWeight: r.uitkomst.normbeeld === "niet_gehaald" ? 600 : 400,
                color:
                  r.uitkomst.normbeeld === "niet_gehaald"
                    ? KLEUR.aandacht
                    : r.uitkomst.normbeeld === "gehaald"
                      ? KLEUR.tekst
                      : KLEUR.zacht,
              }}
              data-testid={`icc-norm-${r.bewijsstukNummer}`}
            >
              {r.uitkomst.normbeeld === "gehaald"
                ? "gehaald"
                : r.uitkomst.normbeeld === "niet_gehaald"
                  ? "niet gehaald"
                  : r.uitkomst.normbeeld === "onbeslist"
                    ? "onbeslist"
                    : "—"}
            </td>
            <td style={CEL} data-testid={`icc-blok-${r.bewijsstukNummer}`}>
              {r.uitkomst.dossiers} × {r.uitkomst.beoordelaars}
              {r.dossiersAfgevallen + r.beoordelaarsAfgevallen > 0 && (
                <span style={{ display: "block", fontSize: 12, color: KLEUR.zacht }}>
                  buiten het blok: {r.dossiersAfgevallen} dossier(s),{" "}
                  {r.beoordelaarsAfgevallen} beoordelaar(s)
                </span>
              )}
            </td>
            <td style={CEL} data-testid={`icc-dekking-${r.bewijsstukNummer}`}>
              {aandeel(r.dekkingsgraad)}
              {r.ontbrekendeCellen > 0 && (
                <span style={{ display: "block", fontSize: 12, color: KLEUR.zacht }}>
                  {r.ontbrekendeCellen} beoordeling(en) ontbreekt
                </span>
              )}
            </td>
            <td style={CEL}>{r.kalibratieScores}</td>
          </tr>
        ))}
      </Tabel>
      <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "12px 0 0", lineHeight: 1.6 }}>
        Sectie 13.1 normeert de ICC op ≥ .75 <em>op de ondergrens van het
        betrouwbaarheidsinterval</em>. De kolom "Norm §13.1" leest die ondergrens: gehaald wanneer de
        ondergrens .75 of hoger is, niet gehaald wanneer de bovengrens eronder blijft, en anders
        onbeslist — het interval loopt dan over de norm heen en het panel is te klein voor een
        uitspraak. Het interval volgt McGraw en Wong (1996) voor ICC(A,1). Een ICC over één enkel
        dossier bestaat niet; daarom staat de maat per soort bewijsstuk, over de dossiers heen, en
        niet per kandidaat. Er wordt niets berekend onder drie dossiers of twee beoordelaars.
      </p>
      <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "8px 0 0", lineHeight: 1.6 }}>
        De kolom "Blok" toont het grootste volledig beoordeelde blok dat in de matrix te vinden was.
        Wat daarbuiten valt, is niet weggegooid: het staat als openstaand werk onder deze tabel.
        "Dekking" is het aandeel gevulde cellen in de volle matrix, dus vóór die keuze.
      </p>
    </>
  );
}

function Onvolledig({ regels }: { regels: OnvolledigBeoordeeld[] }) {
  if (regels.length === 0) {
    return (
      <p style={{ fontSize: 14, color: KLEUR.zacht, margin: 0 }} data-testid="onvolledig-leeg">
        Elk bewijsstuk met scores is door alle betrokken beoordelaars beoordeeld.
      </p>
    );
  }
  return (
    <>
      <Tabel koppen={["Bewijsstuk", "Ontbrekende beoordelingen", "Dekking", "ICC berekend"]}>
        {regels.map((r) => (
          <tr key={r.bewijsstukNummer} data-testid={`onvolledig-${r.bewijsstukNummer}`}>
            <td style={CEL}>Bewijsstuk {r.bewijsstukNummer}</td>
            <td style={{ ...CEL, fontWeight: 600 }}>{r.ontbrekendeCellen}</td>
            <td style={CEL}>{aandeel(r.dekkingsgraad)}</td>
            <td style={{ ...CEL, color: r.iccBerekend ? KLEUR.tekst : KLEUR.aandacht }}>
              {r.iccBerekend ? "ja, op het volledige blok" : "nee"}
            </td>
          </tr>
        ))}
      </Tabel>
      <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "12px 0 0", lineHeight: 1.6 }}>
        Dit is werk dat nog gedaan moet worden, geen fout in de meting. Zolang een cel leeg blijft,
        draagt dat dossier of die beoordelaar niet bij aan de betrouwbaarheidsmaat. Deze lijst staat
        naast de agenda en niet erin: de agenda voert alleen posten met een eigen termijn.
      </p>
    </>
  );
}

function Termijn({ kpi, sleutel }: { kpi: TermijnKpi; sleutel: string }) {
  const gehaald = kpi.gemeten > 0 && kpi.buiten.length === 0;
  return (
    <tr data-testid={`kpi-${sleutel}`}>
      <td style={CEL}>{kpi.norm}</td>
      <td style={CEL}>{kpi.gemeten}</td>
      <td
        style={{
          ...CEL,
          color: kpi.buiten.length > 0 ? KLEUR.aandacht : gehaald ? KLEUR.tekst : KLEUR.zacht,
          fontWeight: kpi.buiten.length > 0 ? 600 : 400,
        }}
      >
        {aandeel(kpi.aandeel)}
      </td>
      <td style={CEL}>
        {kpi.buiten.length === 0 ? "—" : kpi.buiten.join(", ")}
      </td>
      <td style={CEL}>{kpi.nogOpen}</td>
    </tr>
  );
}

function Proces({ proces }: { proces: Beeld["proces"] }) {
  return (
    <>
      <Tabel koppen={["Norm", "Gemeten", "Binnen de termijn", "Buiten (id)", "Nog open"]}>
        <Termijn kpi={proces.debrief} sleutel="debrief" />
        <Termijn kpi={proces.publicatie} sleutel="publicatie" />
        <Termijn kpi={proces.bezwaar} sleutel="bezwaar" />
      </Tabel>
      <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "12px 0 0", lineHeight: 1.6 }}>
        Werkdagen zijn maandag tot vrijdag, met de tien Belgische wettelijke feestdagen eruit
        gerekend (wet van 4 januari 1974). Pasen en de dagen die eraan hangen worden per jaar
        berekend, dus ook vooruit. Een vervangingsdag voor een feestdag die in het weekend valt, wordt
        per onderneming collectief vastgelegd en is niet te berekenen; die zit hier dus niet in. De
        bezwaartermijn loopt in kalenderdagen en raakt feestdagen daarom niet. "Laatste onderdeel" is
        de jongste inleverdatum van de bewijsstukken in de ronde, niet de datum waarop het panel klaar
        was.
      </p>
    </>
  );
}

function Itembank({ bank }: { bank: ItembankKpi }) {
  return (
    <>
      <Tabel koppen={["Indicator", "Norm", "Gemeten"]}>
        <tr data-testid="kpi-p-waarde">
          <td style={CEL}>
            Items met p &lt; {getal(bank.pOndergrens)} of p &gt; {getal(bank.pBovengrens)}
          </td>
          <td style={CEL}>minder dan 10% van de bank</td>
          <td
            style={{
              ...CEL,
              fontWeight: 600,
              color:
                bank.aandeelBuitenBereik !== null && bank.aandeelBuitenBereik >= 0.1
                  ? KLEUR.aandacht
                  : KLEUR.tekst,
            }}
          >
            {aandeel(bank.aandeelBuitenBereik)}
            <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: KLEUR.zacht }}>
              {bank.buitenBereik.length} van {bank.metPWaarde} items met een p-waarde
            </span>
          </td>
        </tr>
        <tr data-testid="kpi-discriminatie">
          <td style={CEL}>Items met een negatieve item-restcorrelatie</td>
          <td style={CEL}>0 in de scoring</td>
          <td
            style={{
              ...CEL,
              fontWeight: 600,
              color: bank.negatieveDiscriminatie.length > 0 ? KLEUR.aandacht : KLEUR.tekst,
            }}
          >
            {bank.negatieveDiscriminatie.length}
            {bank.negatieveDiscriminatie.length > 0 && (
              <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: KLEUR.zacht }}>
                id: {bank.negatieveDiscriminatie.join(", ")}
              </span>
            )}
          </td>
        </tr>
      </Tabel>
      <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "12px 0 0", lineHeight: 1.6 }}>
        Gemeten over de {bank.items} actieve items. Items die uit de scoring gehaald zijn, tellen niet
        mee: dat is een verholpen tekort, geen openstaand tekort.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// De poortsimulatie
// ---------------------------------------------------------------------------

function Poortsimulatie({ peildatum, instrument }: { peildatum: string; instrument: string }) {
  const [handeling, setHandeling] = useState<string>("afname_aanmaken");
  const [stand, setStand] = useState<string>("handhaaf");
  const [beheerderId, setBeheerderId] = useState("");
  const [organisatieId, setOrganisatieId] = useState("");
  const [uitkomst, setUitkomst] = useState<Simulatie | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const simuleer = useMutation({
    mutationFn: async () => {
      const antwoord = await apiRequest(
        "POST",
        `${API_BASE}/api/bekwaamheid/regiekamer/poortsimulatie`,
        {
          handeling,
          stand,
          peildatum,
          instrumentId: instrument === "" ? null : instrument,
          beheerderId: beheerderId === "" ? null : Number(beheerderId),
          organisatieId: organisatieId === "" ? null : Number(organisatieId),
        },
      );
      const lijf = await antwoord.json();
      if (!antwoord.ok) throw new Error(lijf?.error ?? "De simulatie is niet gelukt.");
      return lijf as Simulatie;
    },
    onSuccess: (u) => {
      setUitkomst(u);
      setFout(null);
    },
    onError: (e: Error) => {
      setUitkomst(null);
      setFout(e.message);
    },
  });

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Handeling</label>
          <select
            value={handeling}
            onChange={(e) => setHandeling(e.target.value)}
            style={VELD}
            data-testid="simulatie-handeling"
          >
            {HANDELINGEN.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Stand</label>
          <select
            value={stand}
            onChange={(e) => setStand(e.target.value)}
            style={VELD}
            data-testid="simulatie-stand"
          >
            {STANDEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Beheerder-id van wie afneemt
          </label>
          <input
            type="text"
            value={beheerderId}
            onChange={(e) => setBeheerderId(e.target.value.replace(/[^0-9]/g, ""))}
            style={VELD}
            data-testid="simulatie-beheerder"
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
            Of organisatie-id
          </label>
          <input
            type="text"
            value={organisatieId}
            onChange={(e) => setOrganisatieId(e.target.value.replace(/[^0-9]/g, ""))}
            style={VELD}
            data-testid="simulatie-organisatie"
          />
        </div>
      </div>

      <Button
        onClick={() => simuleer.mutate()}
        disabled={simuleer.isPending}
        style={{ marginTop: 16, background: KLEUR.donker, color: "#fff" }}
        data-testid="knop-simuleer"
      >
        <Play className="w-4 h-4 mr-1" /> Simuleren
      </Button>

      {fout && (
        <p style={{ color: KLEUR.aandacht, fontSize: 13, marginTop: 12 }} data-testid="simulatie-fout">
          {fout}
        </p>
      )}

      {uitkomst && (
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${KLEUR.rand}`,
            borderRadius: 4,
            padding: 14,
            background: KLEUR.achtergrond,
          }}
          data-testid="simulatie-uitkomst"
        >
          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: KLEUR.donker }}>
            {uitkomst.zouWeigeren
              ? "De poort zou dit weigeren."
              : "De poort zou dit doorlaten."}
          </p>
          <Tabel koppen={["Veld", "Waarde"]}>
            <tr>
              <td style={CEL}>Grond</td>
              <td style={CEL}>{uitkomst.grond}</td>
            </tr>
            <tr>
              <td style={CEL}>Gaat door in deze stand</td>
              <td style={CEL}>{uitkomst.mag ? "ja" : "nee"}</td>
            </tr>
            <tr>
              <td style={CEL}>Zou weigeren bij handhaven</td>
              <td style={CEL}>{uitkomst.zouWeigeren ? "ja" : "nee"}</td>
            </tr>
            <tr>
              <td style={CEL}>Feiten opzoekbaar</td>
              <td style={CEL}>{uitkomst.toetsbaar ? "ja" : "nee"}</td>
            </tr>
            <tr>
              <td style={CEL}>Platformdeel gedefinieerd</td>
              <td style={CEL}>{uitkomst.platformdeelLeemte ? "nee — niet toetsbaar" : "ja"}</td>
            </tr>
            <tr>
              <td style={CEL}>Tekst aan de afnemer</td>
              <td style={CEL}>{uitkomst.tekst}</td>
            </tr>
            <tr>
              <td style={CEL}>Weg vooruit</td>
              <td style={CEL}>{uitkomst.watNu.actie}</td>
            </tr>
          </Tabel>
        </div>
      )}

      <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "14px 0 0", lineHeight: 1.6 }}>
        Een simulatie verandert niets en laat geen spoor, ook niet in het auditlog. De stand hierboven
        overschrijft alleen deze ene vraag; de werkelijke stand van de poort blijft staan.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Het scherm
// ---------------------------------------------------------------------------

export default function AdminBekwaamheid() {
  const vandaag = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [peildatum, setPeildatum] = useState(vandaag);
  const [instrument, setInstrument] = useState("");

  const instrumentenQuery = useQuery({
    queryKey: ["/api/bekwaamheid/normprofiel-instrumenten"],
    queryFn: () =>
      apiRequest("GET", `${API_BASE}/api/bekwaamheid/normprofiel-instrumenten`).then((r) => r.json()),
  });

  const beeldQuery = useQuery({
    queryKey: ["/api/bekwaamheid/regiekamer", peildatum, instrument],
    queryFn: () => {
      const vraag = new URLSearchParams({ peildatum });
      if (instrument !== "") vraag.set("instrument", instrument);
      return apiRequest("GET", `${API_BASE}/api/bekwaamheid/regiekamer?${vraag.toString()}`).then(
        (r) => r.json(),
      );
    },
  });

  const instrumenten: Array<{ instrumentId: string; naam: string }> = Array.isArray(
    instrumentenQuery.data,
  )
    ? instrumentenQuery.data
    : [];

  const beeld: Beeld | null =
    beeldQuery.data && typeof beeldQuery.data === "object" && "rondes" in beeldQuery.data
      ? (beeldQuery.data as Beeld)
      : null;

  return (
    <div className="min-h-screen" style={{ background: KLEUR.achtergrond }}>
      <div style={{ background: KLEUR.donker, padding: "24px 32px" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p
              style={{
                color: KLEUR.accent,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 4,
              }}
            >
              Bekwaamheid
            </p>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>
              De regiekamer
            </h1>
            <p style={{ color: KLEUR.accent, fontSize: 14, marginTop: 4, opacity: 0.8 }}>
              Rondes, agenda, overeenstemming tussen beoordelaars en de poort
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/bekwaamheid/normprofiel">
              <Button
                variant="outline"
                size="sm"
                style={{ borderColor: KLEUR.accent, color: KLEUR.accent, background: "transparent" }}
                data-testid="link-norm"
              >
                De norm
              </Button>
            </Link>
            <Link href="/admin">
              <Button
                variant="outline"
                size="sm"
                style={{ borderColor: KLEUR.accent, color: KLEUR.accent, background: "transparent" }}
                data-testid="link-terug"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Terug naar admin
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto" style={{ padding: "24px 32px 64px" }}>
        <Kaart
          titel="Peilmoment"
          onderschrift="Elke telling op dit scherm hangt aan één datum. De agenda, de verstreken vensters en de leeftijd van een post zijn zonder peildatum niet te lezen."
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Peildatum</label>
              <input
                type="date"
                value={peildatum}
                onChange={(e) => setPeildatum(e.target.value)}
                style={VELD}
                data-testid="veld-peildatum"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Instrument</label>
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                style={VELD}
                data-testid="keuze-instrument"
              >
                <option value="">Alle instrumenten</option>
                {instrumenten.map((i) => (
                  <option key={i.instrumentId} value={i.instrumentId}>
                    {i.naam}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Kaart>

        {beeldQuery.isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: KLEUR.zacht }}>
            <RefreshCw className="w-4 h-4 animate-spin" /> Regiekamer laden…
          </div>
        )}

        {beeldQuery.isError && (
          <p style={{ color: KLEUR.aandacht, fontSize: 14 }} data-testid="beeld-fout">
            Het beeld kon niet worden opgehaald.
          </p>
        )}

        {beeld && (
          <>
            <Kaart
              titel="Rondes per fase"
              onderschrift="Alle elf fasen staan er, ook de lege. Een fase die pas verschijnt zodra er iemand in zit, verbergt precies wat je wil zien."
            >
              <Rondes regels={beeld.rondes} />
            </Kaart>

            <Kaart
              titel="Agenda — openstaande posten"
              onderschrift="Posten met een datum op of vóór de peildatum die nog niet zijn afgehandeld."
            >
              <Agenda regels={beeld.agenda} />
            </Kaart>

            <Kaart
              titel="Overeenstemming tussen beoordelaars"
              onderschrift="Sectie 13.1 van het draaiboek: ICC per bewijsstuk, met het 95%-interval waarop de norm gelezen wordt."
            >
              <Icc regels={beeld.icc} />
            </Kaart>

            <Kaart
              titel="Nog niet volledig beoordeeld"
              onderschrift="Bewijsstukken waar niet elke betrokken beoordelaar een score heeft ingevoerd. Openstaand werk, geen meetfout."
            >
              <Onvolledig regels={beeld.onvolledigBeoordeeld} />
            </Kaart>

            <Kaart
              titel="Kwaliteit van het proces"
              onderschrift="Sectie 13.2 van het draaiboek: de drie termijnen die uit de eigen tabellen te meten zijn."
            >
              <Proces proces={beeld.proces} />
            </Kaart>

            <Kaart
              titel="Kwaliteit van de itembank"
              onderschrift="Sectie 13.1 van het draaiboek: p-waarden en item-restcorrelaties."
            >
              <Itembank bank={beeld.itembank} />
            </Kaart>

            <Kaart
              titel="Poortsimulatie"
              onderschrift="Wat de poort zou doen bij deze handeling, deze afnemer en deze stand — zonder dat er iets gebeurt."
            >
              <Poortsimulatie peildatum={peildatum} instrument={instrument} />
            </Kaart>

            <Kaart
              titel="Niet gemeten"
              onderschrift="Indicatoren uit sectie 13 waarvoor het platform vandaag geen bron heeft. Ze staan hier omdat een leeg vakje leest als 'gehaald'."
            >
              <Tabel koppen={["Indicator", "Waarom niet"]}>
                {beeld.nietGemeten.map((n) => (
                  <tr key={n.indicator} data-testid="niet-gemeten-regel">
                    <td style={CEL}>{n.indicator}</td>
                    <td style={{ ...CEL, color: KLEUR.zacht }}>{n.waarom}</td>
                  </tr>
                ))}
              </Tabel>
            </Kaart>
          </>
        )}
      </div>
    </div>
  );
}
