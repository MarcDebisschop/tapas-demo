// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid-normprofiel.tsx — scherm 9.5 uit het
// bouwplan: /admin/bekwaamheid/normprofiel — de norm.
//
// Weging, drempels, activiteitsdrempel, methode, panelomschrijving en
// onderbouwing. Na bevriezing volledig read-only, met de knop "nieuwe versie"
// ernaast en een versiehistoriek eronder.
//
// Drie dingen die dit scherm bewust NIET doet.
//
// Het rekent niet. Er staat geen enkele formule in dit bestand: of een weging op
// één sluit, of een onderbouwing lang genoeg is, of een drempel binnen bereik
// valt — dat beslist `valideerNormprofiel` op de server, en het scherm toont wat
// er terugkomt. Een formulier dat zelf meerekent, is een tweede cesuur die
// stilletjes van de eerste gaat afwijken.
//
// Het maakt de read-only stand niet zelf op. Of iets bevroren is, staat in
// `bevrorenOp` uit het antwoord. Zou het scherm daar een eigen vlag naast zetten,
// dan zou een fout in die vlag een bevroren norm weer bewerkbaar maken.
//
// Het biedt geen weg terug. Er is geen ontdooiknop, ook geen verborgene, omdat
// er geen endpoint bestaat dat het kan. Wie de lat wil verleggen, legt een
// nieuwe versie neer; de vorige blijft staan, want de beslissingen die eronder
// genomen zijn verwijzen ernaar.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Lock, Plus, RefreshCw, Snowflake } from "lucide-react";

const API_BASE = (() => {
  const _s = "__PORT_5000__";
  return _s.startsWith("__") ? "" : "/" + _s;
})();

/** De vier assen. Vaste orde, gelijk aan `ASSEN` op de server. */
const ASSEN = ["weten", "zien", "zeggen", "zorgen"] as const;
type As = (typeof ASSEN)[number];

const ASLABEL: Record<As, string> = {
  weten: "Weten",
  zien: "Zien",
  zeggen: "Zeggen",
  zorgen: "Zorgen",
};

const KLEUR = {
  achtergrond: "#f4f1ec",
  donker: "#14213d",
  accent: "#d8c9a3",
  tekst: "#2c2a26",
  zacht: "#7a7468",
  rand: "#ddd6cb",
  wit: "#ffffff",
};

type Normprofiel = {
  id: number;
  instrumentId: string;
  versie: number;
  weging: Record<string, number>;
  drempelTotaal: number;
  drempelPerAs: Record<string, number>;
  activiteitsdrempel: number;
  activiteitsvensterMaanden: number;
  methode: string;
  paneelOmschrijving: string | null;
  vastgesteldOp: string;
  vastgesteldDoor: string;
  bevrorenOp: string | null;
  onderbouwing: string;
};

type Bevinding = { veld: string; melding: string };

type Formulier = {
  weging: Record<As, string>;
  drempelPerAs: Record<As, string>;
  drempelTotaal: string;
  activiteitsdrempel: string;
  activiteitsvensterMaanden: string;
  methode: string;
  paneelOmschrijving: string;
  vastgesteldDoor: string;
  onderbouwing: string;
};

const LEEG: Formulier = {
  weging: { weten: "", zien: "", zeggen: "", zorgen: "" },
  drempelPerAs: { weten: "", zien: "", zeggen: "", zorgen: "" },
  drempelTotaal: "",
  activiteitsdrempel: "",
  activiteitsvensterMaanden: "",
  methode: "",
  paneelOmschrijving: "",
  vastgesteldDoor: "",
  onderbouwing: "",
};

function uitProfiel(p: Normprofiel): Formulier {
  const asWaarden = (bron: Record<string, number>) =>
    Object.fromEntries(ASSEN.map((a) => [a, String(bron?.[a] ?? "")])) as Record<As, string>;
  return {
    weging: asWaarden(p.weging),
    drempelPerAs: asWaarden(p.drempelPerAs),
    drempelTotaal: String(p.drempelTotaal),
    activiteitsdrempel: String(p.activiteitsdrempel),
    activiteitsvensterMaanden: String(p.activiteitsvensterMaanden),
    methode: p.methode,
    paneelOmschrijving: p.paneelOmschrijving ?? "",
    vastgesteldDoor: p.vastgesteldDoor,
    onderbouwing: p.onderbouwing,
  };
}

