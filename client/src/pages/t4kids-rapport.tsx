// ---------------------------------------------------------------------------
// client/src/pages/t4kids-rapport.tsx — NIEUW BESTAND (strikt additief).
//
// Het rijke, kindvriendelijke T4Kids-eindrapport. Vervangt voor T4Kids-afnames
// de generieke "TaPas Kompas"-weergave (klaar.tsx blijft ongemoeid voor andere
// instrumenten). Leest het reeds server-side gebouwde contract via de additieve
// route GET /api/afnames/:id/t4kids-rapport.json en toont:
//   • trotse coverpagina met de naam van het kind
//   • welkom / hoe lees je dit boekje
//   • Deel 1 — talenten & interesses (reiskaart + exacte keuzes + staafgrafiek +
//     gekozen archetypen als aardappelbeeldkaarten met "waarom")
//   • Deel 2 — talentversnellers (+ staafgrafiek)
//   • Deel 3 — drijfveren (+ staafgrafiek)
//   • Deel 4 — paden om te verkennen
//   • voor de ouder — een warme uitnodiging
//   • wetenschappelijke onderbouwing met genummerde, klikbare bronnenlijst
//   • warme afsluiter
// "Download als PDF" gebruikt window.print() met een print-stylesheet (A4,
// cover + secties op eigen pagina's).
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";

// ── Contract-vorm (enkel wat dit rapport nodig heeft) ─────────────────────────
interface ReiskaartItem { focus: string; activiteit: string; keuzes: number }
interface RapportKind {
  titel: string;
  reiskaart: ReiskaartItem[];
  energieVan: string[];
  topArchetypen: { naam: string; waarom: string }[];
  watMeTypeert: string[];
  vanzelfGing: string[];
  verkennen: string[];
}
interface RapportOuder {
  methodiek: string;
  autonomieSignaal: string;
  gesprekstips: string[];
  talentVolgensBloom: string;
  nuance: string;
}
interface ExacteInteresse {
  id: string;
  gekozenKant: "links" | "rechts";
  gekozenTekst: string;
  andereTekst: string;
  focus: string;
}
interface ExacteArchetype {
  id: string;
  naam: string;
  focus: string;
  waarom: string;
  topRang: number | null;
}
interface ExacteStelling {
  id: string;
  tekst: string;
  soort: "Sterkte" | "Drijfveer";
  gekozenWaarde: number;
  gekozenWoord: string;
}
interface FocusTally { focus: string; activiteit: string; keuzes: number }
interface ExacteAntwoorden {
  interesses: ExacteInteresse[];
  focusTally: FocusTally[];
  archetypen: ExacteArchetype[];
  top3: { rang: number; id: string; naam: string }[];
  stellingen: ExacteStelling[];
}
interface ConstructRow {
  construct: string;
  family: string;
  avgEnergy: number;
  net: number;
  shown: number;
}
interface T4KidsContract {
  generatedAt: string;
  participant: { name: string };
  sections: {
    main: {
      meta: {
        completedInteresse: number;
        totalInteresse: number;
        gekozenArchetypen: number;
        completedStellingen: number;
        totalStellingen: number;
        autonomie: { intrinsiek: number; extrinsiek: number; balansLabel: string };
      };
      constructRows: ConstructRow[];
    };
    rapport: { kind: RapportKind; ouder: RapportOuder; exacteAntwoorden: ExacteAntwoorden };
  };
}

interface ManifestEntry { naam: string; focus: string; bestand: string; emoji: string }
interface Manifest { archetypen: Record<string, ManifestEntry> }

// ── Kleuren per focus (sluit aan bij de archetype-illustraties) ───────────────
const FOCUS_KLEUR: Record<string, string> = {
  "Abstraherend": "#6366f1",
  "Doelgericht-Creatief": "#f97316",
  "Sociaal-gericht": "#f43f5e",
  "Uitvoerend": "#10b981",
  "Overdracht-gericht": "#0ea5e9",
  "Artistiek-Creatief": "#a855f7",
};
const TEAL = "#0f766e";
const AMBER = "#f59e0b";

const voornaam = (n: string) => (n || "").trim().split(/\s+/)[0] || "ontdekker";

function formatteerDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

// ── Pagina-wrapper: elke sectie print op een eigen A4-pagina ─────────────────
function Pagina({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`t4k-pagina mx-auto mb-8 w-full max-w-[820px] rounded-3xl bg-white/90 p-8 shadow-lg ring-1 ring-teal-100 sm:p-10 ${className}`}>
      {children}
    </section>
  );
}

