// ---------------------------------------------------------------------------
// client/src/pages/reis-t4kids.tsx — NIEUW BESTAND (strikt additief).
//
// De kindvriendelijke belevings-UX voor T4Kids (10-13 jaar): een echte
// ontdekkingsreis langs drie eilanden (= de 3 modules van het instrument).
// Geen scores, geen tijdsdruk, vrije eilandvolgorde, "sla over"/"stop"-opties.
//
// Deze route (/reis/:id) staat volledig los van het generieke deel1-pad; enkel
// afnames met instrumentId "t4kids" landen hier (via deelnemer.tsx). De reis
// submit uiteindelijk naar dezelfde endpoints als elke afname:
//   POST /api/afnames/:id/main        { responses }
//   POST /api/afnames/:id/connection  { answers, keuzes }
// waarna buildT4KidsContract server-side het rapport bouwt.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Afname, BlockAnswer } from "@/lib/types";
import { normaliseerTaal, STANDAARD_TAAL } from "@shared/i18n";

// ── Vorm van het /api/vragenlijst/tapas-t4kids-antwoord (additief modules-veld).
interface InteressePaarView {
  id: string;
  links: { tekst: string };
  rechts: { tekst: string };
}
interface ArchetypeView {
  id: string;
  naam: string;
}
interface StellingView {
  id: string;
  tekst: string;
}
interface T4KidsView {
  name: string;
  modules: [
    { id: string; naam: string; uitleg: string; paren: InteressePaarView[] },
    {
      id: string;
      naam: string;
      uitleg: string;
      maxKeuze: number;
      topN: number;
      archetypen: ArchetypeView[];
    },
    {
      id: string;
      naam: string;
      uitleg: string;
      schaal: { waarde: number; label: string }[];
      stellingen: StellingView[];
    },
  ];
}

const leegAntwoord = (): BlockAnswer => ({
  most: null,
  least: null,
  itemEnergy: { most: null, least: null },
  blockEnergy: null,
});

// Fisher-Yates — itemvolgorde per eiland randomiseren (belevingswaarde).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Fase = "assent" | "kaart" | "eiland1" | "eiland2" | "eiland3";

const EILAND_EMOJI = ["🏝️", "🖼️", "🌟"];

