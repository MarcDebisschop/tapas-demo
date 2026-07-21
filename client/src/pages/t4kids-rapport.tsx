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
import {
  FOCUS_KLEUR,
  DEEP_TEAL,
  ORANGE,
  VIOLET,
  TAPPIE_SRC,
  COVER_GRADIENT,
  AFSLUITER_GRADIENT,
} from "@/pages/t4kids/palette";
import { analyseerWoorden } from "@/pages/t4kids/woordanalyse";

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

// ── Kleuren per focus komen uit het gedeelde tiener-palet ─────────────────────
const TEAL = DEEP_TEAL; // hoofd-accent voor sterktes/tegels
const AMBER = ORANGE; // energie-accent voor drijfveren

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
    <section className={`t4k-pagina mx-auto mb-8 w-full max-w-[820px] rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200 sm:p-10 ${className}`}>
      {children}
    </section>
  );
}

// Tappie-mascotte in het rapport (print-veilig, geen animatie).
function Tappie({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={TAPPIE_SRC}
      alt="Tappie"
      style={{ width: size, height: size }}
      className={`select-none object-contain ${className}`}
    />
  );
}

function SectieTitel({ nr, children }: { nr?: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl" style={{ color: DEEP_TEAL }}>
      {nr && (
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black text-white shadow"
          style={{ backgroundColor: ORANGE }}
        >
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

  // ── Deel 5 — cross-eiland-analyse (client-side afgeleid uit contractdata) ────
  // Versterkingen (signalen die samenvallen) + "verwonderlijke dingen om samen
  // te bespreken" (zachte spanning). Nooit "tegenstrijdig"; robuust bij lege data.
  const analyse = useMemo(() => {
    const res = {
      versterkingen: [] as string[],
      verwonderlijk: [] as string[],
      ouder: "",
    };
    if (!exact) return res;

    const tally = [...(exact.focusTally ?? [])]
      .filter((f) => f.keuzes > 0)
      .sort((a, b) => b.keuzes - a.keuzes);
    const archs = exact.archetypen ?? [];
    const top3 = exact.top3 ?? [];
    const stellingen = exact.stellingen ?? [];
    const archFocus = new Set(archs.map((a) => a.focus));
    const dom = tally[0];
    const kleineAct = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

    // A. Versterkingen / bevestigingen
    if (dom && archs.length > 0) {
      const passend = archs.filter((a) => a.focus === dom.focus);
      if (passend.length > 0) {
        const namen = passend.slice(0, 2).map((a) => a.naam).join(" en ");
        res.versterkingen.push(
          `Op Eiland 1 koos je vaak voor ${kleineAct(dom.activiteit)}, en op Eiland 2 koos je figuren als ${namen} die daar prachtig bij passen. Dat versterkt elkaar — een duidelijk signaal van waar jouw energie zit. 💪`,
        );
      }
    }
    const sterkeSterktes = stellingen.filter((s) => s.soort === "Sterkte" && s.gekozenWaarde >= 2);
    if (sterkeSterktes.length > 0 && dom) {
      const woorden = sterkeSterktes.slice(0, 2).map((s) => `“${s.gekozenWoord}”`).join(" en ");
      res.versterkingen.push(
        `Je liet op Eiland 3 ook zien dat ${woorden} vaak bij jou past. Zulke krachten helpen je om met ${kleineAct(dom.activiteit)} nog verder te groeien.`,
      );
    }

    // B. Verwonderlijke dingen die fijn zijn om samen te bespreken
    if (dom && archs.length > 0 && !archFocus.has(dom.focus)) {
      const yArch = archs[0]!;
      res.verwonderlijk.push(
        `Je koos op Eiland 1 vaak voor ${kleineAct(dom.activiteit)}, maar bij de figuren viel je meer op ${yArch.naam}. Dat is niet gek — misschien speelt het ene vooral thuis, en het andere vooral op school? Fijn om er samen eens over te praten: wanneer voelt ${naam} zich het meest zichzelf?`,
      );
    } else if (dom && archs.length > 0 && top3.length > 0) {
      const topArch =
        archs.find((a) => a.topRang === 1) ??
        archs.find((a) => top3.some((t) => t.id === a.id));
      if (topArch && topArch.focus !== dom.focus) {
        res.verwonderlijk.push(
          `Je reisde op Eiland 1 het vaakst naar ${kleineAct(dom.activiteit)}, maar bij je top koos je voor ${topArch.naam}. Twee mooie kanten van jou! Wanneer komt elk van beide het sterkst naar boven — thuis, op school of bij vrienden?`,
        );
      }
    }
    const sterkeDrijf = stellingen.filter((s) => s.soort === "Drijfveer" && s.gekozenWaarde >= 2);
    if (sterkeDrijf.length > 0) {
      res.verwonderlijk.push(
        `Je liet zien dat je dingen graag héél goed wil doen. Dat is een mooie kracht — én soms best spannend. Wat helpt jou als iets even niet lukt?`,
      );
    }

    // Warme fallbacks als er geen duidelijke divergentie/versterking is.
    if (res.versterkingen.length === 0) {
      res.versterkingen.push(
        `Over de eilanden heen zie je telkens stukjes van dezelfde ${naam} terugkomen. Zoek samen naar wat op elk eiland het meest opviel.`,
      );
    }
    if (res.verwonderlijk.length === 0) {
      res.verwonderlijk.push(
        `De eilanden vertellen een verrassend consistent verhaal — mooi! Bespreek samen wat ${naam} het meest verraste.`,
      );
    }

    // Ouder-verdieping — context-druk iets explicieter, als uitnodiging.
    const ouderStukken: string[] = [];
    if (dom && archs.length > 0 && !archFocus.has(dom.focus)) {
      ouderStukken.push(
        `Er is een lichte spanning tussen de sterke interesse in “${dom.activiteit}” (Eiland 1) en de gekozen figuren (Eiland 2). Dat kan wijzen op een verschil in context — thuis versus school — of tussen wat ${naam} leuk vindt en waar hij/zij zich (nog) toe durft rekenen.`,
      );
    }
    if (sterkeDrijf.length > 0) {
      ouderStukken.push(
        `De antwoorden op Eiland 3 tonen een merkbare drijfveer (bijvoorbeeld iets heel goed willen doen of anderen willen plezieren). Zulke drijfveren zijn krachtig én kunnen extrinsieke druk meebrengen — de moeite waard om er zonder oordeel over door te vragen.`,
      );
    }
    if (ouderStukken.length === 0) {
      ouderStukken.push(
        `De signalen over de drie eilanden liggen mooi in lijn met elkaar. Dat maakt het gesprek met ${naam} eenvoudiger: bevestig wat je ziet en vraag door op wat hem/haar zelf het meest verraste.`,
      );
    }
    res.ouder = ouderStukken.join(" ");
    return res;
  }, [exact, naam]);

  // ── "De onzichtbare laag" — de eigen woorden van het kind serieus nemen ──────
  // Puur afgeleid uit de reeds aanwezige `waarom`-teksten. Robuust bij lege data.
  const woordAnalyse = useMemo(
    () =>
      analyseerWoorden(
        (exact?.archetypen ?? []).map((a) => ({
          naam: a.naam,
          focus: a.focus,
          waarom: a.waarom,
        })),
      ),
    [exact],
  );

  // Verwonderlijke punten uit de woorden (divergentie woord ↔ figuur) — ADDITIEF
  // bovenop de bestaande cross-eiland verwonderpunten.
  const verwonderlijkAlles = useMemo(
    () => [...analyse.verwonderlijk, ...woordAnalyse.divergenties.map((d) => d.zin)],
    [analyse, woordAnalyse],
  );

  if (isLoading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-gradient-to-b from-cyan-600 via-violet-700 to-slate-900">
        <p className="animate-pulse text-lg font-semibold text-cyan-200">Je talenten-boekje wordt gemaakt…</p>
      </div>
    );
  }
  if (isError || !data || !kind || !ouder || !exact || !meta) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-gradient-to-b from-cyan-600 via-violet-700 to-slate-900 px-6 text-center">
        <div className="flex flex-col items-center">
          <Tappie size={110} />
          <p className="mt-3 text-lg text-slate-100">
            We konden dit talenten-boekje nog niet ophalen. Rond eerst de reis helemaal af.
          </p>
        </div>
      </div>
    );
  }

  const datum = formatteerDatum(data.generatedAt);

  return (
    <div className="t4k-root min-h-[100dvh] bg-gradient-to-b from-cyan-700 via-violet-800 to-slate-900 pb-16">
      <PrintStyles />

      {/* Zwevende actiebalk (niet mee-geprint) */}
      <div className="t4k-noprint sticky top-0 z-20 flex items-center justify-between gap-3 bg-slate-900/95 px-4 py-3 text-white shadow-md ring-1 ring-cyan-400/30 backdrop-blur">
        <span className="font-semibold" style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}>
          🧭 Talenten-boekje van {naam}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-orange-400"
          data-testid="button-download-pdf"
        >
          ⬇︎ Download als PDF
        </button>
      </div>

      <main className="px-3 pt-8 sm:px-6">
        {/* ── COVER ─────────────────────────────────────────────────────── */}
        <section className={`t4k-cover t4k-pagina mx-auto mb-8 flex w-full max-w-[820px] flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br ${COVER_GRADIENT} p-10 text-center text-white shadow-2xl sm:p-16`}>
          <Tappie size={130} className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.4)]" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-white/90">
            TaPasCity · Tapas for Kids
          </p>
          <h1
            className="mt-3 text-4xl font-black leading-tight drop-shadow-sm sm:text-6xl"
            style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}
          >
            Een vergrootglas voor<br />mijn talenten & passies
          </h1>
          <div className="mt-8 inline-flex flex-col items-center rounded-3xl bg-white/15 px-8 py-5 ring-2 ring-white/40">
            <span className="text-sm text-white/90">Dit boekje is van</span>
            <span
              className="mt-1 text-5xl font-black sm:text-6xl"
              style={{ fontFamily: "'Baloo 2', system-ui, sans-serif" }}
            >
              {naam}
            </span>
          </div>
          <p className="mt-6 text-white/90">{datum && `Mijn ontdekkingsreis · ${datum}`}</p>
        </section>

        {/* ── WELKOM ────────────────────────────────────────────────────── */}
        <Pagina>
          <SectieTitel>Hoi {naam}, welkom in jouw boekje!</SectieTitel>

          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-slate-900 p-4 text-slate-100 ring-1 ring-cyan-400/40">
            <Tappie size={72} className="shrink-0" />
            <p className="text-[15px] leading-relaxed">
              De vrolijke figuur in dit boekje is <strong className="text-cyan-300">Tappie</strong>. Tappie
              kan elke gedaante aannemen — detective, uitvinder, kunstenaar en nog veel meer. Net zoals jij:
              jij draagt heel veel talenten en passies in je. In dit boekje ontdek je welke.
            </p>
          </div>

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
                <span key={i} className="rounded-full bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-900 ring-1 ring-orange-300">
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
                          <div className="grid aspect-square w-full place-items-center bg-cyan-50 p-4">
                            <img src={TAPPIE_SRC} alt="" className="h-full w-full object-contain" />
                          </div>
                        )}
                        {a.topRang && (
                          <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white shadow" style={{ backgroundColor: ORANGE }}>
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
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-orange-50 to-cyan-50 p-5 ring-1 ring-orange-200">
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
            <div className="mt-6 rounded-2xl bg-orange-50 p-5 ring-1 ring-orange-200">
              <h3 className="text-lg font-bold text-orange-900">Wat bijna vanzelf ging ✨</h3>
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
                        s.soort === "Sterkte" ? "bg-cyan-100 text-cyan-800" : "bg-orange-100 text-orange-800"
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

        {/* ── WAT JOUW EIGEN WOORDEN ONS VERTELDEN (de onzichtbare laag) ── */}
        <Pagina>
          <SectieTitel>Wat jouw eigen woorden ons vertelden</SectieTitel>

          <div className="mt-4 flex items-start gap-4 rounded-2xl bg-slate-900 p-4 text-slate-100 ring-1 ring-cyan-400/40">
            <Tappie size={64} className="shrink-0" />
            <p className="text-[15px] leading-relaxed">
              Bij de figuren schreef je in je eigen woorden waarom ze bij je passen. Dank je wel — zo
              mochten we even in <strong className="text-cyan-300">jóuw wereld</strong> meekijken. Dit is
              wat we daarin terugzagen.
            </p>
          </div>

          {woordAnalyse.heeftWoorden ? (
            <>
              {/* De voorzichtige rode draad uit de woorden */}
              <div className="mt-4 rounded-2xl bg-cyan-50 p-5 ring-1 ring-cyan-200">
                <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: DEEP_TEAL }}>
                  <span className="text-xl">🧵</span> Een zachte rode draad
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
                  In jouw woorden kwam vooral dit naar boven:{" "}
                  <strong>{woordAnalyse.rodeDraad[0]?.motief.label}</strong>
                  {woordAnalyse.rodeDraad[1] && (
                    <>
                      , en ook <strong>{woordAnalyse.rodeDraad[1].motief.label}</strong>
                    </>
                  )}
                  . Misschien is dat iets waar jij blij van wordt — het lijkt een beetje op wie jij bent.
                </p>
                {woordAnalyse.citaat && (
                  <p className="mt-3 rounded-xl bg-white p-3 text-[15px] italic text-slate-600 shadow-sm ring-1 ring-cyan-100">
                    Je schreef bijvoorbeeld: “{woordAnalyse.citaat}”
                  </p>
                )}
              </div>

              {/* Het verbindende: eenzelfde motief bij meerdere figuren */}
              {woordAnalyse.verbindend && (
                <div className="mt-4 rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-200">
                  <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: VIOLET }}>
                    <span className="text-xl">🔗</span> Wat alles verbindt
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
                    Bij verschillende figuren ({woordAnalyse.verbindend.figuren.join(", ")}) kwam telkens
                    ditzelfde terug: <strong>{woordAnalyse.verbindend.motief.label}</strong>. Dat lijkt
                    echt iets te zijn wat jou drijft. Mooi om te zien!
                  </p>
                </div>
              )}

              <p className="mt-4 text-center text-[16px] font-medium" style={{ color: DEEP_TEAL }}>
                Jouw woorden laten zien wie je bent — dank je dat je ze met ons deelde. 💛
              </p>
            </>
          ) : (
            <div className="mt-4 rounded-2xl bg-cyan-50 p-5 text-[15px] leading-relaxed text-slate-700 ring-1 ring-cyan-200">
              Deze keer koos je vooral met je gevoel — ook dat vertelt iets moois. Soms weet je gewoon dat
              iets bij je past, zonder er woorden voor te hebben. Ook dat mag. 💛
            </div>
          )}
        </Pagina>

        {/* ── WAT WE TERUGZIEN OVER DE EILANDEN HEEN (cross-eiland) ─────── */}
        <Pagina>
          <SectieTitel>Wat we terugzien over de eilanden heen</SectieTitel>
          <p className="mt-4 text-[17px] leading-relaxed text-slate-700">
            Elk eiland vertelde een stukje van jouw verhaal. Als we ze <strong>samen</strong> bekijken, zien
            we waar de eilanden elkaar <strong>versterken</strong> — en waar er iets <strong>verwonderlijks</strong>{" "}
            zit dat fijn is om samen te bespreken.
          </p>

          {/* A. Versterkingen / bevestigingen */}
          <div className="mt-6 rounded-2xl bg-cyan-50 p-5 ring-1 ring-cyan-200">
            <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: DEEP_TEAL }}>
              <span className="text-xl">💪</span> Wat elkaar versterkt
            </h3>
            <ul className="mt-3 space-y-3">
              {analyse.versterkingen.map((z, i) => (
                <li key={i} className="rounded-xl bg-white p-3 text-[15px] leading-relaxed text-slate-700 shadow-sm ring-1 ring-cyan-100">
                  {z}
                </li>
              ))}
            </ul>
          </div>

          {/* B. Verwonderlijke dingen om samen te bespreken */}
          <div className="mt-4 rounded-2xl bg-violet-50 p-5 ring-1 ring-violet-200">
            <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: VIOLET }}>
              <span className="text-xl">✨</span> Verwonderlijke dingen om samen te bespreken
            </h3>
            <ul className="mt-3 space-y-3">
              {verwonderlijkAlles.map((z, i) => (
                <li key={i} className="rounded-xl bg-white p-3 text-[15px] leading-relaxed text-slate-700 shadow-sm ring-1 ring-violet-100">
                  {z}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm italic text-slate-500">
              Dit zijn geen tekortkomingen — het zijn nieuwsgierige vragen. Er is geen goed of fout.
            </p>
          </div>

          {/* Ouder-verdieping */}
          <div className="mt-4 rounded-2xl bg-slate-900 p-5 text-slate-100 ring-1 ring-cyan-400/40">
            <h3 className="text-base font-bold text-cyan-300">Voor de ouder — iets dieper</h3>
            <p className="mt-2 text-[15px] leading-relaxed">{analyse.ouder}</p>
          </div>
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
        <Pagina className="bg-slate-50">
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

          <div className="mt-4 rounded-2xl bg-orange-50 p-5 ring-1 ring-orange-200">
            <h3 className="text-lg font-bold text-orange-900">Belangrijke nuance</h3>
            <p className="mt-2 text-[15px] text-slate-700">{ouder.nuance}</p>
          </div>

          {/* De onzichtbare laag — de eigen woorden van het kind */}
          <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-violet-200">
            <h3 className="text-lg font-bold" style={{ color: VIOLET }}>De onzichtbare laag: de eigen woorden</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
              We mochten even te gast zijn in de wereld van {naam}. Bij de figuren schreef {naam} in eigen
              woorden waaróm ze passen. Die woorden tonen soms een motief dat ónder het gekozen figuur ligt —
              bijvoorbeeld een helpend of sociaal motief onder een creatief figuur.
              {woordAnalyse.divergenties.length > 0 && (
                <>
                  {" "}Zo koos {naam} bijvoorbeeld <strong>{woordAnalyse.divergenties[0]!.figuurNaam}</strong>,
                  maar de woorden erbij wezen eerder richting “{woordAnalyse.divergenties[0]!.woordMotief.label}”.
                </>
              )}{" "}
              Vaak zit dát dichter bij de echte belevingswereld dan onze archetype-labels.
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-700">
              Een fijne uitnodiging: vraag net op die eigen woorden door — “Je zei bij die figuur ‘…’,
              vertel daar eens over?” — zonder te sturen. Het kind is de expert over zichzelf; wij zijn te gast.
            </p>
          </div>

          {/* Concreet aan de slag */}
          <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <h3 className="text-lg font-bold" style={{ color: DEEP_TEAL }}>Zo ga je samen aan de slag</h3>
            <ol className="mt-3 space-y-2 text-[15px] text-slate-700">
              <li className="flex gap-3">
                <span className="font-black" style={{ color: ORANGE }}>1.</span>
                <span>Lees het boekje <strong>samen</strong> door en laat {naam} zelf vertellen bij de figuren die hij/zij koos — luister meer dan je stuurt.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-black" style={{ color: ORANGE }}>2.</span>
                <span>Vraag door op de <strong>“verwonderlijke dingen”</strong>: “Wanneer voel jij je zo? Op school, thuis, bij vrienden?” Zonder oordeel.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-black" style={{ color: ORANGE }}>3.</span>
                <span>Benoem talenten <strong>procesgericht</strong>: prijs de inzet en de aanpak (“je bleef doorzoeken”), niet enkel het resultaat.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-black" style={{ color: ORANGE }}>4.</span>
                <span>Geef ruimte om te <strong>oefenen en te falen</strong> — talent groeit door proberen. Vier kleine stappen.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-black" style={{ color: ORANGE }}>5.</span>
                <span>Kom er <strong>later nog eens op terug</strong>. Kinderen veranderen; dit is een momentopname, geen etiket.</span>
              </li>
            </ol>
          </div>

          {/* Uitnodiging TaPas-coach */}
          <div className="mt-4 rounded-2xl bg-slate-900 p-5 text-slate-100 ring-1 ring-cyan-400/40">
            <h3 className="text-lg font-bold text-cyan-300">Samen verder met een TaPas-coach</h3>
            <p className="mt-2 text-[15px] leading-relaxed">
              Wil je dieper ingaan op wat je hier ontdekte? Een gesprek met een TaPas-coach kan verdiepend en
              ondersteunend werken — voor {naam} én voor jou als ouder. De coach helpt de signalen uit dit
              boekje vertalen naar concrete, warme stappen. Neem gerust contact op via je TaPas-begeleider.
            </p>
          </div>

          <p className="mt-5 text-center text-[16px] font-medium" style={{ color: DEEP_TEAL }}>
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
        <section className={`t4k-pagina mx-auto mb-8 flex w-full max-w-[820px] flex-col items-center justify-center rounded-3xl bg-gradient-to-br ${AFSLUITER_GRADIENT} p-12 text-center text-white shadow-2xl sm:p-16`}>
          <Tappie size={140} className="drop-shadow-[0_8px_14px_rgba(0,0,0,0.4)]" />
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
          <p className="mt-6 font-semibold">Tappie en het TaPas-team wensen je een talent-rijke reis. 🌟</p>
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
        html, body {
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .t4k-noprint { display: none !important; }
        .t4k-root { background: #ffffff !important; padding: 0 !important; }
        .t4k-root main { padding: 0 !important; }
        /* Elke logische pagina begint op een verse A4-pagina en mag intern
           netjes over twee A4's lopen (GEEN break-inside: avoid → geen bleed). */
        .t4k-pagina {
          box-shadow: none !important;
          ring: 0 !important;
          break-before: page;
          page-break-before: always;
          break-after: auto;
          page-break-after: auto;
          break-inside: auto;
          page-break-inside: auto;
          overflow: visible !important;
          height: auto !important;
          margin: 0 auto 0 auto !important;
          max-width: 100% !important;
          width: 100% !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        /* De cover mag geen lege pagina ervoor forceren. */
        .t4k-pagina:first-child {
          break-before: auto;
          page-break-before: avoid;
        }
        /* Atomische blokken nooit middenin splitsen. */
        .t4k-chart, figure {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .t4k-pagina .rounded-2xl, .t4k-pagina .rounded-xl {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        /* Koppen bij hun tekst houden. */
        h1, h2, h3 {
          break-after: avoid;
          page-break-after: avoid;
          break-inside: avoid;
        }
        a { color: #0f766e !important; text-decoration: underline; }
      }
    `}</style>
  );
}
