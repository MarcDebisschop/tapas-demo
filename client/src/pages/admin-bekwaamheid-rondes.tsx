// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid-rondes.tsx — levering 4 uit het
// vervolgplan: /admin/bekwaamheid/rondes — de rondes en hun bewijsstukken.
//
// Een ronde is het dossier van één bekwaamheidsbeoordeling: vijf bewijsstukken,
// een venster waarbinnen ze ingeleverd moeten zijn, en een loop van elf fasen.
// Dit scherm opent een ronde, legt de bewijsstukken aan en zet de fase door.
//
// Vier dingen die dit scherm bewust NIET doet.
//
// Het bepaalt de fasenloop niet. Welke fase na welke mag komen, staat in
// rondeloop.ts op de server. Het scherm biedt alle fasen aan en laat de server
// weigeren, met haar eigen tekst erbij. Een tweede lijst met toegestane
// overgangen in de browser gaat na de eerste wijziging afwijken, en dan staat er
// een knop die niet werkt of ontbreekt er een die zou moeten werken.
//
// Het geeft geen codenummer uit. Het volgende nummer is op te vragen zonder het
// te reserveren; het echte nummer wordt bij het openen door de server gezet.
// Zouden twee beheerders tegelijk een ronde openen, dan mag er geen twijfel zijn
// over wie R-2026-0007 kreeg.
//
// Het rekent geen venster uit. De einddatum komt van de server. Wie hier maanden
// zou optellen, krijgt bij een schrikkeljaar een andere datum dan het dossier.
//
// Het verbergt geen aanpassing. Een aangepast dossier — meer tijd, een andere
// route — blijft met omschrijving en reden zichtbaar. Een aanpassing die niet in
// het dossier staat, is bij een bezwaar niet te verantwoorden.
// ---------------------------------------------------------------------------
import { useState } from "react";
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

// De elf fasen en de vier soorten, gelijk aan RONDEFASEN en RONDESOORTEN in
// server/bekwaamheid/schema.ts. De loop zelf staat op de server.
const FASEN = [
  "voorbereiding",
  "open",
  "ingeleverd",
  "in_beoordeling",
  "beslissing_voorstel",
  "overleg",
  "beslist",
  "gedebrieft",
  "afgesloten",
  "bezwaar",
  "gestaakt",
] as const;

const SOORTEN = [
  { waarde: "nulmeting", tekst: "Nulmeting" },
  { waarde: "bekrachtiging", tekst: "Bekrachtiging" },
  { waarde: "herkansing", tekst: "Herkansing" },
  { waarde: "reactivatie", tekst: "Reactivatie" },
] as const;

const ASSEN = [
  { waarde: "weten", tekst: "Weten" },
  { waarde: "zien", tekst: "Zien" },
  { waarde: "zeggen", tekst: "Zeggen" },
  { waarde: "zorgen", tekst: "Zorgen" },
] as const;

const ROUTES = [
  { waarde: "", tekst: "Geen route" },
  { waarde: "simulatie", tekst: "Simulatie" },
  { waarde: "eigen_opname", tekst: "Eigen opname" },
] as const;

type Ronde = {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  normprofielId: number;
  soort: string;
  codenummer: string;
  fase: string;
  geopendOp: string;
  vensterTot: string;
  afgerondOp: string | null;
  aanpassingen: string | null;
  aanpassingenReden: string | null;
  notitieIntern: string | null;
  naam?: string | null;
  aantalBewijsstukken?: number;
};

type Bewijsstuk = {
  id: number;
  rondeId: number;
  nummer: number;
  as: string;
  weging: number;
  status: string;
  ruweScore: number | null;
  itemsetId: number | null;
  route: string | null;
  opnameVerklaring: boolean;
  ingeleverdOp: string | null;
  beoordeeldOp: string | null;
};

type Dossier = {
  ronde: Ronde;
  persoon: { id: number; naam: string } | null;
  normprofiel: { id: number; versie: number } | null;
  bewijsstukken: Bewijsstuk[];
  scores: { id: number; bewijsstukId: number }[];
  beslissing: unknown | null;
  bezwaren: unknown[];
};

