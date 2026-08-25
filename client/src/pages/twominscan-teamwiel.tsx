import { useEffect, useMemo, useState } from "react";
import { KLEUR, KLEUR_HEX } from "@/twominscan/theme";
import {
  POSITIES,
  KLEURWOORD,
  Temperamentenwiel,
  analyseerTeam,
  initialenVan,
  positieByWielpositie,
  sectorLabel,
  type Inzicht,
  type WielDeelnemer,
} from "@/temperamentenwiel";
import { verkleinAfbeeldingNaarDataUrl } from "@/lib/afbeelding";

// =============================================================================
// 2MINSCAN teamwiel — meerdere afnames samen op één Temperamentenwiel.
// -----------------------------------------------------------------------------
// Twee standen op één pagina:
//   samenstellen  de coach zet de deelnemers klaar (naam + wielpositie, en
//                 optioneel een portret);
//   rapport       vijf printklare pagina's: cover, wiel, deelnemersoverzicht,
//                 teamdynamiek en werkafspraken met slotnuance.
//
// De wielposities komen uit de bestaande 24 profielen; het wiel zelf komt uit
// client/src/temperamentenwiel/ en blijft ongewijzigd bronwaarheid van de mat.
//
// Vooraf gevulde lijst kan via /2minscan/teamwiel?d=<encodeURIComponent(JSON)>
// met { organisatie, datum, deelnemers: [{ naam, wielpositie, rol }] }.
//
// Portretten zijn altijd optioneel. Wie geen foto heeft, staat gewoon zonder
// foto in het rapport: geen leeg kader en geen melding dat er iets ontbreekt.
// =============================================================================

const CONTACT = { web: "www.tapascity.com", mail: "info@tapascity.com" };

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

function leegTeamlid(): Teamlid {
  return { naam: "", rol: "", wielpositie: POSITIES[0].wielpositie, foto: null };
}

function leesPayload(): { organisatie: string; datum: string; leden: Teamlid[] } | null {
  const ruw = new URLSearchParams(window.location.search).get("d");
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
      leden,
    };
  } catch {
    return null;
  }
}

