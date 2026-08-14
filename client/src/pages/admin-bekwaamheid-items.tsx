// ---------------------------------------------------------------------------
// client/src/pages/admin-bekwaamheid-items.tsx — levering 3 uit het
// vervolgplan: /admin/bekwaamheid/items — de itembank en de dekking.
//
// De itembank is de voorraad vragen waaruit een kennischeck wordt samengesteld.
// Dit scherm laat een beheerder een item schrijven, bijstellen en uit gebruik
// nemen, en het laat zien waar de voorraad te dun is.
//
// Vier dingen die dit scherm bewust NIET doet.
//
// Het keurt niet zelf. De vragen die op een item afkomen — is de vraagtekst lang
// genoeg, staat er een afleider in die alleen nauwkeurig lezen toetst, is de
// sleutel een letter — worden door de server gesteld. Het scherm toont de
// bevindingen woordelijk. Twee keuringsplaatsen lopen na de eerste wijziging
// uiteen, en dan is een item ergens goedgekeurd en ergens afgekeurd.
//
// Het verwijdert geen item. Een item dat niet meer mag meten, gaat op verbrand.
// Wissen zou de itemsets breken waarin het item al gebruikt is, en daarmee de
// verantwoording van beslissingen die op die sets rusten.
//
// Het maakt van een oefenitem geen meetitem. Die overgang bestaat niet en het
// scherm biedt haar niet aan: wie de oefenset heeft gezien, kent het item, en als
// meetitem zou het hoge scores geven zonder dat er iets gemeten is.
//
// Het verzint geen dekking. De dekkingstabel komt gerekend uit hetzelfde antwoord
// als de itemlijst, zodat lijst en dekking altijd bij elkaar horen.
// ---------------------------------------------------------------------------
import { Fragment, useState } from "react";
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
  leesbaar,
} from "@/components/bekwaamheid-kader";

// De vier assen en de vier itemsoorten, gelijk aan ASSEN en ITEMSOORTEN in
// server/bekwaamheid/schema.ts. De server weigert alles wat hier niet in staat.
const ASSEN = [
  { waarde: "weten", tekst: "Weten" },
  { waarde: "zien", tekst: "Zien" },
  { waarde: "zeggen", tekst: "Zeggen" },
  { waarde: "zorgen", tekst: "Zorgen" },
] as const;

const SOORTEN = [
  { waarde: "meerkeuze", tekst: "Meerkeuze" },
  { waarde: "scenario", tekst: "Scenario" },
  { waarde: "juistfout", tekst: "Juist of onjuist" },
  { waarde: "open", tekst: "Open vraag" },
] as const;

const BLOKKEN = [
  { waarde: "", tekst: "Geen blok" },
  { waarde: "A", tekst: "A — Constructen" },
  { waarde: "B", tekst: "B — Scoring en rapportlogica" },
  { waarde: "C", tekst: "C — Grenzen" },
  { waarde: "D", tekst: "D — Interpretatiefouten herkennen" },
  { waarde: "E", tekst: "E — Ethiek en privacy" },
] as const;

const GEBRUIKEN = [
  { waarde: "", tekst: "Alle" },
  { waarde: "meten", tekst: "Meten" },
  { waarde: "oefenen", tekst: "Oefenen" },
  { waarde: "verbrand", tekst: "Verbrand" },
] as const;

type Item = {
  id: number;
  instrumentId: string;
  as: string;
  blok: string | null;
  soort: string;
  stam: string;
  opties: string[] | null;
  sleutel: string;
  toelichtingGoed: string;
  toelichtingFout: string;
  gebruik: string;
  versie: number;
  actief: boolean;
  pWaarde: number | null;
  discriminatie: number | null;
  bronVerwijzing: string | null;
};

/** De dekking zoals de server haar teruggeeft. De vorm blijft opzettelijk los. */
type Antwoord = { instrumentId: string; items: Item[]; dekking: unknown };