export default function ReisT4Kids() {
  const params = useParams();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [fase, setFase] = useState<Fase>("assent");
  const [voltooid, setVoltooid] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Antwoorden per module.
  const [interesse, setInteresse] = useState<Record<string, "links" | "rechts">>({});
  const [gekozen, setGekozen] = useState<string[]>([]); // archetype-ids
  const [waarom, setWaarom] = useState<Record<string, string>>({});
  const [top3, setTop3] = useState<string[]>([]);
  const [schaal, setSchaal] = useState<Record<string, number>>({});

  const { data: afname } = useQuery<Afname>({
    queryKey: ["/api/afnames", id],
    enabled: !!id,
  });
  const taal = normaliseerTaal(afname?.taal ?? STANDAARD_TAAL);

  const { data: view, isLoading } = useQuery<T4KidsView>({
    queryKey: ["/api/vragenlijst/tapas-t4kids", taal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/vragenlijst/tapas-t4kids?taal=${taal}`);
      return res.json();
    },
    enabled: !!afname,
  });

  const m1 = view?.modules[0];
  const m2 = view?.modules[1];
  const m3 = view?.modules[2];

  // Randomiseer één keer per geladen view.
  const parenGemengd = useMemo(() => (m1 ? shuffle(m1.paren) : []), [m1]);
  const archetypenGemengd = useMemo(() => (m2 ? shuffle(m2.archetypen) : []), [m2]);
  const stellingenGemengd = useMemo(() => (m3 ? shuffle(m3.stellingen) : []), [m3]);

  const naam = (view?.name ?? afname?.name ?? "").trim().split(/\s+/)[0] || "ontdekker";

  function markeerVoltooid(nr: number) {
    setVoltooid((prev) => new Set(prev).add(nr));
    setFase("kaart");
  }

  function toggleArchetype(aid: string) {
    setGekozen((prev) => {
      if (prev.includes(aid)) {
        setTop3((t) => t.filter((x) => x !== aid));
        return prev.filter((x) => x !== aid);
      }
      if (m2 && prev.length >= m2.maxKeuze) return prev;
      return [...prev, aid];
    });
  }

  function toggleTop3(aid: string) {
    setTop3((prev) => {
      if (prev.includes(aid)) return prev.filter((x) => x !== aid);
      if (m2 && prev.length >= m2.topN) return prev;
      return [...prev, aid];
    });
  }

  async function rondAf() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Bouw de responses in de blockResponse-vorm die de server verwacht.
      const responses: Record<string, BlockAnswer> = {};
      for (const [pairId, kant] of Object.entries(interesse)) {
        responses[pairId] = { ...leegAntwoord(), most: kant };
      }
      for (const [stId, waarde] of Object.entries(schaal)) {
        responses[stId] = { ...leegAntwoord(), blockEnergy: waarde };
      }

      await apiRequest("POST", `/api/afnames/${id}/main`, { responses });

      const keuzes = {
        archetypen: gekozen.map((aid) => ({ id: aid, waarom: waarom[aid] ?? "" })),
        top3,
      };
      // answers q1..q4 zijn schema-verplicht; voor T4Kids neutraal (geen 0-10-schaal
      // in de kind-UX). keuzes reist additief mee en wordt server-side gelezen.
      await apiRequest("POST", `/api/afnames/${id}/connection`, {
        answers: { q1: 5, q2: 5, q3: 5, q4: 5 },
        keuzes,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/afnames"] });
      navigate(`/afname/${id}/klaar`);
    } catch (e: any) {
      toast({
        title: "Oeps, dat lukte niet",
        description: String(e?.message ?? e),
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }

  // ── Reeds voltooide afname niet opnieuw laten invullen ─────────────────────
  if (afname?.status === "voltooid") {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-sky-50 to-amber-50">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <div className="text-5xl">🎉</div>
          <h1 className="mt-4 text-xl font-semibold text-slate-800">Je reis zit erop!</h1>
          <p className="mt-2 text-slate-600">Je hebt de ontdekkingsreis al helemaal afgemaakt. Goed gedaan!</p>
        </main>
      </div>
    );
  }

  if (isLoading || !view || !m1 || !m2 || !m3) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-sky-50 to-amber-50">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  const eilanden = [m1, m2, m3];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-sky-50 via-teal-50 to-amber-50">
      <AppHeader right={<span className="text-sm text-slate-500">🧭 T4Kids Ontdekkingsreis</span>} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* ── Assent-scherm ─────────────────────────────────────────────── */}
        {fase === "assent" && (
          <Card className="border-teal-200 bg-white/80 shadow-sm">
            <CardContent className="p-8 text-center">
              <div className="text-6xl">🧭</div>
              <h1 className="mt-4 text-2xl font-bold text-slate-800">
                Hoi {naam}! Klaar voor de ontdekkingsreis?
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-slate-600">
                Je gaat op reis langs <strong>drie eilanden</strong>. Op elk eiland kies je gewoon wat
                het best bij jou past. Er zijn <strong>geen foute antwoorden</strong>, en je mag altijd
                iets overslaan of stoppen. Je bepaalt zelf welk eiland je eerst bezoekt.
              </p>
              <Button
                size="lg"
                className="mt-6 bg-teal-600 text-lg hover:bg-teal-700"
                onClick={() => setFase("kaart")}
                data-testid="button-start-reis"
              >
                Start mijn reis! 🚀
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Reiskaart (eilandkiezer) ──────────────────────────────────── */}
        {fase === "kaart" && (
          <div>
            <h1 className="text-center text-2xl font-bold text-slate-800">Jouw reiskaart</h1>
            <p className="mt-2 text-center text-slate-600">
              Kies een eiland om te bezoeken. Je mag ze in elke volgorde doen.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {eilanden.map((eiland, i) => {
                const nr = i + 1;
                const klaar = voltooid.has(nr);
                return (
                  <Card
                    key={eiland.id}
                    className={`cursor-pointer border-2 transition ${
                      klaar ? "border-emerald-300 bg-emerald-50" : "border-teal-200 bg-white/80 hover:border-teal-400"
                    }`}
                    onClick={() => setFase(`eiland${nr}` as Fase)}
                    data-testid={`kaart-eiland-${nr}`}
                  >
                    <CardContent className="p-5 text-center">
                      <div className="text-4xl">{EILAND_EMOJI[i]}</div>
                      <p className="mt-2 font-semibold text-slate-800">{eiland.naam}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {klaar ? "✅ Bezocht" : "Tik om te starten"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Button
                size="lg"
                variant={voltooid.size > 0 ? "default" : "outline"}
                className={voltooid.size > 0 ? "bg-amber-500 text-lg hover:bg-amber-600" : ""}
                onClick={rondAf}
                disabled={submitting}
                data-testid="button-rond-af"
              >
                {submitting ? "Bezig…" : "Rond mijn reis af 🏁"}
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                Je mag afronden wanneer je wil — ook als je niet alle eilanden bezocht hebt.
              </p>
            </div>
          </div>
        )}

        {/* ── Eiland 1 — Ontdekkingsreis (forced-choice) ────────────────── */}
        {fase === "eiland1" && (
          <div>
            <IslandHeader emoji={EILAND_EMOJI[0]} naam={m1.naam} uitleg={m1.uitleg} />
            <div className="mt-6 space-y-4">
              {parenGemengd.map((paar) => (
                <Card key={paar.id} className="border-teal-200 bg-white/80">
                  <CardContent className="p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["links", "rechts"] as const).map((kant) => {
                        const gekozenKant = interesse[paar.id] === kant;
                        const tekst = kant === "links" ? paar.links.tekst : paar.rechts.tekst;
                        return (
                          <button
                            key={kant}
                            type="button"
                            onClick={() => setInteresse((p) => ({ ...p, [paar.id]: kant }))}
                            className={`rounded-xl border-2 p-4 text-left text-base transition ${
                              gekozenKant
                                ? "border-teal-500 bg-teal-100 font-semibold text-teal-900"
                                : "border-slate-200 bg-white hover:border-teal-300"
                            }`}
                            data-testid={`keuze-${paar.id}-${kant}`}
                          >
                            {tekst}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <IslandFooter onKaart={() => setFase("kaart")} onKlaar={() => markeerVoltooid(1)} />
          </div>
        )}

        {/* ── Eiland 2 — Galerij (archetypen) ───────────────────────────── */}
        {fase === "eiland2" && (
          <div>
            <IslandHeader emoji={EILAND_EMOJI[1]} naam={m2.naam} uitleg={m2.uitleg} />
            <p className="mt-3 text-center text-sm text-slate-500">
              Gekozen: {gekozen.length}/{m2.maxKeuze}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {archetypenGemengd.map((a) => {
                const isGekozen = gekozen.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleArchetype(a.id)}
                    className={`rounded-xl border-2 p-3 text-center text-sm capitalize transition ${
                      isGekozen
                        ? "border-purple-500 bg-purple-100 font-semibold text-purple-900"
                        : "border-slate-200 bg-white hover:border-purple-300"
                    }`}
                    data-testid={`archetype-${a.id}`}
                  >
                    {a.naam}
                  </button>
                );
              })}
            </div>

            {gekozen.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-slate-800">Vertel in een paar woorden waarom</h3>
                <div className="mt-3 space-y-3">
                  {gekozen.map((aid) => {
                    const a = m2.archetypen.find((x) => x.id === aid);
                    return (
                      <div key={aid} className="rounded-lg border border-slate-200 bg-white/70 p-3">
                        <p className="text-sm font-medium capitalize text-slate-700">{a?.naam}</p>
                        <Textarea
                          rows={2}
                          placeholder="Waarom vind je dit leuk?"
                          value={waarom[aid] ?? ""}
                          onChange={(e) => setWaarom((p) => ({ ...p, [aid]: e.target.value }))}
                          className="mt-2"
                          data-testid={`waarom-${aid}`}
                        />
                      </div>
                    );
                  })}
                </div>

                <h3 className="mt-6 font-semibold text-slate-800">
                  Kies je top {m2.topN}: wat wil je NU het liefst zijn? ({top3.length}/{m2.topN})
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {gekozen.map((aid) => {
                    const a = m2.archetypen.find((x) => x.id === aid);
                    const rang = top3.indexOf(aid);
                    return (
                      <button
                        key={aid}
                        type="button"
                        onClick={() => toggleTop3(aid)}
                        className={`rounded-full border-2 px-4 py-2 text-sm capitalize transition ${
                          rang >= 0
                            ? "border-amber-500 bg-amber-100 font-semibold text-amber-900"
                            : "border-slate-200 bg-white hover:border-amber-300"
                        }`}
                        data-testid={`top3-${aid}`}
                      >
                        {rang >= 0 ? `${rang + 1}. ` : ""}
                        {a?.naam}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <IslandFooter onKaart={() => setFase("kaart")} onKlaar={() => markeerVoltooid(2)} />
          </div>
        )}

        {/* ── Eiland 3 — Zo ben ik nu (woordschaal) ─────────────────────── */}
        {fase === "eiland3" && (
          <div>
            <IslandHeader emoji={EILAND_EMOJI[2]} naam={m3.naam} uitleg={m3.uitleg} />
            <div className="mt-6 space-y-4">
              {stellingenGemengd.map((st) => (
                <Card key={st.id} className="border-teal-200 bg-white/80">
                  <CardContent className="p-4">
                    <p className="text-base text-slate-800">{st.tekst}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {m3.schaal.map((opt) => {
                        const gekozenOpt = schaal[st.id] === opt.waarde;
                        return (
                          <button
                            key={opt.waarde}
                            type="button"
                            onClick={() => setSchaal((p) => ({ ...p, [st.id]: opt.waarde }))}
                            className={`rounded-lg border-2 px-2 py-2 text-sm transition ${
                              gekozenOpt
                                ? "border-teal-500 bg-teal-100 font-semibold text-teal-900"
                                : "border-slate-200 bg-white hover:border-teal-300"
                            }`}
                            data-testid={`schaal-${st.id}-${opt.waarde}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <IslandFooter onKaart={() => setFase("kaart")} onKlaar={() => markeerVoltooid(3)} />
          </div>
        )}
      </main>
    </div>
  );
}

function IslandHeader({ emoji, naam, uitleg }: { emoji: string; naam: string; uitleg: string }) {
  return (
    <div className="text-center">
      <div className="text-5xl">{emoji}</div>
      <h1 className="mt-2 text-2xl font-bold text-slate-800">{naam}</h1>
      <p className="mx-auto mt-2 max-w-xl text-slate-600">{uitleg}</p>
    </div>
  );
}

function IslandFooter({ onKaart, onKlaar }: { onKaart: () => void; onKlaar: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <Button variant="outline" onClick={onKaart} data-testid="button-terug-kaart">
        ← Terug naar de kaart
      </Button>
      <Button className="bg-teal-600 hover:bg-teal-700" onClick={onKlaar} data-testid="button-eiland-klaar">
        Klaar met dit eiland ✓
      </Button>
    </div>
  );
}
