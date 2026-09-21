import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Compass, ExternalLink, Layers, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";

/**
 * De rapporten van één lid, gelezen door de begeleider.
 * ---------------------------------------------------------------------------
 * De rapportsluis werkt op de link van het lid. Daardoor hield ze ook de
 * begeleider tegen, terwijl juist hij eerst hoort te lezen. Dit scherm loopt de
 * andere weg: het vraagt de drie rapporten op bij het traject, achter de
 * beheerderslogin. Vrijgeven blijft een aparte handeling, want vrijgave gaat
 * over wat het lid zelf mag zien.
 *
 * Per instrument werkt het anders, en dat is geen keuze maar een gevolg van waar
 * elk rapport leeft:
 *   Teamscan   de server rekent en maakt de pagina, dus het scherm opent ze.
 *   2MINSCAN   de browser rekent, dus het scherm bouwt het rapport opnieuw op
 *              uit de bewaarde uitkomst en opent de gewone rapportpagina.
 *   Kompas     het rapport staat in het beheer, dus het scherm verwijst erheen.
 */

// Dezelfde voorvoegselregel als in lib/queryClient.ts.
const API_BASE =
  typeof window !== "undefined" && window.location.hostname.endsWith(".pplx.app")
    ? "/port/5000"
    : "";

const INK = "#16384a";
const SUB = "#5b6b73";
const GOED = "#2f6f3f";

const kaart: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e4e9eb",
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
};

interface Bronnen {
  trajectId: number;
  lid: {
    id: number;
    naam: string;
    email: string | null;
    organisatie: string;
    vrijgegeven: boolean;
  };
  teamscan: { uitgestuurd: boolean; ingevuld: boolean; label: string | null };
  twominscan: {
    uitgestuurd: boolean;
    ingevuld: boolean;
    herbouwbaar: boolean;
    afname: {
      naam: string;
      organisatie: string;
      rol: string;
      egCode: string;
      wielpositie: string;
      taal: string;
      datum: string;
      bewaardOp: string;
      rapport: null | {
        score: { blauw: number; groen: number; geel: number; rood: number };
        ie: { uitkomst: string; label: string; verschil: number; xStand: string };
        egCode: string;
        egCodePositief: string;
        minSegment: string | null;
        profielCode: string;
        exact: boolean;
      };
    } | null;
  };
  kompas: { uitgestuurd: boolean; ingevuld: boolean; afnameId: number | null; status: string | null };
}

/** Opent het 2MINSCAN-rapport opnieuw, opgebouwd uit de bewaarde uitkomst. */
function openTwominscan(bronnen: Bronnen): void {
  const afname = bronnen.twominscan.afname;
  if (!afname?.rapport) return;
  const payload = encodeURIComponent(
    JSON.stringify({
      naam: afname.naam,
      organisatie: afname.organisatie,
      ...(afname.rol ? { rol: afname.rol } : {}),
      taal: afname.taal || "nl",
      datum: afname.datum || new Date().toLocaleDateString("nl-BE"),
      ...afname.rapport,
    }),
  );
  // De rapportpagina leest haar gegevens uit de zoekreeks, en het pad staat in
  // de hash. Er gaat geen uitnodiging mee: de sluis geldt voor het lid, niet
  // voor de begeleider die hier al aangemeld is.
  window.open(`/?d=${payload}#/2minscan/rapport`, "_blank", "noopener");
}

function Regel({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13, color: SUB, marginBottom: 4 }}>
      <span style={{ minWidth: 130 }}>{label}</span>
      <span style={{ color: INK }}>{waarde}</span>
    </div>
  );
}

