// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid-cyclus.tsx — levering 7 uit het
// vervolgplan: /admin/bekwaamheid/cyclus — tussentijdse toets, coachingsplan,
// agenda.
//
// De cyclus loopt twee jaar. Na het eerste jaar komt de tussentijdse toets: die
// kijkt naar het aantal afnames, naar de scores van de oefensessies, en stelt bij
// te veel twijfels een coachingsplan voor met de melding 'alert'. Dit scherm doet
// die toets, legt het plan aan en houdt de agenda bij.
//
// Vijf dingen die dit scherm bewust NIET doet.
//
// Het is geen sanctie-instrument. De uitkomsten zijn geen_signaal, aandachtspunt
// en alert. Ook 'alert' schorst niets; het vraagt een gesprek en een plan. Wie
// halverwege een cyclus een licentie zou kunnen intrekken op cijfers alleen, maakt
// van een ontwikkelmoment een controlemoment, en dan stoppen mensen met oefenen.
//
// Het rekent de toets niet zelf na. Het aantal afnames, het gemiddelde van de
// oefensessies, de signalen en de bindende regel komen van de server.
//
// Het vult de vaststelling niet voor. De berekende uitkomst staat er, de keuze
// staat leeg, en wijkt de vaststelling af, dan is de motivering verplicht.
//
// Het toont geen nul waar niets gemeten is. Zijn er geen afgeronde oefensessies
// in het venster, dan staat het gemiddelde leeg. Een nul zou een score suggereren
// die niemand heeft gehaald.
//
// Het geeft de hele agenda niet terug. Alleen wat op of voor de peildatum
// openstaat. Een lijst die ook alle afgehandelde posten toont, wordt niet gelezen,
// en dan blijft er iets staan waardoor een licentie vervalt.
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

// Gelijk aan TOETSUITKOMSTEN en COACHINGSPLANUITKOMSTEN in schema.ts.
const TOETSUITKOMSTEN = [
  { waarde: "geen_signaal", tekst: "Geen signaal" },
  { waarde: "aandachtspunt", tekst: "Aandachtspunt" },
  { waarde: "alert", tekst: "Alert" },
] as const;

const PLANUITKOMSTEN = [
  { waarde: "opgelost", tekst: "Opgelost" },
  { waarde: "verlengd", tekst: "Verlengd" },
  { waarde: "meegenomen_naar_bekrachtiging", tekst: "Meegenomen naar de bekrachtiging" },
] as const;

type Signaal = { naam: string; toelichting?: string; [k: string]: unknown };

type Toets = {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  licentieId: number;
  peildatum: string;
  vensterVan: string;
  vensterTot: string;
  afnamesAantal: number;
  afnamesDrempel: number;
  stmSessies: number;
  stmGemiddelde: number | null;
  stmPerLaag: Record<string, number> | null;
  signalen: Signaal[];
  uitkomst: string | null;
  berekendeUitkomst: string;
  bindendeRegel: string;
  vastgesteldDoor: number | null;
  vastgesteldOp: string | null;
  besprokenOp: string | null;
  gepubliceerdOp: string | null;
  coachingsplanId: number | null;
};

type Post = {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  soort: string;
  datum: string;
  naam?: string | null;
};

