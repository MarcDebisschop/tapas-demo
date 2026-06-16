import { useRef, useState, useMemo, useEffect } from "react";
import { downloadNodeAlsPdf, PdfExportError } from "../lib/pdf-export";
import type { Session, Stakeholder, Answer } from "../lib/t4r-schema";
import {
  CONSTRUCTS,
  THRESHOLDS,
  VERVULLING_LABEL,
  ENERGIE_LABEL,
  EINDOORDEEL_LABEL,
  profielPerConstruct,
} from "../match";
import type { ConstructDef, ConstructResultaat, EnergieStatus, Classificatie } from "../match";
import {
  useCandidateReport,
  useExtractCandidate,
  useSaveCandidate,
  useMatch,
  useChat,
  usePostChat,
  useKoopExtra,
  type ExtractResult,
  type ExtractedMeting,
  type ExtractContext,
  type T4rChatBerichtUI,
  type T4rChatLimiet,
  type T4rChatCoach,
} from "../lib/session-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  UploadCloud,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Scale,
  Gauge,
  ClipboardCheck,
  HelpCircle,
  MessageCircle,
  Send,
  Loader2,
  Lock,
  CreditCard,
  HeartHandshake,
  Mail,
  ShieldCheck,
  Info,
} from "lucide-react";
import { STANDAARD_TAAL, maakVertaler, type Taal } from "@shared/i18n";

const FOOTER = "Ontwikkeld in opdracht van Marc Debisschop, met AI als belangrijke partner in de realisatie.";

// Welke constructen zijn relevant voor deze sessie (er is een classificatie voor)?
function gevraagdeConstructen(answers: Answer[]): Map<string, { classificatie: Classificatie; kritisch: boolean }> {
  const map = new Map<string, { classificatie: Classificatie; kritisch: boolean }>();
  for (const p of profielPerConstruct(answers)) {
    map.set(p.construct.key, { classificatie: p.classificatie, kritisch: p.kritisch });
  }
  return map;
}

type Fase = "upload" | "verificatie" | "studie";

// Werkstaat tijdens verificatie: per construct een (bewerkbare) net + energie.
interface VerifiedMeting {
  net: string; // tekstveld, gevalideerd bij opslaan
  energie: EnergieStatus | "";
  confident: boolean;
}

