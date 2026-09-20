import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Layers, Compass, Lock, LockOpen, Mail, RefreshCw, UserPlus } from "lucide-react";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient as globaleClient } from "@/lib/queryClient";

/**
 * Human Due Diligence: het trajectscherm.
 * ---------------------------------------------------------------------------
 * Dit scherm ontbrak, en dat was de kern van het probleem. De server kon een
 * fase al uitsturen (server/hdd/uitsturen.ts en server/hdd/uitnodigingsmail.ts),
 * maar er was nergens een knop. De lijst op /hdd verwees naar /hdd/traject/:id
 * en die route bestond niet, dus een traject eindigde op de foutpagina. Wie toch
 * wilde uitsturen, kwam bij Bulk-import terecht, en daar werd het traject als
 * gewone vragenlijst behandeld: één link per persoon naar het TaPas Business
 * Kompas, zonder Teamscan en zonder 2MINSCAN.
 *
 * Wat hier staat, volgt de twee fasen uit de registry:
 *   Fase 1  Teamscan en 2MINSCAN, twee links per lid.
 *   Fase 2  TaPas Business Kompas, één link per lid.
 *
 * Vulde een lid het Kompas al in, ook via een oude uitnodiging, dan neemt het
 * traject die afname over en krijgt dat lid geen tweede vragenlijst.
 */

// Dezelfde voorvoegselregel als in lib/queryClient.ts: op de sandbox loopt het
// verkeer via /port/5000, op Render staat de API op dezelfde origin.
const API_BASE =
  typeof window !== "undefined" && window.location.hostname.endsWith(".pplx.app")
    ? "/port/5000"
    : "";

const INK = "#16384a";
const SUB = "#5b6b73";
const ACCENT = "#1f6f8b";
const ALARM = "#a1362a";
const GOED = "#2f6f3f";

const INSTRUMENTNAAM: Record<string, string> = {
  "tapas-teamscan": "TaPas Teamscan",
  twominscan: "2MINSCAN",
  "t4p-business-kompas": "TaPas Business Kompas",
};

function naamVan(instrumentId: string): string {
  return INSTRUMENTNAAM[instrumentId] ?? instrumentId;
}

interface Lid {
  id: number;
  naam: string;
  email: string;
  // De rapportsluis. Staat hier niets, dan ziet het lid zijn eigen rapport niet.
  // Zie server/hdd/rapportsluis.ts.
  rapportVrijgaveOp?: number | null;
}

interface TrajectDetail {
  id: number;
  boardNaam: string;
  orgLabel: string;
  context: string;
  status: string;
  leden: Lid[];
}

interface InstrumentVoortgang {
  instrumentId: string;
  uitgestuurd: boolean;
  ingevuld: boolean;
  bronstatus: string | null;
}

interface Voortgang {
  status: string;
  aantalLeden: number;
  leden: { lidId: number; naam: string; instrumenten: InstrumentVoortgang[] }[];
}

interface UitstuurLink {
  instrumentId: string;
  token: string;
  link: string;
  nieuw: boolean;
}

interface Uitslag {
  fase: number;
  status: string;
  credits: { status: string; credits: number };
  leden: { lidId: number; naam: string; email: string; links: UitstuurLink[] }[];
  mail: { lidId: number; naam: string; email: string; mailStatus: string; melding?: string }[];
  aantalMailVerstuurd: number;
  aantalZonderMail: number;
  mailGeslaagd: boolean;
}

const kaart: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eef1f2",
  borderRadius: 12,
  padding: 24,
  marginTop: 20,
};

const STATUSTEKST: Record<string, string> = {
  fase1_open: "Fase 1 is verstuurd",
  gate: "Het scharnier is beoordeeld",
  fase2_open: "Fase 2 is verstuurd",
  afgerond: "Afgerond",
};

