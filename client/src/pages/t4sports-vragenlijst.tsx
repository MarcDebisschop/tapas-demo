// client/src/pages/t4sports-vragenlijst.tsx
// T4Sports vragenlijst — sport-specifiek Mental Talent Profiel.
// Kleurstijl: donker navy (#0D1B3E) + goud (#C9A84C).

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClientBlock, BlockAnswer, EnergyOption } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ============================================================
// Constanten
// ============================================================
const NAVY = "#0D1B3E";
const GOUD = "#C9A84C";

type Stap = "welkom" | "baseline" | "vragenlijst" | "verbinding" | "voltooid";

type AnswerState = Record<string, BlockAnswer>;

function emptyAnswer(): BlockAnswer {
  return { most: null, least: null, itemEnergy: { most: null, least: null }, blockEnergy: null };
}

// ============================================================
// Energy Row component
// ============================================================
function EnergyRow({
  options,
  value,
  onChange,
}: {
  options: EnergyOption[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={active ? { background: GOUD, borderColor: GOUD, color: NAVY } : {}}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "font-bold"
                : "border-gray-300 text-gray-600 hover:border-yellow-500"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Scherm 1: Welkom
// ============================================================
function WelkomScherm({
  naam, setNaam,
  sporttak, setSporttak,
  ploeg, setPloeg,
  rol, setRol,
  niveau, setNiveau,
  sportType, setSportType,
  ambitie, setAmbitie,
  onVolgende,
}: {
  naam: string; setNaam: (v: string) => void;
  sporttak: string; setSporttak: (v: string) => void;
  ploeg: string; setPloeg: (v: string) => void;
  rol: string; setRol: (v: string) => void;
  niveau: string; setNiveau: (v: string) => void;
  sportType: string; setSportType: (v: string) => void;
  ambitie: string; setAmbitie: (v: string) => void;
  onVolgende: () => void;
}) {
  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div style={{ color: GOUD }} className="text-sm font-bold tracking-widest uppercase mb-6">
          T4Sports · Mental Talent Profiel
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-3">
          Ontdek je mentaal talent als atleet
        </h1>
        <p className="text-blue-200 text-sm leading-relaxed mb-8">
          Dit profiel brengt jouw drivers, talent-foci en versnellers in kaart — volledig in sporttaal.
          Het is de basis voor mental coaching op maat. Eerlijk, wetenschappelijk onderbouwd, en voor jou.
        </p>

        <div className="space-y-5">
          <div>
            <Label className="text-blue-200 text-xs uppercase tracking-wide">Naam *</Label>
            <Input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Jouw volledige naam"
              className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <Label className="text-blue-200 text-xs uppercase tracking-wide">Sporttak *</Label>
            <Input
              value={sporttak}
              onChange={(e) => setSporttak(e.target.value)}
              placeholder="Bijv. voetbal, zwemmen, atletiek..."
              className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <Label className="text-blue-200 text-xs uppercase tracking-wide">Club / Ploeg (optioneel)</Label>
            <Input
              value={ploeg}
              onChange={(e) => setPloeg(e.target.value)}
              placeholder="Bijv. KRC Gent, Beerschot..."
              className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <Label className="text-blue-200 text-xs uppercase tracking-wide">Positie / Rol (optioneel)</Label>
            <Input
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              placeholder="Bijv. middenvelder, sprinter, keeper..."
              className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <Label className="text-blue-200 text-xs uppercase tracking-wide">Niveau *</Label>
            <select
              value={niveau}
              onChange={(e) => setNiveau(e.target.value)}
              className="mt-1 w-full rounded-md bg-white/10 border border-white/20 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="" disabled className="text-gray-900">Selecteer je niveau…</option>
              <option value="elite" className="text-gray-900">Elite / Professioneel</option>
              <option value="topsport" className="text-gray-900">Topsport / Semi-professioneel</option>
              <option value="hoog_amateurs" className="text-gray-900">Hoog competitief amateur</option>
              <option value="recreatief_competitief" className="text-gray-900">Recreatief maar competitief</option>
              <option value="recreatief" className="text-gray-900">Puur recreatief</option>
            </select>
          </div>
          <div>
            <Label className="text-blue-200 text-xs uppercase tracking-wide">Type sport *</Label>
            <div className="mt-2 flex gap-3">
              {(["individueel", "ploeg"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSportType(opt)}
                  className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition-all"
                  style={sportType === opt
                    ? { background: GOUD, borderColor: GOUD, color: NAVY, fontWeight: 700 }
                    : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)" }}
                >
                  {opt === "individueel" ? "🏃 Individueel" : "🤝 Ploeg / Team"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-blue-200 text-xs uppercase tracking-wide">Mijn ambitie *</Label>
            <select
              value={ambitie}
              onChange={(e) => setAmbitie(e.target.value)}
              className="mt-1 w-full rounded-md bg-white/10 border border-white/20 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="" disabled className="text-gray-900">Wat wil je bereiken?</option>
              <option value="best_of_world" className="text-gray-900">Best of the world — absolute top</option>
              <option value="topper" className="text-gray-900">Topper in mijn discipline</option>
              <option value="subtopper" className="text-gray-900">Subtopper — sterk nationaal niveau</option>
              <option value="recreatief_limieten" className="text-gray-900">Recreatief maar mijn limieten opzoeken</option>
              <option value="plezier" className="text-gray-900">Plezier en gezondheid voorop</option>
            </select>
          </div>
        </div>

        <Button
          onClick={onVolgende}
          disabled={!naam.trim() || !sporttak.trim() || !niveau || !sportType || !ambitie}
          className="mt-8 w-full font-bold"
          style={{ background: GOUD, color: NAVY }}
        >
          Starten →
        </Button>

        <p className="text-white/30 text-xs mt-4 text-center">
          Jouw antwoorden zijn vertrouwelijk en worden enkel gebruikt voor jouw persoonlijk profiel.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Scherm 2: Baseline
// ============================================================
function BaselineScherm({
  baseline, setBaseline,
  onVolgende, onTerug,
}: {
  baseline: number;
  setBaseline: (v: number) => void;
  onVolgende: () => void;
  onTerug: () => void;
}) {
  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div style={{ color: GOUD }} className="text-sm font-bold tracking-widest uppercase mb-6">
          T4Sports · Stap 1 van 4
        </div>
        <h2 className="text-2xl font-extrabold text-white mb-4">
          Jouw mentale energie als atleet
        </h2>
        <p className="text-blue-200 text-sm leading-relaxed mb-8">
          Hoe schat je jouw mentale energie in als atleet op dit moment?
          <br /><span className="text-white/50">0 = volledig uitgeput — 10 = volledig in je kracht</span>
        </p>

        <div className="bg-white/5 rounded-2xl p-8 text-center mb-8">
          <div style={{ color: GOUD }} className="text-6xl font-extrabold mb-2">
            {baseline}
          </div>
          <div className="text-blue-200 text-sm mb-6">/ 10</div>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[baseline]}
            onValueChange={([v]) => setBaseline(v)}
            className="w-full"
          />
          <div className="flex justify-between text-white/30 text-xs mt-2">
            <span>Uitgeput</span>
            <span>In mijn kracht</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onTerug} className="border-white/20 text-white/70 hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={onVolgende}
            className="flex-1 font-bold"
            style={{ background: GOUD, color: NAVY }}
          >
            Volgende →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Scherm 3: Vragenlijst (forced-choice)
// ============================================================
function VragenlijstScherm({
  blocks,
  energyOptions,
  answers,
  setAnswers,
  onVolgende,
  onTerug,
}: {
  blocks: ClientBlock[];
  energyOptions: EnergyOption[];
  answers: AnswerState;
  setAnswers: React.Dispatch<React.SetStateAction<AnswerState>>;
  onVolgende: () => void;
  onTerug: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const block = blocks[idx];
  const stateKey = block ? `B${block.blockIndex}` : "";
  const cur = answers[stateKey] ?? emptyAnswer();
  const progress = blocks.length > 0 ? Math.round((idx / blocks.length) * 100) : 0;

  function updateCur(patch: Partial<BlockAnswer>) {
    setAnswers((prev) => ({
      ...prev,
      [stateKey]: { ...emptyAnswer(), ...prev[stateKey], ...patch },
    }));
  }

  function selectMost(pos: string) {
    const cur2 = answers[stateKey] ?? emptyAnswer();
    if (cur2.least === pos) return; // kan niet both zijn
    updateCur({ most: pos });
  }

  function selectLeast(pos: string) {
    const cur2 = answers[stateKey] ?? emptyAnswer();
    if (cur2.most === pos) return;
    updateCur({ least: pos });
  }

  const canNext = cur.most !== null && cur.least !== null;

  if (!block) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: NAVY }}>
        <div className="text-white text-center">
          <p className="text-xl font-bold">Vragenlijst voltooid!</p>
          <Button onClick={onVolgende} className="mt-4" style={{ background: GOUD, color: NAVY }}>
            Ga verder →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 bg-white/10 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${progress}%`, background: GOUD }}
            />
          </div>
          <span className="text-white/50 text-xs">{idx + 1}/{blocks.length}</span>
        </div>

        <div style={{ color: GOUD }} className="text-xs font-bold tracking-widest uppercase mb-3">
          Blok {idx + 1} · {block.family}
        </div>

        <h2 className="text-white text-lg font-bold mb-6">
          Welke uitspraak herken je het meest? En het minst?
        </h2>

        <div className="space-y-3 mb-8">
          {block.items.map((item) => {
            const isMost = cur.most === item.pos;
            const isLeast = cur.least === item.pos;
            return (
              <div
                key={item.pos}
                className="rounded-xl p-4 border transition-all"
                style={{
                  background: isMost ? `${GOUD}22` : isLeast ? "#ffffff11" : "#ffffff08",
                  borderColor: isMost ? GOUD : isLeast ? "#ffffff33" : "#ffffff11",
                }}
              >
                <p className="text-white text-sm leading-relaxed mb-3">{item.text}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => selectMost(item.pos)}
                    disabled={cur.least === item.pos}
                    className={`px-3 py-1 text-xs rounded-full font-bold transition-all border ${
                      isMost
                        ? "text-navy border-yellow-500"
                        : "border-white/20 text-white/50 hover:border-yellow-400"
                    }`}
                    style={isMost ? { background: GOUD, color: NAVY } : {}}
                  >
                    MEEST
                  </button>
                  <button
                    onClick={() => selectLeast(item.pos)}
                    disabled={cur.most === item.pos}
                    className={`px-3 py-1 text-xs rounded-full font-bold transition-all border ${
                      isLeast
                        ? "bg-white/20 border-white/60 text-white"
                        : "border-white/20 text-white/50 hover:border-white/40"
                    }`}
                  >
                    MINST
                  </button>
                </div>
                {/* Energie voor item (drivers only) */}
                {block.energyMode === "item" && isMost && (
                  <EnergyRow
                    options={energyOptions}
                    value={cur.itemEnergy.most}
                    onChange={(v) => updateCur({ itemEnergy: { ...cur.itemEnergy, most: v } })}
                  />
                )}
                {block.energyMode === "item" && isLeast && (
                  <EnergyRow
                    options={energyOptions}
                    value={cur.itemEnergy.least}
                    onChange={(v) => updateCur({ itemEnergy: { ...cur.itemEnergy, least: v } })}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Block energie voor non-driver blokken */}
        {block.energyMode === "block" && canNext && (
          <div className="bg-white/5 rounded-xl p-4 mb-6">
            <p className="text-blue-200 text-sm mb-3">Hoeveel energie geeft dit thema je als atleet?</p>
            <EnergyRow
              options={energyOptions}
              value={cur.blockEnergy}
              onChange={(v) => updateCur({ blockEnergy: v })}
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (idx > 0) setIdx(idx - 1);
              else onTerug();
            }}
            className="border-white/20 text-white/70 hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => {
              if (idx < blocks.length - 1) setIdx(idx + 1);
              else onVolgende();
            }}
            disabled={!canNext}
            className="flex-1 font-bold"
            style={canNext ? { background: GOUD, color: NAVY } : {}}
          >
            {idx < blocks.length - 1 ? "Volgende →" : "Klaar met vragenlijst →"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Scherm 4: Verbindingsvragen (4 sliders)
// ============================================================
const VERBINDING_VRAGEN = [
  {
    id: "q1",
    label: "Sportpassie",
    tekst: "In welke mate heb je het gevoel dat je vandaag in verbinding bent met je sport — niet uit verplichting maar vanuit echte passie?",
  },
  {
    id: "q2",
    label: "Billijkheid in sport",
    tekst: "In welke mate voel je je eerlijk behandeld door je trainer, je club en je omgeving in de sport?",
  },
  {
    id: "q3",
    label: "Mentale zelfinvestering",
    tekst: "In welke mate investeer je zelf in je mentale en emotionele ontwikkeling als atleet, buiten de fysieke training?",
  },
  {
    id: "q4",
    label: "Club-investering in de atleet",
    tekst: "In welke mate voel je dat je club/team ook investeert in jou als persoon, niet alleen in jou als prestatiemachine?",
  },
];

function VerbindingScherm({
  verbinding,
  setVerbinding,
  onVolgende,
  onTerug,
}: {
  verbinding: Record<string, number>;
  setVerbinding: (v: Record<string, number>) => void;
  onVolgende: () => void;
  onTerug: () => void;
}) {
  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div style={{ color: GOUD }} className="text-sm font-bold tracking-widest uppercase mb-6">
          T4Sports · Stap 3 van 4
        </div>
        <h2 className="text-2xl font-extrabold text-white mb-4">Sportverbondenheid</h2>
        <p className="text-blue-200 text-sm leading-relaxed mb-8">
          Vier korte vragen over jouw verbinding met je sport en omgeving. Schaal van 0 tot 10.
        </p>

        <div className="space-y-8">
          {VERBINDING_VRAGEN.map((vr) => (
            <div key={vr.id}>
              <p className="text-white text-sm leading-relaxed mb-3">{vr.tekst}</p>
              <div className="flex items-center gap-4">
                <span className="text-white/40 text-xs w-4">0</span>
                <div className="flex-1">
                  <Slider
                    min={0}
                    max={10}
                    step={1}
                    value={[verbinding[vr.id] ?? 5]}
                    onValueChange={([v]) => setVerbinding({ ...verbinding, [vr.id]: v })}
                  />
                </div>
                <span className="text-white/40 text-xs w-4">10</span>
                <span style={{ color: GOUD }} className="font-bold text-lg w-8 text-right">
                  {verbinding[vr.id] ?? 5}
                </span>
              </div>
              <div className="flex justify-between text-white/30 text-xs mt-1">
                <span>Helemaal niet</span>
                <span>Volledig</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-10">
          <Button variant="outline" onClick={onTerug} className="border-white/20 text-white/70 hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={onVolgende}
            className="flex-1 font-bold"
            style={{ background: GOUD, color: NAVY }}
          >
            Profiel genereren →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Scherm 5: Voltooiing
// ============================================================
function VoltooiingScherm({ naam }: { naam: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: NAVY }}>
      <div className="text-center px-6">
        <div style={{ color: GOUD }} className="text-5xl font-extrabold mb-4">✓</div>
        <h2 className="text-2xl font-bold text-white mb-3">Je profiel wordt gegenereerd...</h2>
        <p className="text-blue-200 text-sm">
          Bedankt, {naam.split(" ")[0] || "atleet"}! Je T4Sports Mental Talent Profiel is klaar.
          <br />Je kunt het bekijken via het dashboard-scherm.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Hoofd-component
// ============================================================
interface T4SportsInstrument {
  blocks: ClientBlock[];
  responseScales: { energy: { options: EnergyOption[] } };
  totalBlocks: number;
}

export default function T4SportsVragenlijst() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // State: gebruikersinfo
  const [naam, setNaam] = useState("");
  const [sporttak, setSporttak] = useState("");
  const [ploeg, setPloeg] = useState("");
  const [rol, setRol] = useState("");
  const [niveau, setNiveau] = useState("");
  const [sportType, setSportType] = useState("");
  const [ambitie, setAmbitie] = useState("");
  const [baseline, setBaseline] = useState(5);
  const [verbinding, setVerbinding] = useState<Record<string, number>>({
    q1: 5, q2: 5, q3: 5, q4: 5,
  });
  const [answers, setAnswers] = useState<AnswerState>({});
  const [stap, setStap] = useState<Stap>("welkom");
  const [afnameId, setAfnameId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Instrument ophalen
  const { data: inst } = useQuery<T4SportsInstrument>({
    queryKey: ["/api/t4sports/instrument"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/t4sports/instrument?taal=nl");
      return res.json();
    },
  });

  const blocks: ClientBlock[] = inst?.blocks ?? [];
  const energyOptions: EnergyOption[] = inst?.responseScales?.energy?.options ?? [];

  // Stap: welkom → afname aanmaken
  async function startAfname() {
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/t4sports/afnames", {
        name: naam.trim(),
        sporttak: sporttak.trim(),
        ploeg: ploeg.trim() || undefined,
        rol: rol.trim() || undefined,
        niveau: niveau || undefined,
        sportType: sportType || undefined,
        ambitie: ambitie || undefined,
        baselineEnergy: baseline,
        taal: "nl",
      });
      const data: any = await res.json();
      setAfnameId(data.id);
      setStap("baseline");
    } catch {
      toast({ title: "Fout", description: "Kon geen afname aanmaken. Probeer opnieuw.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // Voltooiing: stuur alles op
  async function voltooiAfname() {
    if (!afnameId) return;
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/t4sports/afnames/${afnameId}/voltooien`, {
        responses: answers,
        connection: {
          q1: verbinding.q1 ?? 5,
          q2: verbinding.q2 ?? 5,
          q3: verbinding.q3 ?? 5,
          q4: verbinding.q4 ?? 5,
        },
        baselineEnergy: baseline,
      });
      const data: any = await res.json();
      if (data.ok) {
        setStap("voltooid");
        // Navigeer naar dashboard na 2 sec
        setTimeout(() => {
          const respondentCode = data.afname?.respondentCode;
          if (respondentCode) {
            navigate(`/t4sports/dashboard/${respondentCode}`);
          }
        }, 2000);
      }
    } catch {
      toast({ title: "Fout", description: "Kon profiel niet genereren. Probeer opnieuw.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (stap === "welkom") {
    return (
      <WelkomScherm
        naam={naam} setNaam={setNaam}
        sporttak={sporttak} setSporttak={setSporttak}
        ploeg={ploeg} setPloeg={setPloeg}
        rol={rol} setRol={setRol}
        niveau={niveau} setNiveau={setNiveau}
        sportType={sportType} setSportType={setSportType}
        ambitie={ambitie} setAmbitie={setAmbitie}
        onVolgende={startAfname}
      />
    );
  }

  if (stap === "baseline") {
    return (
      <BaselineScherm
        baseline={baseline}
        setBaseline={setBaseline}
        onVolgende={() => setStap("vragenlijst")}
        onTerug={() => setStap("welkom")}
      />
    );
  }

  if (stap === "vragenlijst") {
    return (
      <VragenlijstScherm
        blocks={blocks}
        energyOptions={energyOptions}
        answers={answers}
        setAnswers={setAnswers}
        onVolgende={() => setStap("verbinding")}
        onTerug={() => setStap("baseline")}
      />
    );
  }

  if (stap === "verbinding") {
    return (
      <VerbindingScherm
        verbinding={verbinding}
        setVerbinding={setVerbinding}
        onVolgende={voltooiAfname}
        onTerug={() => setStap("vragenlijst")}
      />
    );
  }

  return <VoltooiingScherm naam={naam} />;
}