export function MatchModule({
  session,
  answers,
  taal = STANDAARD_TAAL,
}: {
  session: Session;
  stakeholders: Stakeholder[];
  answers: Answer[];
  taal?: Taal;
}) {
  const t = maakVertaler(taal);
  const { toast } = useToast();
  const sessionId = session.id;
  const { data: bestaand, isLoading: laadtRapport } = useCandidateReport(sessionId);
  const extract = useExtractCandidate(sessionId);
  const save = useSaveCandidate(sessionId);

  // Welke fase tonen we? Als er al een geverifieerd rapport is → meteen de studie.
  const [fase, setFase] = useState<Fase | null>(null);
  const effectieveFase: Fase = fase ?? (bestaand?.verified ? "studie" : "upload");

  const matchActief = effectieveFase === "studie";
  const { data: match, isLoading: laadtMatch, error: matchError } = useMatch(sessionId, matchActief);

  // Verificatie-werkstaat
  const [label, setLabel] = useState("");
  const [bestandsnaam, setBestandsnaam] = useState<string | null>(null);
  const [werk, setWerk] = useState<Record<string, VerifiedMeting>>({});
  const [ctx, setCtx] = useState<ExtractContext>({});

  const gevraagd = useMemo(() => gevraagdeConstructen(answers), [answers]);

  // Alleen constructen die de rol beoordeelt verschijnen in de verificatie —
  // het zijn de enige die de match nodig heeft. (Item-blinded labels.)
  const teVerifierenConstructen = useMemo(
    () => CONSTRUCTS.filter((c) => gevraagd.has(c.key)),
    [gevraagd]
  );

  function handleFile(file: File) {
    setLabel((l) => l || file.name.replace(/\.pdf$/i, ""));
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      extract.mutate(
        { fileName: file.name, pdfBase64: base64 },
        {
          onSuccess: (res: ExtractResult) => {
            setBestandsnaam(res.fileName);
            // Vul de werkstaat met geëxtraheerde waarden voor élk gevraagd construct.
            const next: Record<string, VerifiedMeting> = {};
            for (const c of teVerifierenConstructen) {
              const m: ExtractedMeting | undefined = res.metingen[c.key];
              next[c.key] = {
                net: m?.net != null ? String(m.net) : "",
                energie: (m?.energie as EnergieStatus) ?? "",
                confident: m?.confident ?? false,
              };
            }
            setWerk(next);
            setCtx(res.context ?? {});
            setFase("verificatie");
          },
          onError: (e: any) => {
            toast({
              title: "Extractie mislukt",
              description:
                e?.message?.includes("422") || /PDF/i.test(String(e?.message))
                  ? "Kon de PDF niet lezen. Controleer of het een tekst-PDF is (geen scan)."
                  : "Er ging iets mis bij het inlezen van het bestand.",
              variant: "destructive",
            });
          },
        }
      );
    };
    reader.readAsDataURL(file);
  }

  function bevestigEnBereken() {
    // Validatie: élk gevraagd construct moet een geldige net + energie hebben.
    const metingen: Record<string, { net: number; energie: EnergieStatus }> = {};
    const ontbreekt: string[] = [];
    for (const c of teVerifierenConstructen) {
      const w = werk[c.key];
      const n = w ? Number(String(w.net).replace(",", ".")) : NaN;
      if (!w || w.net === "" || !Number.isFinite(n) || !w.energie) {
        ontbreekt.push(c.label);
        continue;
      }
      metingen[c.key] = { net: n, energie: w.energie };
    }
    if (ontbreekt.length) {
      toast({
        title: t("t4r_comp_verif_verplicht"),
        description: `${t("t4r_comp_verif_intro_onzeker").replace(/\.$/, "")} ${ontbreekt.slice(0, 3).join(", ")}${
          ontbreekt.length > 3 ? "…" : ""
        }.`,
        variant: "destructive",
      });
      return;
    }
    if (!label.trim()) {
      toast({ title: t("t4r_comp_verif_kandidaatlabel"), description: t("t4r_comp_verif_label_placeholder"), variant: "destructive" });
      return;
    }
    save.mutate(
      {
        candidateLabel: label.trim(),
        sourceFile: bestandsnaam,
        metingen,
        context: {
          energieDiscrepantie: ctx.energieDiscrepantie ?? null,
          herstelTraag: ctx.herstelTraag ?? null,
          perfectionistischeBelasting: ctx.perfectionistischeBelasting ?? null,
          scheveWederkerigheid: ctx.scheveWederkerigheid ?? null,
        },
        verified: true,
      },
      {
        onSuccess: () => {
          toast({ title: t("t4r_comp_verif_bevestig"), description: t("t4r_comp_verif_berekenen") });
          setFase("studie");
        },
        onError: () => toast({ title: t("t4r_comp_studie_fout"), description: t("t4r_comp_studie_opnieuw"), variant: "destructive" }),
      }
    );
  }

  function opnieuw() {
    setFase("upload");
    setWerk({});
    setCtx({});
    setLabel("");
    setBestandsnaam(null);
  }

  // -------------------------------------------------------------------------
  // Geen alignment-ring gesloten? Dan is er nog geen norm om tegen te toetsen.
  // (Deze guard staat ook in de sessie-navigatie, maar dubbel is veilig.)
  // -------------------------------------------------------------------------
  if (gevraagd.size === 0) {
    return (
      <div className="space-y-6">
        <Kop taal={taal} />
        <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/5 p-5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[hsl(var(--chart-4))]" />
          <p className="text-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_match_geen_profiel")}
          </p>
        </div>
      </div>
    );
  }

  if (laadtRapport) {
    return (
      <div className="space-y-6">
        <Kop taal={taal} />
        <div className="rounded-xl border border-card-border bg-card p-8 text-center text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_match_laden")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Kop taal={taal} />

      {/* Procesindicator */}
      <ol className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }} data-no-print>
        <ProcStap n={1} label={t("t4r_comp_stap_upload")} actief={effectieveFase === "upload"} klaar={effectieveFase !== "upload"} icon={UploadCloud} />
        <span className="text-border">—</span>
        <ProcStap n={2} label={t("t4r_comp_stap_verificatie")} actief={effectieveFase === "verificatie"} klaar={effectieveFase === "studie"} icon={ClipboardCheck} />
        <span className="text-border">—</span>
        <ProcStap n={3} label={t("t4r_comp_stap_studie")} actief={effectieveFase === "studie"} klaar={false} icon={Scale} />
      </ol>

      {effectieveFase === "upload" && (
        <UploadFase onFile={handleFile} bezig={extract.isPending} taal={taal} />
      )}

      {effectieveFase === "verificatie" && (
        <VerificatieFase
          constructen={teVerifierenConstructen}
          gevraagd={gevraagd}
          werk={werk}
          setWerk={setWerk}
          ctx={ctx}
          setCtx={setCtx}
          label={label}
          setLabel={setLabel}
          bestandsnaam={bestandsnaam}
          onBevestig={bevestigEnBereken}
          onOpnieuw={opnieuw}
          bezig={save.isPending}
          taal={taal}
        />
      )}

      {effectieveFase === "studie" && (
        <StudieFase
          session={session}
          match={match}
          laadt={laadtMatch}
          fout={matchError}
          gevraagd={gevraagd}
          sessionId={sessionId}
          onOpnieuw={opnieuw}
          taal={taal}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kop
// ---------------------------------------------------------------------------
function Kop({ taal = STANDAARD_TAAL }: { taal?: Taal }) {
  const t = maakVertaler(taal);
  return (
    <div data-no-print>
      <div className="mb-1 flex items-center gap-2 text-primary" style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <Scale size={13} /> {t("t4r_comp_match_kop_label")}
      </div>
      <h1 className="font-serif text-foreground" style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>
        {t("t4r_comp_match_kop_titel")}
      </h1>
      <p className="mt-1.5 max-w-2xl text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
        {t("t4r_comp_match_kop_intro")}
      </p>
    </div>
  );
}

function ProcStap({ n, label, actief, klaar, icon: Icon }: { n: number; label: string; actief: boolean; klaar: boolean; icon: typeof Scale }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-medium ${
          actief ? "border-primary bg-primary text-primary-foreground" : klaar ? "border-primary text-primary" : "border-border text-muted-foreground"
        }`}
      >
        {klaar ? <CheckCircle2 size={12} /> : n}
      </span>
      <span className={actief ? "font-medium text-foreground" : ""}>{label}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Fase 1 — Upload
// ---------------------------------------------------------------------------
function UploadFase({ onFile, bezig, taal = STANDAARD_TAAL }: { onFile: (f: File) => void; bezig: boolean; taal?: Taal }) {
  const t = maakVertaler(taal);
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          over ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud size={22} />
        </span>
        <p className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>
          {t("t4r_comp_upload_titel")}
        </p>
        <p className="mt-1 max-w-md text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_upload_intro")}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          data-testid="input-candidate-pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <Button className="mt-5" data-testid="button-choose-pdf" disabled={bezig} onClick={() => inputRef.current?.click()}>
          {bezig ? t("t4r_comp_upload_bezig") : t("t4r_comp_upload_kies_pdf")}
        </Button>
        <p className="mt-3 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
          {t("t4r_comp_upload_sleep")}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <HelpCircle size={15} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_upload_hulp")}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fase 2 — Verificatie / correctie
// ---------------------------------------------------------------------------
function VerificatieFase({
  constructen,
  gevraagd,
  werk,
  setWerk,
  ctx,
  setCtx,
  label,
  setLabel,
  bestandsnaam,
  onBevestig,
  onOpnieuw,
  bezig,
  taal = STANDAARD_TAAL,
}: {
  constructen: ConstructDef[];
  gevraagd: Map<string, { classificatie: Classificatie; kritisch: boolean }>;
  werk: Record<string, VerifiedMeting>;
  setWerk: React.Dispatch<React.SetStateAction<Record<string, VerifiedMeting>>>;
  ctx: ExtractContext;
  setCtx: React.Dispatch<React.SetStateAction<ExtractContext>>;
  label: string;
  setLabel: (v: string) => void;
  bestandsnaam: string | null;
  onBevestig: () => void;
  onOpnieuw: () => void;
  bezig: boolean;
  taal?: Taal;
}) {
  const t = maakVertaler(taal);
  const onzeker = constructen.filter((c) => !werk[c.key]?.confident || werk[c.key]?.net === "").length;

  function set(key: string, patch: Partial<VerifiedMeting>) {
    setWerk((w) => ({ ...w, [key]: { ...w[key], ...patch } }));
  }

  // groepeer per as voor leesbaarheid
  const assen: { key: ConstructDef["as"]; titel: string }[] = [
    { key: "drivers", titel: t("t4r_comp_verif_werkstijlen") },
    { key: "foci", titel: t("t4r_comp_verif_werkgedrag") },
    { key: "versnellers", titel: t("t4r_comp_verif_versterkend") },
    { key: "zelfbeeld", titel: t("t4r_comp_verif_zelfbeeld") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/5 p-4">
        <ClipboardCheck size={18} className="mt-0.5 shrink-0 text-[hsl(var(--chart-4))]" />
        <div>
          <p className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_verif_verplicht")}
          </p>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {onzeker > 0 ? t("t4r_comp_verif_intro_onzeker") : t("t4r_comp_verif_intro_ok")}
          </p>
        </div>
      </div>

      {/* Kandidaatlabel + bron */}
      <div className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cand-label" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_verif_kandidaatlabel")}</Label>
            <Input
              id="cand-label"
              data-testid="input-candidate-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("t4r_comp_verif_label_placeholder")}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_verif_bronbestand")}</Label>
            <div className="mt-1.5 flex h-10 items-center rounded-md border border-border bg-background px-3 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
              {bestandsnaam ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Per-construct verificatie, gegroepeerd per as */}
      {assen.map((as) => {
        const lijst = constructen.filter((c) => c.as === as.key);
        if (!lijst.length) return null;
        return (
          <section key={as.key} className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
            <h3 className="mb-3 font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{as.titel}</h3>
            <div className="space-y-2.5">
              {lijst.map((c) => {
                const w = werk[c.key] ?? { net: "", energie: "", confident: false };
                const g = gevraagd.get(c.key);
                const onzekerVlag = !w.confident || w.net === "";
                return (
                  <div
                    key={c.key}
                    className={`grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center ${
                      onzekerVlag ? "border-[hsl(var(--chart-4))]/40 bg-[hsl(var(--chart-4))]/5" : "border-border bg-background/50"
                    }`}
                    data-testid={`verify-row-${c.key}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)" }}>{c.label}</span>
                        {g && <ClassifPill classificatie={g.classificatie} kritisch={g.kritisch} taal={taal} />}
                        {onzekerVlag && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--chart-4))]/40 bg-[hsl(var(--chart-4))]/10 px-1.5 py-0.5 text-[hsl(var(--chart-4))]" style={{ fontSize: "11px" }}>
                            <AlertTriangle size={10} /> {t("t4r_comp_verif_onzeker_badge")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{c.beschrijving}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_comp_verif_nettoscore")}</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={w.net}
                        data-testid={`input-net-${c.key}`}
                        onChange={(e) => set(c.key, { net: e.target.value, confident: true })}
                        className="h-9 w-20 text-center"
                        placeholder="−6…+6"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_comp_verif_energie")}</Label>
                      <Select value={w.energie || undefined} onValueChange={(v) => set(c.key, { energie: v as EnergieStatus, confident: true })}>
                        <SelectTrigger className="h-9 w-40" data-testid={`select-energie-${c.key}`}>
                          <SelectValue placeholder={t("t4r_comp_verif_kies")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="geeft">{ENERGIE_LABEL.geeft}</SelectItem>
                          <SelectItem value="neutraal">{ENERGIE_LABEL.neutraal}</SelectItem>
                          <SelectItem value="kost">{ENERGIE_LABEL.kost}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Contextsignalen */}
      <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
        <h3 className="mb-1 font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{t("t4r_comp_verif_ctx_titel")}</h3>
        <p className="mb-3 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_verif_ctx_intro")}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="discrep" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_verif_discrep_label")}</Label>
            <Input
              id="discrep"
              type="text"
              inputMode="decimal"
              data-testid="input-discrepantie"
              value={ctx.energieDiscrepantie != null ? String(ctx.energieDiscrepantie) : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                const n = raw === "" ? null : Number(raw);
                setCtx((c) => ({ ...c, energieDiscrepantie: raw === "" ? null : Number.isFinite(n!) ? n : c.energieDiscrepantie }));
              }}
              placeholder="bv. −3,5"
              className="mt-1.5"
            />
            <p className="mt-1 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_comp_verif_discrep_hint")}</p>
          </div>
          <div className="space-y-2.5 sm:pt-6">
            <CtxVink label={t("t4r_comp_verif_herstel")} checked={!!ctx.herstelTraag} onChange={(v) => setCtx((c) => ({ ...c, herstelTraag: v }))} testid="check-herstel" />
            <CtxVink label={t("t4r_comp_verif_perfectie")} checked={!!ctx.perfectionistischeBelasting} onChange={(v) => setCtx((c) => ({ ...c, perfectionistischeBelasting: v }))} testid="check-perfectie" />
            <CtxVink label={t("t4r_comp_verif_wederkerigheid")} checked={!!ctx.scheveWederkerigheid} onChange={(v) => setCtx((c) => ({ ...c, scheveWederkerigheid: v }))} testid="check-wederkerigheid" />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button variant="outline" data-testid="button-restart-upload" onClick={onOpnieuw}>
          <RotateCcw size={15} className="mr-1.5" /> {t("t4r_comp_verif_ander_bestand")}
        </Button>
        <Button data-testid="button-confirm-compute" disabled={bezig} onClick={onBevestig}>
          {bezig ? t("t4r_comp_verif_berekenen") : t("t4r_comp_verif_bevestig")} <ArrowRight size={15} className="ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function CtxVink({ label, checked, onChange, testid }: { label: string; checked: boolean; onChange: (v: boolean) => void; testid: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} data-testid={testid} className="mt-0.5" />
      <span className="text-foreground" style={{ fontSize: "var(--text-sm)" }}>{label}</span>
    </label>
  );
}