export default function AdminBekwaamheidRondes() {
  const rij = useQueryClient();
  const [fase, zetFase] = useState("");
  const [instrument, zetInstrument] = useState("");
  const [gekozen, zetGekozen] = useState<number | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const [gelukt, zetGelukt] = useState<string | null>(null);

  const vraag = new URLSearchParams();
  if (fase) vraag.set("fase", fase);
  if (instrument.trim()) vraag.set("instrumentId", instrument.trim());

  const lijst = useQuery<{ rondes: Ronde[] }>({
    queryKey: ["/api/bekwaamheid/rondes", vraag.toString()],
    queryFn: async () =>
      apiRequest("GET", `/api/bekwaamheid/rondes?${vraag.toString()}`).then((r) => r.json()),
  });

  const volgend = useQuery<{ codenummer: string; gereserveerd: boolean }>({
    queryKey: ["/api/bekwaamheid/rondes-volgend-nummer"],
    queryFn: async () =>
      apiRequest("GET", "/api/bekwaamheid/rondes-volgend-nummer").then((r) => r.json()),
  });

  const dossier = useQuery<Dossier>({
    queryKey: ["/api/bekwaamheid/ronde", gekozen],
    enabled: gekozen !== null,
    queryFn: async () =>
      apiRequest("GET", `/api/bekwaamheid/rondes/${gekozen}`).then((r) => r.json()),
  });

  function vernieuw() {
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/rondes"] });
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/ronde"] });
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/rondes-volgend-nummer"] });
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

  const rondes = lijst.data?.rondes ?? [];

  return (
    <div style={{ background: KLEUR.achtergrond, minHeight: "100vh", color: KLEUR.tekst }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 22px 60px" }}>
        <Link
          href="/admin/bekwaamheid"
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
          <ChevronLeft size={15} /> Terug naar de regiekamer
        </Link>

        <h1 style={{ margin: "0 0 6px", fontSize: 26, color: KLEUR.donker, fontWeight: 600 }}>
          Rondes en bewijsstukken
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: KLEUR.zacht, maxWidth: "78ch" }}>
          Eén ronde is één bekwaamheidsbeoordeling: vijf bewijsstukken, een venster waarbinnen ze
          ingeleverd moeten zijn, en een loop van elf fasen. Welke fase na welke mag komen, bepaalt de
          server; dit scherm vraagt het en laat de weigering woordelijk zien.
        </p>

        <Melding soort="fout" tekst={fout} />
        <Melding soort="goed" tekst={gelukt} />

        <Openen
          volgendNummer={volgend.data?.codenummer ?? null}
          klaar={async (waarden) => {
            const uit = (await stuur("POST", "/api/bekwaamheid/rondes", waarden)) as {
              ronde?: Ronde;
            } | null;
            if (uit?.ronde) {
              zetGelukt(`Ronde ${uit.ronde.codenummer} staat open.`);
              zetGekozen(uit.ronde.id);
              vernieuw();
            }
          }}
        />

        <Kaart
          kop="De rondes"
          onderkop="Zonder filter alle rondes, ook de gestaakte en de afgesloten. Een lijst die alleen de lopende toont, laat precies de dossiers weg waar iets in blijft hangen."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Keuze
              label="Fase"
              waarde={fase}
              zet={zetFase}
              opties={[
                { waarde: "", tekst: "Alle fasen" },
                ...FASEN.map((f) => ({ waarde: f, tekst: leesbaar(f) })),
              ]}
            />
            <Invoer label="Instrument-id" waarde={instrument} zet={zetInstrument} />
          </div>

          {lijst.isLoading ? (
            <Leeg tekst="De rondes worden opgehaald." />
          ) : rondes.length === 0 ? (
            <Leeg tekst="Geen enkele ronde past bij deze keuze. Bij een leeg dossier is dat de gewone stand; staat het filter op een fase, dan is die fase leeg." />
          ) : (
            <Tabel
              koppen={
                [
                  "Codenummer",
                  "Naam",
                  "Instrument",
                  "Soort",
                  "Fase",
                  "Geopend",
                  "Venster tot",
                  "Stukken",
                  "",
                ] as const
              }
            >
              {rondes.map((r) => (
                <tr key={r.id} style={{ background: r.id === gekozen ? "#f8f6f1" : "transparent" }}>
                  <Cel>{r.codenummer}</Cel>
                  <Cel>{r.naam ?? `#${r.geaccrediteerdeId}`}</Cel>
                  <Cel>{r.instrumentId}</Cel>
                  <Cel>{leesbaar(r.soort)}</Cel>
                  <Cel>
                    <span
                      style={{
                        color: r.fase === "gestaakt" ? KLEUR.aandacht : KLEUR.tekst,
                      }}
                    >
                      {leesbaar(r.fase)}
                    </span>
                  </Cel>
                  <Cel>{datum(r.geopendOp)}</Cel>
                  <Cel>{datum(r.vensterTot)}</Cel>
                  <Cel>{r.aantalBewijsstukken ?? "—"}</Cel>
                  <Cel>
                    <Knop klik={() => zetGekozen(r.id === gekozen ? null : r.id)}>
                      {r.id === gekozen ? "Sluiten" : "Dossier"}
                    </Knop>
                  </Cel>
                </tr>
              ))}
            </Tabel>
          )}
        </Kaart>

        {gekozen !== null && dossier.data ? (
          <>
            <Kaart
              kop={`Dossier ${dossier.data.ronde.codenummer}`}
              onderkop="De aanpassing en haar reden blijven staan zolang het dossier bestaat. Bij een bezwaar is precies dat het eerste wat gelezen wordt."
              rechts={
                <Link
                  href={`/admin/bekwaamheid/beslissingen?ronde=${dossier.data.ronde.id}`}
                  style={{ fontSize: 13, color: KLEUR.donker }}
                >
                  Naar de beslissing
                </Link>
              }
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 14 }}>
                <Veld label="Naam" waarde={dossier.data.persoon?.naam ?? "—"} />
                <Veld label="Instrument" waarde={dossier.data.ronde.instrumentId} />
                <Veld label="Soort" waarde={leesbaar(dossier.data.ronde.soort)} />
                <Veld label="Fase" waarde={leesbaar(dossier.data.ronde.fase)} />
                <Veld
                  label="Normprofiel"
                  waarde={
                    dossier.data.normprofiel
                      ? `versie ${dossier.data.normprofiel.versie}`
                      : "niet gevonden"
                  }
                />
                <Veld label="Geopend op" waarde={datum(dossier.data.ronde.geopendOp)} />
                <Veld label="Venster tot" waarde={datum(dossier.data.ronde.vensterTot)} />
                <Veld label="Afgerond op" waarde={datum(dossier.data.ronde.afgerondOp)} />
                <Veld label="Scores" waarde={dossier.data.scores.length} />
                <Veld label="Bezwaren" waarde={dossier.data.bezwaren.length} />
              </div>

              {dossier.data.ronde.aanpassingen ? (
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
                  <strong>Aanpassing:</strong> {dossier.data.ronde.aanpassingen}
                  <br />
                  <strong>Reden:</strong> {dossier.data.ronde.aanpassingenReden ?? "—"}
                </p>
              ) : null}

              <Fase
                huidig={dossier.data.ronde.fase}
                klaar={async (naar, reden) => {
                  const uit = await stuur(`POST`, `/api/bekwaamheid/rondes/${gekozen}/fase`, {
                    naar,
                    reden: reden || undefined,
                  });
                  if (uit) {
                    zetGelukt(`De ronde staat in fase ${leesbaar(naar)}.`);
                    vernieuw();
                  }
                }}
              />

              <Aanpassing
                klaar={async (aanpassingen, reden) => {
                  const uit = await stuur("POST", `/api/bekwaamheid/rondes/${gekozen}/aanpassing`, {
                    aanpassingen,
                    reden,
                  });
                  if (uit) {
                    zetGelukt("De aanpassing staat in het dossier.");
                    vernieuw();
                  }
                }}
              />
            </Kaart>

            <Kaart
              kop="De bewijsstukken"
              onderkop="Bewijsstukken worden alleen in de voorbereiding aangelegd, met een nummer van één tot vijf. Wie er later een bij zou kunnen leggen, verandert de meting terwijl ze loopt."
            >
              {dossier.data.bewijsstukken.length === 0 ? (
                <Leeg tekst="Er staat nog geen bewijsstuk in dit dossier." />
              ) : (
                <Tabel
                  koppen={
                    [
                      "Nr.",
                      "As",
                      "Weging",
                      "Status",
                      "Route",
                      "Opnameverklaring",
                      "Ruwe score",
                      "Ingeleverd",
                      "Beoordeeld",
                      "",
                    ] as const
                  }
                >
                  {dossier.data.bewijsstukken.map((b) => (
                    <tr key={b.id}>
                      <Cel>{b.nummer}</Cel>
                      <Cel>{leesbaar(b.as)}</Cel>
                      <Cel>{b.weging}</Cel>
                      <Cel>{leesbaar(b.status)}</Cel>
                      <Cel>{b.route ? leesbaar(b.route) : "—"}</Cel>
                      <Cel>{b.opnameVerklaring ? "Ja" : "Nee"}</Cel>
                      <Cel>{b.ruweScore === null ? "—" : b.ruweScore}</Cel>
                      <Cel>{datum(b.ingeleverdOp)}</Cel>
                      <Cel>{datum(b.beoordeeldOp)}</Cel>
                      <Cel>
                        <div style={{ display: "flex", gap: 6 }}>
                          {b.status === "open" ? (
                            <Knop
                              klik={async () => {
                                const uit = await stuur(
                                  "POST",
                                  `/api/bekwaamheid/bewijsstukken/${b.id}/inleveren`,
                                  {},
                                );
                                if (uit) {
                                  zetGelukt(`Bewijsstuk ${b.nummer} is ingeleverd.`);
                                  vernieuw();
                                }
                              }}
                            >
                              Inleveren
                            </Knop>
                          ) : null}
                          <Link
                            href={`/admin/bekwaamheid/beoordelen?bewijsstuk=${b.id}`}
                            style={{ fontSize: 13, color: KLEUR.donker, alignSelf: "center" }}
                          >
                            Beoordelen
                          </Link>
                          {b.status !== "nvt" ? (
                            <Nvt
                              klaar={async (reden) => {
                                const uit = await stuur(
                                  "POST",
                                  `/api/bekwaamheid/bewijsstukken/${b.id}/nvt`,
                                  { reden },
                                );
                                if (uit) {
                                  zetGelukt(
                                    `Bewijsstuk ${b.nummer} staat op niet van toepassing.`,
                                  );
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

              <Bewijsstuk
                klaar={async (waarden) => {
                  const uit = await stuur(
                    "POST",
                    `/api/bekwaamheid/rondes/${gekozen}/bewijsstukken`,
                    waarden,
                  );
                  if (uit) {
                    zetGelukt("Het bewijsstuk staat in het dossier.");
                    vernieuw();
                  }
                }}
              />
            </Kaart>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Openen({
  volgendNummer,
  klaar,
}: {
  volgendNummer: string | null;
  klaar: (waarden: Record<string, unknown>) => Promise<void>;
}) {
  const [persoonId, zetPersoonId] = useState("");
  const [instrument, zetInstrument] = useState("");
  const [soort, zetSoort] = useState<string>(SOORTEN[0].waarde);
  const [geopendOp, zetGeopendOp] = useState("");
  const [maanden, zetMaanden] = useState("");
  const [notitie, zetNotitie] = useState("");

  return (
    <Kaart
      kop="Een ronde openen"
      onderkop="Een ronde openen vraagt een bevroren normprofiel voor dit instrument; de versie ervan wordt in de ronde vastgelegd. Er kan één ronde per persoon per instrument lopen."
      rechts={
        <span style={{ fontSize: 13, color: KLEUR.zacht }}>
          Volgend nummer:{" "}
          <strong style={{ color: KLEUR.donker }}>{volgendNummer ?? "onbekend"}</strong> — nog niet
          uitgegeven
        </span>
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Invoer
          label="Registernummer"
          waarde={persoonId}
          zet={zetPersoonId}
          soort="number"
          toelichting="Uit het register."
        />
        <Invoer label="Instrument-id" waarde={instrument} zet={zetInstrument} />
        <Keuze label="Soort" waarde={soort} zet={zetSoort} opties={SOORTEN} />
        <Invoer
          label="Geopend op"
          waarde={geopendOp}
          zet={zetGeopendOp}
          soort="date"
          toelichting="Leeg laten voor vandaag."
        />
        <Invoer
          label="Venster in maanden"
          waarde={maanden}
          zet={zetMaanden}
          soort="number"
          toelichting="Leeg laten voor de gewone termijn."
        />
      </div>
      <Tekstvak
        label="Interne notitie"
        waarde={notitie}
        zet={zetNotitie}
        regels={2}
        toelichting="Blijft binnen de beheerderskant"
      />
      <Knop
        soort="hoofd"
        uit={persoonId.trim() === "" || instrument.trim() === ""}
        klik={async () => {
          await klaar({
            geaccrediteerdeId: Number(persoonId),
            instrumentId: instrument.trim(),
            soort,
            geopendOp: geopendOp.trim() || undefined,
            vensterMaanden: maanden.trim() ? Number(maanden) : undefined,
            notitieIntern: notitie.trim() || null,
          });
          zetPersoonId("");
          zetNotitie("");
        }}
      >
        Ronde openen
      </Knop>
    </Kaart>
  );
}

function Fase({
  huidig,
  klaar,
}: {
  huidig: string;
  klaar: (naar: string, reden: string) => Promise<void>;
}) {
  const [naar, zetNaar] = useState("");
  const [reden, zetReden] = useState("");
  return (
    <div style={{ borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 14, marginTop: 4 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, color: KLEUR.donker }}>De fase doorzetten</h3>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "72ch" }}>
        Alle elf fasen staan hier. Welke er vanuit <strong>{leesbaar(huidig)}</strong> mag volgen,
        weet de server; kiest u er een die niet mag, dan komt haar weigering woordelijk in beeld.
        Staken vraagt een reden van minstens tien tekens.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        <Keuze
          label="Naar fase"
          waarde={naar}
          zet={zetNaar}
          opties={[
            { waarde: "", tekst: "Kies een fase" },
            ...FASEN.filter((f) => f !== huidig).map((f) => ({ waarde: f, tekst: leesbaar(f) })),
          ]}
        />
        <Invoer
          label="Reden"
          waarde={reden}
          zet={zetReden}
          toelichting="Verplicht bij staken."
        />
      </div>
      <Knop
        uit={naar === "" || (naar === "gestaakt" && reden.trim().length < 10)}
        klik={async () => {
          await klaar(naar, reden.trim());
          zetNaar("");
          zetReden("");
        }}
      >
        Fase doorzetten
      </Knop>
    </div>
  );
}

function Aanpassing({ klaar }: { klaar: (aanpassingen: string, reden: string) => Promise<void> }) {
  const [wat, zetWat] = useState("");
  const [reden, zetReden] = useState("");
  return (
    <div style={{ borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 14, marginTop: 14 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, color: KLEUR.donker }}>
        Een aanpassing vastleggen
      </h3>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "72ch" }}>
        Meer tijd, een andere route, een aangepaste opdracht: het mag, en het staat erbij. Zonder
        reden wordt het niet vastgelegd, want een aanpassing zonder reden is bij een bezwaar niet te
        verantwoorden.
      </p>
      <Tekstvak label="Wat is aangepast" waarde={wat} zet={zetWat} regels={2} />
      <Tekstvak label="Waarom" waarde={reden} zet={zetReden} regels={2} />
      <Knop
        uit={wat.trim().length === 0 || reden.trim().length === 0}
        klik={async () => {
          await klaar(wat.trim(), reden.trim());
          zetWat("");
          zetReden("");
        }}
      >
        Aanpassing vastleggen
      </Knop>
    </div>
  );
}

function Bewijsstuk({ klaar }: { klaar: (waarden: Record<string, unknown>) => Promise<void> }) {
  const [nummer, zetNummer] = useState("1");
  const [as, zetAs] = useState<string>(ASSEN[0].waarde);
  const [weging, zetWeging] = useState("1");
  const [route, zetRoute] = useState("");
  const [verklaring, zetVerklaring] = useState(false);

  return (
    <div style={{ borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 14, marginTop: 14 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, color: KLEUR.donker }}>
        Een bewijsstuk aanleggen
      </h3>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "72ch" }}>
        Alleen in de voorbereiding, met een nummer van één tot vijf. Bij een eigen opname hoort de
        opnameverklaring van de betrokkene; zonder die verklaring mag de opname niet beoordeeld
        worden.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Invoer label="Nummer" waarde={nummer} zet={zetNummer} soort="number" />
        <Keuze label="As" waarde={as} zet={zetAs} opties={ASSEN} />
        <Invoer label="Weging" waarde={weging} zet={zetWeging} soort="number" />
        <Keuze label="Route" waarde={route} zet={zetRoute} opties={ROUTES} />
      </div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          marginBottom: 12,
          color: KLEUR.tekst,
        }}
      >
        <input
          type="checkbox"
          checked={verklaring}
          onChange={(e) => zetVerklaring(e.target.checked)}
        />
        De opnameverklaring van de betrokkene is er
      </label>
      <Knop
        uit={nummer.trim() === "" || weging.trim() === ""}
        klik={async () => {
          await klaar({
            nummer: Number(nummer),
            as,
            weging: Number(weging),
            route: route || null,
            opnameVerklaring: verklaring,
          });
          zetVerklaring(false);
        }}
      >
        Bewijsstuk aanleggen
      </Knop>
    </div>
  );
}

function Nvt({ klaar }: { klaar: (reden: string) => Promise<void> }) {
  const [open, zetOpen] = useState(false);
  const [reden, zetReden] = useState("");
  if (!open)
    return (
      <Knop soort="aandacht" klik={() => zetOpen(true)}>
        Niet van toepassing
      </Knop>
    );
  return (
    <div style={{ minWidth: 220 }}>
      <Tekstvak label="Reden" waarde={reden} zet={zetReden} regels={2} />
      <div style={{ display: "flex", gap: 8 }}>
        <Knop
          soort="aandacht"
          uit={reden.trim().length === 0}
          klik={async () => {
            await klaar(reden.trim());
            zetReden("");
            zetOpen(false);
          }}
        >
          Vastleggen
        </Knop>
        <Knop klik={() => zetOpen(false)}>Afzien</Knop>
      </div>
    </div>
  );
}