export default function HddLidRapport() {
  const params = useParams<{ id: string; lidId: string }>();
  const trajectId = Number(params.id);
  const lidId = Number(params.lidId);

  const bronnen = useQuery<Bronnen>({
    queryKey: [`/api/hdd/trajecten/${trajectId}/leden/${lidId}/rapportbronnen`],
    enabled: Number.isFinite(trajectId) && Number.isFinite(lidId),
  });

  const data = bronnen.data;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7f8" }}>
      <AppHeader />
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 20px 60px" }}>
        <Link href={`/hdd/traject/${trajectId}`} data-testid="link-terug-traject">
          <span style={{ color: SUB, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft className="h-4 w-4" /> Terug naar het traject
          </span>
        </Link>

        <h1 style={{ color: INK, fontSize: 24, marginBottom: 4 }} data-testid="titel-lid-rapport">
          {data ? `De rapporten van ${data.lid.naam}` : "De rapporten van dit lid"}
        </h1>
        <p style={{ color: SUB, fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
          Als begeleider leest u hier elk rapport dat dit lid al invulde, ook voordat u de
          rapporten vrijgeeft. Het lid zelf ziet zijn rapporten pas nadat u ze vrijgeeft.
        </p>

        {bronnen.isLoading && (
          <p style={{ color: SUB, fontSize: 14 }} data-testid="tekst-laden">
            De rapporten van dit lid worden opgehaald.
          </p>
        )}

        {bronnen.isError && (
          <p style={{ color: "#a1362a", fontSize: 14 }} data-testid="tekst-fout">
            Het platform kan de rapporten van dit lid niet ophalen. Ververs het scherm of ga
            terug naar het traject.
          </p>
        )}

        {data && (
          <>
            {/* ---- Teamscan ---- */}
            <div style={kaart} data-testid="kaart-teamscan">
              <h2 style={{ color: INK, fontSize: 17, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Layers className="h-4 w-4" /> TaPas Teamscan
              </h2>
              {data.teamscan.ingevuld ? (
                <>
                  <p style={{ color: GOED, fontSize: 13, marginTop: 0 }}>Ingevuld.</p>
                  <Button
                    size="sm"
                    onClick={() =>
                      window.open(
                        `${API_BASE}/api/hdd/trajecten/${trajectId}/leden/${lidId}/teamscan-rapport`,
                        "_blank",
                        "noopener",
                      )
                    }
                    data-testid="button-open-teamscan"
                  >
                    <ExternalLink className="mr-1 h-4 w-4" /> Het Teamscan-rapport openen
                  </Button>
                </>
              ) : (
                <p style={{ color: SUB, fontSize: 13, marginTop: 0 }} data-testid="tekst-teamscan-leeg">
                  {data.teamscan.uitgestuurd
                    ? "Dit lid kreeg de link, maar vulde de Teamscan nog niet in."
                    : "Dit lid kreeg nog geen link voor de Teamscan."}
                </p>
              )}
            </div>

            {/* ---- 2MINSCAN ---- */}
            <div style={kaart} data-testid="kaart-twominscan">
              <h2 style={{ color: INK, fontSize: 17, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles className="h-4 w-4" /> 2MINSCAN
              </h2>
              {data.twominscan.ingevuld && data.twominscan.afname ? (
                <>
                  <p style={{ color: GOED, fontSize: 13, marginTop: 0 }}>
                    Ingevuld op {data.twominscan.afname.datum || data.twominscan.afname.bewaardOp.slice(0, 10)}.
                  </p>
                  <Regel label="EG-code" waarde={data.twominscan.afname.egCode || "Niet bewaard"} />
                  <Regel label="Wielpositie" waarde={data.twominscan.afname.wielpositie} />
                  {data.twominscan.afname.rapport && (
                    <Regel
                      label="I/E-stand"
                      waarde={data.twominscan.afname.rapport.ie.label}
                    />
                  )}
                  {data.twominscan.herbouwbaar ? (
                    <Button
                      size="sm"
                      style={{ marginTop: 8 }}
                      onClick={() => openTwominscan(data)}
                      data-testid="button-open-twominscan"
                    >
                      <ExternalLink className="mr-1 h-4 w-4" /> Het 2MINSCAN-rapport openen
                    </Button>
                  ) : (
                    <p style={{ color: SUB, fontSize: 13 }} data-testid="tekst-twominscan-oud">
                      Dit lid vulde de scan in voordat het platform de uitkomst bewaarde. Daarom
                      staan hier enkel de code en de wielpositie. Het volledige rapport kan het
                      platform niet opnieuw tonen. Laat het lid de scan opnieuw doen om het rapport
                      terug te krijgen.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: SUB, fontSize: 13, marginTop: 0 }} data-testid="tekst-twominscan-leeg">
                  {data.twominscan.uitgestuurd
                    ? "Dit lid kreeg de link, maar vulde de 2MINSCAN nog niet in."
                    : "Dit lid kreeg nog geen link voor de 2MINSCAN."}
                </p>
              )}
            </div>

            {/* ---- Kompas ---- */}
            <div style={kaart} data-testid="kaart-kompas">
              <h2 style={{ color: INK, fontSize: 17, marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Compass className="h-4 w-4" /> TaPas Business Kompas
              </h2>
              {data.kompas.afnameId ? (
                <>
                  <p style={{ color: data.kompas.ingevuld ? GOED : SUB, fontSize: 13, marginTop: 0 }}>
                    {data.kompas.ingevuld
                      ? "Ingevuld."
                      : "Dit lid begon aan het Kompas, maar rondde het nog niet af."}
                  </p>
                  <Link href={`/admin/${data.kompas.afnameId}`}>
                    <Button size="sm" data-testid="button-open-kompas">
                      <ExternalLink className="mr-1 h-4 w-4" /> Het rapport van deze afname openen
                    </Button>
                  </Link>
                </>
              ) : (
                <p style={{ color: SUB, fontSize: 13, marginTop: 0 }} data-testid="tekst-kompas-leeg">
                  {data.kompas.uitgestuurd
                    ? "Dit lid kreeg de link, maar begon nog niet aan het Kompas."
                    : "Voor dit lid loopt fase 2 nog niet, dus er is nog geen Kompas."}
                </p>
              )}
            </div>

            <p style={{ color: SUB, fontSize: 12, lineHeight: 1.6 }}>
              {data.lid.vrijgegeven
                ? "Dit lid mag zijn eigen rapporten al inkijken."
                : "Dit lid mag zijn eigen rapporten nog niet inkijken. U geeft ze vrij op het trajectscherm."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