export default function TwominscanTeamwiel() {
  const vooraf = useMemo(leesPayload, []);
  const [organisatie, setOrganisatie] = useState(vooraf?.organisatie ?? "");
  const [datum, setDatum] = useState(vooraf?.datum || new Date().toLocaleDateString("nl-BE"));
  const [leden, setLeden] = useState<Teamlid[]>(
    vooraf?.leden.length ? vooraf.leden : [leegTeamlid(), leegTeamlid(), leegTeamlid()],
  );
  const [modus, setModus] = useState<"samenstellen" | "rapport">(vooraf?.leden.length ? "rapport" : "samenstellen");

  const geldig = leden.filter((l) => l.naam.trim() && positieByWielpositie(l.wielpositie));

  function wijzig(i: number, deel: Partial<Teamlid>) {
    setLeden((cur) => cur.map((l, j) => (j === i ? { ...l, ...deel } : l)));
  }

  return (
    <div className="twominscan-pagina" style={{ minHeight: "100vh", background: modus === "rapport" ? "#e8e6df" : KLEUR.zacht, color: KLEUR.inkt }}>
      <style>{printCss}</style>
      <Balk
        modus={modus}
        setModus={setModus}
        aantal={geldig.length}
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
          naarRapport={() => setModus("rapport")}
        />
      ) : (
        <Teamrapport organisatie={organisatie} datum={datum} leden={geldig} />
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
}: {
  modus: "samenstellen" | "rapport";
  setModus: (m: "samenstellen" | "rapport") => void;
  aantal: number;
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
      <span style={{ fontWeight: 800, color: KLEUR.petrol }}>2MINSCAN · teamwiel</span>
      <span style={{ fontSize: 13, color: "#6b6b6b" }}>{aantal} deelnemer(s) klaar</span>
      <div style={{ flex: 1 }} />
      {modus === "rapport" ? (
        <>
          <Knop soort="rand" onClick={() => setModus("samenstellen")}>
            Deelnemers aanpassen
          </Knop>
          <Knop soort="vol" onClick={() => window.print()}>
            Rapport afdrukken / PDF
          </Knop>
        </>
      ) : (
        <Knop soort="vol" onClick={() => setModus("rapport")} uit={aantal < 2}>
          Toon teamrapport →
        </Knop>
      )}
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
}) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "26px 20px 70px" }}>
      <div style={{ color: KLEUR.goud, fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>TEAMWIEL</div>
      <h1 style={{ color: KLEUR.petrol, fontSize: 34, lineHeight: 1.1, margin: "8px 0 12px", fontWeight: 800 }}>
        Zet de afgenomen 2MINSCANs samen op één wiel
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, maxWidth: 680 }}>
        Vul per deelnemer de naam en de wielpositie in zoals die uit de 2MINSCAN kwam. Het wiel zelf blijft
        onveranderd: elke positie houdt haar eigen kleurvolgorde.
      </p>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "22px 0 10px" }}>
        <Veldje label="Organisatie (optioneel)">
          <input value={organisatie} onChange={(e) => setOrganisatie(e.target.value)} placeholder="bv. Newco" style={veldStijl} />
        </Veldje>
        <Veldje label="Datum">
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
            <Veldje label="Naam">
              <input value={lid.naam} onChange={(e) => wijzig(i, { naam: e.target.value })} placeholder="bv. Ilse Verhoeven" style={{ ...veldStijl, maxWidth: 230 }} />
            </Veldje>
            <Veldje label="Rol (optioneel)">
              <input value={lid.rol} onChange={(e) => wijzig(i, { rol: e.target.value })} placeholder="bv. algemeen directeur" style={{ ...veldStijl, maxWidth: 200 }} />
            </Veldje>
            <Veldje label="Wielpositie">
              <select value={lid.wielpositie} onChange={(e) => wijzig(i, { wielpositie: e.target.value })} style={{ ...veldStijl, maxWidth: 220 }}>
                {POSITIES.map((p) => (
                  <option key={p.wielpositie} value={p.wielpositie}>
                    {p.wielpositie} — {p.acroniem}
                  </option>
                ))}
              </select>
            </Veldje>
            <Veldje label="Foto (optioneel)">
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
              verwijderen
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Knop soort="rand" onClick={() => setLeden((cur) => [...cur, leegTeamlid()])}>
          + Deelnemer toevoegen
        </Knop>
        <Knop soort="vol" onClick={naarRapport} uit={geldigAantal < 2}>
          Toon teamrapport →
        </Knop>
      </div>

      <Fotopaneel leden={leden} wijzig={wijzig} />
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
// Portretten van de website van de organisatie zelf
// ---------------------------------------------------------------------------
// Geen zoektocht over het web: één pagina die de organisatie zelf publiceerde,
// en per persoon een bevestiging door de coach. De server weigert zoekmachines,
// sociale netwerken en fotobanken, en respecteert robots.txt.
function Fotopaneel({
  leden,
  wijzig,
}: {
  leden: Teamlid[];
  wijzig: (i: number, deel: Partial<Teamlid>) => void;
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
      if (!antwoord.ok) throw new Error(data?.error ?? "Kon de pagina niet lezen.");
      setBron(data.bron ?? paginaUrl);
      setKandidaten(Array.isArray(data.kandidaten) ? data.kandidaten : []);
      if (!data.kandidaten?.length) setFout("Op deze pagina staan geen bruikbare portretten.");
    } catch (e: any) {
      setFout(e?.message ?? "Kon de pagina niet lezen.");
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
        {open ? "▾" : "▸"} Portretten van de website van de organisatie
      </button>
      {open ? (
        <>
          <p style={{ fontSize: 13, color: "#5b5b5b", lineHeight: 1.55, maxWidth: 700, marginTop: 10 }}>
            Geef één pagina op die de organisatie zelf publiceerde, bijvoorbeeld de directie- of teampagina. Je krijgt de
            portretten van die pagina te zien en bevestigt zelf welke foto bij wie hoort. Er wordt niet op het web
            gezocht, geen andere pagina gelezen en niets bewaard. De website blijft als bron in het rapport staan. Vraag
            de betrokkenen of ze het goed vinden dat hun foto in dit teamrapport komt; wie dat niet wil, laat je gewoon
            zonder foto.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
            <Veldje label="Pagina op de website van de organisatie">
              <input
                value={paginaUrl}
                onChange={(e) => setPaginaUrl(e.target.value)}
                placeholder="https://www.organisatie.be/over-ons/directie"
                style={{ ...veldStijl, maxWidth: 420 }}
              />
            </Veldje>
            <Knop soort="rand" onClick={zoek} uit={bezig || !paginaUrl.trim()}>
              {bezig ? "Bezig…" : "Portretten ophalen"}
            </Knop>
          </div>
          {fout ? <p style={{ fontSize: 13, color: "#a4462e", marginTop: 10 }}>{fout}</p> : null}

          {kandidaten.length ? (
            <>
            <p style={{ fontSize: 12.5, color: "#6b6b6b", marginTop: 14, marginBottom: 0 }}>
              Bron: {bron} · {kandidaten.length} beeld(en) van deze pagina. Wijs alleen toe wat een portret van die
              persoon is; deze bron komt in het rapport te staan.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginTop: 12 }}>
              {kandidaten.map((k) => (
                <div key={k.url} style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 10, padding: 8 }}>
                  <img src={k.dataUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 6 }} />
                  <div style={{ fontSize: 11.5, color: "#6b6b6b", margin: "6px 0 4px", minHeight: 28, lineHeight: 1.3 }}>
                    {k.naamGok ? `Waarschijnlijk ${k.naamGok}` : k.alt || "Onbekend portret"}
                  </div>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      if (Number.isInteger(i) && i >= 0) wijzig(i, { foto: { src: k.dataUrl, bron } });
                    }}
                    style={{ ...veldStijl, maxWidth: "100%", fontSize: 12.5, padding: "7px 9px" }}
                  >
                    <option value="">Toewijzen aan…</option>
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
function Teamrapport({ organisatie, datum, leden }: { organisatie: string; datum: string; leden: Teamlid[] }) {
  const deelnemers: WielDeelnemer[] = useMemo(
    () => leden.map((l) => ({ naam: l.naam, initialen: initialenVan(l.naam), wielpositie: l.wielpositie })),
    [leden],
  );
  const analyse = useMemo(() => analyseerTeam(deelnemers), [deelnemers]);

  useEffect(() => {
    document.title = organisatie ? `Energetisch teamprofiel — ${organisatie}` : "Energetisch teamprofiel";
  }, [organisatie]);

  if (!analyse) {
    return (
      <div style={{ maxWidth: 700, margin: "40px auto", padding: 20 }}>
        <p>Er zijn minstens twee deelnemers met een geldige wielpositie nodig voor een teamrapport.</p>
      </div>
    );
  }

  return (
    <div className="rapport-doc" style={docStyle}>
      <Cover organisatie={organisatie} datum={datum} aantal={leden.length} />
      <Wielpagina deelnemers={deelnemers} organisatie={organisatie} />
      <Deelnemerspagina leden={leden} organisatie={organisatie} />
      <Dynamiekpagina analyse={analyse} organisatie={organisatie} />
      <Slotpagina analyse={analyse} organisatie={organisatie} />
    </div>
  );
}

function Cover({ organisatie, datum, aantal }: { organisatie: string; datum: string; aantal: number }) {
  return (
    <section className="pagina" style={{ padding: "60px 54px 50px", minHeight: 560, display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 20, color: KLEUR.petrol }}>TaPasCity</span>
        <div style={{ flex: 1, height: 2, background: KLEUR.petrol }} />
      </div>

      <div style={{ marginTop: 70 }}>
        <div style={{ fontFamily: "Arial, sans-serif", color: KLEUR.goud, fontWeight: 800, letterSpacing: 4, fontSize: 14 }}>2MINSCAN</div>
        <h1 style={{ fontFamily: "Arial, sans-serif", fontSize: 52, fontWeight: 800, color: KLEUR.petrol, margin: "6px 0 4px", lineHeight: 1 }}>
          Energetisch
        </h1>
        <h1 style={{ fontFamily: "Arial, sans-serif", fontSize: 52, fontWeight: 800, color: KLEUR.petrol, margin: 0, lineHeight: 1 }}>
          Teamprofiel
        </h1>
        <p style={{ fontStyle: "italic", color: "#5b5b5b", fontSize: 17, marginTop: 14 }}>
          Hoe de energie van dit team samen beweegt
        </p>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 40 }}>
        <div style={{ height: 1, background: KLEUR.lijn, marginBottom: 18 }} />
        {organisatie ? <Veld label="ORGANISATIE" waarde={organisatie} /> : null}
        <Veld label="DATUM" waarde={datum} />
        <Veld label="DEELNEMERS" waarde={String(aantal)} />
        <div style={{ height: 1, background: KLEUR.lijn, margin: "18px 0 10px" }} />
        <div style={{ fontFamily: "Arial, sans-serif", letterSpacing: 2, fontSize: 11.5, color: KLEUR.teal, fontWeight: 700 }}>
          VERTROUWELIJK TEAMRAPPORT
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

function Pagina({ kicker, titel, organisatie, nr, children }: { kicker: string; titel: string; organisatie: string; nr: number; children: React.ReactNode }) {
  return (
    <section className="pagina" style={{ padding: "44px 54px 40px", minHeight: 560, display: "flex", flexDirection: "column", background: "#fff", borderTop: `1px solid ${KLEUR.lijn}` }}>
      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10.5, letterSpacing: 2.5, color: KLEUR.goud, fontWeight: 800 }}>{kicker}</div>
      <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 28, fontWeight: 800, color: KLEUR.petrol, margin: "6px 0 8px", lineHeight: 1.15 }}>{titel}</h2>
      <div style={{ height: 2, background: KLEUR.petrol, marginBottom: 16 }} />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <Voet organisatie={organisatie} nr={nr} />
    </section>
  );
}