export default function AdminBekwaamheidItems() {
  const rij = useQueryClient();
  const [instrument, zetInstrument] = useState("t4p-business-kompas");
  const [as, zetAs] = useState("");
  const [blok, zetBlok] = useState("");
  const [gebruik, zetGebruik] = useState("");
  const [ookVerbrand, zetOokVerbrand] = useState(false);
  const [open, zetOpen] = useState<number | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const [gelukt, zetGelukt] = useState<string | null>(null);

  const vraag = new URLSearchParams();
  if (as) vraag.set("as", as);
  if (blok) vraag.set("blok", blok);
  if (gebruik) vraag.set("gebruik", gebruik);
  if (ookVerbrand) vraag.set("alle", "1");

  const bank = useQuery<Antwoord>({
    queryKey: ["/api/bekwaamheid/items", instrument, vraag.toString()],
    enabled: instrument.trim().length > 0,
    queryFn: async () =>
      apiRequest(
        "GET",
        `/api/bekwaamheid/items/${encodeURIComponent(instrument.trim())}?${vraag.toString()}`,
      ).then((r) => r.json()),
  });

  function vernieuw() {
    void rij.invalidateQueries({ queryKey: ["/api/bekwaamheid/items"] });
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

  const items = bank.data?.items ?? [];

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
          Itembank
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: KLEUR.zacht, maxWidth: "78ch" }}>
          De voorraad vragen waaruit een kennischeck wordt samengesteld. Een item dat niet meer mag
          meten gaat op verbrand en blijft staan; wissen zou de itemsets breken waarin het al gebruikt
          is, en daarmee de verantwoording van de beslissingen die op die sets rusten.
        </p>

        <Melding soort="fout" tekst={fout} />
        <Melding soort="goed" tekst={gelukt} />

        <Kaart
          kop="Wat je bekijkt"
          onderkop="Zonder filter staan hier de items die nog in gebruik zijn. Verbrande items komen er alleen bij als je ze erbij vraagt."
          rechts={
            <Knop klik={() => zetOokVerbrand(!ookVerbrand)}>
              {ookVerbrand ? "Verbrande verbergen" : "Verbrande erbij"}
            </Knop>
          }
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Invoer label="Instrument-id" waarde={instrument} zet={zetInstrument} />
            <Keuze
              label="As"
              waarde={as}
              zet={zetAs}
              opties={[{ waarde: "", tekst: "Alle assen" }, ...ASSEN]}
            />
            <Keuze label="Blok" waarde={blok} zet={zetBlok} opties={BLOKKEN} />
            <Keuze label="Gebruik" waarde={gebruik} zet={zetGebruik} opties={GEBRUIKEN} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 4 }}>
            <Veld label="Items in beeld" waarde={items.length} />
            <Veld label="Meten" waarde={items.filter((i) => i.gebruik === "meten").length} />
            <Veld label="Oefenen" waarde={items.filter((i) => i.gebruik === "oefenen").length} />
            <Veld label="Verbrand" waarde={items.filter((i) => i.gebruik === "verbrand").length} />
          </div>
        </Kaart>

        <Nieuw
          instrument={instrument}
          klaar={async (waarden) => {
            const uit = await stuur("POST", "/api/bekwaamheid/items", waarden);
            if (uit) {
              zetGelukt("Het item staat in de bank.");
              vernieuw();
            }
          }}
        />

        <Kaart
          kop="De items"
          onderkop="De sleutel en de twee toelichtingen staan hier omdat dit de beheerderskant is. Op de kant van de deelnemer komen ze niet mee."
        >
          {bank.isLoading ? (
            <Leeg tekst="De itembank wordt opgehaald." />
          ) : bank.isError ? (
            <Leeg tekst="De itembank is niet op te halen. Klopt het instrument-id?" />
          ) : items.length === 0 ? (
            <Leeg tekst="Geen enkel item past bij deze keuze. Dat kan betekenen dat de voorraad hier leeg is; het kan ook zijn dat het filter te nauw staat." />
          ) : (
            <Tabel
              koppen={
                [
                  "Nr.",
                  "As",
                  "Blok",
                  "Soort",
                  "Vraagtekst",
                  "Sleutel",
                  "Gebruik",
                  "Versie",
                  "p",
                  "",
                ] as const
              }
            >
              {items.map((i) => (
                <Fragment key={i.id}>
                  <tr>
                    <Cel>{i.id}</Cel>
                    <Cel>{leesbaar(i.as)}</Cel>
                    <Cel>{i.blok ?? "—"}</Cel>
                    <Cel>{leesbaar(i.soort)}</Cel>
                    <Cel breed>
                      <span style={{ display: "block", maxWidth: "48ch" }}>{i.stam}</span>
                    </Cel>
                    <Cel>{i.sleutel.length > 12 ? `${i.sleutel.slice(0, 12)}…` : i.sleutel}</Cel>
                    <Cel>
                      <span
                        style={{
                          color: i.gebruik === "verbrand" ? KLEUR.aandacht : KLEUR.tekst,
                        }}
                      >
                        {leesbaar(i.gebruik)}
                      </span>
                    </Cel>
                    <Cel>{i.versie}</Cel>
                    <Cel>{i.pWaarde === null ? "—" : i.pWaarde.toFixed(2)}</Cel>
                    <Cel>
                      <Knop klik={() => zetOpen(open === i.id ? null : i.id)}>
                        {open === i.id ? "Sluiten" : "Openen"}
                      </Knop>
                    </Cel>
                  </tr>
                  {open === i.id ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 0, borderBottom: `1px solid ${KLEUR.rand}` }}>
                        <Bijstellen
                          item={i}
                          klaar={async (waarden) => {
                            const uit = await stuur(
                              "PATCH",
                              `/api/bekwaamheid/item/${i.id}`,
                              waarden,
                            );
                            if (uit) {
                              zetGelukt(`Item ${i.id} is bijgesteld.`);
                              vernieuw();
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </Tabel>
          )}
        </Kaart>

        <Kaart
          kop="Dekking"
          onderkop="Gerekend door de server, in hetzelfde antwoord als de itemlijst, zodat lijst en dekking altijd bij elkaar horen. Wat hier dun staat, is dun in de voorraad."
        >
          {bank.data?.dekking === undefined ? (
            <Leeg tekst="Er is nog geen dekking berekend." />
          ) : (
            <pre
              style={{
                margin: 0,
                padding: "12px 14px",
                fontSize: 12,
                lineHeight: 1.6,
                background: KLEUR.achtergrond,
                border: `1px solid ${KLEUR.rand}`,
                borderRadius: 6,
                overflowX: "auto",
                color: KLEUR.tekst,
              }}
            >
              {JSON.stringify(bank.data.dekking, null, 2)}
            </pre>
          )}
        </Kaart>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Nieuw({
  instrument,
  klaar,
}: {
  instrument: string;
  klaar: (waarden: Record<string, unknown>) => Promise<void>;
}) {
  const [as, zetAs] = useState<string>(ASSEN[0].waarde);
  const [blok, zetBlok] = useState("");
  const [soort, zetSoort] = useState<string>(SOORTEN[0].waarde);
  const [stam, zetStam] = useState("");
  const [opties, zetOpties] = useState("");
  const [sleutel, zetSleutel] = useState("");
  const [goed, zetGoed] = useState("");
  const [slecht, zetSlecht] = useState("");
  const [bron, zetBron] = useState("");

  const heeftKeuzes = soort === "meerkeuze" || soort === "scenario";
  const optielijst = opties
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  return (
    <Kaart
      kop="Een item schrijven"
      onderkop="Bij een meerkeuze- of scenario-item is de sleutel de letter van de juiste mogelijkheid, niet de antwoordtekst: zo breekt het herstellen van een spelfout in een mogelijkheid de sleutel niet. Beide toelichtingen zijn verplicht — een item zonder uitleg leert niets aan wie het fout had."
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        <Keuze label="As" waarde={as} zet={zetAs} opties={ASSEN} />
        <Keuze
          label="Blok"
          waarde={blok}
          zet={zetBlok}
          opties={BLOKKEN}
          toelichting="Een blok hoort bij de as weten."
        />
        <Keuze label="Soort" waarde={soort} zet={zetSoort} opties={SOORTEN} />
        <Invoer
          label={heeftKeuzes ? "Sleutel (letter)" : "Sleutel"}
          waarde={sleutel}
          zet={zetSleutel}
          toelichting={heeftKeuzes ? "A, B, C…" : "Bij juist of onjuist: juist of onjuist."}
        />
      </div>
      <Tekstvak
        label="Vraagtekst"
        waarde={stam}
        zet={zetStam}
        regels={3}
        toelichting="Minstens twintig tekens"
      />
      {heeftKeuzes ? (
        <Tekstvak
          label="Mogelijkheden — één per regel"
          waarde={opties}
          zet={zetOpties}
          regels={4}
          toelichting={`Drie tot zes mogelijkheden; nu ${optielijst.length}`}
        />
      ) : null}
      <Tekstvak
        label="Toelichting bij het juiste antwoord"
        waarde={goed}
        zet={zetGoed}
        regels={2}
        toelichting="Minstens twintig tekens"
      />
      <Tekstvak
        label="Toelichting bij een fout antwoord"
        waarde={slecht}
        zet={zetSlecht}
        regels={2}
        toelichting="Minstens twintig tekens"
      />
      <Invoer
        label="Bronverwijzing"
        waarde={bron}
        zet={zetBron}
        breed
        toelichting="Waar in het draaiboek of de handleiding dit item op rust. Mag leeg blijven."
      />
      <Knop
        soort="hoofd"
        uit={
          stam.trim().length === 0 ||
          sleutel.trim().length === 0 ||
          goed.trim().length === 0 ||
          slecht.trim().length === 0 ||
          instrument.trim().length === 0
        }
        klik={async () => {
          await klaar({
            instrumentId: instrument.trim(),
            as,
            blok: blok || null,
            soort,
            stam: stam.trim(),
            opties: heeftKeuzes ? optielijst : null,
            sleutel: sleutel.trim(),
            toelichtingGoed: goed.trim(),
            toelichtingFout: slecht.trim(),
            bronVerwijzing: bron.trim() || null,
          });
          zetStam("");
          zetOpties("");
          zetSleutel("");
          zetGoed("");
          zetSlecht("");
          zetBron("");
        }}
      >
        Item vastleggen
      </Knop>
    </Kaart>
  );
}

function Bijstellen({
  item,
  klaar,
}: {
  item: Item;
  klaar: (waarden: Record<string, unknown>) => Promise<void>;
}) {
  const [stam, zetStam] = useState(item.stam);
  const [goed, zetGoed] = useState(item.toelichtingGoed);
  const [slecht, zetSlecht] = useState(item.toelichtingFout);

  // Alleen de overgangen die bestaan. Van oefenen naar meten bestaat niet en
  // staat er dus niet: wie de oefenset heeft gezien, kent het item.
  const overgangen =
    item.gebruik === "meten"
      ? [
          { waarde: "oefenen", tekst: "Naar oefenen" },
          { waarde: "verbrand", tekst: "Naar verbrand" },
        ]
      : item.gebruik === "oefenen"
        ? [{ waarde: "verbrand", tekst: "Naar verbrand" }]
        : [];

  return (
    <div style={{ padding: "16px 12px", background: "#faf9f6" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 12 }}>
        <Veld label="Gebruik" waarde={leesbaar(item.gebruik)} />
        <Veld label="Versie" waarde={item.versie} />
        <Veld label="Sleutel" waarde={item.sleutel} />
        <Veld
          label="p-waarde"
          waarde={item.pWaarde === null ? "niet berekend" : item.pWaarde.toFixed(3)}
        />
        <Veld
          label="Discriminatie"
          waarde={item.discriminatie === null ? "niet berekend" : item.discriminatie.toFixed(3)}
        />
        <Veld label="Bron" waarde={item.bronVerwijzing ?? "—"} />
      </div>

      {item.opties && item.opties.length > 0 ? (
        <ol style={{ margin: "0 0 14px 18px", fontSize: 13, color: KLEUR.tekst }}>
          {item.opties.map((o, n) => (
            <li key={n} style={{ marginBottom: 3 }}>
              {String.fromCharCode(65 + n)}. {o}
              {String.fromCharCode(65 + n) === item.sleutel.trim().toUpperCase() ? (
                <span style={{ color: KLEUR.goed }}> — sleutel</span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      <Tekstvak label="Vraagtekst" waarde={stam} zet={zetStam} regels={3} />
      <Tekstvak
        label="Toelichting bij het juiste antwoord"
        waarde={goed}
        zet={zetGoed}
        regels={2}
      />
      <Tekstvak
        label="Toelichting bij een fout antwoord"
        waarde={slecht}
        zet={zetSlecht}
        regels={2}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Knop
          soort="hoofd"
          uit={stam.trim() === item.stam && goed.trim() === item.toelichtingGoed && slecht.trim() === item.toelichtingFout}
          klik={() =>
            klaar({
              stam: stam.trim(),
              toelichtingGoed: goed.trim(),
              toelichtingFout: slecht.trim(),
            })
          }
        >
          Tekst bijstellen
        </Knop>
        {overgangen.map((o) => (
          <Knop key={o.waarde} soort="aandacht" klik={() => klaar({ gebruik: o.waarde })}>
            {o.tekst}
          </Knop>
        ))}
        {overgangen.length === 0 ? (
          <span style={{ fontSize: 12, color: KLEUR.zacht }}>
            Een verbrand item blijft verbrand. Het is publiek geworden en dat is niet terug te
            draaien; schrijf een nieuw item.
          </span>
        ) : null}
      </div>
    </div>
  );
}