function ClassifPill({ classificatie, kritisch, taal = STANDAARD_TAAL }: { classificatie: Classificatie; kritisch: boolean; taal?: Taal }) {
  const t = maakVertaler(taal);
  const map: Record<Classificatie, { label: string; cls: string }> = {
    need: { label: "Need", cls: "border-primary/30 bg-primary/10 text-primary" },
    nice: { label: "Nice", cls: "border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]" },
    "not-needed": { label: "Not needed", cls: "border-border bg-muted text-muted-foreground" },
  };
  const m = map[classificatie];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${m.cls}`} style={{ fontSize: "11px" }}>
      {kritisch && classificatie === "need" ? t("t4r_comp_kritische_need") : m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Fase 3 — Vergelijkende studie + corporate PDF
// ---------------------------------------------------------------------------
function StudieFase({
  session,
  match,
  laadt,
  fout,
  gevraagd,
  sessionId,
  onOpnieuw,
  taal = STANDAARD_TAAL,
}: {
  session: Session;
  match: ReturnType<typeof useMatch>["data"];
  laadt: boolean;
  fout: unknown;
  gevraagd: Map<string, { classificatie: Classificatie; kritisch: boolean }>;
  sessionId: number;
  onOpnieuw: () => void;
  taal?: Taal;
}) {
  const t = maakVertaler(taal);
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [bezigPdf, setBezigPdf] = useState(false);

  const handleDownload = async () => {
    if (bezigPdf) return;
    const label = match?.candidate.label ?? "kandidaat";
    setBezigPdf(true);
    try {
      const resultaat = await downloadNodeAlsPdf(printRef.current, `Vergelijkende studie - ${label}`);
      if (resultaat === "nieuw-tabblad") {
        toast({
          title: t("t4r_comp_studie_download_pdf"),
          description: "De studie is geopend in een nieuw tabblad (en gedownload indien uw browser dat toestaat). Vindt u geen nieuw tabblad? Sta dan pop-ups voor deze pagina toe, of open de app in een eigen tabblad.",
        });
      } else {
        toast({ title: t("t4r_comp_studie_download_pdf"), description: t("t4r_comp_studie_laden") });
      }
    } catch (e: any) {
      const reden =
        e instanceof PdfExportError
          ? e.message
          : "De PDF kon niet worden aangemaakt. Vernieuw de pagina en probeer het opnieuw.";
      toast({ variant: "destructive", title: t("t4r_comp_studie_fout"), description: reden });
      // eslint-disable-next-line no-console
      console.error("PDF-export fout:", e);
    } finally {
      setBezigPdf(false);
    }
  };

  if (laadt) {
    return (
      <div className="rounded-xl border border-card-border bg-card p-8 text-center text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
        {t("t4r_comp_studie_laden")}
      </div>
    );
  }
  if (fout || !match) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-destructive" />
        <div>
          <p className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_studie_fout")}</p>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_studie_fout_detail")}
          </p>
          <Button variant="outline" className="mt-3" data-testid="button-restart-from-error" onClick={onOpnieuw}>
            <RotateCcw size={15} className="mr-1.5" /> {t("t4r_comp_studie_opnieuw")}
          </Button>
        </div>
      </div>
    );
  }

  const u = match.uitkomst;
  const needs = u.constructen.filter((c) => c.classificatie === "need");
  const overige = u.constructen.filter((c) => c.classificatie !== "need");

  return (
    <div className="space-y-5">
      {/* Actiebalk (niet meegeprint) */}
      <div className="flex items-center justify-between gap-3" data-no-print>
        <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_studie_voor")} <span className="font-medium text-foreground">{match.candidate.label}</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-restart-study" onClick={onOpnieuw}>
            <RotateCcw size={15} className="mr-1.5" /> {t("t4r_comp_studie_ander_rapport")}
          </Button>
          <Button data-testid="button-download-study" onClick={handleDownload} disabled={bezigPdf}>
            <FileDown size={15} className="mr-1.5" /> {bezigPdf ? t("t4r_comp_studie_pdf_bezig") : t("t4r_comp_studie_download_pdf")}
          </Button>
        </div>
      </div>

      {/* Het afdrukbare corporate rapport */}
      <div ref={printRef} className="space-y-6">
        {/* Rapportkop */}
        <div className="rounded-xl border border-card-border bg-card p-6 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
          <div className="mb-1 text-primary" style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {t("t4r_comp_studie_rapport_kop")}
          </div>
          <h2 className="font-serif text-foreground" style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>
            {session.functionTitle}
          </h2>
          <div className="mt-2 grid gap-2 text-muted-foreground sm:grid-cols-2" style={{ fontSize: "var(--text-sm)" }}>
            <span>{t("t4r_comp_studie_org_context")} <span className="text-foreground">{session.orgLabel}</span></span>
            <span>{t("t4r_comp_studie_type_niveau")} <span className="text-foreground capitalize">{session.roleType} / {session.roleLevel}</span></span>
            <span>{t("t4r_comp_studie_kandidaat")} <span className="text-foreground">{match.candidate.label}</span></span>
            <span>{t("t4r_comp_studie_beoordeeld")} <span className="text-foreground">{u.constructen.length}</span></span>
          </div>
        </div>

        {/* Eindoordeel */}
        <EindoordeelKaart u={u} taal={taal} />

        {/* Leeswijzer drempels (de enige numerieke afspraak) */}
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Gauge size={14} /></span>
            <h3 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{t("t4r_comp_leeswijzer_titel")}</h3>
          </div>
          <p className="mb-3 max-w-3xl text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_leeswijzer_intro")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <DrempelKaart titel={VERVULLING_LABEL.sterk} bereik={`net ≥ +${THRESHOLDS.sterk}`} cls="border-[hsl(var(--chart-3))]/30 bg-[hsl(var(--chart-3))]/5 text-[hsl(var(--chart-3))]" />
            <DrempelKaart titel={VERVULLING_LABEL.aanwezig} bereik={`net ${THRESHOLDS.aanwezig}…+${THRESHOLDS.sterk - 1}`} cls="border-primary/30 bg-primary/5 text-primary" />
            <DrempelKaart titel={VERVULLING_LABEL.zwak} bereik={`net ${THRESHOLDS.afwezig + 1}…−1`} cls="border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/5 text-[hsl(var(--chart-4))]" />
            <DrempelKaart titel={VERVULLING_LABEL.afwezig} bereik={`net ≤ ${THRESHOLDS.afwezig}`} cls="border-destructive/30 bg-destructive/5 text-destructive" />
          </div>
        </section>

        {/* Need-lijnen: de dragende confrontatie */}
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary" style={{ fontSize: "var(--text-xs)" }}>1</span>
            <h3 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{t("t4r_comp_need_lijnen_titel")}</h3>
          </div>
          <p className="mb-3 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_need_lijnen_intro")}
          </p>
          {needs.length ? <ConfrontatieTabel rijen={needs} taal={taal} /> : <Leeg taal={taal} />}
        </section>

        {/* Risicovlaggen */}
        <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary" style={{ fontSize: "var(--text-xs)" }}>2</span>
            <h3 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{t("t4r_comp_risico_titel")}</h3>
          </div>
          {u.energiewaakpunten > 0 && (
            <p className="mb-2 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
              {u.energiewaakpunten} {t("t4r_comp_risico_energie")}
            </p>
          )}
          {u.risicovlaggen.length ? (
            <div className="space-y-2">
              {u.risicovlaggen.map((v) => (
                <div key={v.key} className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0 text-destructive" />
                  <div>
                    <span className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{v.label}</span>
                    <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{v.toelichting}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
              <CheckCircle2 size={15} className="text-[hsl(var(--chart-3))]" /> {t("t4r_comp_risico_geen")}
            </p>
          )}
        </section>

        {/* Overige lijnen (nice / not needed) */}
        {overige.length > 0 && (
          <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary" style={{ fontSize: "var(--text-xs)" }}>3</span>
              <h3 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{t("t4r_comp_overige_titel")}</h3>
            </div>
            <p className="mb-3 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
              {t("t4r_comp_overige_intro")}
            </p>
            <ConfrontatieTabel rijen={overige} taal={taal} />
          </section>
        )}

        {/* Footer-attributie */}
        <div className="flex flex-col items-center gap-1 pt-2 text-center text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-primary" />
            {FOOTER}
          </span>
          <span>TAPAS 4 Recruitment · vergelijkende studie · richtinggevend, het besluit blijft bij de stakeholders</span>
        </div>
      </div>

      {/* Studie-assistent (chatbot) — alleen recruiter/coach, NOOIT meegeprint */}
      <div data-no-print>
        <StudieChat sessionId={sessionId} taal={taal} />
      </div>
    </div>
  );
}

function DrempelKaart({ titel, bereik, cls }: { titel: string; bereik: string; cls: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="font-semibold" style={{ fontSize: "var(--text-sm)" }}>{titel}</div>
      <div className="font-mono text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{bereik}</div>
    </div>
  );
}

function Leeg({ taal = STANDAARD_TAAL }: { taal?: Taal }) {
  const t = maakVertaler(taal);
  return <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_geen_lijnen")}</p>;
}

// Eindoordeel-kaart met kleur per uitkomst en verplichte-motivatie-melding.
function EindoordeelKaart({ u, taal = STANDAARD_TAAL }: { u: NonNullable<ReturnType<typeof useMatch>["data"]>["uitkomst"]; taal?: Taal }) {
  const t = maakVertaler(taal);
  const conf: Record<string, { cls: string; icon: typeof CheckCircle2 }> = {
    match: { cls: "border-[hsl(var(--chart-3))]/40 bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))]", icon: CheckCircle2 },
    aandacht: { cls: "border-[hsl(var(--chart-4))]/40 bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]", icon: AlertTriangle },
    mismatch: { cls: "border-destructive/40 bg-destructive/10 text-destructive", icon: ShieldAlert },
  };
  const c = conf[u.eindoordeel];
  const Icon = c.icon;
  return (
    <section className={`rounded-xl border-2 p-5 ${c.cls}`}>
      <div>
        <div className="flex items-start gap-3">
          <Icon size={24} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold uppercase tracking-wide" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_comp_eindoordeel")}</div>
            <div className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-lg)" }}>{EINDOORDEEL_LABEL[u.eindoordeel]}</div>
            <p className="mt-1.5 max-w-3xl text-foreground" style={{ fontSize: "var(--text-sm)" }}>{u.motivatie}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
              <span>Needs: <span className="font-medium text-foreground">{u.needTotaal}</span></span>
              <span>Match: <span className="font-medium text-foreground">{u.needMatch}</span></span>
              <span>Aandacht: <span className="font-medium text-foreground">{u.needAandacht}</span></span>
              <span>Mismatch: <span className="font-medium text-foreground">{u.needMismatch}</span></span>
              <span>{t("t4r_comp_kritische_need")}: <span className="font-medium text-foreground">{u.kritischTotaal}</span></span>
              <span>{t("t4r_comp_risico_titel")}: <span className="font-medium text-foreground">{u.risicovlaggen.length}</span></span>
            </div>
            {u.motivatieVerplicht && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[hsl(var(--chart-4))]" />
                {t("t4r_comp_motivatie_verplicht")}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// 3-koloms confrontatietabel: gevraagd × gemeten × oordeel.
function ConfrontatieTabel({ rijen, taal = STANDAARD_TAAL }: { rijen: ConstructResultaat[]; taal?: Taal }) {
  const t = maakVertaler(taal);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table style={{ fontSize: "var(--text-sm)" }}>
        <thead>
          <tr className="border-b border-border bg-background/60 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_comp_tabel_gevraagd")}</th>
            <th className="px-3 py-2 font-medium" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_comp_tabel_gemeten")}</th>
            <th className="px-3 py-2 font-medium" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_comp_tabel_oordeel")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rijen.map((r) => (
            <tr key={r.construct.key} className="align-top" data-testid={`study-row-${r.construct.key}`}>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{r.construct.label}</span>
                  <ClassifPill classificatie={r.classificatie} kritisch={r.kritisch} taal={taal} />
                </div>
                <p className="mt-0.5 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{r.construct.beschrijving}</p>
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">{VERVULLING_LABEL[r.niveau]}</span>
                  <span className="font-mono text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>({r.net >= 0 ? "+" : ""}{r.net})</span>
                </div>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${energieCls(r.energie)}`} style={{ fontSize: "11px" }}>
                  {ENERGIE_LABEL[r.energie]}
                </span>
              </td>
              <td className="px-3 py-3">
                <OordeelPill oordeel={r.oordeel} />
                <p className="mt-1 max-w-md text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{r.toelichting}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function energieCls(e: EnergieStatus): string {
  if (e === "geeft") return "border-[hsl(var(--chart-3))]/30 bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))]";
  if (e === "kost") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

