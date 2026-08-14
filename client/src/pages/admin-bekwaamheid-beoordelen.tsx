// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid-beoordelen.tsx — levering 5 uit het
// vervolgplan: /admin/bekwaamheid/beoordelen — scoren en de kennischeck.
//
// Dit is de plek waar een beoordelaar zijn scores op een bewijsstuk zet, waar
// twee beoordelaars naast elkaar te zien zijn, en waar de kennischeck van een
// dossier wordt samengesteld, ingeleverd en nagekeken.
//
// Vier dingen die dit scherm bewust NIET doet.
//
// Het kiest de beoordelaar niet. Wie scoort, is wie is aangemeld; het scherm
// stuurt geen beoordelaar-id mee en de server neemt er ook geen aan. Kon dat wel,
// dan kon één persoon twee scores op twee namen zetten, en dan is de dubbele
// beoordeling die de hele opzet draagt een formaliteit.
//
// Het rondt niet automatisch af nadat de laatste score staat. Afronden is een
// aparte handeling, omdat de module niet weet hoeveel beoordelaars er hadden
// moeten zijn. Zou ze na één score afronden, dan zag een dossier met één
// beoordelaar eruit als een dossier met twee.
//
// Het herziet geen score van iemand anders. De server weigert dat; het scherm
// biedt de knop alleen aan bij de eigen scores en toont bij de andere waarom.
//
// Het rekent de kennischeck niet zelf na. De nakijkuitslag komt gerekend van de
// server, met de uitgesloten items erbij. Twee rekenplaatsen leveren na de eerste
// wijziging twee uitslagen op, en dan is niet meer te zeggen welke gold.
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

type Score = {
  id: number;
  bewijsstukId: number;
  beoordelaarId: number;
  onderdeel: string;
  score: number;
  onderbouwing: string;
  ingevoerdOp: string;
  isKalibratie: boolean;
};

type Itemset = {
  id: number;
  rondeId: number;
  bewijsstukNummer: number;
  status: string;
  itemIds: number[];
  antwoorden: Record<string, string> | null;
  score: number | null;
  geslaagd: boolean | null;
  aangemaaktOp: string;
  ingeleverdOp: string | null;
  nagekekenOp: string | null;
};

/** De vier scores die op elk bewijsstuk gezet worden. Vrije tekst blijft mogelijk. */
const ONDERDELEN = [
  "vakinhoud",
  "gespreksvoering",
  "zorgvuldigheid",
  "verantwoording",
] as const;