export default function AdminBekwaamheidCyclus() {
  const rij = useQueryClient();
  const [persoonId, zetPersoonId] = useState("");
  const [peildatum, zetPeildatum] = useState("");
  const [fout, zetFout] = useState<string | null>(null);
  const [gelukt, zetGelukt] = useState<string | null>(null);

  const pId = Number(persoonId);
  const geldig = persoonId.trim() !== "" && Number.isFinite(pId) && pId > 0;

  const toetsen = useQuery<{ toetsen: Toets[] }>({
    queryKey: ["/api/bekwaamheid/toetsen", persoonId],
    enabled: geldig,
    retry: false,
    queryFn: async () =>
      apiRequest("GET", `/api/bekwaamheid/toetsen/${pId}`).then((r) => r.json()),
  });

  const agenda = useQuery<{ peildatum: string; posten: Post[] }>({
    queryKey: ["/api/bekwaamheid/agenda", peildatum],
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/bekwaamheid/agenda${peildatum.trim() ? `?peildatum=${peildatum.trim()}` : ""}`,
      ).then((r) => r.json()),
  });

  const vervallend = useQuery<{ peildatum: string; licenties: unknown[] }>({
    queryKey: ["/api/bekwaamheid/vervallende-toetsen", peildatum],
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/bekwaamheid/vervallende-toetsen${peildatum.trim() ? `?peildatum=${peildatum.trim()}` : ""}`,
      ).then((r) => r.json()),
  });

  function vernieuw() {
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/toetsen"] });
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/agenda"] });
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/vervallende-toetsen"] });
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

  const lijst = toetsen.data?.toetsen ?? [];
  const posten = agenda.data?.posten ?? [];

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
          Cyclus, tussentijdse toets en agenda
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: KLEUR.zacht, maxWidth: "78ch" }}>
          De cyclus loopt vierentwintig maanden, met na twaalf maanden een tussentijdse toets. Die kijkt
          naar het aantal afnames en naar de oefensessies, en meldt bij te veel twijfels 'alert' met een
          coachingsplan erbij. Ook 'alert' schorst niets: het vraagt een gesprek en een plan.
        </p>

        <Melding soort="fout" tekst={fout} />
        <Melding soort="goed" tekst={gelukt} />

        <Kaart
          kop="De agenda"
          onderkop="Wat op of voor de peildatum openstaat. Afgehandelde posten komen er niet bij: een lijst die alles toont, wordt niet gelezen, en dan blijft er iets staan waardoor een licentie vervalt."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Invoer
              label="Peildatum"
              waarde={peildatum}
              zet={zetPeildatum}
              soort="date"
              toelichting="Leeg laten voor vandaag."
            />
            <Veld label="Openstaand" waarde={posten.length} />
            <Veld
              label="Toetsen die vervallen"
              waarde={(vervallend.data?.licenties ?? []).length}
            />
          </div>

          {agenda.isLoading ? (
            <Leeg tekst="De agenda wordt opgehaald." />
          ) : posten.length === 0 ? (
            <Leeg tekst="Er staat niets open op deze peildatum." />
          ) : (
            <Tabel koppen={["Datum", "Soort", "Naam", "Instrument", ""] as const}>
              {posten.map((p) => (
                <tr key={p.id}>
                  <Cel>{datum(p.datum)}</Cel>
                  <Cel>{leesbaar(p.soort)}</Cel>
                  <Cel>{p.naam ?? `#${p.geaccrediteerdeId}`}</Cel>
                  <Cel>{p.instrumentId}</Cel>
                  <Cel>
                    <Knop
                      klik={async () => {
                        const uit = await stuur(
                          "POST",
                          `/api/bekwaamheid/agenda/${p.id}/afhandelen`,
                          {},
                        );
                        if (uit) {
                          zetGelukt("De post is afgehandeld.");
                          vernieuw();
                        }
                      }}
                    >
                      Afhandelen
                    </Knop>
                  </Cel>
                </tr>
              ))}
            </Tabel>
          )}
        </Kaart>

        <Kaart
          kop="Een tussentijdse toets doen"
          onderkop="De toets hangt aan een licentie en niet aan een persoon: iemand kan meerdere licenties hebben, en elke licentie heeft haar eigen cyclus met haar eigen peildatum."
        >
          <Nieuw
            klaar={async (waarden) => {
              const uit = await stuur("POST", "/api/bekwaamheid/toetsen", waarden);
              if (uit) {
                zetGelukt("De toets is gerekend en staat in het dossier.");
                vernieuw();
              }
            }}
          />
        </Kaart>

        <Kaart
          kop="De toetsen van één geaccrediteerde"
          onderkop="Met de signalen en de bindende regel erbij. Is er in het venster geen afgeronde oefensessie, dan staat het gemiddelde leeg en niet op nul: een nul zou een score suggereren die niemand haalde."
        >
          <Invoer label="Registernummer" waarde={persoonId} zet={zetPersoonId} soort="number" />

          {!geldig ? (
            <Leeg tekst="Vul een registernummer in." />
          ) : toetsen.isLoading ? (
            <Leeg tekst="De toetsen worden opgehaald." />
          ) : lijst.length === 0 ? (
            <Leeg tekst="Voor deze geaccrediteerde staat er nog geen tussentijdse toets." />
          ) : (
            lijst.map((t) => (
              <ToetsKaart
                key={t.id}
                toets={t}
                stuur={stuur}
                gelukt={(m) => {
                  zetGelukt(m);
                  vernieuw();
                }}
              />
            ))
          )}
        </Kaart>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Nieuw({ klaar }: { klaar: (waarden: Record<string, unknown>) => Promise<void> }) {
  const [licentieId, zetLicentieId] = useState("");
  const [peildatum, zetPeildatum] = useState("");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
      <Invoer label="Licentienummer" waarde={licentieId} zet={zetLicentieId} soort="number" />
      <Invoer
        label="Peildatum"
        waarde={peildatum}
        zet={zetPeildatum}
        soort="date"
        toelichting="Leeg laten voor vandaag."
      />
      <Knop
        soort="hoofd"
        uit={licentieId.trim() === ""}
        klik={async () => {
          await klaar({
            licentieId: Number(licentieId),
            peildatum: peildatum.trim() || undefined,
          });
          zetLicentieId("");
        }}
      >
        Toets rekenen
      </Knop>
    </div>
  );
}

