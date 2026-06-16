import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { downloadNodeAlsPdf, PdfExportError } from "../lib/pdf-export";
import { useToast } from "@/hooks/use-toast";
import type { Session, Stakeholder, Answer, AuditEvent } from "../lib/t4r-schema";
import { classificationItems, MODULES } from "../library";
import { vertaalClassificationItems, vertaalModuleByKey, itemTekst } from "../library-i18n";
import type { LibraryItem } from "../library";
import { Button } from "@/components/ui/button";
import { Lock, FileDown, Star, ShieldCheck, ShieldAlert, CheckCircle2, Compass, Gauge, Flame, Sprout, Sparkles } from "lucide-react";
import {
  STANDAARD_TAAL,
  maakVertaler,
  type Taal,
} from "@shared/i18n";

// Volgorde van belang: kritisch need -> need -> nice -> not needed -> onbeoordeeld.
// Binnen need-to-have stuurt de handmatige rangorde (rank) de volgorde aan:
// items met een rang sorteren op die rang, items zonder rang vallen daarna.
const ORDER_RANK: Record<string, number> = { need: 1, nice: 2, "not-needed": 3 };
function rankFor(a: Answer | undefined): number {
  if (!a || !a.classification) return 4;
  let band = ORDER_RANK[a.classification] ?? 4;
  // kritische need-items vormen de bovenste band
  if (a.classification === "need" && a.critical) band = 0;
  // fractie binnen de band: handmatige rang eerst, ongerangschikte items erna
  const frac = a.rank != null ? a.rank / 1000 : 0.5;
  return band + frac;
}

function itemText(id: string, taal: Taal): string {
  for (const m of MODULES) {
    const it = m.items.find((i) => i.id === id);
    if (it) return itemTekst(it.id, it.text, taal);
  }
  return id;
}

function answerFor(answers: Answer[], id: string) {
  return answers.find((a) => a.itemId === id);
}

