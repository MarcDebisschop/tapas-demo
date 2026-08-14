// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid-beslissingen.tsx — levering 6 uit het
// vervolgplan: /admin/bekwaamheid/beslissingen — voorstel, beslissing, bezwaar.
//
// Dit scherm laat de scheiding zien waar de hele module op rust: de motor doet
// een voorstel, twee mensen beslissen, en wijkt hun beslissing af van het
// voorstel, dan schrijven ze op waarom. Links het gerekende voorstel met de
// asscores en het activiteitsbeeld eronder; rechts het formulier waarin een mens
// vastlegt wat besloten is.
//
// Vijf dingen die dit scherm bewust NIET doet.
//
// Het rekent geen voorstel. De uitkomst, de asscores, het activiteitsbeeld en de
// toegepaste regels komen van de server. Zou de browser meerekenen, dan kon wat
// op het scherm stond afwijken van wat als `voorstel_berekening` in de databank
// belandt, en dan is bij een bezwaar niet meer vast te stellen op welke cijfers
// de beslissing rustte.
//
// Het vult de beslissing niet vooraf in met het voorstel. De keuze staat leeg.
// Wie een voorgevulde keuze ziet, drukt op bevestigen; dan is de menselijke
// beslissing een formaliteit geworden en had de motor net zo goed zelf kunnen
// beslissen.
//
// Het draait de volgorde niet om. Publiceren kan pas na het debriefgesprek. De
// betrokkene hoort de uitkomst van een mens, niet uit een dossier dat al open
// stond voor het gesprek plaatsvond.
//
// Het verbergt de motivering niet. Wijkt de beslissing af, dan is het veld
// verplicht en blijft de tekst in het dossier staan.
//
// Het beoordeelt geen bezwaar. Het legt de ontvangst vast en later de uitspraak
// met haar motivering; het weegt niet mee of het bezwaar terecht is.
// ---------------------------------------------------------------------------
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft } from "lucide-react";
import {
  Cel,
  Invoer,
  Kaart,
  Keuze,
  KLEUR,
  Knop,
  Leeg,
  Melding,
  Tabel,
  Tekstvak,
  Veld,
  datum,
  leesbaar,
} from "@/components/bekwaamheid-kader";

// Gelijk aan BESLISUITKOMSTEN in server/bekwaamheid/schema.ts. `beeindigd` staat
// er wel bij: een mens mag die uitkomst nemen, de motor stelt hem nooit voor.
const UITKOMSTEN = [
  { waarde: "bekrachtigd", tekst: "Bekrachtigd" },
  { waarde: "bekrachtigd_met_aandachtspunt", tekst: "Bekrachtigd met aandachtspunt" },
  { waarde: "voorwaardelijk", tekst: "Voorwaardelijk" },
  { waarde: "opgeschort", tekst: "Opgeschort" },
  { waarde: "beeindigd", tekst: "Beëindigd" },
] as const;

const UITSPRAKEN = [
  { waarde: "gegrond", tekst: "Gegrond" },
  { waarde: "deels_gegrond", tekst: "Deels gegrond" },
  { waarde: "ongegrond", tekst: "Ongegrond" },
] as const;

type Beslissing = {
  id: number;
  rondeId: number;
  voorstelUitkomst: string;
  definitieveUitkomst: string;
  afwijkingMotivering: string | null;
  bekrachtigerEenId: number;
  bekrachtigerTweeId: number;
  bekrachtigdOp: string;
  gepubliceerdOp: string | null;
  debriefOp: string | null;
  debriefDoor: number | null;
};

type Voorstel = {
  ronde: { id: number; codenummer: string; fase: string; instrumentId: string };
  normprofielVersie: number;
  peildatum: string;
  asscores: unknown;
  activiteit: unknown;
  administratieveLeemten: string[];
  uitkomst: { uitkomst?: string | null; [k: string]: unknown };
};

type Bezwaar = {
  id: number;
  rondeId: number;
  grond: string;
  status: string;
  ingediendOp: string;
  ontvangstOp: string | null;
  uitspraak: string | null;
  uitspraakMotivering: string | null;
  uitspraakOp: string | null;
};