function datum(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-BE", { day: "2-digit", month: "short", year: "numeric" });
}

/** Percentage voor de leesweergave. Louter presentatie; de norm blijft een breuk. */
function procent(waarde: number | undefined): string {
  if (typeof waarde !== "number" || !Number.isFinite(waarde)) return "—";
  return `${(waarde * 100).toFixed(0)}%`;
}

// ---------------------------------------------------------------------------
// Kleine bouwstenen
// ---------------------------------------------------------------------------

function Kaart({ titel, children }: { titel: string; children: React.ReactNode }) {
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
          margin: "0 0 16px",
          fontWeight: 600,
        }}
      >
        {titel}
      </h2>
      {children}
    </section>
  );
}

function Veldfout({ bevindingen, veld }: { bevindingen: Bevinding[]; veld: string }) {
  const eigen = bevindingen.filter((b) => b.veld === veld);
  if (!eigen.length) return null;
  return (
    <p style={{ color: "#a12c2c", fontSize: 12, margin: "4px 0 0" }} data-testid={`fout-${veld}`}>
      {eigen.map((b) => b.melding).join(" ")}
    </p>
  );
}

function Tekstveld({
  label,
  waarde,
  zet,
  bevindingen,
  veld,
  hint,
  breed,
  regels,
}: {
  label: string;
  waarde: string;
  zet: (v: string) => void;
  bevindingen: Bevinding[];
  veld: string;
  hint?: string;
  breed?: boolean;
  regels?: number;
}) {
  const stijl: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${KLEUR.rand}`,
    borderRadius: 4,
    padding: "8px 10px",
    fontSize: 14,
    color: KLEUR.tekst,
    background: KLEUR.wit,
    fontFamily: "inherit",
  };
  return (
    <div style={{ gridColumn: breed ? "1 / -1" : undefined, marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 13, color: KLEUR.tekst, marginBottom: 4 }}>
        {label}
      </label>
      {regels ? (
        <textarea
          rows={regels}
          value={waarde}
          onChange={(e) => zet(e.target.value)}
          style={stijl}
          data-testid={`veld-${veld}`}
        />
      ) : (
        <input
          type="text"
          value={waarde}
          onChange={(e) => zet(e.target.value)}
          style={stijl}
          data-testid={`veld-${veld}`}
        />
      )}
      {hint && <p style={{ fontSize: 12, color: KLEUR.zacht, margin: "4px 0 0" }}>{hint}</p>}
      <Veldfout bevindingen={bevindingen} veld={veld} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// De read-only weergave van een bevroren norm.
// ---------------------------------------------------------------------------
function BevrorenNorm({ profiel }: { profiel: Normprofiel }) {
  return (
    <div data-testid="norm-bevroren">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "#eef1f7",
          border: `1px solid ${KLEUR.rand}`,
          borderRadius: 4,
          marginBottom: 18,
        }}
      >
        <Lock className="w-4 h-4" style={{ color: KLEUR.donker }} />
        <span style={{ fontSize: 13, color: KLEUR.donker }}>
          Versie {profiel.versie} is bevroren op {datum(profiel.bevrorenOp)} en wijzigt niet.
          Een nieuwe cesuur is een nieuwe versie; deze blijft staan omdat de beslissingen die
          eronder genomen zijn ernaar verwijzen.
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {["As", "Weging", "Drempel"].map((k) => (
              <th
                key={k}
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  borderBottom: `1px solid ${KLEUR.rand}`,
                  color: KLEUR.zacht,
                  fontWeight: 600,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ASSEN.map((as) => (
            <tr key={as}>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                {ASLABEL[as]}
              </td>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                {procent(profiel.weging?.[as])}
              </td>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                {procent(profiel.drempelPerAs?.[as])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px 24px",
          marginTop: 20,
          fontSize: 14,
        }}
      >
        {[
          ["Totaaldrempel", procent(profiel.drempelTotaal)],
          [
            "Activiteitsdrempel",
            `${profiel.activiteitsdrempel} afnames per ${profiel.activiteitsvensterMaanden} maanden`,
          ],
          ["Methode", profiel.methode],
          ["Panel", profiel.paneelOmschrijving || "—"],
          ["Vastgesteld door", profiel.vastgesteldDoor],
          ["Vastgesteld op", datum(profiel.vastgesteldOp)],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt style={{ fontSize: 12, color: KLEUR.zacht, textTransform: "uppercase", letterSpacing: 1 }}>
              {k}
            </dt>
            <dd style={{ margin: "2px 0 0", color: KLEUR.tekst }}>{v}</dd>
          </div>
        ))}
      </dl>

      <div style={{ marginTop: 20 }}>
        <p style={{ fontSize: 12, color: KLEUR.zacht, textTransform: "uppercase", letterSpacing: 1 }}>
          Onderbouwing
        </p>
        <p style={{ margin: "4px 0 0", color: KLEUR.tekst, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {profiel.onderbouwing}
        </p>
      </div>

      <p style={{ fontSize: 12, color: KLEUR.zacht, marginTop: 18 }}>
        De activiteitsdrempel is geen tekortkoming. Wie eronder blijft, komt in de route slapende
        licentie of reactivatie — niet in een beoordeling.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Het scherm
// ---------------------------------------------------------------------------
export default function AdminBekwaamheidNormprofiel() {
  const [instrument, setInstrument] = useState<string>("");
  const [formulier, setFormulier] = useState<Formulier>(LEEG);
  const [bevindingen, setBevindingen] = useState<Bevinding[]>([]);
  const [melding, setMelding] = useState<string | null>(null);
  const [nieuweVersie, setNieuweVersie] = useState(false);

  const instrumentenQuery = useQuery({
    queryKey: ["/api/bekwaamheid/normprofiel-instrumenten"],
    queryFn: () =>
      apiRequest("GET", `${API_BASE}/api/bekwaamheid/normprofiel-instrumenten`).then((r) => r.json()),
  });

  const instrumenten: Array<{
    instrumentId: string;
    naam: string;
    geldendeVersie: number | null;
    aantalVersies: number;
    heeftConcept: boolean;
  }> = instrumentenQuery.data?.instrumenten ?? [];

  useEffect(() => {
    if (!instrument && instrumenten.length) setInstrument(instrumenten[0].instrumentId);
  }, [instrument, instrumenten]);

  const normQuery = useQuery({
    queryKey: ["/api/bekwaamheid/normprofiel", instrument],
    queryFn: () =>
      apiRequest("GET", `${API_BASE}/api/bekwaamheid/normprofiel/${instrument}`).then((r) => r.json()),
    enabled: instrument !== "",
  });

  const concept: Normprofiel | null = normQuery.data?.concept ?? null;
  const geldend: Normprofiel | null = normQuery.data?.geldend ?? null;
  const versies: Normprofiel[] = normQuery.data?.versies ?? [];

  /**
   * Welk profiel het formulier bewerkt.
   *
   * Er is er hoogstens één: een concept. Bestaat dat niet, dan is er niets te
   * wijzigen en legt de gebruiker een nieuwe versie neer.
   */
  const inBewerking = concept;

  useEffect(() => {
    setBevindingen([]);
    setMelding(null);
    setNieuweVersie(false);
    if (concept) setFormulier(uitProfiel(concept));
    else if (geldend) {
      // Een nieuwe versie begint bij de geldende norm, met de onderbouwing leeg:
      // wie de lat verlegt, verantwoordt dat opnieuw en hergebruikt niet de
      // motivering van de vorige cesuur.
      setFormulier({ ...uitProfiel(geldend), onderbouwing: "" });
    } else setFormulier(LEEG);
  }, [instrument, concept?.id, geldend?.id]);

  const bezig =
    instrumentenQuery.isLoading || (instrument !== "" && normQuery.isLoading);

  function lichaamUitFormulier() {
    return {
      instrumentId: instrument,
      weging: formulier.weging,
      drempelPerAs: formulier.drempelPerAs,
      drempelTotaal: formulier.drempelTotaal,
      activiteitsdrempel: formulier.activiteitsdrempel,
      activiteitsvensterMaanden: formulier.activiteitsvensterMaanden,
      methode: formulier.methode,
      paneelOmschrijving: formulier.paneelOmschrijving,
      vastgesteldDoor: formulier.vastgesteldDoor,
      onderbouwing: formulier.onderbouwing,
    };
  }

  function verwerkAntwoord(status: number, lichaam: any): boolean {
    if (status === 422) {
      setBevindingen(lichaam?.bevindingen ?? []);
      setMelding(lichaam?.fout ?? "Het normprofiel is afgekeurd.");
      return false;
    }
    if (status === 409) {
      // Intussen bevroren. Verversen, en het formulier verdwijnt van zichzelf.
      setBevindingen([]);
      setMelding(lichaam?.fout ?? "Dit normprofiel is bevroren en wijzigt niet.");
      return false;
    }
    if (status >= 400) {
      setBevindingen([]);
      setMelding(lichaam?.fout ?? "Er ging iets mis.");
      return false;
    }
    setBevindingen([]);
    return true;
  }

  function verversAlles() {
    queryClient.invalidateQueries({ queryKey: ["/api/bekwaamheid/normprofiel", instrument] });
    queryClient.invalidateQueries({ queryKey: ["/api/bekwaamheid/normprofiel-instrumenten"] });
  }

  const bewaar = useMutation({
    mutationFn: async () => {
      const nieuw = !inBewerking || nieuweVersie;
      const antwoord = nieuw
        ? await apiRequest("POST", `${API_BASE}/api/bekwaamheid/normprofiel`, lichaamUitFormulier())
        : await apiRequest(
            "PATCH",
            `${API_BASE}/api/bekwaamheid/normprofiel/${inBewerking!.id}`,
            lichaamUitFormulier(),
          );
      return { status: antwoord.status, lichaam: await antwoord.json().catch(() => null) };
    },
    onSuccess: ({ status, lichaam }) => {
      if (!verwerkAntwoord(status, lichaam)) {
        if (status === 409) verversAlles();
        return;
      }
      setMelding("Opgeslagen als concept. De norm geldt pas na bevriezing.");
      setNieuweVersie(false);
      verversAlles();
    },
  });

  const bevries = useMutation({
    mutationFn: async (id: number) => {
      const antwoord = await apiRequest(
        "POST",
        `${API_BASE}/api/bekwaamheid/normprofiel/${id}/bevries`,
        { bevestigd: true },
      );
      return { status: antwoord.status, lichaam: await antwoord.json().catch(() => null) };
    },
    onSuccess: ({ status, lichaam }) => {
      if (!verwerkAntwoord(status, lichaam)) {
        verversAlles();
        return;
      }
      setMelding("Bevroren. Deze versie wijzigt niet meer.");
      verversAlles();
    },
  });

  const gekozen = useMemo(
    () => instrumenten.find((i) => i.instrumentId === instrument),
    [instrumenten, instrument],
  );

  function zetAs(soort: "weging" | "drempelPerAs", as: As, waarde: string) {
    setFormulier((f) => ({ ...f, [soort]: { ...f[soort], [as]: waarde } }));
  }

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
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>De norm</h1>
            <p style={{ color: KLEUR.accent, fontSize: 14, marginTop: 4, opacity: 0.8 }}>
              Weging, drempels en onderbouwing per instrument
            </p>
          </div>
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

      <div className="max-w-5xl mx-auto" style={{ padding: "24px 32px 64px" }}>
        {bezig && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: KLEUR.zacht }}>
            <RefreshCw className="w-4 h-4 animate-spin" /> Norm laden…
          </div>
        )}

        {!bezig && (
          <>
            <Kaart titel="Instrument">
              <select
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                style={{
                  width: "100%",
                  border: `1px solid ${KLEUR.rand}`,
                  borderRadius: 4,
                  padding: "8px 10px",
                  fontSize: 14,
                  background: KLEUR.wit,
                  color: KLEUR.tekst,
                }}
                data-testid="keuze-instrument"
              >
                {instrumenten.map((i) => (
                  <option key={i.instrumentId} value={i.instrumentId}>
                    {i.naam}
                    {i.geldendeVersie ? ` — geldend: versie ${i.geldendeVersie}` : " — geen geldende norm"}
                  </option>
                ))}
              </select>
              {gekozen && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <Badge variant="outline">{gekozen.aantalVersies} versie(s)</Badge>
                  {gekozen.geldendeVersie ? (
                    <Badge variant="outline">Geldend: versie {gekozen.geldendeVersie}</Badge>
                  ) : (
                    <Badge variant="outline">Nog geen bevroren cesuur</Badge>
                  )}
                  {gekozen.heeftConcept && <Badge variant="outline">Concept in bewerking</Badge>}
                </div>
              )}
            </Kaart>

            {melding && (
              <div
                style={{
                  padding: "10px 12px",
                  border: `1px solid ${KLEUR.rand}`,
                  borderRadius: 4,
                  background: KLEUR.wit,
                  color: KLEUR.tekst,
                  fontSize: 13,
                  marginBottom: 20,
                }}
                data-testid="melding"
              >
                {melding}
              </div>
            )}

            {/* De geldende, bevroren norm — altijd read-only. */}
            {geldend && (
              <Kaart titel={`Geldende norm — versie ${geldend.versie}`}>
                <BevrorenNorm profiel={geldend} />
                {!concept && !nieuweVersie && (
                  <div style={{ marginTop: 20 }}>
                    <Button
                      size="sm"
                      onClick={() => {
                        setNieuweVersie(true);
                        setFormulier({ ...uitProfiel(geldend), onderbouwing: "" });
                        setMelding(null);
                      }}
                      style={{ background: KLEUR.donker, color: "#fff" }}
                      data-testid="knop-nieuwe-versie"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Nieuwe versie
                    </Button>
                    <p style={{ fontSize: 12, color: KLEUR.zacht, marginTop: 8 }}>
                      Een nieuwe versie begint bij deze waarden. De onderbouwing schrijft u opnieuw.
                    </p>
                  </div>
                )}
              </Kaart>
            )}

            {/* Het formulier. Alleen zichtbaar zolang er iets te bewerken is. */}
            {(concept || nieuweVersie || (!geldend && instrument)) && (
              <Kaart
                titel={
                  concept
                    ? `Concept — versie ${concept.versie}`
                    : geldend
                      ? `Nieuwe versie — wordt versie ${(versies[0]?.versie ?? 0) + 1}`
                      : "Eerste versie"
                }
              >
                <p style={{ fontSize: 13, color: KLEUR.zacht, margin: "0 0 18px" }}>
                  Een concept raakt geen enkele beslissing. De norm geldt pas vanaf het moment
                  van bevriezing.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        color: KLEUR.zacht,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 10,
                      }}
                    >
                      Weging per as
                    </p>
                    {ASSEN.map((as) => (
                      <Tekstveld
                        key={as}
                        label={ASLABEL[as]}
                        waarde={formulier.weging[as]}
                        zet={(v) => zetAs("weging", as, v)}
                        bevindingen={bevindingen}
                        veld={`weging.${as}`}
                      />
                    ))}
                    <Veldfout bevindingen={bevindingen} veld="weging" />
                  </div>

                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        color: KLEUR.zacht,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        marginBottom: 10,
                      }}
                    >
                      Drempel per as
                    </p>
                    {ASSEN.map((as) => (
                      <Tekstveld
                        key={as}
                        label={ASLABEL[as]}
                        waarde={formulier.drempelPerAs[as]}
                        zet={(v) => zetAs("drempelPerAs", as, v)}
                        bevindingen={bevindingen}
                        veld={`drempelPerAs.${as}`}
                      />
                    ))}
                  </div>

                  <Tekstveld
                    label="Totaaldrempel"
                    waarde={formulier.drempelTotaal}
                    zet={(v) => setFormulier((f) => ({ ...f, drempelTotaal: v }))}
                    bevindingen={bevindingen}
                    veld="drempelTotaal"
                    hint="Als breuk, bijvoorbeeld 0,70."
                  />
                  <Tekstveld
                    label="Activiteitsdrempel"
                    waarde={formulier.activiteitsdrempel}
                    zet={(v) => setFormulier((f) => ({ ...f, activiteitsdrempel: v }))}
                    bevindingen={bevindingen}
                    veld="activiteitsdrempel"
                    hint="Aantal afnames binnen het venster. Onderschrijding is geen tekortkoming."
                  />
                  <Tekstveld
                    label="Activiteitsvenster in maanden"
                    waarde={formulier.activiteitsvensterMaanden}
                    zet={(v) => setFormulier((f) => ({ ...f, activiteitsvensterMaanden: v }))}
                    bevindingen={bevindingen}
                    veld="activiteitsvensterMaanden"
                  />
                  <Tekstveld
                    label="Methode"
                    waarde={formulier.methode}
                    zet={(v) => setFormulier((f) => ({ ...f, methode: v }))}
                    bevindingen={bevindingen}
                    veld="methode"
                    hint="Hoe de cesuur tot stand kwam."
                  />
                  <Tekstveld
                    label="Panelomschrijving"
                    waarde={formulier.paneelOmschrijving}
                    zet={(v) => setFormulier((f) => ({ ...f, paneelOmschrijving: v }))}
                    bevindingen={bevindingen}
                    veld="paneelOmschrijving"
                    breed
                    hint="Wie het panel vormde, zonder namen."
                  />
                  <Tekstveld
                    label="Vastgesteld door"
                    waarde={formulier.vastgesteldDoor}
                    zet={(v) => setFormulier((f) => ({ ...f, vastgesteldDoor: v }))}
                    bevindingen={bevindingen}
                    veld="vastgesteldDoor"
                    breed
                  />
                  <Tekstveld
                    label="Onderbouwing"
                    waarde={formulier.onderbouwing}
                    zet={(v) => setFormulier((f) => ({ ...f, onderbouwing: v }))}
                    bevindingen={bevindingen}
                    veld="onderbouwing"
                    breed
                    regels={8}
                    hint={`Minstens 200 tekens. Nu ${formulier.onderbouwing.length}.`}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <Button
                    size="sm"
                    onClick={() => bewaar.mutate()}
                    disabled={bewaar.isPending}
                    style={{ background: KLEUR.donker, color: "#fff" }}
                    data-testid="knop-bewaar"
                  >
                    {concept && !nieuweVersie ? "Concept bijwerken" : "Concept neerleggen"}
                  </Button>

                  {concept && !nieuweVersie && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // De enige onomkeerbare handeling op dit scherm. Vandaar
                        // de bevestiging, en vandaar dat de tekst zegt wat er
                        // gebeurt in plaats van te vragen of u zeker bent.
                        const akkoord = window.confirm(
                          `Versie ${concept.versie} bevriezen? Vanaf dat moment wijzigt ze niet ` +
                            `meer en is er geen weg terug. Een latere aanpassing is een nieuwe versie.`,
                        );
                        if (akkoord) bevries.mutate(concept.id);
                      }}
                      disabled={bevries.isPending}
                      style={{ borderColor: KLEUR.donker, color: KLEUR.donker }}
                      data-testid="knop-bevries"
                    >
                      <Snowflake className="w-4 h-4 mr-1" /> Bevriezen
                    </Button>
                  )}

                  {nieuweVersie && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNieuweVersie(false);
                        setBevindingen([]);
                        setMelding(null);
                      }}
                      style={{ borderColor: KLEUR.rand, color: KLEUR.zacht }}
                      data-testid="knop-staak"
                    >
                      Staken
                    </Button>
                  )}
                </div>
              </Kaart>
            )}

            {/* De historiek. Een bevroren cesuur is alleen te verantwoorden als
                na te lezen is wat er vóór stond. */}
            <Kaart titel="Versiehistoriek">
              {versies.length === 0 ? (
                <p style={{ color: KLEUR.zacht, fontSize: 14, margin: 0 }}>
                  Voor dit instrument bestaat nog geen norm.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr>
                      {["Versie", "Stand", "Totaal", "Activiteit", "Vastgesteld door", "Op"].map((k) => (
                        <th
                          key={k}
                          style={{
                            textAlign: "left",
                            padding: "6px 8px",
                            borderBottom: `1px solid ${KLEUR.rand}`,
                            color: KLEUR.zacht,
                            fontWeight: 600,
                            fontSize: 12,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {versies.map((v) => (
                      <tr key={v.id} data-testid={`historiek-${v.versie}`}>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                          {v.versie}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                          {v.bevrorenOp ? `Bevroren ${datum(v.bevrorenOp)}` : "Concept"}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                          {procent(v.drempelTotaal)}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                          {v.activiteitsdrempel} / {v.activiteitsvensterMaanden} mnd
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                          {v.vastgesteldDoor}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: `1px solid ${KLEUR.rand}` }}>
                          {datum(v.vastgesteldOp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Kaart>
          </>
        )}
      </div>
    </div>
  );
}
