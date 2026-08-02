/**
 * Driver-scan — afname (nieuw, apart bestand; Werkprotocol Regel 2).
 *
 * Rendert de 10 forced-choice driver-blokken uit /api/driverscan/blocks
 * (most/least + energie per gekozen item). Antwoorden worden gekeyd "B0".."B9"
 * naar de server gestuurd, die ze via buildMainScores scoort (ONGEWIJZIGD) en
 * het korte visuele PDF-rapport genereert. Scoring wordt hier NIET gedupliceerd.
 */
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Types (spiegelt server clientBlokken + scoring.BlockResponse) ───────────

interface EnergyOption { value: number; label: string; }
interface BlockItem { pos: string; construct: string; text: string; }
interface ClientBlock {
  blockIndex: number;
  stateKey: string;
  family: string;
  energyMode: "item" | "block";
  items: BlockItem[];
}
interface BlocksResponse {
  instrumentId: string;
  language: string;
  responseScales: { energy: { min: number; max: number; options: EnergyOption[] } };
  blocks: ClientBlock[];
  totalBlocks: number;
}
interface Answer {
  most: string | null;
  least: string | null;
  itemEnergy: { most: number | null; least: number | null };
  blockEnergy: number | null;
  toelichting?: string | null;
}
type AnswerState = Record<string, Answer>;

const TALEN = [
  { code: "nl", label: "🇧🇪 NL" },
  { code: "fr", label: "🇫🇷 FR" },
  { code: "en", label: "🇬🇧 EN" },
  { code: "es", label: "🇪🇸 ES" },
  { code: "ru", label: "🇷🇺 RU" },
];

// Minimale UI-microcopy per taal (afname-scherm; rapportteksten zitten server-side).
const T: Record<string, Record<string, string>> = {
  nl: { titel: "Driver-scan", intro: "Kies per blok wat het MÉÉST en het MÍNST bij je past, en geef de energie aan.", meest: "Past het meest", minst: "Past het minst", energieMeest: "Energie bij 'meest'", energieMinst: "Energie bij 'minst'", blok: "Blok", van: "van", vorige: "Vorige", volgende: "Volgende", afronden: "Rapport genereren", naam: "Naam (optioneel)", genereren: "Rapport wordt gegenereerd…", klaar: "Rapport gedownload", fout: "Er ging iets mis. Probeer opnieuw.", onvolledig: "Vul eerst 'meest', 'minst' en beide energiewaarden in.", toelichting: "Wat maakt dit energiekostend? (optioneel)" , nogTeDoen: "Kies eerst wat het meest en het minst past, en geef beide energiewaarden aan. Dan kun je verder." },
  fr: { titel: "Driver-scan", intro: "Par bloc, choisissez ce qui vous correspond LE PLUS et LE MOINS, puis indiquez l'énergie.", meest: "Correspond le plus", minst: "Correspond le moins", energieMeest: "Énergie pour « le plus »", energieMinst: "Énergie pour « le moins »", blok: "Bloc", van: "sur", vorige: "Précédent", volgende: "Suivant", afronden: "Générer le rapport", naam: "Nom (facultatif)", genereren: "Génération du rapport…", klaar: "Rapport téléchargé", fout: "Une erreur s'est produite. Réessayez.", onvolledig: "Complétez d'abord « le plus », « le moins » et les deux valeurs d'énergie.", toelichting: "Qu'est-ce qui rend cela épuisant ? (facultatif)" , nogTeDoen: "Choisissez d'abord ce qui correspond le plus et le moins, puis indiquez les deux valeurs d'énergie. Vous pourrez alors continuer." },
  en: { titel: "Driver-scan", intro: "For each block, pick what fits you MOST and LEAST, then set the energy.", meest: "Fits most", minst: "Fits least", energieMeest: "Energy for 'most'", energieMinst: "Energy for 'least'", blok: "Block", van: "of", vorige: "Previous", volgende: "Next", afronden: "Generate report", naam: "Name (optional)", genereren: "Generating report…", klaar: "Report downloaded", fout: "Something went wrong. Please try again.", onvolledig: "First fill in 'most', 'least' and both energy values.", toelichting: "What makes this energy-draining? (optional)" , nogTeDoen: "First pick what fits most and least, and set both energy values. Then you can continue." },
  es: { titel: "Driver-scan", intro: "En cada bloque, elige lo que MÁS y MENOS encaja contigo, y luego indica la energía.", meest: "Encaja más", minst: "Encaja menos", energieMeest: "Energía para «más»", energieMinst: "Energía para «menos»", blok: "Bloque", van: "de", vorige: "Anterior", volgende: "Siguiente", afronden: "Generar informe", naam: "Nombre (opcional)", genereren: "Generando informe…", klaar: "Informe descargado", fout: "Algo salió mal. Inténtalo de nuevo.", onvolledig: "Primero completa «más», «menos» y ambos valores de energía.", toelichting: "¿Qué hace que esto reste energía? (opcional)" , nogTeDoen: "Elige primero lo que más y lo que menos encaja, e indica ambos valores de energía. Después podrás continuar." },
  ru: { titel: "Driver-scan", intro: "В каждом блоке выберите, что подходит вам БОЛЬШЕ и МЕНЬШЕ всего, и укажите энергию.", meest: "Подходит больше всего", minst: "Подходит меньше всего", energieMeest: "Энергия для «больше»", energieMinst: "Энергия для «меньше»", blok: "Блок", van: "из", vorige: "Назад", volgende: "Далее", afronden: "Сформировать отчёт", naam: "Имя (необязательно)", genereren: "Формирование отчёта…", klaar: "Отчёт загружен", fout: "Что-то пошло не так. Попробуйте ещё раз.", onvolledig: "Сначала укажите «больше», «меньше» и оба значения энергии.", toelichting: "Что делает это энергозатратным? (необязательно)" , nogTeDoen: "Сначала выберите, что подходит больше и меньше всего, и укажите оба значения энергии. Затем можно продолжить." },
};

