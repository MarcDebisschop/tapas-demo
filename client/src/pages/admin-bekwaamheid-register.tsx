// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid-register.tsx — levering 1 uit het
// vervolgplan: /admin/bekwaamheid/register — het register van geaccrediteerden,
// met hun licenties en hun accreditaties.
//
// Dit is de plaats waar een mens in het dossier komt te staan. Alles wat daarna
// gebeurt — een ronde, een beslissing, een bezwaar, een tussentijdse toets —
// verwijst hierheen.
//
// Vier dingen die dit scherm bewust NIET doet.
//
// Het verwijdert niemand. Er is geen wisknop en er komt er geen, want rondes,
// beslissingen en bezwaren verwijzen naar deze rijen en die verwijzingen blijven
// bestaan zolang de bewaartermijn loopt. Wie weg moet, gaat op inactief, met een
// reden die in het auditspoor komt.
//
// Het trekt een accreditatie niet weg. Intrekken zet een datum en een reden; de
// rij blijft staan. Een ingetrokken accreditatie is een feit uit het verleden en
// geen vergissing die verdwijnt.
//
// Het rekent geen datum uit. Wanneer de volgende bekrachtiging valt en wanneer
// de tussentijdse toets verwacht wordt, staat in de licentie zoals de server hem
// heeft berekend. Het scherm telt geen maanden bij een datum op.
//
// Het bepaalt geen status. De zeven licentiestatussen komen uit een beslissing
// of uit de overgangsregeling. Er is hier geen keuzelijst waarmee een beheerder
// iemand op "bekrachtigd" zet: dat zou de hele beslislaag omzeilen.
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// De drie herkomsten van een accreditatiebewijs. Gelijk aan BEWIJSHERKOMSTEN in
// server/bekwaamheid/schema.ts; de server weigert alles wat er niet in staat.
const HERKOMSTEN = [
  { waarde: "academy", tekst: "Academy — opleiding in het platform" },
  { waarde: "historisch", tekst: "Historisch — behaald voor de module bestond" },
  { waarde: "handmatig", tekst: "Handmatig — door een beheerder vastgelegd" },
] as const;

type Persoon = {
  id: number;
  naam: string;
  email: string | null;
  beheerderId: number | null;
  coachRegisterId: number | null;
  landcode: string;
  taal: string;
  isTrainer: boolean;
  actief: boolean;
  licenties: Licentie[];
  accreditaties: Accreditatie[];
};

type Licentie = {
  id: number;
  geaccrediteerdeId: number;
  instrumentId: string;
  status: string;
  geldigVan: string;
  geldigTot: string | null;
  laatsteBekrachtiging: string | null;
  volgendeBekrachtiging: string | null;
  volgendeTussentijdseToets: string | null;
  alertActief: boolean;
  voorwaardeTekst: string | null;
  voorwaardeVoor: string | null;
};

type Accreditatie = {
  id: number;
  instrumentId: string;
  niveau: number;
  behaaldOp: string;
  bewijsHerkomst: string;
  ingetrokkenOp: string | null;
  ingetrokkenReden: string | null;
};