function OordeelPill({ oordeel }: { oordeel: ConstructResultaat["oordeel"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    match: { label: "Match", cls: "border-[hsl(var(--chart-3))]/40 bg-[hsl(var(--chart-3))]/10 text-[hsl(var(--chart-3))]" },
    aandacht: { label: "Aandacht", cls: "border-[hsl(var(--chart-4))]/40 bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]" },
    mismatch: { label: "Mismatch", cls: "border-destructive/40 bg-destructive/10 text-destructive" },
    plus: { label: "Meerwaarde", cls: "border-primary/40 bg-primary/10 text-primary" },
    neutraal: { label: "Neutraal", cls: "border-border bg-muted text-muted-foreground" },
    signaal: { label: "Signaal", cls: "border-[hsl(var(--chart-4))]/40 bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]" },
  };
  const m = map[oordeel] ?? map.neutraal;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium ${m.cls}`} style={{ fontSize: "var(--text-xs)" }}>
      {m.label}
    </span>
  );
}

// =============================================================================
// Studie-assistent (chatbot) — ALLEEN voor recruiter/coach, NOOIT de kandidaat.
// Bevraagt de vergelijkende studie (het eindrapport). Zelfde voorwaarden als de
// Kompas-chatbot: meertalig, gratislimiet + paywall, recruitment-zorgkompas dat
// geen geschiktheids-/selectie-/rangschikkings-/aanwervingsoordeel geeft en bij
// gevoelige signalen doorverwijst naar een mens (coach-kaart). Verkeer loopt via
// de Node-backend naar de Python-sidecar (variant "recruiter").
// =============================================================================
function StudieChat({ sessionId, taal = STANDAARD_TAAL }: { sessionId: number; taal?: Taal }) {
  const t = maakVertaler(taal);
  const [invoer, setInvoer] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: chat, isLoading } = useChat(sessionId, !!sessionId);
  const verstuur = usePostChat(sessionId);
  const koop = useKoopExtra(sessionId);

  const berichten = chat?.berichten ?? [];
  const limiet = chat?.limiet;
  const suggesties = chat?.suggesties ?? [];
  const coachActief = berichten.some((b) => b.rol === "assistant" && b.veiligheid === "coach");
  const coach = chat?.coach;
  const geblokkeerd = limiet?.geblokkeerd ?? false;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [berichten.length, verstuur.isPending]);

  function indienen(vraag: string) {
    const v = vraag.trim();
    if (!v || verstuur.isPending) return;
    if (geblokkeerd) {
      setPaywallOpen(true);
      return;
    }
    setFout(null);
    verstuur.mutate(v, {
      onSuccess: () => setInvoer(""),
      onError: (err: unknown) => {
        const msg = String((err as { message?: string })?.message ?? "");
        if (msg.includes("402") || msg.includes("limiet_bereikt")) {
          setPaywallOpen(true);
        } else {
          setFout(t("t4r_chat_fout"));
        }
      },
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-[0_1px_3px_rgba(60,45,25,0.05)]" data-testid="card-t4r-chat">
      {/* Kop */}
      <div className="flex items-start gap-3 border-b border-card-border bg-primary/5 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <MessageCircle size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }} data-testid="text-t4r-chat-titel">
            {t("t4r_chat_titel")}
          </h2>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_chat_ondertitel")}</p>
        </div>
        {limiet && (
          <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-muted-foreground sm:flex" style={{ fontSize: "var(--text-xs)" }} data-testid="text-t4r-chat-teller">
            <ShieldCheck size={14} className="text-primary" />
            {limiet.resterend} {t("t4r_chat_teller")}
          </div>
        )}
      </div>

      {/* Recruiter-only notitie */}
      <div className="flex items-start gap-2 border-b border-card-border bg-muted/40 px-5 py-2.5 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }} data-testid="text-t4r-chat-recruiter-only">
        <Info size={14} className="mt-0.5 shrink-0 text-primary" />
        <span>{t("t4r_chat_recruiter_only")}</span>
      </div>

      {/* Berichtenstroom */}
      <div ref={scrollRef} className="flex max-h-[26rem] min-h-[14rem] flex-col gap-3 overflow-y-auto p-5" data-testid="t4r-chat-stroom">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          </div>
        ) : berichten.length === 0 ? (
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles size={16} />
            </div>
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 leading-relaxed text-foreground" style={{ fontSize: "var(--text-sm)" }}>
              {t("t4r_chat_welkom")}
            </div>
          </div>
        ) : (
          berichten.map((b) => <StudieChatBubbel key={b.id} bericht={b} />)
        )}

        {verstuur.isPending && (
          <div className="flex items-start gap-2.5" data-testid="t4r-chat-typing">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Sparkles size={16} />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
            </div>
          </div>
        )}
      </div>

      {/* Coach-doorverwijskaart (recruitment-zorgkompas) */}
      {coachActief && coach && <StudieCoachKaart coach={coach} taal={taal} />}

      {/* Suggesties (alleen bij lege stroom) */}
      {!isLoading && berichten.length === 0 && suggesties.length > 0 && (
        <div className="border-t border-card-border px-5 py-3">
          <p className="mb-2 font-medium uppercase tracking-wide text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_chat_suggesties")}</p>
          <div className="flex flex-wrap gap-2">
            {suggesties.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => indienen(s)}
                disabled={verstuur.isPending}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-foreground transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                style={{ fontSize: "var(--text-xs)" }}
                data-testid={`chip-t4r-suggestie-${i}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {fout && (
        <p className="border-t border-card-border bg-destructive/5 px-5 py-2.5 text-destructive" style={{ fontSize: "var(--text-sm)" }} data-testid="text-t4r-chat-fout">{fout}</p>
      )}

      {/* Invoer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          indienen(invoer);
        }}
        className="flex items-end gap-2 border-t border-card-border p-4"
      >
        {geblokkeerd ? (
          <Button type="button" className="w-full" onClick={() => setPaywallOpen(true)} data-testid="button-t4r-chat-geblokkeerd">
            <Lock size={16} className="mr-2" /> {t("t4r_chat_paywall_titel")}
          </Button>
        ) : (
          <>
            <textarea
              value={invoer}
              onChange={(e) => setInvoer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  indienen(invoer);
                }
              }}
              rows={1}
              placeholder={t("t4r_chat_placeholder")}
              className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              style={{ fontSize: "var(--text-sm)" }}
              disabled={verstuur.isPending}
              data-testid="input-t4r-chat"
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={verstuur.isPending || !invoer.trim()}
              data-testid="button-t4r-chat-verstuur"
              aria-label={t("t4r_chat_verstuur")}
            >
              {verstuur.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </Button>
          </>
        )}
      </form>

      <StudiePaywall
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        taal={taal}
        limiet={limiet}
        bezig={koop.isPending}
        gelukt={koop.isSuccess}
        onKoop={() => koop.mutate()}
      />
    </div>
  );
}

function StudieChatBubbel({ bericht }: { bericht: T4rChatBerichtUI }) {
  const isUser = bericht.rol === "user";
  if (isUser) {
    return (
      <div className="flex justify-end" data-testid={`bubbel-t4r-user-${bericht.id}`}>
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 leading-relaxed text-primary-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {bericht.inhoud}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5" data-testid={`bubbel-t4r-assistent-${bericht.id}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles size={16} />
      </div>
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 leading-relaxed text-foreground" style={{ fontSize: "var(--text-sm)" }}>
        {bericht.inhoud}
      </div>
    </div>
  );
}

function StudieCoachKaart({ coach, taal = STANDAARD_TAAL }: { coach: T4rChatCoach; taal?: Taal }) {
  const t = maakVertaler(taal);
  return (
    <div className="mx-5 mb-1 mt-1 rounded-xl border border-primary/30 bg-primary/5 p-4" data-testid="card-t4r-coach">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <HeartHandshake size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_chat_coach_titel")}</p>
          <p className="mt-1 leading-relaxed text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{coach.bericht}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground" style={{ fontSize: "var(--text-sm)" }}>{coach.naam}</span>
            <Badge variant="secondary" className="font-normal">{coach.rol}</Badge>
          </div>
          <Button size="sm" variant="outline" className="mt-3" data-testid="button-t4r-coach-contact">
            <Mail size={16} className="mr-2" /> {t("t4r_chat_coach_contact")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudiePaywall({
  open,
  onOpenChange,
  taal = STANDAARD_TAAL,
  limiet,
  bezig,
  gelukt,
  onKoop,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taal?: Taal;
  limiet?: T4rChatLimiet;
  bezig: boolean;
  gelukt: boolean;
  onKoop: () => void;
}) {
  const t = maakVertaler(taal);
  const pakket = limiet?.pakketGrootte ?? 25;
  useEffect(() => {
    if (gelukt && limiet && !limiet.geblokkeerd) {
      const id = setTimeout(() => onOpenChange(false), 1200);
      return () => clearTimeout(id);
    }
  }, [gelukt, limiet?.geblokkeerd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-t4r-paywall">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock size={24} />
          </div>
          <DialogTitle className="text-center">{t("t4r_chat_paywall_titel")}</DialogTitle>
          <DialogDescription className="text-center">{t("t4r_chat_paywall_tekst")}</DialogDescription>
        </DialogHeader>

        {gelukt && limiet && !limiet.geblokkeerd ? (
          <p className="rounded-lg bg-primary/10 px-4 py-3 text-center font-medium text-primary" style={{ fontSize: "var(--text-sm)" }} data-testid="text-t4r-paywall-gelukt">
            {t("t4r_chat_paywall_gelukt")}
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_chat_paywall_koop")}</p>
              <p className="mt-1 font-semibold text-foreground" style={{ fontSize: "var(--text-xl)" }} data-testid="text-t4r-paywall-pakket">
                {pakket} {t("t4r_chat_paywall_vragen")}
              </p>
            </div>
            <Button onClick={onKoop} disabled={bezig} className="w-full" data-testid="button-t4r-koop-extra">
              {bezig ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CreditCard size={16} className="mr-2" />}
              {t("t4r_chat_paywall_demo")}
            </Button>
            <p className="text-center text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{t("t4r_chat_paywall_demo_note")}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