export default function AdminBekwaamheidBeoordelen() {
  const rij = useQueryClient();
  const [bewijsstukId, zetBewijsstukId] = useState("");
  const [rondeId, zetRondeId] = useState("");
  const [nummer, zetNummer] = useState("1");
  const [fout, zetFout] = useState<string | null>(null);
  const [gelukt, zetGelukt] = useState<string | null>(null);

  // Het bewijsstuk of de ronde kan uit de zoekbalk komen: de rondepagina linkt
  // hierheen met ?bewijsstuk= of ?ronde=.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const b = p.get("bewijsstuk");
    const r = p.get("ronde");
    if (b) zetBewijsstukId(b);
    if (r) zetRondeId(r);
  }, []);

  const bId = Number(bewijsstukId);
  const geldigB = bewijsstukId.trim() !== "" && Number.isFinite(bId) && bId > 0;

  const scores = useQuery<{ scores: Score[] }>({
    queryKey: ["/api/bekwaamheid/scores", bewijsstukId],
    enabled: geldigB,
    queryFn: async () =>
      apiRequest("GET", `/api/bekwaamheid/bewijsstukken/${bId}/scores`).then((r) => r.json()),
  });

  const rId = Number(rondeId);
  const geldigR = rondeId.trim() !== "" && Number.isFinite(rId) && rId > 0;

  const set = useQuery<{ itemset: Itemset | null; items?: unknown[] }>({
    queryKey: ["/api/bekwaamheid/itemset", rondeId, nummer],
    enabled: geldigR,
    retry: false,
    queryFn: async () =>
      apiRequest("GET", `/api/bekwaamheid/itemset/${rId}/${Number(nummer)}`).then((r) => r.json()),
  });

  function vernieuw() {
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/scores"] });
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/itemset"] });
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

  const alle = scores.data?.scores ?? [];
  const beoordelaars = Array.from(new Set(alle.map((s) => s.beoordelaarId)));

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
          Beoordelen
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: KLEUR.zacht, maxWidth: "78ch" }}>
          Wie scoort, is wie is aangemeld: dit scherm stuurt geen beoordelaar mee en de server neemt er
          ook geen aan. Zo staat elke score op naam van wie hem echt gaf, en betekent een tweede score
          werkelijk een tweede paar ogen.
        </p>

        <Melding soort="fout" tekst={fout} />
        <Melding soort="goed" tekst={gelukt} />

        <Kaart
          kop="Welk bewijsstuk"
          onderkop="Het nummer van het bewijsstuk staat in het dossier op de rondepagina. Vanaf daar linkt de knop Beoordelen rechtstreeks hierheen."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Invoer
              label="Bewijsstuknummer"
              waarde={bewijsstukId}
              zet={zetBewijsstukId}
              soort="number"
            />
            <Veld label="Scores" waarde={alle.length} />
            <Veld label="Beoordelaars" waarde={beoordelaars.length} />
          </div>
          {geldigB && beoordelaars.length === 1 && alle.length > 0 ? (
            <Melding
              soort="fout"
              tekst="Er staat maar één beoordelaar op dit bewijsstuk. Afronden mag, maar de tweede blik ontbreekt dan in het dossier."
            />
          ) : null}
        </Kaart>

        {geldigB ? (
          <>
            <Invoeren
              klaar={async (waarden) => {
                const uit = await stuur(
                  "POST",
                  `/api/bekwaamheid/bewijsstukken/${bId}/scores`,
                  waarden,
                );
                if (uit) {
                  zetGelukt("De score staat vast.");
                  vernieuw();
                }
              }}
            />

            <Kaart
              kop="De ingevoerde scores"
              onderkop="Van alle beoordelaars, met de onderbouwing erbij. Een score zonder onderbouwing bestaat niet: de server vraagt er minstens veertig tekens voor."
              rechts={
                <Knop
                  soort="hoofd"
                  klik={async () => {
                    const uit = await stuur(
                      "POST",
                      `/api/bekwaamheid/bewijsstukken/${bId}/afronden`,
                      {},
                    );
                    if (uit) {
                      zetGelukt("Het bewijsstuk is afgerond en staat op beoordeeld.");
                      vernieuw();
                    }
                  }}
                >
                  Bewijsstuk afronden
                </Knop>
              }
            >
              {scores.isLoading ? (
                <Leeg tekst="De scores worden opgehaald." />
              ) : scores.isError ? (
                <Leeg tekst="De scores zijn niet op te halen. Bestaat dit bewijsstuk?" />
              ) : alle.length === 0 ? (
                <Leeg tekst="Er staat nog geen score op dit bewijsstuk." />
              ) : (
                <Tabel
                  koppen={
                    [
                      "Onderdeel",
                      "Score",
                      "Beoordelaar",
                      "Kalibratie",
                      "Ingevoerd",
                      "Onderbouwing",
                      "",
                    ] as const
                  }
                >
                  {alle.map((s) => (
                    <tr key={s.id}>
                      <Cel>{leesbaar(s.onderdeel)}</Cel>
                      <Cel>{s.score}</Cel>
                      <Cel>#{s.beoordelaarId}</Cel>
                      <Cel>{s.isKalibratie ? "Ja" : "Nee"}</Cel>
                      <Cel>{datum(s.ingevoerdOp)}</Cel>
                      <Cel breed>
                        <span style={{ display: "block", maxWidth: "56ch" }}>{s.onderbouwing}</span>
                      </Cel>
                      <Cel>
                        <Herzien
                          score={s}
                          klaar={async (waarden) => {
                            const uit = await stuur(
                              "PATCH",
                              `/api/bekwaamheid/scores/${s.id}`,
                              waarden,
                            );
                            if (uit) {
                              zetGelukt("De score is herzien.");
                              vernieuw();
                            }
                          }}
                        />
                      </Cel>
                    </tr>
                  ))}
                </Tabel>
              )}
            </Kaart>
          </>
        ) : null}

        <Kaart
          kop="De kennischeck"
          onderkop="Een itemset hoort bij één bewijsstuk van één ronde. Het samenstellen gebeurt met een zaad, zodat dezelfde set opnieuw te maken is als er later twijfel is over welke vragen iemand kreeg."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Invoer label="Rondenummer" waarde={rondeId} zet={zetRondeId} soort="number" />
            <Invoer label="Bewijsstuk" waarde={nummer} zet={zetNummer} soort="number" />
          </div>

          {!geldigR ? (
            <Leeg tekst="Vul een rondenummer in om de kennischeck van dat dossier te zien." />
          ) : set.isLoading ? (
            <Leeg tekst="De kennischeck wordt opgehaald." />
          ) : set.isError || !set.data?.itemset ? (
            <>
              <Leeg tekst="Voor dit bewijsstuk staat er nog geen kennischeck klaar." />
              <Samenstellen
                klaar={async (zaad) => {
                  const uit = await stuur("POST", "/api/bekwaamheid/itemsets", {
                    rondeId: rId,
                    bewijsstukNummer: Number(nummer),
                    zaad: zaad || undefined,
                  });
                  if (uit) {
                    zetGelukt("De kennischeck staat klaar.");
                    vernieuw();
                  }
                }}
              />
            </>
          ) : (
            <Kennischeck
              set={set.data.itemset}
              inleveren={async (antwoorden) => {
                const uit = await stuur(
                  "POST",
                  `/api/bekwaamheid/itemsets/${set.data!.itemset!.id}/inleveren`,
                  { antwoorden },
                );
                if (uit) {
                  zetGelukt("De antwoorden zijn ingeleverd.");
                  vernieuw();
                }
              }}
              nakijken={async (uitsluiten, reden) => {
                const uit = await stuur(
                  "POST",
                  `/api/bekwaamheid/itemsets/${set.data!.itemset!.id}/nakijken`,
                  {
                    uitsluiten: uitsluiten.length > 0 ? uitsluiten : undefined,
                    redenUitsluiting: reden || undefined,
                  },
                );
                if (uit) {
                  zetGelukt("De kennischeck is nagekeken.");
                  vernieuw();
                }
              }}
            />
          )}
        </Kaart>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Invoeren({ klaar }: { klaar: (waarden: Record<string, unknown>) => Promise<void> }) {
  const [onderdeel, zetOnderdeel] = useState<string>(ONDERDELEN[0]);
  const [score, zetScore] = useState("");
  const [onderbouwing, zetOnderbouwing] = useState("");
  const [kalibratie, zetKalibratie] = useState(false);

  const kort = onderbouwing.trim().length < 40;

  return (
    <Kaart
      kop="Een score invoeren"
      onderkop="Vier gehele stappen van nul tot en met drie. Geen halve punten: een halve stap suggereert een precisie die een menselijk oordeel op een gesprek niet heeft."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: KLEUR.zacht,
              marginBottom: 4,
            }}
          >
            Onderdeel
          </label>
          <input
            list="bekwaamheid-onderdelen"
            value={onderdeel}
            onChange={(e) => zetOnderdeel(e.target.value)}
            style={{
              padding: "7px 9px",
              fontSize: 14,
              border: `1px solid ${KLEUR.rand}`,
              borderRadius: 5,
              background: KLEUR.wit,
              color: KLEUR.tekst,
              minWidth: 200,
            }}
          />
          <datalist id="bekwaamheid-onderdelen">
            {ONDERDELEN.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: KLEUR.zacht,
              marginBottom: 4,
            }}
          >
            Score
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => zetScore(String(n))}
                style={{
                  width: 38,
                  height: 34,
                  fontSize: 14,
                  cursor: "pointer",
                  borderRadius: 5,
                  border: `1px solid ${score === String(n) ? KLEUR.donker : KLEUR.rand}`,
                  background: score === String(n) ? KLEUR.donker : KLEUR.wit,
                  color: score === String(n) ? KLEUR.wit : KLEUR.tekst,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            marginTop: 22,
            color: KLEUR.tekst,
          }}
        >
          <input
            type="checkbox"
            checked={kalibratie}
            onChange={(e) => zetKalibratie(e.target.checked)}
          />
          Dit is een kalibratiescore
        </label>
      </div>

      <Tekstvak
        label="Onderbouwing"
        waarde={onderbouwing}
        zet={zetOnderbouwing}
        regels={3}
        toelichting={
          kort
            ? `Minstens veertig tekens; nu ${onderbouwing.trim().length}`
            : `${onderbouwing.trim().length} tekens`
        }
      />
      <Knop
        soort="hoofd"
        uit={score === "" || kort}
        klik={async () => {
          await klaar({
            onderdeel: onderdeel.trim(),
            score: Number(score),
            onderbouwing: onderbouwing.trim(),
            isKalibratie: kalibratie,
          });
          zetScore("");
          zetOnderbouwing("");
          zetKalibratie(false);
        }}
      >
        Score vastleggen
      </Knop>
    </Kaart>
  );
}