function leegAntwoord(): Answer {
  return { most: null, least: null, itemEnergy: { most: null, least: null }, blockEnergy: null, toelichting: null };
}

function EnergiePicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: EnergyOption[];
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
            value === o.value
              ? "bg-accent text-accent-foreground border-accent"
              : "bg-muted/40 text-muted-foreground border-border hover:border-accent/50"
          } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function DriverScanAfname() {
  const [taal, setTaal] = useState("nl");
  const [data, setData] = useState<BlocksResponse | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [idx, setIdx] = useState(0);
  const [naam, setNaam] = useState("");
  const [status, setStatus] = useState<"idle" | "bezig" | "klaar" | "fout">("idle");
  const [waarschuwing, setWaarschuwing] = useState<string | null>(null);

  const tt = (k: string) => T[taal]?.[k] ?? T.nl[k] ?? k;

  useEffect(() => {
    fetch(`/api/driverscan/blocks?taal=${taal}`)
      .then((r) => r.json())
      .then((d: BlocksResponse) => { setData(d); setIdx(0); })
      .catch(() => setStatus("fout"));
  }, [taal]);

  const blocks = data?.blocks ?? [];
  const energyOptions = data?.responseScales.energy.options ?? [];
  const block = blocks[idx];
  const cur = block ? answers[block.stateKey] ?? leegAntwoord() : leegAntwoord();
  // "Energiekostend" = de laagste/negatieve energie-optie. Bij die keuze tonen
  // we een optioneel toelichting-veld; het blokkeert de afronding nooit.
  const minEnergie = energyOptions.length ? Math.min(...energyOptions.map((o) => o.value)) : 0;
  const isEnergieKostend = (v: number | null | undefined) =>
    v !== null && v !== undefined && (v < 0 || v === minEnergie);
  const toonToelichting = isEnergieKostend(cur.itemEnergy.most) || isEnergieKostend(cur.itemEnergy.least);

  const update = (patch: Partial<Answer>) => {
    if (!block) return;
    setWaarschuwing(null);
    setAnswers((prev) => {
      const c = prev[block.stateKey] ?? leegAntwoord();
      return { ...prev, [block.stateKey]: { ...c, ...patch } };
    });
  };
  const kiesMeest = (pos: string) => {
    const least = cur.least === pos ? null : cur.least;
    update({ most: cur.most === pos ? null : pos, least });
  };
  const kiesMinst = (pos: string) => {
    const most = cur.most === pos ? null : cur.most;
    update({ least: cur.least === pos ? null : pos, most });
  };

  const blokCompleet = (a: Answer | undefined) =>
    !!a && !!a.most && !!a.least && a.itemEnergy.most !== null && a.itemEnergy.least !== null;

  const alleCompleet = useMemo(
    () => blocks.length > 0 && blocks.every((b) => blokCompleet(answers[b.stateKey])),
    [blocks, answers]
  );

  // Verplicht doorklikken: het huidige blok moet af voor er een volgend blok
  // komt. Terug gaan blijft altijd mogelijk, ook vanaf een onvolledig blok.
  const huidigCompleet = blokCompleet(cur);

  const isLaatste = idx === blocks.length - 1;

  async function afronden() {
    if (!alleCompleet) {
      const eerste = blocks.findIndex((b) => !blokCompleet(answers[b.stateKey]));
      if (eerste >= 0) setIdx(eerste);
      setWaarschuwing(tt("onvolledig"));
      return;
    }
    setStatus("bezig");
    try {
      const res = await fetch("/api/driverscan/rapport.pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taal, naam: naam.trim() || undefined, responses: answers }),
      });
      if (!res.ok) throw new Error("pdf");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `driver-scan-${taal}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("klaar");
    } catch {
      setStatus("fout");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Kop + taalkiezer */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-serif font-semibold text-foreground">{tt("titel")}</h1>
            <p className="text-sm text-muted-foreground max-w-lg mt-1">{tt("intro")}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {TALEN.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setTaal(l.code)}
                className={`px-2 py-1 rounded-full text-xs font-medium transition ${
                  taal === l.code ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent/20"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voortgang */}
        {block && (
          <div className="my-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{tt("blok")} {idx + 1} {tt("van")} {blocks.length}</span>
              <span>{Object.values(answers).filter(blokCompleet).length}/{blocks.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${((idx + 1) / blocks.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Blok */}
        {block && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-3">
            {block.items.map((it) => {
              const isMost = cur.most === it.pos;
              const isLeast = cur.least === it.pos;
              return (
                <div
                  key={it.pos}
                  className={`rounded-lg border p-3 transition ${
                    isMost ? "border-accent bg-accent/5" : isLeast ? "border-destructive/40 bg-destructive/5" : "border-border"
                  }`}
                >
                  <p className="text-sm text-foreground mb-2 leading-relaxed">{it.text}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => kiesMeest(it.pos)}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                        isMost ? "bg-accent text-accent-foreground border-accent" : "border-border text-muted-foreground hover:border-accent/50"
                      }`}
                    >
                      {tt("meest")}
                    </button>
                    <button
                      type="button"
                      onClick={() => kiesMinst(it.pos)}
                      className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                        isLeast ? "bg-destructive text-destructive-foreground border-destructive" : "border-border text-muted-foreground hover:border-destructive/50"
                      }`}
                    >
                      {tt("minst")}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Energie per gekozen item */}
            <div className="pt-2 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{tt("energieMeest")}</p>
                <EnergiePicker options={energyOptions} value={cur.itemEnergy.most} disabled={!cur.most} onChange={(v) => update({ itemEnergy: { ...cur.itemEnergy, most: v } })} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{tt("energieMinst")}</p>
                <EnergiePicker options={energyOptions} value={cur.itemEnergy.least} disabled={!cur.least} onChange={(v) => update({ itemEnergy: { ...cur.itemEnergy, least: v } })} />
              </div>
              {toonToelichting && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">{tt("toelichting")}</p>
                  <textarea
                    value={cur.toelichting ?? ""}
                    onChange={(e) => update({ toelichting: e.target.value || null })}
                    rows={2}
                    data-testid="input-toelichting"
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {waarschuwing && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 mt-4">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">{waarschuwing}</p>
          </div>
        )}

        {/* Verplicht doorklikken: tonen wat er nog te doen is, geen verwijt
            achteraf. De knop volgende blijft dicht zolang dit blok open staat. */}
        {!huidigCompleet && (
          <p className="mt-4 text-sm text-muted-foreground" data-testid="text-nog-te-doen">
            {tt("nogTeDoen")}
          </p>
        )}

        {/* Navigatie */}
        <div className="flex items-center gap-3 mt-6">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> {tt("vorige")}
          </Button>
          {!isLaatste ? (
            <Button
              onClick={() => setIdx((i) => Math.min(blocks.length - 1, i + 1))}
              disabled={!huidigCompleet}
              className="gap-1.5 ml-auto"
            >
              {tt("volgende")} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="ml-auto flex items-center gap-3">
              <Input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder={tt("naam")} className="w-44 h-9 text-sm" />
              <Button onClick={afronden} disabled={status === "bezig" || !alleCompleet} className="gap-1.5">
                {status === "bezig" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "klaar" ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {status === "bezig" ? tt("genereren") : status === "klaar" ? tt("klaar") : tt("afronden")}
              </Button>
            </div>
          )}
        </div>

        {status === "fout" && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 mt-4">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{tt("fout")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