export default function HddTraject() {
  const params = useParams<{ id: string }>();
  const trajectId = Number(params.id);
  const client = useQueryClient();
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [uitslag, setUitslag] = useState<Uitslag | null>(null);
  const [fout, setFout] = useState("");
  const [mailweg, setMailweg] = useState<number | null>(null);

  const traject = useQuery<TrajectDetail>({
    queryKey: [`/api/hdd/trajecten/${trajectId}`],
    enabled: Number.isFinite(trajectId),
  });
  const voortgang = useQuery<Voortgang>({
    queryKey: [`/api/hdd/trajecten/${trajectId}/voortgang`],
    enabled: Number.isFinite(trajectId),
  });

  function verversAlles() {
    client.invalidateQueries({ queryKey: [`/api/hdd/trajecten/${trajectId}`] });
    client.invalidateQueries({ queryKey: [`/api/hdd/trajecten/${trajectId}/voortgang`] });
    globaleClient.invalidateQueries({ queryKey: ["/api/hdd/trajecten"] });
  }

  const voegLidToe = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/hdd/trajecten/${trajectId}/leden`, {
        naam: naam.trim(),
        email: email.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      setNaam("");
      setEmail("");
      setFout("");
      verversAlles();
    },
    onError: (err: unknown) => {
      setFout(err instanceof Error ? err.message : "Het lid is niet toegevoegd.");
    },
  });

  // ---- De rapportsluis ----
  // Een lid van een traject vult in en leest niet mee. U leest de uitkomst eerst,
  // bespreekt ze, en geeft daarna vrij. Zonder lidId geldt de keuze voor alle
  // leden. Zie server/hdd/rapportsluis.ts.
  const vrijgave = useMutation({
    mutationFn: async (opties: { lidId?: number; vrij: boolean }) => {
      const res = await apiRequest("POST", `/api/hdd/trajecten/${trajectId}/vrijgave`, {
        ...(opties.lidId != null ? { lidId: opties.lidId } : {}),
        vrij: opties.vrij,
      });
      return res.json();
    },
    onSuccess: () => {
      setFout("");
      verversAlles();
    },
    onError: (err: unknown) => {
      setFout(err instanceof Error ? err.message : "Het vrijgeven is niet gelukt.");
    },
  });

  const stuurUit = useMutation({
    mutationFn: async (opties: { fase: number; tochUitsturen?: boolean }) => {
      const res = await fetch(
        `${API_BASE}/api/hdd/trajecten/${trajectId}/start-fase${opties.fase}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taal: "nl", tochUitsturen: opties.tochUitsturen === true }),
        },
      );
      const lichaam = await res.json().catch(() => ({}));
      if (!res.ok) {
        const melding =
          typeof lichaam?.error === "string" ? lichaam.error : "Het versturen is niet gelukt.";
        throw Object.assign(new Error(melding), { code: lichaam?.code, fase: opties.fase });
      }
      return lichaam as Uitslag;
    },
    onMutate: () => {
      setFout("");
      setMailweg(null);
    },
    onSuccess: (data) => {
      setUitslag(data);
      verversAlles();
    },
    onError: (err: any) => {
      setFout(err?.message ?? "Het versturen is niet gelukt.");
      if (err?.code === "MAILWEG_ONBRUIKBAAR") setMailweg(Number(err?.fase) || null);
    },
  });

  if (!Number.isFinite(trajectId)) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader />
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px" }}>
          <p style={{ color: ALARM }}>Dit adres verwijst niet naar een traject.</p>
        </div>
      </div>
    );
  }

  const leden = traject.data?.leden ?? [];
  const basis = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader />
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px 80px" }}>
        <Link href="/hdd">
          <a
            data-testid="link-terug-hdd"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: ACCENT,
              fontSize: 13,
              textDecoration: "none",
              marginBottom: 14,
            }}
          >
            <ArrowLeft className="h-4 w-4" /> Terug naar de trajecten
          </a>
        </Link>

        <h1 style={{ color: INK, fontSize: 28, margin: "0 0 4px" }} data-testid="titel-traject">
          {traject.data?.boardNaam ?? "Traject"}
        </h1>
        <div style={{ color: SUB, fontSize: 13 }}>
          {traject.data?.orgLabel ? `${traject.data.orgLabel} · ` : ""}
          {traject.data?.context === "ma" ? "Overname" : "Eigen doorlichting"}
          {traject.data?.status ? ` · ${STATUSTEKST[traject.data.status] ?? traject.data.status}` : ""}
        </div>

        {/* ---- Leden ---- */}
        <div style={kaart}>
          <h2 style={{ color: INK, fontSize: 18, marginTop: 0 }}>De leden van dit traject</h2>
          <p style={{ color: SUB, fontSize: 13, lineHeight: 1.55, marginTop: 0 }}>
            Voeg elk lid één keer toe en geef het adres waarop het lid de uitnodiging leest. Het
            traject gebruikt datzelfde adres om een vragenlijst terug te vinden die het lid al
            invulde.
          </p>

          {leden.length === 0 && (
            <p style={{ color: SUB, fontSize: 14 }} data-testid="tekst-geen-leden">
              Er staat nog geen lid in dit traject.
            </p>
          )}

          {leden.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {leden.map((lid) => (
                <div
                  key={lid.id}
                  data-testid={`lid-${lid.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid #eef1f2",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ color: INK, fontSize: 14, fontWeight: 600 }}>{lid.naam}</div>
                  <div style={{ color: SUB, fontSize: 13 }}>
                    {lid.email || "geen adres, geef de link zelf door"}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <Label>Naam</Label>
              <Input
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                placeholder="Voornaam en naam"
                data-testid="input-lid-naam"
              />
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Label>E-mailadres</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@bedrijf.be"
                data-testid="input-lid-email"
              />
            </div>
            <Button
              onClick={() => voegLidToe.mutate()}
              disabled={!naam.trim() || voegLidToe.isPending}
              data-testid="button-lid-toevoegen"
            >
              <UserPlus className="mr-1 h-4 w-4" /> Lid toevoegen
            </Button>
          </div>
        </div>

        {/* ---- De rapportsluis ---- */}
        <div style={kaart}>
          <h2 style={{ color: INK, fontSize: 18, marginTop: 0 }}>De rapporten vrijgeven</h2>
          <p style={{ color: SUB, fontSize: 13, lineHeight: 1.55, marginTop: 0 }}>
            Een lid vult de vragenlijsten in en leest zijn eigen rapport niet. U leest de uitkomst
            eerst en bespreekt ze met het lid. Daarna geeft u het rapport vrij. Tot dat moment ziet
            het lid alleen de melding dat zijn antwoorden aangekomen zijn. De rapporten haalt u zelf
            altijd op via het
            {" "}
            <Link href="/hdd/rapport">
              <a style={{ color: INK, fontWeight: 600 }} data-testid="link-sluis-rapport">
                rapportscherm van Human Due Diligence
              </a>
            </Link>
            , ook wanneer u nog niets vrijgegeven hebt.
          </p>

          {leden.length === 0 && (
            <p style={{ color: SUB, fontSize: 14 }} data-testid="tekst-sluis-geen-leden">
              Zodra er leden in dit traject staan, kunt u hun rapporten hier vrijgeven.
            </p>
          )}

          {leden.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {leden.map((lid) => {
                const vrij = Boolean(lid.rapportVrijgaveOp);
                return (
                  <div
                    key={lid.id}
                    data-testid={`sluis-lid-${lid.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      border: "1px solid #eef1f2",
                      borderRadius: 8,
                      padding: "10px 14px",
                    }}
                  >
                    <div style={{ color: INK, fontSize: 14, fontWeight: 600 }}>{lid.naam}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: vrij ? GOED : SUB, fontSize: 13 }}>
                        {vrij ? "Vrijgegeven" : "Nog niet vrijgegeven"}
                      </span>
                      <Button
                        size="sm"
                        variant={vrij ? "outline" : "default"}
                        onClick={() => vrijgave.mutate({ lidId: lid.id, vrij: !vrij })}
                        disabled={vrijgave.isPending}
                        data-testid={`button-vrijgave-${lid.id}`}
                      >
                        {vrij ? (
                          <>
                            <Lock className="mr-1 h-4 w-4" /> Terugnemen
                          </>
                        ) : (
                          <>
                            <LockOpen className="mr-1 h-4 w-4" /> Vrijgeven
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {leden.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button
                onClick={() => vrijgave.mutate({ vrij: true })}
                disabled={vrijgave.isPending}
                data-testid="button-vrijgave-allen"
              >
                <LockOpen className="mr-1 h-4 w-4" /> Alle rapporten vrijgeven
              </Button>
              <Button
                variant="outline"
                onClick={() => vrijgave.mutate({ vrij: false })}
                disabled={vrijgave.isPending}
                data-testid="button-vrijgave-allen-terug"
              >
                <Lock className="mr-1 h-4 w-4" /> Alles terugnemen
              </Button>
            </div>
          )}
        </div>

        {/* ---- De twee fasen ---- */}
        <div style={kaart}>
          <h2 style={{ color: INK, fontSize: 18, marginTop: 0 }}>De vragenlijsten versturen</h2>
          <p style={{ color: SUB, fontSize: 13, lineHeight: 1.55, marginTop: 0 }}>
            In fase 1 krijgt elk lid twee links: een link voor de TaPas Teamscan en een link voor de
            2MINSCAN. In fase 2 volgt de link voor het TaPas Business Kompas. Verstuurt u een fase
            een tweede keer, dan blijven de links dezelfde en is het bericht een herinnering. De
            trajectprijs gaat één keer van uw saldo.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button
              onClick={() => stuurUit.mutate({ fase: 1 })}
              disabled={leden.length === 0 || stuurUit.isPending}
              data-testid="button-fase1-uitsturen"
            >
              <Layers className="mr-1 h-4 w-4" /> Fase 1 versturen
            </Button>
            <Button
              variant="outline"
              onClick={() => stuurUit.mutate({ fase: 2 })}
              disabled={leden.length === 0 || stuurUit.isPending}
              data-testid="button-fase2-uitsturen"
            >
              <Compass className="mr-1 h-4 w-4" /> Fase 2 versturen
            </Button>
            <Button
              variant="ghost"
              onClick={() => verversAlles()}
              data-testid="button-verversen"
            >
              <RefreshCw className="mr-1 h-4 w-4" /> Voortgang verversen
            </Button>
          </div>

          {fout && (
            <p style={{ color: ALARM, fontSize: 13, marginTop: 14 }} data-testid="melding-fout">
              {fout}
            </p>
          )}
          {mailweg != null && (
            <div style={{ marginTop: 8 }}>
              <Button
                variant="outline"
                onClick={() => stuurUit.mutate({ fase: mailweg, tochUitsturen: true })}
                data-testid="button-enkel-links"
              >
                <Mail className="mr-1 h-4 w-4" /> Alleen de links aanmaken, ik geef ze zelf door
              </Button>
            </div>
          )}
        </div>

        {/* ---- Uitslag van de laatste uitsturing ---- */}
        {uitslag && (
          <div style={kaart} data-testid="kaart-uitslag">
            <h2 style={{ color: INK, fontSize: 18, marginTop: 0 }}>
              Fase {uitslag.fase}: dit is verstuurd
            </h2>
            <p style={{ color: SUB, fontSize: 13, marginTop: 0 }}>
              {uitslag.aantalMailVerstuurd} van de {uitslag.leden.length} leden kregen een bericht.
              {uitslag.aantalZonderMail > 0
                ? ` ${uitslag.aantalZonderMail} leden hebben geen adres; geef hun links zelf door.`
                : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {uitslag.leden.map((lid) => {
                const post = uitslag.mail.find((m) => m.lidId === lid.lidId);
                return (
                  <div
                    key={lid.lidId}
                    data-testid={`uitslag-lid-${lid.lidId}`}
                    style={{ border: "1px solid #eef1f2", borderRadius: 8, padding: "12px 14px" }}
                  >
                    <div style={{ color: INK, fontSize: 14, fontWeight: 600 }}>{lid.naam}</div>
                    {lid.links.map((l) => (
                      <div key={l.instrumentId} style={{ marginTop: 6 }}>
                        <div style={{ color: ACCENT, fontSize: 12, fontWeight: 600 }}>
                          {naamVan(l.instrumentId)}
                          {l.nieuw ? "" : " (bestond al)"}
                        </div>
                        <div style={{ color: SUB, fontSize: 12, wordBreak: "break-all" }}>
                          {basis}
                          {l.link}
                        </div>
                      </div>
                    ))}
                    {post && (
                      <div
                        style={{
                          color: post.mailStatus === "fout" ? ALARM : SUB,
                          fontSize: 12,
                          marginTop: 8,
                        }}
                      >
                        {post.mailStatus === "verstuurd"
                          ? `Bericht verstuurd naar ${post.email}`
                          : post.melding || `Status van het bericht: ${post.mailStatus}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Voortgang ---- */}
        <div style={kaart}>
          <h2 style={{ color: INK, fontSize: 18, marginTop: 0 }}>Wie vulde wat in</h2>
          <p style={{ color: SUB, fontSize: 13, marginTop: 0 }}>
            Deze stand komt van de instrumenten zelf. Een vinkje betekent dat er antwoorden staan.
          </p>
          {(voortgang.data?.leden ?? []).length === 0 && (
            <p style={{ color: SUB, fontSize: 14 }}>Er is nog niets verstuurd.</p>
          )}
          {(voortgang.data?.leden ?? []).map((lid) => (
            <div
              key={lid.lidId}
              data-testid={`voortgang-lid-${lid.lidId}`}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 14,
                alignItems: "center",
                borderTop: "1px solid #f1f4f5",
                padding: "10px 0",
              }}
            >
              <div style={{ color: INK, fontSize: 14, fontWeight: 600, flex: "1 1 160px" }}>
                {lid.naam}
              </div>
              {lid.instrumenten.map((i) => (
                <div key={i.instrumentId} style={{ fontSize: 12, color: SUB, flex: "0 1 210px" }}>
                  <span style={{ color: i.ingevuld ? GOED : SUB, fontWeight: 600 }}>
                    {i.ingevuld ? "Ingevuld" : i.uitgestuurd ? "Verstuurd" : "Nog niet"}
                  </span>{" "}
                  {naamVan(i.instrumentId)}
                  {i.ingevuld && <Check className="ml-1 inline h-3 w-3" style={{ color: GOED }} />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