export default function AdminBekwaamheidRegister() {
  const rij = useQueryClient();
  const [alle, zetAlle] = useState(false);
  const [gekozen, zetGekozen] = useState<number | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const [gelukt, zetGelukt] = useState<string | null>(null);

  const lijst = useQuery<{ personen: Persoon[] }>({
    queryKey: ["/api/bekwaamheid/register", alle],
    // `apiRequest` zet zelf het basispad ervoor en gooit bij een foutstatus de
    // tekst van de server als melding. Die tekst is voor een beheerder
    // geschreven en wordt hier niet herschreven.
    queryFn: async () =>
      apiRequest("GET", `/api/bekwaamheid/register${alle ? "?alle=1" : ""}`).then((r) => r.json()),
  });

  function vernieuw() {
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/register"] });
  }

  /** Eén plaats waar een mislukt verzoek zijn tekst kwijt kan. */
  async function stuur(methode: string, pad: string, lichaam?: unknown): Promise<unknown | null> {
    zetFout(null);
    zetGelukt(null);
    try {
      const antwoord = await apiRequest(methode, pad, lichaam);
      return await antwoord.json();
    } catch (e) {
      zetFout(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  const personen = lijst.data?.personen ?? [];
  const persoon = personen.find((p) => p.id === gekozen) ?? null;

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
          Register van geaccrediteerden
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: KLEUR.zacht, maxWidth: "76ch" }}>
          Wie in dit register staat, kan een licentie hebben en een bekwaamheidsronde doorlopen. Een
          rij verdwijnt hier niet: wie niet meer werkt met een instrument, gaat op inactief met een
          reden. Die reden komt in het auditspoor te staan.
        </p>

        <Melding soort="fout" tekst={fout} />
        <Melding soort="goed" tekst={gelukt} />

        <Inschrijven
          klaar={async (waarden) => {
            const uit = await stuur("POST", "/api/bekwaamheid/register", waarden);
            if (uit) {
              zetGelukt(`${waarden.naam} staat in het register.`);
              vernieuw();
            }
          }}
        />

        <Kaart
          kop="Het register"
          onderkop={
            alle
              ? "Alle rijen, ook de inactieve."
              : "Alleen de actieve rijen. Zet de schakelaar om om ook de inactieve te zien."
          }
          rechts={
            <Knop klik={() => zetAlle(!alle)}>{alle ? "Alleen actieve" : "Ook inactieve"}</Knop>
          }
        >
          {lijst.isLoading ? (
            <Leeg tekst="Het register wordt opgehaald." />
          ) : personen.length === 0 ? (
            <Leeg
              tekst={
                alle
                  ? "Het register is leeg. Er is nog niemand ingeschreven."
                  : "Er staat niemand actief in het register. Er kunnen wel inactieve rijen zijn."
              }
            />
          ) : (
            <Tabel
              koppen={["Naam", "E-mail", "Licenties", "Accreditaties", "Stand", "", ""] as const}
            >
              {personen.map((p) => (
                <tr key={p.id} style={{ background: p.id === gekozen ? "#f8f6f1" : "transparent" }}>
                  <Cel>{p.naam}</Cel>
                  <Cel>{p.email ?? "—"}</Cel>
                  <Cel>{p.licenties.length}</Cel>
                  <Cel>{p.accreditaties.filter((a) => !a.ingetrokkenOp).length}</Cel>
                  <Cel>
                    <span style={{ color: p.actief ? KLEUR.tekst : KLEUR.aandacht }}>
                      {p.actief ? "Actief" : "Inactief"}
                    </span>
                  </Cel>
                  <Cel>
                    <Knop klik={() => zetGekozen(p.id === gekozen ? null : p.id)}>
                      {p.id === gekozen ? "Sluiten" : "Dossier"}
                    </Knop>
                  </Cel>
                  <Cel>
                    {p.actief ? (
                      <Inactief
                        klaar={async (reden) => {
                          const uit = await stuur(
                            "POST",
                            `/api/bekwaamheid/register/${p.id}/inactief`,
                            { reden },
                          );
                          if (uit) {
                            zetGelukt(`${p.naam} staat op inactief.`);
                            vernieuw();
                          }
                        }}
                      />
                    ) : (
                      <span style={{ color: KLEUR.zacht }}>—</span>
                    )}
                  </Cel>
                </tr>
              ))}
            </Tabel>
          )}
        </Kaart>

        {persoon ? (
          <>
            <Kaart
              kop={`Licenties van ${persoon.naam}`}
              onderkop="De status komt uit een beslissing of uit de overgangsregeling. Er is hier geen keuzelijst waarmee een status met de hand te zetten is; dat zou de beslislaag omzeilen."
            >
              {persoon.licenties.length === 0 ? (
                <Leeg tekst="Deze persoon heeft nog geen licentie. Een overgangsperiode is de enige weg om er een aan te leggen zonder ronde." />
              ) : (
                <Tabel
                  koppen={
                    [
                      "Instrument",
                      "Status",
                      "Geldig van",
                      "Geldig tot",
                      "Volgende bekrachtiging",
                      "Tussentijdse toets",
                      "Alert",
                      "",
                    ] as const
                  }
                >
                  {persoon.licenties.map((l) => (
                    <tr key={l.id}>
                      <Cel>{l.instrumentId}</Cel>
                      <Cel>
                        <span
                          style={{
                            color:
                              l.status === "opgeschort" || l.status === "beeindigd"
                                ? KLEUR.aandacht
                                : KLEUR.tekst,
                          }}
                        >
                          {leesbaar(l.status)}
                        </span>
                      </Cel>
                      <Cel>{datum(l.geldigVan)}</Cel>
                      <Cel>{datum(l.geldigTot)}</Cel>
                      <Cel>{datum(l.volgendeBekrachtiging)}</Cel>
                      <Cel>{datum(l.volgendeTussentijdseToets)}</Cel>
                      <Cel>
                        <span style={{ color: l.alertActief ? KLEUR.aandacht : KLEUR.zacht }}>
                          {l.alertActief ? "Alert" : "—"}
                        </span>
                      </Cel>
                      <Cel>
                        <Knop
                          klik={async () => {
                            const uit = await stuur(
                              "POST",
                              `/api/bekwaamheid/licenties/${l.id}/alert`,
                              { actief: !l.alertActief },
                            );
                            if (uit) {
                              zetGelukt(
                                l.alertActief
                                  ? "De alertvlag staat uit."
                                  : "De alertvlag staat aan. Die vermelding hoort bij een coachingsplan.",
                              );
                              vernieuw();
                            }
                          }}
                        >
                          {l.alertActief ? "Alert weghalen" : "Alert zetten"}
                        </Knop>
                      </Cel>
                    </tr>
                  ))}
                </Tabel>
              )}
              {persoon.licenties.some((l) => l.voorwaardeTekst) ? (
                <div style={{ marginTop: 12 }}>
                  {persoon.licenties
                    .filter((l) => l.voorwaardeTekst)
                    .map((l) => (
                      <p key={l.id} style={{ margin: "0 0 6px", fontSize: 13 }}>
                        <strong>{l.instrumentId}</strong> — voorwaarde tot {datum(l.voorwaardeVoor)}:{" "}
                        {l.voorwaardeTekst}
                      </p>
                    ))}
                </div>
              ) : null}

              <Overgangsperiode
                persoonId={persoon.id}
                klaar={async (waarden) => {
                  const uit = await stuur(
                    "POST",
                    "/api/bekwaamheid/licenties/overgangsperiode",
                    waarden,
                  );
                  if (uit) {
                    zetGelukt("De overgangsperiode staat vast.");
                    vernieuw();
                  }
                }}
              />
            </Kaart>

            <Kaart
              kop={`Accreditaties van ${persoon.naam}`}
              onderkop="Een accreditatie is het bewijs van een opleiding. Intrekken zet een datum en een reden; de rij blijft staan, want ze is een feit uit het verleden."
            >
              {persoon.accreditaties.length === 0 ? (
                <Leeg tekst="Er staat nog geen accreditatie op naam van deze persoon." />
              ) : (
                <Tabel
                  koppen={
                    [
                      "Instrument",
                      "Niveau",
                      "Behaald op",
                      "Herkomst",
                      "Ingetrokken",
                      "Reden",
                      "",
                    ] as const
                  }
                >
                  {persoon.accreditaties.map((a) => (
                    <tr key={a.id}>
                      <Cel>{a.instrumentId}</Cel>
                      <Cel>{a.niveau}</Cel>
                      <Cel>{datum(a.behaaldOp)}</Cel>
                      <Cel>{leesbaar(a.bewijsHerkomst)}</Cel>
                      <Cel>
                        <span style={{ color: a.ingetrokkenOp ? KLEUR.aandacht : KLEUR.zacht }}>
                          {datum(a.ingetrokkenOp)}
                        </span>
                      </Cel>
                      <Cel breed>{a.ingetrokkenReden ?? "—"}</Cel>
                      <Cel>
                        {a.ingetrokkenOp ? (
                          <span style={{ color: KLEUR.zacht }}>—</span>
                        ) : (
                          <Intrekken
                            klaar={async (reden) => {
                              const uit = await stuur(
                                "POST",
                                `/api/bekwaamheid/accreditaties/${a.id}/intrekken`,
                                { reden },
                              );
                              if (uit) {
                                zetGelukt("De accreditatie is ingetrokken en blijft bewaard.");
                                vernieuw();
                              }
                            }}
                          />
                        )}
                      </Cel>
                    </tr>
                  ))}
                </Tabel>
              )}

              <Accrediteren
                persoonId={persoon.id}
                klaar={async (waarden) => {
                  const uit = await stuur("POST", "/api/bekwaamheid/accreditaties", waarden);
                  if (uit) {
                    zetGelukt("De accreditatie staat vast.");
                    vernieuw();
                  }
                }}
              />
            </Kaart>

            <Kaart kop="Gegevens" onderkop="Zoals ze in het register staan.">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
                <Veld label="Registernummer" waarde={persoon.id} />
                <Veld label="E-mail" waarde={persoon.email ?? "—"} />
                <Veld label="Beheerder-id" waarde={persoon.beheerderId ?? "—"} />
                <Veld label="Coachregister-id" waarde={persoon.coachRegisterId ?? "—"} />
                <Veld label="Landcode" waarde={persoon.landcode} />
                <Veld label="Taal" waarde={persoon.taal} />
                <Veld label="Trainer" waarde={persoon.isTrainer ? "Ja" : "Nee"} />
                <Veld label="Stand" waarde={persoon.actief ? "Actief" : "Inactief"} />
              </div>
            </Kaart>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// De vier invoervakken. Elk vak houdt zijn eigen waarden bij en geeft ze in één
// keer af; er wordt niets bewaard terwijl er getypt wordt.
// ---------------------------------------------------------------------------

function Inschrijven({
  klaar,
}: {
  klaar: (waarden: {
    naam: string;
    email?: string;
    beheerderId?: number;
    coachRegisterId?: number;
  }) => Promise<void>;
}) {
  const [naam, zetNaam] = useState("");
  const [email, zetEmail] = useState("");
  const [beheerderId, zetBeheerderId] = useState("");
  const [coachId, zetCoachId] = useState("");
  const bezig = useMutation({
    mutationFn: async () => {
      await klaar({
        naam: naam.trim(),
        email: email.trim() || undefined,
        beheerderId: beheerderId.trim() ? Number(beheerderId) : undefined,
        coachRegisterId: coachId.trim() ? Number(coachId) : undefined,
      });
      zetNaam("");
      zetEmail("");
      zetBeheerderId("");
      zetCoachId("");
    },
  });

  // De databank eist dat iemand te vinden is: een e-mailadres, een beheerder-id
  // of een coachregister-id. Een naam alleen is niet genoeg, want twee mensen
  // kunnen dezelfde naam hebben en het dossier moet naar één mens verwijzen.
  const teVinden = email.trim().length > 0 || beheerderId.trim() !== "" || coachId.trim() !== "";

  return (
    <Kaart
      kop="Iemand inschrijven"
      onderkop="Een naam alleen is niet genoeg. Er moet een e-mailadres, een beheerder-id of een coachregister-id bij, want het dossier moet naar één mens verwijzen en twee mensen kunnen dezelfde naam hebben."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Invoer label="Naam" waarde={naam} zet={zetNaam} />
        <Invoer label="E-mail" waarde={email} zet={zetEmail} soort="email" />
        <Invoer
          label="Beheerder-id"
          waarde={beheerderId}
          zet={zetBeheerderId}
          soort="number"
          toelichting="Als de persoon al beheerder is."
        />
        <Invoer
          label="Coachregister-id"
          waarde={coachId}
          zet={zetCoachId}
          soort="number"
          toelichting="Als de persoon al coach is."
        />
      </div>
      <Knop
        soort="hoofd"
        bezig={bezig.isPending}
        uit={naam.trim().length === 0 || !teVinden}
        klik={() => bezig.mutate()}
      >
        Inschrijven
      </Knop>
      {naam.trim().length > 0 && !teVinden ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: KLEUR.zacht }}>
          Vul een e-mailadres, een beheerder-id of een coachregister-id in.
        </p>
      ) : null}
    </Kaart>
  );
}

function Inactief({ klaar }: { klaar: (reden: string) => Promise<void> }) {
  const [open, zetOpen] = useState(false);
  const [reden, zetReden] = useState("");
  if (!open) return <Knop soort="aandacht" klik={() => zetOpen(true)}>Inactief</Knop>;
  return (
    <div style={{ minWidth: 240 }}>
      <Tekstvak
        label="Reden"
        waarde={reden}
        zet={zetReden}
        regels={2}
        toelichting="De reden komt in het auditspoor"
      />
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

function Intrekken({ klaar }: { klaar: (reden: string) => Promise<void> }) {
  const [open, zetOpen] = useState(false);
  const [reden, zetReden] = useState("");
  if (!open) return <Knop soort="aandacht" klik={() => zetOpen(true)}>Intrekken</Knop>;
  return (
    <div style={{ minWidth: 240 }}>
      <Tekstvak
        label="Reden van intrekking"
        waarde={reden}
        zet={zetReden}
        regels={2}
        toelichting="Minstens tien tekens"
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Knop
          soort="aandacht"
          uit={reden.trim().length < 10}
          klik={async () => {
            await klaar(reden.trim());
            zetReden("");
            zetOpen(false);
          }}
        >
          Intrekken
        </Knop>
        <Knop klik={() => zetOpen(false)}>Afzien</Knop>
      </div>
    </div>
  );
}

function Overgangsperiode({
  persoonId,
  klaar,
}: {
  persoonId: number;
  klaar: (waarden: {
    geaccrediteerdeId: number;
    instrumentId: string;
    geldigVan?: string;
  }) => Promise<void>;
}) {
  const [instrument, zetInstrument] = useState("");
  const [van, zetVan] = useState("");
  return (
    <div style={{ marginTop: 18, borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 14 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, color: KLEUR.donker }}>
        Een overgangsperiode openen
      </h3>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "70ch" }}>
        Een overgangsperiode geeft afnamerecht zonder dat er al een ronde gelopen is. Ze bestaat voor
        wie al met een instrument werkte voordat deze module er was. De einddatum wordt door de
        server gezet, niet hier.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Invoer label="Instrument-id" waarde={instrument} zet={zetInstrument} />
        <Invoer
          label="Geldig van"
          waarde={van}
          zet={zetVan}
          soort="date"
          toelichting="Leeg laten voor vandaag."
        />
      </div>
      <Knop
        uit={instrument.trim().length === 0}
        klik={async () => {
          await klaar({
            geaccrediteerdeId: persoonId,
            instrumentId: instrument.trim(),
            geldigVan: van.trim() || undefined,
          });
          zetInstrument("");
          zetVan("");
        }}
      >
        Overgangsperiode vastleggen
      </Knop>
    </div>
  );
}

function Accrediteren({
  persoonId,
  klaar,
}: {
  persoonId: number;
  klaar: (waarden: {
    geaccrediteerdeId: number;
    instrumentId: string;
    niveau: number;
    behaaldOp: string;
    bewijsHerkomst: string;
    opleidingId?: number;
  }) => Promise<void>;
}) {
  const [instrument, zetInstrument] = useState("");
  const [niveau, zetNiveau] = useState("1");
  const [behaaldOp, zetBehaaldOp] = useState("");
  const [herkomst, zetHerkomst] = useState<string>(HERKOMSTEN[0].waarde);
  const [opleidingId, zetOpleidingId] = useState("");
  const volledig =
    instrument.trim().length > 0 && behaaldOp.trim().length > 0 && niveau.trim().length > 0;
  return (
    <div style={{ marginTop: 18, borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 14 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, color: KLEUR.donker }}>
        Een accreditatie vastleggen
      </h3>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "70ch" }}>
        De herkomst zegt waar het bewijs vandaan komt. Dat onderscheid blijft nodig: bij een
        historisch bewijs is er geen opleidingsdossier in het platform om op terug te vallen.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Invoer label="Instrument-id" waarde={instrument} zet={zetInstrument} />
        <Invoer label="Niveau" waarde={niveau} zet={zetNiveau} soort="number" />
        <Invoer label="Behaald op" waarde={behaaldOp} zet={zetBehaaldOp} soort="date" />
        <Keuze label="Herkomst" waarde={herkomst} zet={zetHerkomst} opties={HERKOMSTEN} />
        <Invoer
          label="Opleiding-id"
          waarde={opleidingId}
          zet={zetOpleidingId}
          soort="number"
          toelichting="Alleen bij een Academy-opleiding."
        />
      </div>
      <Knop
        uit={!volledig}
        klik={async () => {
          await klaar({
            geaccrediteerdeId: persoonId,
            instrumentId: instrument.trim(),
            niveau: Number(niveau),
            behaaldOp: behaaldOp.trim(),
            bewijsHerkomst: herkomst,
            opleidingId: opleidingId.trim() ? Number(opleidingId) : undefined,
          });
          zetInstrument("");
          zetBehaaldOp("");
          zetOpleidingId("");
        }}
      >
        Accreditatie vastleggen
      </Knop>
    </div>
  );
}