function SectieTitel({ nr, children }: { nr?: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-2xl font-extrabold text-teal-800 sm:text-3xl">
      {nr && (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-lg font-black text-white shadow">
          {nr}
        </span>
      )}
      <span style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>{children}</span>
    </h2>
  );
}

// Eenvoudige, print-veilige recharts-staafgrafiek.
function Staafgrafiek({
  data,
  kleurVoor,
  domeinMax,
}: {
  data: { label: string; waarde: number; focus?: string }[];
  kleurVoor: (d: { label: string; focus?: string }) => string;
  domeinMax?: number;
}) {
  const hoogte = Math.max(140, data.length * 46 + 30);
  return (
    <div className="t4k-chart w-full" style={{ height: hoogte }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 44, bottom: 6, left: 8 }}>
          <XAxis type="number" hide domain={[0, domeinMax ?? "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tick={{ fontSize: 13, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="waarde" radius={[0, 8, 8, 0]} isAnimationActive={false} barSize={22}>
            {data.map((d, i) => (
              <Cell key={i} fill={kleurVoor(d)} />
            ))}
            <LabelList dataKey="waarde" position="right" style={{ fontSize: 12, fill: "#475569" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function T4KidsRapport() {
  const params = useParams();
  const id = Number(params.id);

  const { data, isLoading, isError } = useQuery<T4KidsContract>({
    queryKey: ["/api/afnames", id, "t4kids-rapport"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/afnames/${id}/t4kids-rapport.json`);
      return res.json();
    },
    enabled: Number.isFinite(id),
  });

  const { data: manifest } = useQuery<Manifest>({
    queryKey: ["t4kids-archetypen-manifest"],
    queryFn: async () => {
      const res = await fetch("/t4kids/archetypen/manifest.json");
      if (!res.ok) throw new Error("manifest niet gevonden");
      return res.json();
    },
  });

  // Speelse titel-fonts inladen (Baloo 2) — zonder build-afhankelijkheid.
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap";
    document.head.appendChild(l);
    return () => { document.head.removeChild(l); };
  }, []);

  const beeldVoor = (aid: string): string | null => {
    const entry = manifest?.archetypen?.[aid];
    return entry ? `/t4kids/archetypen/${entry.bestand}` : null;
  };

  const kind = data?.sections.rapport.kind;
  const ouder = data?.sections.rapport.ouder;
  const exact = data?.sections.rapport.exacteAntwoorden;
  const meta = data?.sections.main.meta;
  const rows = data?.sections.main.constructRows ?? [];
  const naam = voornaam(data?.participant.name ?? "");

  const versnellerData = useMemo(
    () =>
      rows
        .filter((r) => r.family === "Sterkte")
        .map((r) => ({ label: r.construct, waarde: Number(r.avgEnergy.toFixed(2)) }))
        .sort((a, b) => b.waarde - a.waarde),
    [rows],
  );
  const driverData = useMemo(
    () =>
      rows
        .filter((r) => r.family === "Drijfveer")
        .map((r) => ({ label: r.construct, waarde: Number(r.avgEnergy.toFixed(2)) }))
        .sort((a, b) => b.waarde - a.waarde),
    [rows],
  );
  const focusData = useMemo(
    () =>
      (exact?.focusTally ?? [])
        .filter((f) => f.keuzes > 0)
        .map((f) => ({ label: f.focus, waarde: f.keuzes, focus: f.focus })),
    [exact],
  );

  if (isLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-gradient-to-b from-sky-50 to-amber-50">
        <p className="animate-pulse text-lg text-teal-700">Je talenten-boekje wordt gemaakt…</p>
      </div>
    );
  }
  if (isError || !data || !kind || !ouder || !exact || !meta) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-gradient-to-b from-sky-50 to-amber-50 px-6 text-center">
        <div>
          <div className="text-5xl">🧭</div>
          <p className="mt-3 text-lg text-slate-700">
            We konden dit talenten-boekje nog niet ophalen. Rond eerst de reis helemaal af.
          </p>
        </div>
      </div>
    );
  }

  const datum = formatteerDatum(data.generatedAt);

  return (
    <div className="t4k-root min-h-[100dvh] bg-gradient-to-b from-sky-100 via-teal-50 to-amber-50 pb-16">
      <PrintStyles />

      {/* Zwevende actiebalk (niet mee-geprint) */}
      <div className="t4k-noprint sticky top-0 z-20 flex items-center justify-between gap-3 bg-teal-700/95 px-4 py-3 text-white shadow-md backdrop-blur">
        <span className="font-semibold" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
          🧭 Talenten-boekje van {naam}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-teal-900 shadow transition hover:bg-amber-300"
          data-testid="button-download-pdf"
        >
          ⬇︎ Download als PDF
        </button>
      </div>

      <main className="px-3 pt-8 sm:px-6">
        {/* ── COVER ─────────────────────────────────────────────────────── */}
        <section className="t4k-cover t4k-pagina mx-auto mb-8 flex w-full max-w-[820px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 via-teal-400 to-amber-300 p-10 text-center text-white shadow-xl sm:p-16">
          <div className="text-6xl sm:text-7xl">🌟</div>
          <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-white/90">
            TaPasCity · Tapas for Kids
          </p>
          <h1
            className="mt-3 text-4xl font-black leading-tight drop-shadow-sm sm:text-6xl"
            style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}
          >
            Een vergrootglas voor<br />mijn talenten & passies
          </h1>
          <div className="mt-8 inline-flex flex-col items-center rounded-3xl bg-white/25 px-8 py-5 ring-2 ring-white/50">
            <span className="text-sm text-white/90">Dit boekje is van</span>
            <span
              className="mt-1 text-5xl font-black sm:text-6xl"
              style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}
            >
              {naam}
            </span>
          </div>
          <div className="mt-8 text-7xl sm:text-8xl">🥔</div>
          <p className="mt-6 text-white/90">{datum && `Mijn ontdekkingsreis · ${datum}`}</p>
        </section>

        {/* ── WELKOM ────────────────────────────────────────────────────── */}
        <Pagina>
          <SectieTitel>Hoi {naam}, welkom in jouw boekje!</SectieTitel>
          <div className="mt-4 space-y-3 text-[17px] leading-relaxed text-slate-700">
            <p>
              Jij bent op <strong>ontdekkingsreis</strong> geweest langs drie eilanden. Onderweg maakte je
              allemaal keuzes. In dit boekje lees je wat die keuzes laten zien over <strong>jouw talenten
              en waar je energie van krijgt</strong>.
            </p>
            <p>
              Een <strong>talent</strong> is iets wat vaak vanzelf een beetje beter gaat, en waar je blij van
              wordt. Dit boekje is geen rapport met cijfers en geen toets — er is <strong>geen goed of fout</strong>.
              Het is een <strong>foto van nu</strong>. Volgend jaar kan er alweer iets bij zijn gekomen, want
              talenten blijven groeien. 🌱
            </p>
            <div className="rounded-2xl bg-teal-50 p-4 text-teal-800 ring-1 ring-teal-100">
              <p className="font-semibold">Zo lees je dit boekje:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Deel 1 gaat over <strong>wat je leuk vindt</strong> (je interesses).</li>
                <li>Deel 2 gaat over <strong>hoe je dingen aanpakt</strong> (je talentversnellers).</li>
                <li>Deel 3 gaat over <strong>wat jou op gang brengt</strong> (je drijfveren).</li>
                <li>Deel 4 geeft <strong>ideeën om te verkennen</strong>. Achteraan is er een stukje voor je papa, mama of juf/meester.</li>
              </ul>
            </div>
          </div>
        </Pagina>

        {/* ── DEEL 1 — TALENTEN & INTERESSES ────────────────────────────── */}
        <Pagina>
          <SectieTitel nr="1">Mijn talenten & interesses</SectieTitel>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
            Op <strong>Eiland 1</strong> koos je telkens tussen twee dingen. Zo ontstond jouw persoonlijke
            <strong> reiskaart</strong>: de kleuren waar je het vaakst naartoe reisde.
          </p>

          {kind.energieVan.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {kind.energieVan.map((z, i) => (
                <span key={i} className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
                  ⭐ {z}
                </span>
              ))}
            </div>
          )}

          {/* Reiskaart als kleurtegels */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {kind.reiskaart.map((r) => (
              <div
                key={r.focus}
                className="rounded-2xl p-4 text-white shadow-sm"
                style={{ backgroundColor: FOCUS_KLEUR[r.focus] ?? TEAL }}
              >
                <div className="text-2xl font-black">{r.keuzes}×</div>
                <div className="text-sm leading-snug opacity-95">{r.activiteit}</div>
              </div>
            ))}
          </div>

          {/* Staafgrafiek interessefoci */}
          {focusData.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-800">Waar reisde je het vaakst naartoe?</h3>
              <Staafgrafiek data={focusData} kleurVoor={(d) => FOCUS_KLEUR[d.focus ?? ""] ?? TEAL} />
            </div>
          )}

          {/* Exacte interessekeuzes */}
          {exact.interesses.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-800">Jouw exacte keuzes op Eiland 1</h3>
              <ul className="mt-3 space-y-2">
                {exact.interesses.map((k) => (
                  <li key={k.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                    <span
                      className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: FOCUS_KLEUR[k.focus] ?? TEAL }}
                    />
                    <span className="text-[15px] text-slate-700">
                      <strong className="text-slate-900">{k.gekozenTekst}</strong>
                      <span className="text-slate-400"> — liever dan “{k.andereTekst}”</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gekozen archetypen als beeldkaarten */}
          {exact.archetypen.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-800">De figuren die jij koos op Eiland 2</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {exact.archetypen.map((a) => {
                  const src = beeldVoor(a.id);
                  return (
                    <figure key={a.id} className="overflow-hidden rounded-2xl bg-white shadow ring-1 ring-slate-100">
                      <div className="relative">
                        {src ? (
                          <img src={src} alt={a.naam} className="aspect-square w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid aspect-square w-full place-items-center bg-teal-50 text-4xl">🥔</div>
                        )}
                        {a.topRang && (
                          <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-white shadow">
                            #{a.topRang}
                          </span>
                        )}
                      </div>
                      <figcaption className="p-3">
                        <p className="font-bold capitalize text-slate-800">{a.naam}</p>
                        {a.waarom ? (
                          <p className="mt-1 text-sm italic text-slate-600">“{a.waarom}”</p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-400">Deze koos je omdat hij bij je past.</p>
                        )}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top-3 */}
          {exact.top3.length > 0 && (
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-amber-50 to-teal-50 p-5 ring-1 ring-amber-100">
              <h3 className="text-lg font-bold text-slate-800">🏆 Jouw top {exact.top3.length}</h3>
              <ol className="mt-2 flex flex-wrap gap-2">
                {exact.top3.map((t) => (
                  <li key={t.id} className="rounded-full bg-white px-4 py-2 text-sm font-semibold capitalize text-teal-800 shadow-sm ring-1 ring-teal-100">
                    {t.rang}. {t.naam}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Pagina>

        {/* ── DEEL 2 — TALENTVERSNELLERS ────────────────────────────────── */}
        <Pagina>
          <SectieTitel nr="2">Wat mij typeert — mijn talentversnellers</SectieTitel>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
            Een <strong>talentversneller</strong> is een manier waarop jij dingen aanpakt, waardoor iets net
            wat vlotter gaat. Dit liet je zien op <strong>Eiland 3</strong>.
          </p>

          {kind.watMeTypeert.length > 0 && (
            <ul className="mt-4 space-y-2">
              {kind.watMeTypeert.map((z, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-teal-50 p-3 text-teal-900 ring-1 ring-teal-100">
                  <span className="text-lg">💪</span>
                  <span className="text-[15px]">{z.charAt(0).toUpperCase() + z.slice(1)}.</span>
                </li>
              ))}
            </ul>
          )}

          {versnellerData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-800">Jouw talentversnellers in beeld</h3>
              <Staafgrafiek data={versnellerData} kleurVoor={() => TEAL} domeinMax={3} />
              <p className="mt-1 text-xs text-slate-400">Schaal: bijna nooit (0) → bijna altijd (3).</p>
            </div>
          )}

          {kind.vanzelfGing.length > 0 && (
            <div className="mt-6 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
              <h3 className="text-lg font-bold text-amber-900">Wat bijna vanzelf ging ✨</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-slate-700">
                {kind.vanzelfGing.map((z, i) => <li key={i}>{z}</li>)}
              </ul>
            </div>
          )}
        </Pagina>

        {/* ── DEEL 3 — DRIJFVEREN ───────────────────────────────────────── */}
        <Pagina>
          <SectieTitel nr="3">Wat mij drijft — mijn drijfveren</SectieTitel>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
            Je <strong>drijfveren</strong> zijn wat jou op gang brengt. Iedereen heeft een eigen mix — er is
            geen betere of slechtere.
          </p>

          {driverData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-slate-800">Jouw drijfveren in beeld</h3>
              <Staafgrafiek data={driverData} kleurVoor={() => AMBER} domeinMax={3} />
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-teal-50 p-5 ring-1 ring-teal-100">
            <h3 className="text-lg font-bold text-teal-900">Zelf willen of samen willen?</h3>
            <p className="mt-2 text-[15px] text-slate-700">
              Soms doe je iets <strong>omdat je het zelf leuk of belangrijk vindt</strong>, soms
              <strong> omdat je anderen blij wil maken</strong>. Bij jou lijkt het nu{" "}
              <strong>{meta.autonomie.balansLabel}</strong> te zijn. Dat is een mooi startpunt voor een gesprek —
              geen eindoordeel.
            </p>
          </div>

          {/* Exacte stellingantwoorden */}
          {exact.stellingen.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-800">Jouw exacte antwoorden op Eiland 3</h3>
              <ul className="mt-3 space-y-2">
                {exact.stellingen.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                    <span className="text-[15px] text-slate-700">{s.tekst}</span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                        s.soort === "Sterkte" ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {s.gekozenWoord}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Pagina>

        {/* ── DEEL 4 — PADEN OM TE VERKENNEN ────────────────────────────── */}
        <Pagina>
          <SectieTitel nr="4">Paden om te verkennen</SectieTitel>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
            Dit zijn geen opdrachten — het zijn <strong>ideetjes</strong> die passen bij wat je liet zien. Je
            mag zelf kiezen wat je eens wil proberen. 🧭
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {kind.verkennen.map((v, i) => (
              <div key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-teal-100">
                <span className="text-2xl">🚩</span>
                <p className="mt-1 text-[15px] text-slate-700">{v}</p>
              </div>
            ))}
          </div>
        </Pagina>

        {/* ── VOOR DE OUDER ─────────────────────────────────────────────── */}
        <Pagina className="bg-teal-50/80">
          <SectieTitel>Voor de ouder — een uitnodiging</SectieTitel>
          <p className="mt-4 text-[16px] leading-relaxed text-slate-700">{ouder.methodiek}</p>

          <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-teal-100">
            <h3 className="text-lg font-bold text-teal-800">Wat betekent “talent” hier?</h3>
            <p className="mt-2 text-[15px] text-slate-700">{ouder.talentVolgensBloom}</p>
          </div>

          <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-teal-100">
            <h3 className="text-lg font-bold text-teal-800">Signaal rond motivatie</h3>
            <p className="mt-2 text-[15px] text-slate-700">{ouder.autonomieSignaal}</p>
          </div>

          <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-teal-100">
            <h3 className="text-lg font-bold text-teal-800">Gesprekstips</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-slate-700">
              {ouder.gesprekstips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>

          <div className="mt-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-100">
            <h3 className="text-lg font-bold text-amber-900">Belangrijke nuance</h3>
            <p className="mt-2 text-[15px] text-slate-700">{ouder.nuance}</p>
          </div>

          <p className="mt-5 text-center text-[16px] font-medium text-teal-800">
            Neem {naam} ernstig, wees nieuwsgierig, en ontdek samen. Dat is het mooiste cadeau. 💛
          </p>
        </Pagina>

        {/* ── WETENSCHAPPELIJKE ONDERBOUWING ────────────────────────────── */}
        <Pagina>
          <SectieTitel>Wetenschappelijke onderbouwing</SectieTitel>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-700">
            Dit boekje is speels, maar niet willekeurig. De opbouw leunt op enkele gevestigde kaders uit de
            onderwijs- en motivatiepsychologie. Kort samengevat:
          </p>
          <div className="mt-4 space-y-3 text-[15px] text-slate-700">
            <p>
              <strong>Talent als hogere-orde denken.</strong> We kijken niet naar losse feitenkennis, maar
              naar <em>analyseren, evalueren en creëren</em> — de hoogste niveaus in de herziene taxonomie van
              Bloom (Anderson &amp; Krathwohl). Deel 1 en 2 sporen aanzetten daartoe op.
            </p>
            <p>
              <strong>Motivatie: van binnenuit of van buitenaf.</strong> Of een kind iets doet omdat het zelf
              wil, of om anderen te plezieren, komt uit de <em>zelfdeterminatietheorie</em> (Deci &amp; Ryan).
              Deel 3 signaleert dit voorzichtig, als gespreksopener.
            </p>
            <p>
              <strong>Groeidenken en karaktersterktes.</strong> Talenten zijn niet in beton gegoten. We
              formuleren procesgericht (“je liet zien dat…”), in lijn met de <em>growth mindset</em> (Dweck)
              en de talent-/karaktersterktebenadering (VIA).
            </p>
            <p>
              <strong>Drijfveren.</strong> De vijf drijfveren zijn een verzachte, kindvriendelijke variant van
              de <em>working-style drivers</em> uit de transactionele analyse (Kahler): Be&nbsp;Perfect,
              Please&nbsp;Others, Hurry&nbsp;Up, Try&nbsp;Hard, Be&nbsp;Strong.
            </p>
          </div>

          <h3 className="mt-6 text-lg font-bold text-teal-800">Bronnen</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-[14px] text-slate-600">
            <li>
              Anderson, L. W., &amp; Krathwohl, D. R. (2001). <em>A Taxonomy for Learning, Teaching, and
              Assessing: A Revision of Bloom’s Taxonomy of Educational Objectives.</em>{" "}
              <a className="text-teal-700 underline" href="https://en.wikipedia.org/wiki/Bloom%27s_taxonomy" target="_blank" rel="noreferrer">
                overzicht
              </a>
            </li>
            <li>
              Deci, E. L., &amp; Ryan, R. M. — Self-Determination Theory.{" "}
              <a className="text-teal-700 underline" href="https://selfdeterminationtheory.org/" target="_blank" rel="noreferrer">
                selfdeterminationtheory.org
              </a>
            </li>
            <li>
              Dweck, C. S. (2006). <em>Mindset: The New Psychology of Success.</em>{" "}
              <a className="text-teal-700 underline" href="https://en.wikipedia.org/wiki/Mindset#Fixed_and_growth" target="_blank" rel="noreferrer">
                growth mindset
              </a>
            </li>
            <li>
              Peterson, C., &amp; Seligman, M. (2004). <em>Character Strengths and Virtues</em> (VIA).{" "}
              <a className="text-teal-700 underline" href="https://www.viacharacter.org/" target="_blank" rel="noreferrer">
                viacharacter.org
              </a>
            </li>
            <li>
              Kahler, T. (1975). <em>Drivers: The Key to the Process of Scripts.</em>{" "}
              <a className="text-teal-700 underline" href="https://en.wikipedia.org/wiki/Transactional_analysis" target="_blank" rel="noreferrer">
                transactionele analyse
              </a>
            </li>
          </ol>
          <p className="mt-4 text-xs italic text-slate-400">
            Dit instrument is een exploratie, geen diagnose of studieadvies.
          </p>
        </Pagina>

        {/* ── AFSLUITER ─────────────────────────────────────────────────── */}
        <section className="t4k-pagina mx-auto mb-8 flex w-full max-w-[820px] flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-amber-300 via-teal-400 to-teal-600 p-12 text-center text-white shadow-xl sm:p-16">
          <div className="text-6xl">🎈</div>
          <h2
            className="mt-4 text-3xl font-black sm:text-4xl"
            style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}
          >
            Goed gedaan, {naam}!
          </h2>
          <p className="mt-4 max-w-md text-white/95">
            Je hebt jouw talenten onder een vergrootglas gelegd. Blijf nieuwsgierig, blijf proberen — er is nog
            zóveel moois in jou te ontdekken.
          </p>
          <p className="mt-6 font-semibold">Het TaPas-team wenst je een talent-rijke reis. 🌟</p>
          <div className="mt-6 text-5xl">🥔🌟🚀</div>
        </section>
      </main>
    </div>
  );
}

// Print-stylesheet: A4, cover + elke sectie op eigen pagina, actiebalk verbergen.
function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 12mm; }
        html, body { background: #ffffff !important; }
        .t4k-noprint { display: none !important; }
        .t4k-root { background: #ffffff !important; padding: 0 !important; }
        .t4k-root main { padding: 0 !important; }
        .t4k-pagina {
          box-shadow: none !important;
          ring: 0 !important;
          break-inside: avoid;
          page-break-inside: avoid;
          page-break-after: always;
          margin: 0 auto 0 auto !important;
          max-width: 100% !important;
          width: 100% !important;
        }
        .t4k-pagina:last-child { page-break-after: auto; }
        .t4k-chart { break-inside: avoid; page-break-inside: avoid; }
        figure { break-inside: avoid; page-break-inside: avoid; }
        a { color: #0f766e !important; text-decoration: underline; }
      }
    `}</style>
  );
}