export function ReportView({
  session,
  stakeholders,
  answers,
  onLock,
  locked,
  taal = STANDAARD_TAAL,
}: {
  session: Session;
  stakeholders: Stakeholder[];
  answers: Answer[];
  onLock: () => void;
  locked: boolean;
  taal?: Taal;
}) {
  const t = maakVertaler(taal);
  const { data: audit } = useQuery<AuditEvent[]>({ queryKey: ["/api/t4r/sessions", session.id, "audit"] });
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [bezigPdf, setBezigPdf] = useState(false);

  const handleDownload = async () => {
    if (bezigPdf) return;
    setBezigPdf(true);
    try {
      const resultaat = await downloadNodeAlsPdf(printRef.current, `Recruitment design report - ${session.functionTitle}`);
      if (resultaat === "nieuw-tabblad") {
        toast({
          title: "PDF klaargezet",
          description: "Het rapport is geopend in een nieuw tabblad (en gedownload indien uw browser dat toestaat). Vindt u geen nieuw tabblad? Sta dan pop-ups voor deze pagina toe, of open de app in een eigen tabblad.",
        });
      } else {
        toast({ title: "PDF gedownload", description: "Het rapport is opgeslagen als PDF." });
      }
    } catch (e) {
      const reden =
        e instanceof PdfExportError
          ? e.message
          : "De PDF kon niet worden aangemaakt. Vernieuw de pagina en probeer het opnieuw.";
      toast({ variant: "destructive", title: "Download mislukt", description: reden });
      // eslint-disable-next-line no-console
      console.error("PDF-export fout:", e);
    } finally {
      setBezigPdf(false);
    }
  };
  const items = vertaalClassificationItems(taal);
  const need = items.filter((i) => answerFor(answers, i.id)?.classification === "need");
  const nice = items.filter((i) => answerFor(answers, i.id)?.classification === "nice");
  const notNeeded = items.filter((i) => answerFor(answers, i.id)?.classification === "not-needed");
  const critical = items.filter((i) => answerFor(answers, i.id)?.critical);

  const thresholds = vertaalModuleByKey("drempels", taal)!.items;
  const riskItems = vertaalModuleByKey("risico", taal)!.items.filter((i) => i.type === "drempel");

  return (
    <div className="space-y-6" ref={printRef}>
      <div className="flex items-start justify-between gap-4" data-no-print>
        <div>
          <div className="mb-1 text-primary" style={{ fontSize: "var(--text-xs)", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {t("t4r_comp_report_eyebrow")}
          </div>
          <h1 className="font-serif text-foreground" style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>
            {t("t4r_comp_report_titel")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_report_subtitel")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" data-testid="button-print" onClick={handleDownload} disabled={bezigPdf}>
            <FileDown size={15} className="mr-1.5" /> {bezigPdf ? t("t4r_comp_report_pdf_bezig") : t("t4r_comp_report_download")}
          </Button>
          {!locked && (
            <Button data-testid="button-lock" onClick={onLock}>
              <Lock size={15} className="mr-1.5" /> {t("t4r_comp_report_sluit")}
            </Button>
          )}
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-primary" style={{ fontSize: "var(--text-sm)" }}>
          <CheckCircle2 size={16} /> {t("t4r_comp_report_vergrendeld")}
        </div>
      )}

      {/* 1. Formeel virtueel profiel */}
      <ReportSection nr="1" title={t("t4r_comp_report_sectie1")}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Meta label={t("t4r_comp_report_functie")} value={session.functionTitle} />
          <Meta label={t("t4r_comp_report_organisatie")} value={session.orgLabel} />
          <Meta label={t("t4r_comp_report_type_rol")} value={session.roleType} />
          <Meta label={t("t4r_comp_report_niveau")} value={session.roleLevel} />
          <Meta label={t("t4r_comp_report_invulmodus")} value={session.fillMode} />
          <Meta label={t("t4r_comp_report_stemgerechtigd")} value={`${stakeholders.filter((s) => s.voting).length} ${t("t4r_comp_report_stakeholders")}`} />
        </div>
        <p className="mt-3 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_report_essentieel")
            .replace("{n}", String(need.length))
            .replace("{k}", String(critical.length))}
        </p>
        <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-primary">
            <Compass size={14} />
            <span className="font-semibold" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_report_vrijgave")}</span>
          </div>
          <p className="max-w-3xl text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_report_vrijgave_intro")}
          </p>
        </div>
      </ReportSection>

      {/* De talentmotor in één oogopslag — drie dimensies, gekozen items op volgorde van belang */}
      <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary" style={{ fontSize: "var(--text-xs)" }}>✨</span>
          <h2 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-lg)" }}>{t("t4r_comp_report_talentmotor")}</h2>
        </div>
        <p className="mb-4 max-w-2xl text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_report_talentmotor_intro")}
        </p>

        <DimensionBand
          icon={Compass}
          index={1}
          title={t("t4r_comp_verif_werkgedrag")}
          subtitle={t("t4r_comp_report_dim_foci_sub")}
          moduleKey="foci"
          accentVar="--chart-1"
          answers={answers}
          taal={taal}
        />
        <DimensionBand
          icon={Gauge}
          index={2}
          title={t("t4r_comp_verif_versterkend")}
          subtitle={t("t4r_comp_report_dim_versnellers_sub")}
          moduleKey="versnellers"
          accentVar="--chart-4"
          answers={answers}
          taal={taal}
        />
        <DimensionBand
          icon={Flame}
          index={3}
          title="Drivers"
          subtitle={t("t4r_comp_report_dim_drivers_sub")}
          moduleKey="drivers"
          accentVar="--chart-3"
          answers={answers}
          taal={taal}
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
          <LegendDot label="Need to have" cls="bg-primary" />
          <LegendDot label="Nice to have" cls="bg-[hsl(var(--chart-4))]" />
          <LegendDot label="Not needed" cls="bg-muted-foreground/50" />
          <span className="flex items-center gap-1 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
            <Star size={11} className="text-[hsl(var(--chart-4))]" fill="currentColor" /> {t("t4r_comp_report_kritisch_label")}
          </span>
        </div>
      </section>

      {/* Zelfbeeld en innerlijke oriëntatie — bewust apart van talent */}
      <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[hsl(var(--chart-1))]/10 text-[hsl(var(--chart-1))]">
            <Sprout size={15} />
          </span>
          <h2 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-lg)" }}>{t("t4r_comp_report_zelfbeeld_titel")}</h2>
        </div>
        <p className="mb-4 max-w-2xl text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_report_zelfbeeld_intro")}
        </p>
        <DimensionBand
          icon={Sprout}
          index={1}
          title={t("t4r_comp_verif_zelfbeeld")}
          subtitle={t("t4r_comp_report_dim_zelfbeeld_sub")}
          moduleKey="zelfbeeld"
          accentVar="--chart-1"
          answers={answers}
          taal={taal}
        />
      </section>

      {/* 2. Need / nice / not needed */}
      <ReportSection nr="2" title="Need to have / nice to have / not needed">
        <div className="grid gap-4 md:grid-cols-3">
          <Column title="Need to have" items={need.map((i) => ({ text: i.text, critical: !!answerFor(answers, i.id)?.critical }))} accent="text-primary" />
          <Column title="Nice to have" items={nice.map((i) => ({ text: i.text }))} accent="text-[hsl(var(--chart-4))]" />
          <Column title="Not needed" items={notNeeded.map((i) => ({ text: i.text }))} accent="text-muted-foreground" />
        </div>
      </ReportSection>

      {/* 3. Minimumdrempels + kritische succesvoorwaarden */}
      <ReportSection nr="3" title={t("t4r_comp_report_sectie3")}>
        <div className="mb-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[hsl(var(--chart-4))]">
            <Star size={14} fill="currentColor" />
            <h4 className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_report_kritische_sc")}</h4>
          </div>
          {critical.length ? (
            <ul className="space-y-1">{critical.map((i) => <li key={i.id} className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{i.text}</li>)}</ul>
          ) : <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_report_geen_gemarkeerd")}</p>}
        </div>
        <div className="space-y-1.5">
          {thresholds.map((thresh) => {
            const v = answerFor(answers, thresh.id)?.contextValue;
            return <ThresholdLine key={thresh.id} text={thresh.text} value={v} t={t} />;
          })}
        </div>
      </ReportSection>

      {/* 4. Waakzaamheidsrapport */}
      <ReportSection nr="4" title={t("t4r_comp_report_sectie4")}>
        <div className="mb-3 flex items-center gap-1.5 text-destructive">
          <ShieldAlert size={14} />
          <h4 className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_report_risicodrempels")}</h4>
        </div>
        <div className="space-y-1.5">
          {riskItems.map((thresh) => {
            const v = answerFor(answers, thresh.id)?.contextValue;
            return <ThresholdLine key={thresh.id} text={thresh.text} value={v} risk t={t} />;
          })}
        </div>
      </ReportSection>

      {/* Audit trail */}
      <ReportSection nr="·" title={t("t4r_comp_report_audit")}>
        <ul className="space-y-1.5">
          {(audit ?? []).map((e) => (
            <li key={e.id} className="flex items-baseline gap-3 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
              <span className="font-mono shrink-0">{new Date(e.at).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" })}</span>
              <span className="text-foreground">{e.event}</span>
              {e.detail && <span>— {e.detail}</span>}
            </li>
          ))}
        </ul>
      </ReportSection>

      <div className="flex flex-col items-center gap-1 pt-2 text-center text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
        <span className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-primary" />
          {t("t4r_comp_report_credit")}
        </span>
        <span>{t("t4r_comp_report_footer")}</span>
      </div>
    </div>
  );
}