function ToetsKaart({
  toets,
  stuur,
  gelukt,
}: {
  toets: Toets;
  stuur: (methode: string, pad: string, lichaam?: unknown) => Promise<unknown | null>;
  gelukt: (melding: string) => void;
}) {
  const alert = toets.berekendeUitkomst === "alert";
  return (
    <div
      style={{
        border: `1px solid ${alert ? KLEUR.aandacht : KLEUR.rand}`,
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 14,
        background: KLEUR.wit,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: KLEUR.donker }}>
          Toets {toets.id} — {toets.instrumentId}
        </h3>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: alert ? KLEUR.aandacht : KLEUR.tekst,
          }}
        >
          Berekend: {leesbaar(toets.berekendeUitkomst)}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 12 }}>
        <Veld label="Peildatum" waarde={datum(toets.peildatum)} />
        <Veld label="Venster" waarde={`${datum(toets.vensterVan)} — ${datum(toets.vensterTot)}`} />
        <Veld label="Afnames" waarde={`${toets.afnamesAantal} van ${toets.afnamesDrempel}`} />
        <Veld label="Oefensessies" waarde={toets.stmSessies} />
        <Veld
          label="Gemiddelde oefensessies"
          waarde={toets.stmGemiddelde === null ? "niet gemeten" : toets.stmGemiddelde.toFixed(1)}
        />
        <Veld
          label="Vastgesteld"
          waarde={toets.uitkomst ? leesbaar(toets.uitkomst) : "nog niet"}
        />
        <Veld label="Vastgesteld op" waarde={datum(toets.vastgesteldOp)} />
        <Veld label="Besproken op" waarde={datum(toets.besprokenOp)} />
        <Veld label="Gepubliceerd op" waarde={datum(toets.gepubliceerdOp)} />
        <Veld label="Coachingsplan" waarde={toets.coachingsplanId ?? "geen"} />
      </div>

      <p
        style={{
          margin: "0 0 12px",
          padding: "9px 11px",
          fontSize: 13,
          background: KLEUR.achtergrond,
          border: `1px solid ${KLEUR.rand}`,
          borderRadius: 6,
        }}
      >
        <strong>Bindende regel:</strong> {toets.bindendeRegel}
      </p>

      {toets.signalen.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 5px", fontSize: 13, color: KLEUR.donker }}>De signalen</h4>
          <ul style={{ margin: "0 0 0 18px", fontSize: 13, lineHeight: 1.65 }}>
            {toets.signalen.map((s, n) => (
              <li key={n}>
                <strong>{leesbaar(s.naam)}</strong>
                {typeof s.toelichting === "string" ? ` — ${s.toelichting}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: KLEUR.zacht }}>
          Geen signaal in dit venster.
        </p>
      )}

      {toets.stmPerLaag && Object.keys(toets.stmPerLaag).length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ margin: "0 0 5px", fontSize: 13, color: KLEUR.donker }}>
            Oefensessies per laag
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {Object.entries(toets.stmPerLaag).map(([laag, waarde]) => (
              <Veld key={laag} label={leesbaar(laag)} waarde={waarde.toFixed(1)} />
            ))}
          </div>
        </div>
      ) : null}

      {toets.uitkomst === null ? (
        <Vaststellen
          berekend={toets.berekendeUitkomst}
          klaar={async (waarden) => {
            const uit = await stuur(
              "POST",
              `/api/bekwaamheid/toetsen/${toets.id}/vaststellen`,
              waarden,
            );
            if (uit) gelukt("De toets is vastgesteld.");
          }}
        />
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <Gesprek
            klaar={async (waarden) => {
              const uit = await stuur(
                "POST",
                `/api/bekwaamheid/toetsen/${toets.id}/gesprek`,
                waarden,
              );
              if (uit) gelukt("Het gesprek staat in het dossier.");
            }}
          />
          <Knop
            soort="hoofd"
            uit={toets.gepubliceerdOp !== null}
            klik={async () => {
              const uit = await stuur(
                "POST",
                `/api/bekwaamheid/toetsen/${toets.id}/publiceren`,
                {},
              );
              if (uit) gelukt("De toets is gepubliceerd.");
            }}
          >
            Publiceren
          </Knop>
        </div>
      )}

      {toets.uitkomst !== null && toets.coachingsplanId === null ? (
        <Plan
          toetsId={toets.id}
          verplicht={toets.uitkomst === "alert"}
          stuur={stuur}
          gelukt={gelukt}
        />
      ) : null}
    </div>
  );
}

function Vaststellen({
  berekend,
  klaar,
}: {
  berekend: string;
  klaar: (waarden: Record<string, unknown>) => Promise<void>;
}) {
  const [uitkomst, zetUitkomst] = useState("");
  const [motivering, zetMotivering] = useState("");
  const [besproken, zetBesproken] = useState("");

  const wijktAf = uitkomst !== "" && uitkomst !== berekend;
  const kort = motivering.trim().length < 40;

  return (
    <div style={{ borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 12, marginTop: 4 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 13, color: KLEUR.donker }}>De toets vaststellen</h4>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "72ch" }}>
        De keuze staat leeg en wordt niet voorgevuld met <strong>{leesbaar(berekend)}</strong>. De
        berekening blijft naast de vaststelling staan, ook wanneer er van afgeweken wordt.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Keuze
          label="Vastgestelde uitkomst"
          waarde={uitkomst}
          zet={zetUitkomst}
          opties={[{ waarde: "", tekst: "Kies een uitkomst" }, ...TOETSUITKOMSTEN]}
        />
        <Invoer
          label="Besproken op"
          waarde={besproken}
          zet={zetBesproken}
          soort="date"
          toelichting="Mag later."
        />
      </div>
      {wijktAf ? (
        <Tekstvak
          label="Motivering van de afwijking"
          waarde={motivering}
          zet={zetMotivering}
          regels={3}
          toelichting={kort ? `Minstens veertig tekens; nu ${motivering.trim().length}` : undefined}
        />
      ) : null}
      <Knop
        soort="hoofd"
        uit={uitkomst === "" || (wijktAf && kort)}
        klik={() =>
          klaar({
            uitkomst,
            afwijkingMotivering: wijktAf ? motivering.trim() : undefined,
            besprokenOp: besproken.trim() || undefined,
          })
        }
      >
        Vaststellen
      </Knop>
    </div>
  );
}

function Gesprek({ klaar }: { klaar: (waarden: Record<string, unknown>) => Promise<void> }) {
  const [op, zetOp] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <Invoer label="Gesprek op" waarde={op} zet={zetOp} soort="date" />
      <Knop uit={op.trim() === ""} klik={() => klaar({ besprokenOp: op.trim() })}>
        Gesprek vastleggen
      </Knop>
    </div>
  );
}

function Plan({
  toetsId,
  verplicht,
  stuur,
  gelukt,
}: {
  toetsId: number;
  verplicht: boolean;
  stuur: (methode: string, pad: string, lichaam?: unknown) => Promise<unknown | null>;
  gelukt: (melding: string) => void;
}) {
  const [doel, zetDoel] = useState("");
  const [afspraken, zetAfspraken] = useState("");
  const [begeleider, zetBegeleider] = useState("");
  const [evaluatie, zetEvaluatie] = useState("");
  const [planId, zetPlanId] = useState<number | null>(null);
  const [uitkomst, zetUitkomst] = useState("");

  const regels = afspraken
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  if (planId !== null) {
    return (
      <div style={{ borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 12, marginTop: 12 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: 13, color: KLEUR.donker }}>
          Coachingsplan {planId}
        </h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <Knop
            klik={async () => {
              const uit = await stuur(
                "POST",
                `/api/bekwaamheid/coachingsplannen/${planId}/akkoord`,
                {},
              );
              if (uit) gelukt("Het akkoord van de betrokkene staat vast.");
            }}
          >
            Akkoord vastleggen
          </Knop>
          <Keuze
            label="Afsluiten met"
            waarde={uitkomst}
            zet={zetUitkomst}
            opties={[{ waarde: "", tekst: "Kies een uitkomst" }, ...PLANUITKOMSTEN]}
          />
          <Knop
            uit={uitkomst === ""}
            klik={async () => {
              const uit = await stuur(
                "POST",
                `/api/bekwaamheid/coachingsplannen/${planId}/afsluiten`,
                { uitkomst },
              );
              if (uit) gelukt("Het coachingsplan is afgesloten.");
            }}
          >
            Plan afsluiten
          </Knop>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 12, marginTop: 12 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 13, color: KLEUR.donker }}>
        Een coachingsplan aanleggen
      </h4>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "72ch" }}>
        {verplicht
          ? "Bij een alert hoort een plan. Het plan is geen sanctie: het benoemt één doel en de afspraken die daarbij horen, met een evaluatiemoment na zes maanden."
          : "Ook zonder alert mag er een plan komen. De module laat dat toe en legt het vast; dat een plan zonder signaal mogelijk is, is bewust en staat als zodanig in de toetsen vastgelegd."}
      </p>
      <Tekstvak label="Het doel" waarde={doel} zet={zetDoel} regels={2} />
      <Tekstvak
        label="De afspraken — één per regel"
        waarde={afspraken}
        zet={zetAfspraken}
        regels={4}
        toelichting={`Minstens één afspraak; nu ${regels.length}`}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Invoer
          label="Begeleider"
          waarde={begeleider}
          zet={zetBegeleider}
          soort="number"
          toelichting="Mag leeg blijven."
        />
        <Invoer
          label="Evaluatie op"
          waarde={evaluatie}
          zet={zetEvaluatie}
          soort="date"
          toelichting="Leeg laten voor zes maanden."
        />
      </div>
      <Knop
        soort="hoofd"
        uit={doel.trim().length === 0 || regels.length === 0}
        klik={async () => {
          const uit = (await stuur("POST", "/api/bekwaamheid/coachingsplannen", {
            toetsId,
            doel: doel.trim(),
            afspraken: regels,
            begeleiderId: begeleider.trim() ? Number(begeleider) : undefined,
            evaluatieOp: evaluatie.trim() || undefined,
          })) as { planId?: number } | null;
          if (uit?.planId) {
            zetPlanId(uit.planId);
            gelukt("Het coachingsplan staat vast.");
          }
        }}
      >
        Coachingsplan vastleggen
      </Knop>
    </div>
  );
}