function Voet({ organisatie, nr }: { organisatie: string; nr: number }) {
  return (
    <div style={{ marginTop: 22, paddingTop: 10, borderTop: `1px solid ${KLEUR.lijn}`, display: "flex", gap: 12, alignItems: "baseline", fontFamily: "Arial, sans-serif", fontSize: 9, color: "#9a9a9a" }}>
      <span>2MINSCAN · energetisch teamprofiel{organisatie ? ` · ${organisatie}` : ""}</span>
      <span style={{ flex: 1 }} />
      <a href={`https://${CONTACT.web}`} style={{ color: "#9a9a9a", textDecoration: "none" }}>{CONTACT.web}</a>
      <a href={`mailto:${CONTACT.mail}`} style={{ color: "#9a9a9a", textDecoration: "none" }}>{CONTACT.mail}</a>
      <span>{nr}</span>
    </div>
  );
}

function Wielpagina({ deelnemers, organisatie }: { deelnemers: WielDeelnemer[]; organisatie: string }) {
  return (
    <Pagina kicker="HET TEAM OP HET WIEL" titel="Waar ieders energie vandaan komt" organisatie={organisatie} nr={2}>
      <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#4a4a4a", margin: "0 0 10px", maxWidth: 660 }}>
        Elke positie op dit wiel heeft haar eigen kleurvolgorde: de buitenste band is de eerste energie, daarbinnen de
        tweede en de derde, en de kern toont de kleur die energie kost. De initialen staan op de positie die uit de
        2MINSCAN van die persoon kwam.
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

function Deelnemerspagina({ leden, organisatie }: { leden: Teamlid[]; organisatie: string }) {
  const metFoto = leden.some((l) => l.foto);
  return (
    <Pagina kicker="DE DEELNEMERS" titel="Wie staat waar op het wiel" organisatie={organisatie} nr={3}>
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
                  Wielpositie {positie.wielpositie} · {sectorLabel(positie)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
                {positie.volgorde.map((kleur, i) => (
                  <span
                    key={kleur}
                    title={KLEURWOORD[kleur].titel}
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
        De bolletjes volgen de kleurvolgorde van de positie: eerste, tweede en derde energie, en daarna kleiner de kleur
        die energie kost.
      </p>
    </Pagina>
  );
}

const INZICHT_KLEUR: Record<Inzicht["soort"], string> = {
  sterk: "#2f6f5e",
  gat: "#a4462e",
  "let-op": "#8a6d1f",
  wrijving: "#7a4b6b",
};

function Dynamiekpagina({ analyse, organisatie }: { analyse: NonNullable<ReturnType<typeof analyseerTeam>>; organisatie: string }) {
  return (
    <Pagina kicker="TEAMDYNAMIEK" titel="Hoe de energie van dit team samen beweegt" organisatie={organisatie} nr={4}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Cijfer label="Deelnemers" waarde={String(analyse.n)} />
        <Cijfer label="Kleuren aanwezig" waarde={`${analyse.gedektKleuren}/4`} />
        <Cijfer label="Sectoren bezet" waarde={`${analyse.bezetteSectoren}/8`} />
        <Cijfer label="Gem. afstand" waarde={`${analyse.gemAfstand}°`} />
        <Cijfer label="Grootste afstand" waarde={`${analyse.maxAfstand}°`} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["rood", "geel", "groen", "blauw"] as const).map((kleur) => (
          <div key={kleur} style={{ flex: 1, border: `1px solid ${KLEUR.lijn}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: KLEUR_HEX[kleur] ?? "#999" }} />
              <span style={{ fontWeight: 700, fontSize: 12 }}>{KLEURWOORD[kleur].titel}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: KLEUR.petrol, marginTop: 4 }}>{analyse.pct[kleur]}%</div>
            <div style={{ fontSize: 10, color: "#6b6b6b", lineHeight: 1.35 }}>eerste energie · {KLEURWOORD[kleur].kern}</div>
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

function Slotpagina({ analyse, organisatie }: { analyse: NonNullable<ReturnType<typeof analyseerTeam>>; organisatie: string }) {
  return (
    <Pagina kicker="AAN DE SLAG" titel="Werkafspraken die energie sparen" organisatie={organisatie} nr={5}>
      <div style={{ display: "grid", gap: 7 }}>
        {analyse.afspraken.map((afspraak, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: KLEUR.goud, color: "#fff", fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 12, lineHeight: 1.55, color: "#4a4a4a" }}>{afspraak}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, background: "#f4f2ec", borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10.5, letterSpacing: 2, color: KLEUR.teal, fontWeight: 800 }}>
          EERLIJK OVER WAT DIT WEL EN NIET IS
        </div>
        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "8px 0 0" }}>
          De 2MINSCAN vertrekt vanuit Jungiaans geïnspireerde voorkeuren. Die theorie heeft niet dezelfde
          validatiestatus als moderne psychometrische modellen. Toch geeft ze een bruikbare taal om samenwerking en
          energiemanagement bespreekbaar te maken. Dit teamprofiel zegt niets over wie iemand is, over talent of
          potentieel, en het is geen basis voor selectie of beoordeling. Gaat de vraag over het waarom van
          voorkeursgedrag of over talentpotentieel, dan is een TaPas Kompas een zorgvuldiger vervolgstap.
        </p>
        <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#4a4a4a", margin: "10px 0 0" }}>
          Energie is geen vast etiket. Het is een beweging tussen jullie, elkaar en de context waarin jullie werken.
          Blijf bewegen met de energie van dit team door te blijven benoemen wat elk van jullie nodig heeft om erin te
          blijven.
        </p>
      </div>

      <div style={{ marginTop: 16, fontFamily: "Arial, sans-serif", fontSize: 10.5, color: "#6b6b6b" }}>
        2MINSCAN is een product van TaPasCity ·{" "}
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