function DimensionBand({
  icon: Icon,
  index,
  title,
  subtitle,
  moduleKey,
  accentVar,
  answers,
  taal = STANDAARD_TAAL,
}: {
  icon: typeof Compass;
  index: number;
  title: string;
  subtitle: string;
  moduleKey: string;
  accentVar: string;
  answers: Answer[];
  taal?: Taal;
}) {
  const mod = vertaalModuleByKey(moduleKey, taal)!;
  const items = mod.items.filter((i) => i.type === "classificatie") as LibraryItem[];
  const ordered = items
    .map((it) => ({ it, a: answerFor(answers, it.id) }))
    .sort((x, y) => rankFor(x.a) - rankFor(y.a));
  const accent = `hsl(var(${accentVar}))`;

  return (
    <div
      className="mb-3 overflow-hidden rounded-lg border border-card-border bg-background/60"
      style={{ borderLeftWidth: "4px", borderLeftColor: accent }}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `hsl(var(${accentVar}) / 0.14)`, color: accent }}>
          <Icon size={15} />
        </span>
        <div className="leading-tight">
          <span className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>
            {index}. {title}
          </span>
          <span className="ml-1.5 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>· {subtitle}</span>
        </div>
      </div>
      <ol className="divide-y divide-border">
        {ordered.map(({ it, a }, idx) => (
          <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="flex items-start gap-2.5 text-foreground" style={{ fontSize: "var(--text-sm)", lineHeight: 1.35 }}>
              <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{idx + 1}</span>
              {a?.critical && <Star size={11} className="mt-1 shrink-0 text-[hsl(var(--chart-4))]" fill="currentColor" />}
              <span>{it.text}</span>
            </span>
            <StatusPill classification={a?.classification} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusPill({ classification }: { classification?: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    need: { label: "Need", cls: "border-primary/30 bg-primary/10 text-primary" },
    nice: { label: "Nice", cls: "border-[hsl(var(--chart-4))]/30 bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]" },
    "not-needed": { label: "Not needed", cls: "border-border bg-muted text-muted-foreground" },
  };
  const v = classification ? map[classification] : undefined;
  const m = v ?? { label: "—", cls: "border-dashed border-border bg-transparent text-muted-foreground" };
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 font-medium ${m.cls}`} style={{ fontSize: "var(--text-xs)" }}>
      {m.label}
    </span>
  );
}

function LegendDot({ label, cls }: { label: string; cls: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} /> {label}
    </span>
  );
}

function ReportSection({ nr, title, children }: { nr: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-card-border bg-card p-5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary" style={{ fontSize: "var(--text-xs)" }}>{nr}</span>
        <h2 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{label}</div>
      <div className="capitalize text-foreground" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Column({ title, items, accent }: { title: string; items: { text: string; critical?: boolean }[]; accent: string }) {
  return (
    <div>
      <h4 className={`mb-2 font-semibold ${accent}`} style={{ fontSize: "var(--text-sm)" }}>{title} <span className="text-muted-foreground">({items.length})</span></h4>
      <ul className="space-y-1.5">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-start gap-1.5 text-foreground" style={{ fontSize: "var(--text-sm)", lineHeight: 1.35 }}>
            {it.critical && <Star size={11} className="mt-1 shrink-0 text-[hsl(var(--chart-4))]" fill="currentColor" />}
            <span>{it.text}</span>
          </li>
        ))}
        {items.length === 0 && <li className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>—</li>}
      </ul>
    </div>
  );
}

function ThresholdLine({ text, value, risk, t }: { text: string; value?: string | null; risk?: boolean; t: ReturnType<typeof maakVertaler> }) {
  const label =
    value === "gehaald" ? t("t4r_comp_report_threshold_gehaald")
    : value === "niet-gehaald" ? t("t4r_comp_report_threshold_niet")
    : value === "nvt" ? t("t4r_comp_report_threshold_nvt")
    : t("t4r_comp_report_threshold_niet_beoordeeld");
  const cls =
    value === "gehaald" ? "text-primary" : value === "niet-gehaald" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-1.5 last:border-0">
      <span className="flex items-start gap-1.5 text-foreground" style={{ fontSize: "var(--text-sm)" }}>
        {risk ? <ShieldAlert size={14} className="mt-0.5 shrink-0 text-muted-foreground" /> : <ShieldCheck size={14} className="mt-0.5 shrink-0 text-muted-foreground" />}
        {text}
      </span>
      <span className={`shrink-0 font-medium ${cls}`} style={{ fontSize: "var(--text-xs)" }}>{label}</span>
    </div>
  );
}