export default function AdminBekwaamheidBeslissingen() {
  const rij = useQueryClient();
  const [rondeId, zetRondeId] = useState("");
  const [fout, zetFout] = useState<string | null>(null);
  const [gelukt, zetGelukt] = useState<string | null>(null);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ronde");
    if (r) zetRondeId(r);
  }, []);

  const id = Number(rondeId);
  const geldig = rondeId.trim() !== "" && Number.isFinite(id) && id > 0;

  const voorstel = useQuery<{ voorstel: Voorstel; bestaandeBeslissing: Beslissing | null }>({
    queryKey: ["/api/bekwaamheid/voorstel", rondeId],
    enabled: geldig,
    retry: false,
    queryFn: async () =>
      apiRequest("GET", `/api/bekwaamheid/rondes/${id}/voorstel`).then((r) => r.json()),
  });

  const bezwaren = useQuery<{ bezwaren: Bezwaar[] }>({
    queryKey: ["/api/bekwaamheid/bezwaren"],
    queryFn: async () => apiRequest("GET", "/api/bekwaamheid/bezwaren").then((r) => r.json()),
  });

  function vernieuw() {
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/voorstel"] });
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/bezwaren"] });
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/rondes"] });
  }

  async function stuur(methode: string, pad: string, lichaam?: unknown): Promise<unknown | null> {
    zetFout(null);
    zetGelukt(null);
    try {
      return await (await apiRequest(methode, pad, lichaam)).json();
    } catch (e) {
      zetFout(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  const v = voorstel.data?.voorstel ?? null;
  const bestaand = voorstel.data?.bestaandeBeslissing ?? null;
  const voorgesteld =
    v && typeof v.uitkomst?.uitkomst === "string" ? (v.uitkomst.uitkomst as string) : null;

  return (
    <div style={{ background: KLEUR.achtergrond, minHeight: "100vh", color: KLEUR.tekst }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 22px 60px" }}>
        <Link
          href="/admin/bekwaamheid/rondes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: KLEUR.zacht,
            textDecoration: "none",
            marginBottom: 14,
          }}
        >
          <ChevronLeft size={15} /> Terug naar de rondes
        </Link>

        <h1 style={{ margin: "0 0 6px", fontSize: 26, color: KLEUR.donker, fontWeight: 600 }}>
          Voorstel, beslissing en bezwaar
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: KLEUR.zacht, maxWidth: "78ch" }}>
          De motor doet een voorstel; twee mensen beslissen. De keuze hieronder staat leeg en wordt niet
          voorgevuld met het voorstel: wie een voorgevulde keuze ziet, drukt op bevestigen, en dan had de
          motor net zo goed zelf kunnen beslissen.
        </p>

        <Melding soort="fout" tekst={fout} />
        <Melding soort="goed" tekst={gelukt} />

        <Kaart kop="Welke ronde">
          <Invoer label="Rondenummer" waarde={rondeId} zet={zetRondeId} soort="number" />
        </Kaart>

        {!geldig ? null : voorstel.isLoading ? (
          <Kaart kop="Het voorstel">
            <Leeg tekst="Het voorstel wordt gerekend." />
          </Kaart>
        ) : voorstel.isError || !v ? (
          <Kaart kop="Het voorstel">
            <Leeg tekst="Er is geen voorstel te rekenen voor deze ronde. Bestaat de ronde, en staat er een normprofiel bij?" />
          </Kaart>
        ) : (
          <>
            <Kaart
              kop={`Het voorstel voor ${v.ronde.codenummer}`}
              onderkop="Gerekend door de server uit de asscores, het activiteitsbeeld en de cesuur van het normprofiel. Deze hele berekening gaat bij het vastleggen mee de databank in; bij een bezwaar jaren later is dit het enige wat nog kan laten zien waarop de beslissing rustte."
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 14 }}>
                <Veld label="Fase" waarde={leesbaar(v.ronde.fase)} />
                <Veld label="Instrument" waarde={v.ronde.instrumentId} />
                <Veld label="Normprofiel" waarde={`versie ${v.normprofielVersie}`} />
                <Veld label="Peildatum" waarde={datum(v.peildatum)} />
                <Veld
                  label="Voorgestelde uitkomst"
                  waarde={voorgesteld ? leesbaar(voorgesteld) : "geen voorstel"}
                />
              </div>

              {v.administratieveLeemten.length > 0 ? (
                <div
                  style={{
                    marginBottom: 14,
                    padding: "10px 12px",
                    fontSize: 13,
                    background: "#fdf4f4",
                    border: `1px solid ${KLEUR.aandacht}`,
                    borderRadius: 6,
                    color: KLEUR.aandacht,
                  }}
                >
                  <strong>Administratieve leemten</strong>
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    {v.administratieveLeemten.map((l, n) => (
                      <li key={n}>{l}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Blok kop="Asscores" waarde={v.asscores} />
              <Blok kop="Activiteitsbeeld" waarde={v.activiteit} />
              <Blok kop="Toegepaste regels" waarde={v.uitkomst} />
            </Kaart>

            {bestaand ? (
              <Kaart
                kop="De vastgelegde beslissing"
                onderkop="Eenmaal vastgelegd blijft een beslissing staan. Een gegrond bezwaar leidt niet tot overschrijven maar tot een nieuwe ronde; het oude dossier blijft leesbaar."
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 12 }}>
                  <Veld label="Voorstel was" waarde={leesbaar(bestaand.voorstelUitkomst)} />
                  <Veld label="Besloten" waarde={leesbaar(bestaand.definitieveUitkomst)} />
                  <Veld label="Bekrachtiger 1" waarde={`#${bestaand.bekrachtigerEenId}`} />
                  <Veld label="Bekrachtiger 2" waarde={`#${bestaand.bekrachtigerTweeId}`} />
                  <Veld label="Bekrachtigd op" waarde={datum(bestaand.bekrachtigdOp)} />
                  <Veld label="Debrief op" waarde={datum(bestaand.debriefOp)} />
                  <Veld label="Gepubliceerd op" waarde={datum(bestaand.gepubliceerdOp)} />
                </div>
                {bestaand.afwijkingMotivering ? (
                  <p
                    style={{
                      margin: "0 0 12px",
                      padding: "10px 12px",
                      fontSize: 13,
                      background: KLEUR.achtergrond,
                      border: `1px solid ${KLEUR.rand}`,
                      borderRadius: 6,
                    }}
                  >
                    <strong>Motivering van de afwijking:</strong> {bestaand.afwijkingMotivering}
                  </p>
                ) : null}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Debrief
                    klaar={async (waarden) => {
                      const uit = await stuur(
                        "POST",
                        `/api/bekwaamheid/rondes/${id}/debrief`,
                        waarden,
                      );
                      if (uit) {
                        zetGelukt("Het debriefgesprek staat in het dossier.");
                        vernieuw();
                      }
                    }}
                  />
                  <Knop
                    soort="hoofd"
                    uit={bestaand.debriefOp === null || bestaand.gepubliceerdOp !== null}
                    klik={async () => {
                      const uit = await stuur(
                        "POST",
                        `/api/bekwaamheid/rondes/${id}/publiceren`,
                        {},
                      );
                      if (uit) {
                        zetGelukt("De uitkomst is gepubliceerd.");
                        vernieuw();
                      }
                    }}
                  >
                    Publiceren
                  </Knop>
                  {bestaand.debriefOp === null ? (
                    <span style={{ fontSize: 12, color: KLEUR.zacht, alignSelf: "center" }}>
                      Publiceren kan pas na het debriefgesprek: de betrokkene hoort de uitkomst van een
                      mens.
                    </span>
                  ) : null}
                </div>
              </Kaart>
            ) : (
              <Beslissen
                voorgesteld={voorgesteld}
                klaar={async (waarden) => {
                  const uit = await stuur(
                    "POST",
                    `/api/bekwaamheid/rondes/${id}/beslissing`,
                    waarden,
                  );
                  if (uit) {
                    zetGelukt("De beslissing is vastgelegd.");
                    vernieuw();
                  }
                }}
              />
            )}

            <Bezwaar
              klaar={async (grond) => {
                const uit = await stuur("POST", `/api/bekwaamheid/rondes/${id}/bezwaar`, { grond });
                if (uit) {
                  zetGelukt("Het bezwaar is ingeschreven.");
                  vernieuw();
                }
              }}
            />
          </>
        )}

        <Kaart
          kop="De bezwaren"
          onderkop="Alle bezwaren, ook de afgehandelde. Een lijst die alleen de openstaande toont, laat precies de dossiers weg waarin een uitspraak gedaan is die nog na te lezen valt."
        >
          {bezwaren.isLoading ? (
            <Leeg tekst="De bezwaren worden opgehaald." />
          ) : (bezwaren.data?.bezwaren ?? []).length === 0 ? (
            <Leeg tekst="Er staat geen bezwaar in het register." />
          ) : (
            <Tabel
              koppen={
                [
                  "Nr.",
                  "Ronde",
                  "Status",
                  "Ingediend",
                  "Ontvangst",
                  "Uitspraak",
                  "Grond",
                  "",
                ] as const
              }
            >
              {(bezwaren.data?.bezwaren ?? []).map((b) => (
                <tr key={b.id}>
                  <Cel>{b.id}</Cel>
                  <Cel>{b.rondeId}</Cel>
                  <Cel>{leesbaar(b.status)}</Cel>
                  <Cel>{datum(b.ingediendOp)}</Cel>
                  <Cel>{datum(b.ontvangstOp)}</Cel>
                  <Cel>{b.uitspraak ? leesbaar(b.uitspraak) : "—"}</Cel>
                  <Cel breed>
                    <span style={{ display: "block", maxWidth: "44ch" }}>{b.grond}</span>
                  </Cel>
                  <Cel>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {b.ontvangstOp === null ? (
                        <Knop
                          klik={async () => {
                            const uit = await stuur(
                              "POST",
                              `/api/bekwaamheid/bezwaren/${b.id}/ontvangst`,
                              {},
                            );
                            if (uit) {
                              zetGelukt("De ontvangst is bevestigd.");
                              vernieuw();
                            }
                          }}
                        >
                          Ontvangst bevestigen
                        </Knop>
                      ) : null}
                      {b.uitspraak === null ? (
                        <Uitspraak
                          klaar={async (waarden) => {
                            const uit = await stuur(
                              "POST",
                              `/api/bekwaamheid/bezwaren/${b.id}/uitspraak`,
                              waarden,
                            );
                            if (uit) {
                              zetGelukt("De uitspraak staat in het dossier.");
                              vernieuw();
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  </Cel>
                </tr>
              ))}
            </Tabel>
          )}
        </Kaart>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Toont een gerekend blok zoals de server het gaf, zonder het te hervormen. */
function Blok({ kop, waarde }: { kop: string; waarde: unknown }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h4 style={{ margin: "0 0 5px", fontSize: 13, color: KLEUR.donker }}>{kop}</h4>
      <pre
        style={{
          margin: 0,
          padding: "10px 12px",
          fontSize: 12,
          lineHeight: 1.6,
          background: KLEUR.achtergrond,
          border: `1px solid ${KLEUR.rand}`,
          borderRadius: 6,
          overflowX: "auto",
          color: KLEUR.tekst,
        }}
      >
        {JSON.stringify(waarde, null, 2)}
      </pre>
    </div>
  );
}

function Beslissen({
  voorgesteld,
  klaar,
}: {
  voorgesteld: string | null;
  klaar: (waarden: Record<string, unknown>) => Promise<void>;
}) {
  const [uitkomst, zetUitkomst] = useState("");
  const [een, zetEen] = useState("");
  const [twee, zetTwee] = useState("");
  const [motivering, zetMotivering] = useState("");

  const wijktAf = uitkomst !== "" && voorgesteld !== null && uitkomst !== voorgesteld;
  const motiveringKort = motivering.trim().length < 40;

  return (
    <Kaart
      kop="De beslissing vastleggen"
      onderkop="Twee verschillende bekrachtigers. Wijkt de beslissing af van het voorstel, dan is een motivering van minstens veertig tekens verplicht — niet als drempel maar omdat een afwijking zonder uitleg bij een bezwaar niet te verdedigen is."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Keuze
          label="Definitieve uitkomst"
          waarde={uitkomst}
          zet={zetUitkomst}
          opties={[{ waarde: "", tekst: "Kies een uitkomst" }, ...UITKOMSTEN]}
          toelichting="Staat leeg. Niet voorgevuld met het voorstel."
        />
        <Invoer label="Bekrachtiger 1" waarde={een} zet={zetEen} soort="number" />
        <Invoer label="Bekrachtiger 2" waarde={twee} zet={zetTwee} soort="number" />
      </div>

      {wijktAf ? (
        <>
          <Melding
            soort="fout"
            tekst={`Dit wijkt af van het voorstel (${leesbaar(voorgesteld!)}). De motivering is verplicht.`}
          />
          <Tekstvak
            label="Motivering van de afwijking"
            waarde={motivering}
            zet={zetMotivering}
            regels={3}
            toelichting={
              motiveringKort
                ? `Minstens veertig tekens; nu ${motivering.trim().length}`
                : `${motivering.trim().length} tekens`
            }
          />
        </>
      ) : null}

      {voorgesteld === null ? (
        <Melding
          soort="fout"
          tekst="De motor doet nog geen voorstel voor deze ronde. Zolang dat zo is, weigert de server een beslissing: er is dan niets om van af te wijken en niets om aan te sluiten."
        />
      ) : null}

      <Knop
        soort="hoofd"
        uit={
          uitkomst === "" ||
          een.trim() === "" ||
          twee.trim() === "" ||
          een.trim() === twee.trim() ||
          (wijktAf && motiveringKort)
        }
        klik={() =>
          klaar({
            definitieveUitkomst: uitkomst,
            bekrachtigerEenId: Number(een),
            bekrachtigerTweeId: Number(twee),
            afwijkingMotivering: wijktAf ? motivering.trim() : undefined,
          })
        }
      >
        Beslissing vastleggen
      </Knop>
      {een.trim() !== "" && een.trim() === twee.trim() ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: KLEUR.aandacht }}>
          Twee keer dezelfde bekrachtiger is geen tweede bekrachtiger.
        </p>
      ) : null}
    </Kaart>
  );
}

function Debrief({ klaar }: { klaar: (waarden: Record<string, unknown>) => Promise<void> }) {
  const [open, zetOpen] = useState(false);
  const [op, zetOp] = useState("");
  if (!open) return <Knop klik={() => zetOpen(true)}>Debrief vastleggen</Knop>;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <Invoer
        label="Gesprek op"
        waarde={op}
        zet={zetOp}
        soort="date"
        toelichting="Leeg laten voor vandaag."
      />
      <Knop
        soort="hoofd"
        klik={async () => {
          await klaar({ debriefOp: op.trim() || undefined });
          zetOpen(false);
        }}
      >
        Vastleggen
      </Knop>
      <Knop klik={() => zetOpen(false)}>Afzien</Knop>
    </div>
  );
}

function Bezwaar({ klaar }: { klaar: (grond: string) => Promise<void> }) {
  const [grond, zetGrond] = useState("");
  return (
    <Kaart
      kop="Een bezwaar inschrijven"
      onderkop="Binnen dertig kalenderdagen na publicatie. De grond wordt woordelijk bewaard zoals de betrokkene hem gaf; samenvatten zou het bezwaar veranderen."
    >
      <Tekstvak
        label="De grond van het bezwaar"
        waarde={grond}
        zet={zetGrond}
        regels={3}
        toelichting={`Minstens twintig tekens; nu ${grond.trim().length}`}
      />
      <Knop
        uit={grond.trim().length < 20}
        klik={async () => {
          await klaar(grond.trim());
          zetGrond("");
        }}
      >
        Bezwaar inschrijven
      </Knop>
    </Kaart>
  );
}

function Uitspraak({ klaar }: { klaar: (waarden: Record<string, unknown>) => Promise<void> }) {
  const [open, zetOpen] = useState(false);
  const [uitspraak, zetUitspraak] = useState("");
  const [motivering, zetMotivering] = useState("");

  if (!open) return <Knop klik={() => zetOpen(true)}>Uitspraak doen</Knop>;

  return (
    <div style={{ minWidth: 280 }}>
      <Keuze
        label="Uitspraak"
        waarde={uitspraak}
        zet={zetUitspraak}
        opties={[{ waarde: "", tekst: "Kies een uitspraak" }, ...UITSPRAKEN]}
      />
      <Tekstvak
        label="Motivering"
        waarde={motivering}
        zet={zetMotivering}
        regels={3}
        toelichting={`Minstens veertig tekens; nu ${motivering.trim().length}`}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Knop
          soort="hoofd"
          uit={uitspraak === "" || motivering.trim().length < 40}
          klik={async () => {
            await klaar({ uitspraak, motivering: motivering.trim() });
            zetOpen(false);
          }}
        >
          Uitspraak vastleggen
        </Knop>
        <Knop klik={() => zetOpen(false)}>Afzien</Knop>
      </div>
    </div>
  );
}