function Herzien({
  score,
  klaar,
}: {
  score: Score;
  klaar: (waarden: Record<string, unknown>) => Promise<void>;
}) {
  const [open, zetOpen] = useState(false);
  const [nieuw, zetNieuw] = useState(String(score.score));
  const [onderbouwing, zetOnderbouwing] = useState(score.onderbouwing);

  if (!open) return <Knop klik={() => zetOpen(true)}>Herzien</Knop>;

  return (
    <div style={{ minWidth: 260 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => zetNieuw(String(n))}
            style={{
              width: 32,
              height: 30,
              fontSize: 13,
              cursor: "pointer",
              borderRadius: 5,
              border: `1px solid ${nieuw === String(n) ? KLEUR.donker : KLEUR.rand}`,
              background: nieuw === String(n) ? KLEUR.donker : KLEUR.wit,
              color: nieuw === String(n) ? KLEUR.wit : KLEUR.tekst,
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <Tekstvak
        label="Onderbouwing"
        waarde={onderbouwing}
        zet={zetOnderbouwing}
        regels={3}
        toelichting="Minstens veertig tekens"
      />
      <p style={{ margin: "0 0 8px", fontSize: 12, color: KLEUR.zacht, maxWidth: "44ch" }}>
        Herzien lukt alleen bij uw eigen score. Bij die van een ander weigert de server, want anders
        kon een tweede beoordelaar de eerste stilletjes overschrijven.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <Knop
          soort="hoofd"
          uit={onderbouwing.trim().length < 40}
          klik={async () => {
            await klaar({ score: Number(nieuw), onderbouwing: onderbouwing.trim() });
            zetOpen(false);
          }}
        >
          Herziening vastleggen
        </Knop>
        <Knop klik={() => zetOpen(false)}>Afzien</Knop>
      </div>
    </div>
  );
}

function Samenstellen({ klaar }: { klaar: (zaad: string) => Promise<void> }) {
  const [zaad, zetZaad] = useState("");
  return (
    <div style={{ borderTop: `1px solid ${KLEUR.rand}`, paddingTop: 14, marginTop: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
        <Invoer
          label="Zaad"
          waarde={zaad}
          zet={zetZaad}
          toelichting="Leeg laten laat de server er een kiezen. Met hetzelfde zaad komt dezelfde set terug."
        />
        <Knop soort="hoofd" klik={() => klaar(zaad.trim())}>
          Kennischeck samenstellen
        </Knop>
      </div>
    </div>
  );
}

function Kennischeck({
  set,
  inleveren,
  nakijken,
}: {
  set: Itemset;
  inleveren: (antwoorden: Record<string, string>) => Promise<void>;
  nakijken: (uitsluiten: number[], reden: string) => Promise<void>;
}) {
  const [antwoorden, zetAntwoorden] = useState<Record<string, string>>({});
  const [uitsluiten, zetUitsluiten] = useState<number[]>([]);
  const [reden, zetReden] = useState("");

  const ingeleverd = set.status !== "open" && set.status !== "klaar";

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 14 }}>
        <Veld label="Setnummer" waarde={set.id} />
        <Veld label="Status" waarde={leesbaar(set.status)} />
        <Veld label="Items" waarde={set.itemIds.length} />
        <Veld label="Aangemaakt" waarde={datum(set.aangemaaktOp)} />
        <Veld label="Ingeleverd" waarde={datum(set.ingeleverdOp)} />
        <Veld label="Nagekeken" waarde={datum(set.nagekekenOp)} />
        <Veld label="Score" waarde={set.score === null ? "—" : `${set.score}`} />
        <Veld
          label="Uitkomst"
          waarde={set.geslaagd === null ? "nog niet nagekeken" : set.geslaagd ? "gehaald" : "niet gehaald"}
        />
      </div>

      {!ingeleverd ? (
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 14, color: KLEUR.donker }}>
            De antwoorden invoeren
          </h4>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "72ch" }}>
            Bij een meerkeuze- of scenario-item is het antwoord de letter van de gekozen mogelijkheid,
            niet de tekst ervan. De vraagteksten staan in de itembank; hier gaat het om de vastlegging.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {set.itemIds.map((iid) => (
              <div key={iid}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: KLEUR.zacht,
                    marginBottom: 3,
                  }}
                >
                  Item {iid}
                </label>
                <input
                  value={antwoorden[String(iid)] ?? ""}
                  onChange={(e) =>
                    zetAntwoorden({ ...antwoorden, [String(iid)]: e.target.value })
                  }
                  style={{
                    width: 64,
                    padding: "6px 8px",
                    fontSize: 14,
                    border: `1px solid ${KLEUR.rand}`,
                    borderRadius: 5,
                    background: KLEUR.wit,
                    color: KLEUR.tekst,
                  }}
                />
              </div>
            ))}
          </div>
          <Knop
            soort="hoofd"
            uit={Object.keys(antwoorden).length === 0}
            klik={() => inleveren(antwoorden)}
          >
            Antwoorden inleveren
          </Knop>
        </div>
      ) : (
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 14, color: KLEUR.donker }}>Nakijken</h4>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: KLEUR.zacht, maxWidth: "72ch" }}>
            De uitslag komt gerekend van de server. Een item uitsluiten kan — een vraag kan onbedoeld
            dubbelzinnig blijken — maar dan staat de reden erbij, zodat later na te gaan is waarom de
            set korter was dan gepland.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {set.itemIds.map((iid) => {
              const uit = uitsluiten.includes(iid);
              return (
                <button
                  key={iid}
                  type="button"
                  onClick={() =>
                    zetUitsluiten(uit ? uitsluiten.filter((n) => n !== iid) : [...uitsluiten, iid])
                  }
                  style={{
                    padding: "5px 10px",
                    fontSize: 13,
                    cursor: "pointer",
                    borderRadius: 5,
                    border: `1px solid ${uit ? KLEUR.aandacht : KLEUR.rand}`,
                    background: uit ? KLEUR.aandacht : KLEUR.wit,
                    color: uit ? KLEUR.wit : KLEUR.tekst,
                  }}
                >
                  {iid}
                  {uit ? " — uitgesloten" : ""}
                </button>
              );
            })}
          </div>
          {uitsluiten.length > 0 ? (
            <Tekstvak label="Reden van uitsluiting" waarde={reden} zet={zetReden} regels={2} />
          ) : null}
          <Knop
            soort="hoofd"
            uit={uitsluiten.length > 0 && reden.trim().length === 0}
            klik={() => nakijken(uitsluiten, reden.trim())}
          >
            Kennischeck nakijken
          </Knop>
        </div>
      )}
    </div>
  );
}
