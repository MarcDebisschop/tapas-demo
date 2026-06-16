import { useState } from "react";
import type { ModuleDef, LibraryItem, WorkContext } from "../library";
import { SCALE_OPTIONS, CLASSIFICATION_LABEL, classificationItems, MODULES } from "../library";
import { vertaalScaleOptions, vertaalClassificationItems, itemTekst } from "../library-i18n";
import type { Answer } from "../lib/t4r-schema";
import { DecisionCard } from "./decision-card";
import { answerFor, useUpsertAnswer } from "../lib/session-data";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Star, AlertTriangle, ShieldCheck, ShieldAlert, Check, ArrowUp, ArrowDown, GripVertical, Compass, Handshake, X } from "lucide-react";
import {
  STANDAARD_TAAL,
  maakVertaler,
  type Taal,
} from "@shared/i18n";

interface Ctx {
  sessionId: number;
  module: ModuleDef;
  answers: Answer[];
  taal?: Taal;
}

export function ModuleRender({ sessionId, module, answers, taal = STANDAARD_TAAL }: Ctx) {
  switch (module.kind) {
    case "context":
      return <ContextModule sessionId={sessionId} module={module} answers={answers} taal={taal} />;
    case "selectie":
      return <WorkContextModule sessionId={sessionId} module={module} answers={answers} taal={taal} />;
    case "decision":
      return <DecisionModule sessionId={sessionId} module={module} answers={answers} taal={taal} />;
    case "consolidatie":
      return <Consolidatie sessionId={sessionId} answers={answers} taal={taal} />;
    case "drempel":
      return <Drempels sessionId={sessionId} module={module} answers={answers} taal={taal} />;
    case "risico":
      return <Risico sessionId={sessionId} module={module} answers={answers} taal={taal} />;
    case "finalisatie":
      return <Finalisatie sessionId={sessionId} answers={answers} taal={taal} />;
    default:
      return null;
  }
}

// ---- Context (schaal + open) ----------------------------------------------
function ContextModule({ sessionId, module, answers, taal = STANDAARD_TAAL }: Ctx) {
  const upsert = useUpsertAnswer(sessionId);
  return (
    <div className="space-y-3">
      {module.items.map((item) => (
        <ContextRow key={item.id} item={item} answer={answerFor(answers, item.id)} sessionId={sessionId} upsert={upsert} taal={taal} />
      ))}
    </div>
  );
}

function ContextRow({ item, answer, upsert, taal = STANDAARD_TAAL }: { item: LibraryItem; answer?: Answer; sessionId: number; upsert: ReturnType<typeof useUpsertAnswer>; taal?: Taal }) {
  const t = maakVertaler(taal);
  const [text, setText] = useState(answer?.note ?? "");
  const scaleKind = item.scale?.kind ?? (item.type === "toelichting" || item.type === "discussie" ? "open" : "intensity");

  // Bouw de keuzeopties op basis van het schaaltype
  const scaleOpts = vertaalScaleOptions(taal);
  let options: { value: string; label: string }[] = [];
  if (scaleKind === "intensity") options = scaleOpts;
  else if (scaleKind === "bipolar") options = scaleOpts; // 5 punten, polen apart getoond
  else if (scaleKind === "choice") options = item.scale?.options ?? [];

  return (
    <div className="rounded-lg border border-card-border bg-card p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="font-mono text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
          {item.id}
        </span>
        {item.label === "monitoring" && (
          <span className="text-[hsl(var(--chart-2))]" style={{ fontSize: "var(--text-xs)" }}>· {t("t4r_comp_mr_monitoring")}</span>
        )}
        {item.label === "risico" && (
          <span className="text-destructive" style={{ fontSize: "var(--text-xs)" }}>· {t("t4r_comp_mr_risico")}</span>
        )}
      </div>
      <p className="mb-3 text-foreground" style={{ fontSize: "var(--text-base)", fontWeight: 500 }}>
        {item.text}
      </p>

      {scaleKind === "open" && (
        <Textarea
          data-testid={`context-text-${item.id}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => upsert.mutate({ itemId: item.id, note: text || null })}
          placeholder={t("t4r_comp_mr_toelichting_ph")}
          rows={2}
        />
      )}

      {(scaleKind === "intensity" || scaleKind === "choice") && (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const active = answer?.contextValue === o.value;
            return (
              <button
                key={o.value}
                data-testid={`scale-${item.id}-${o.value}`}
                onClick={() => upsert.mutate({ itemId: item.id, contextValue: active ? null : o.value })}
                className={`rounded-md border px-3 py-1.5 transition-colors ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate"
                }`}
                style={{ fontSize: "var(--text-sm)" }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {scaleKind === "bipolar" && (
        <div>
          <div className="mb-1.5 flex items-center justify-between" style={{ fontSize: "var(--text-xs)" }}>
            <span className="font-medium text-foreground">{item.scale?.poleLeft}</span>
            <span className="font-medium text-foreground">{item.scale?.poleRight}</span>
          </div>
          <div className="flex items-stretch gap-1.5">
            {scaleOpts.map((o, idx) => {
              const active = answer?.contextValue === o.value;
              const mid = idx === 2;
              return (
                <button
                  key={o.value}
                  data-testid={`scale-${item.id}-${o.value}`}
                  onClick={() => upsert.mutate({ itemId: item.id, contextValue: active ? null : o.value })}
                  title={mid ? t("t4r_comp_mr_evenwichtig_neutraal") : undefined}
                  className={`flex-1 rounded-md border py-2 text-center transition-colors ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate"
                  }`}
                  style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}
                >
                  {mid ? "•" : idx + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex items-center justify-between text-muted-foreground" style={{ fontSize: "11px" }}>
            <span>{t("t4r_comp_mr_sterk_links")}</span>
            <span>{t("t4r_comp_mr_evenwichtig")}</span>
            <span>{t("t4r_comp_mr_sterk_rechts")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Module 4: benoemde werkcontexten (classificatie i.p.v. schaal) -------
function WorkContextModule({ sessionId, module, answers, taal = STANDAARD_TAAL }: Ctx) {
  const upsert = useUpsertAnswer(sessionId);
  const contexts = module.workContexts ?? [];
  return (
    <div className="space-y-3">
      {contexts.map((wc) => (
        <WorkContextRow key={wc.id} wc={wc} answer={answerFor(answers, wc.id)} upsert={upsert} taal={taal} />
      ))}
      {/* afsluitende open toelichting */}
      {module.items.map((item) => (
        <ContextRow key={item.id} item={item} answer={answerFor(answers, item.id)} sessionId={sessionId} upsert={upsert} taal={taal} />
      ))}
    </div>
  );
}

function WorkContextRow({ wc, answer, upsert, taal = STANDAARD_TAAL }: { wc: WorkContext; answer?: Answer; upsert: ReturnType<typeof useUpsertAnswer>; taal?: Taal }) {
  const t = maakVertaler(taal);
  const cls = answer?.classification;
  const opts: { v: "need" | "nice" | "not-needed"; label: string; desc: string; cls: string }[] = [
    { v: "need", label: "Bepalend", desc: "Sterk bepalend voor succes", cls: "border-primary bg-primary/10 text-primary" },
    { v: "nice", label: "Relevant", desc: "Speelt mee, niet doorslaggevend", cls: "border-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]" },
    { v: "not-needed", label: "Niet relevant", desc: "Speelt nauwelijks in deze rol", cls: "border-border bg-muted text-muted-foreground" },
  ];
  return (
    <div className="rounded-lg border border-card-border bg-card p-4">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="font-mono text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{wc.id}</span>
          </div>
          <p className="text-foreground" style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{wc.name}</p>
          <p className="mt-0.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{wc.desc}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {opts.map((o) => {
          const active = cls === o.v;
          return (
            <button
              key={o.v}
              data-testid={`wc-${wc.id}-${o.v}`}
              onClick={() => upsert.mutate({ itemId: wc.id, classification: active ? null : o.v })}
              className={`rounded-md border px-3 py-2 text-left transition-colors ${active ? o.cls : "border-border text-muted-foreground hover-elevate"}`}
            >
              <span className="block" style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{o.label}</span>
              <span className="block leading-tight" style={{ fontSize: "11px" }}>{o.desc}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          data-testid={`wc-critical-${wc.id}`}
          disabled={cls !== "need"}
          onClick={() => upsert.mutate({ itemId: wc.id, critical: !answer?.critical })}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors ${
            answer?.critical ? "border-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]" : "border-border text-muted-foreground hover-elevate"
          } ${cls !== "need" ? "opacity-40" : ""}`}
          style={{ fontSize: "var(--text-xs)" }}
        >
          <Star size={12} fill={answer?.critical ? "currentColor" : "none"} /> {t("t4r_comp_mr_meest_kritisch")}
        </button>
        <button
          data-testid={`wc-risk-${wc.id}`}
          onClick={() => upsert.mutate({ itemId: wc.id, conflict: !answer?.conflict })}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 transition-colors ${
            answer?.conflict ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover-elevate"
          }`}
          style={{ fontSize: "var(--text-xs)" }}
        >
          <AlertTriangle size={12} /> {t("t4r_comp_mr_grootste_risico")}
        </button>
      </div>
    </div>
  );
}

// ---- Decision (besluitkaarten) --------------------------------------------
function DecisionModule({ sessionId, module, answers, taal = STANDAARD_TAAL }: Ctx) {
  const upsert = useUpsertAnswer(sessionId);
  return (
    <div className="space-y-4">
      {module.items.map((item) =>
        item.type === "classificatie" ? (
          <DecisionCard
            key={item.id}
            item={item}
            answer={answerFor(answers, item.id)}
            onChange={(patch) => upsert.mutate({ itemId: item.id, ...patch })}
            taal={taal}
          />
        ) : (
          <DiscussionItem key={item.id} item={item} answer={answerFor(answers, item.id)} sessionId={sessionId} upsert={upsert} taal={taal} />
        )
      )}
    </div>
  );
}

function DiscussionItem({ item, answer, upsert, taal = STANDAARD_TAAL }: { item: LibraryItem; answer?: Answer; sessionId: number; upsert: ReturnType<typeof useUpsertAnswer>; taal?: Taal }) {
  const t = maakVertaler(taal);
  const [text, setText] = useState(answer?.note ?? "");
  const isDrempel = item.type === "drempel";
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{item.id}</span>
        <span className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
          · {isDrempel ? t("t4r_comp_mr_drempelvraag") : t("t4r_comp_mr_discussievraag")}
        </span>
      </div>
      <p className="mb-3 text-foreground" style={{ fontSize: "var(--text-base)", fontWeight: 500 }}>{item.text}</p>
      <Textarea
        data-testid={`discussion-${item.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => upsert.mutate({ itemId: item.id, note: text || null })}
        placeholder={t("t4r_comp_mr_discuss_ph")}
        rows={2}
      />
    </div>
  );
}

// ---- Consolidatie (3 kolommen + handmatige rangschikking van need-to-have) --
function Consolidatie({ sessionId, answers, taal = STANDAARD_TAAL }: { sessionId: number; answers: Answer[]; taal?: Taal }) {
  const t = maakVertaler(taal);
  const upsert = useUpsertAnswer(sessionId);
  const items = vertaalClassificationItems(taal);
  const byClass = (c: string) =>
    items.filter((it) => answerFor(answers, it.id)?.classification === c);
  const critical = items.filter((it) => answerFor(answers, it.id)?.critical);
  const conflicts = answers.filter((a) => a.conflict);

  // Need-to-have, geordend op handmatige rang (1 = belangrijkst).
  // Items zonder rang komen achteraan, in hun oorspronkelijke bibliotheekvolgorde.
  const needItems = byClass("need");
  const orderedNeeds = [...needItems].sort((a, b) => {
    const ra = answerFor(answers, a.id)?.rank;
    const rb = answerFor(answers, b.id)?.rank;
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return needItems.indexOf(a) - needItems.indexOf(b);
  });

  // Verplaats een item één plaats omhoog/omlaag en herschrijf alle rangen (1-based).
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= orderedNeeds.length) return;
    const next = [...orderedNeeds];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    next.forEach((it, i) => {
      const current = answerFor(answers, it.id)?.rank;
      if (current !== i + 1) upsert.mutate({ itemId: it.id, rank: i + 1 });
    });
  };

  const otherCols = [
    { key: "nice", label: "Nice to have", color: "border-[hsl(var(--chart-4))]" },
    { key: "not-needed", label: "Not needed", color: "border-border" },
  ];

  return (
    <div className="space-y-5">
      {/* Need to have — met handmatige volgorde van belang */}
      <div className="rounded-lg border-t-2 border-primary border-x border-b border-card-border bg-card p-4">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>Need to have</h4>
          <span className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{orderedNeeds.length}</span>
        </div>
        <p className="mb-3 text-muted-foreground" style={{ fontSize: "var(--text-xs)", lineHeight: 1.4 }}>
          {t("t4r_comp_mr_need_volgorde")}
        </p>
        <ul className="space-y-2">
          {orderedNeeds.map((it, idx) => (
            <li
              key={it.id}
              data-testid={`rank-row-${it.id}`}
              className="flex items-start gap-2.5 rounded-md border border-card-border bg-background px-2.5 py-2"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary"
                style={{ fontSize: "11px" }}
              >
                {idx + 1}
              </span>
              <span className="flex-1 text-foreground" style={{ fontSize: "var(--text-sm)", lineHeight: 1.35 }}>
                {answerFor(answers, it.id)?.critical && (
                  <Star size={12} className="mr-1 inline-block align-[-1px] text-[hsl(var(--chart-4))]" fill="currentColor" />
                )}
                {it.text}
              </span>
              <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-muted-foreground">
                <GripVertical size={13} className="opacity-40" aria-hidden="true" />
                <button
                  data-testid={`rank-up-${it.id}`}
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  aria-label={t("t4r_comp_mr_belangrijker")}
                  className="rounded p-0.5 transition-colors hover-elevate disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  data-testid={`rank-down-${it.id}`}
                  onClick={() => move(idx, 1)}
                  disabled={idx === orderedNeeds.length - 1}
                  aria-label={t("t4r_comp_mr_minder_belangrijk")}
                  className="rounded p-0.5 transition-colors hover-elevate disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <ArrowDown size={14} />
                </button>
              </span>
            </li>
          ))}
          {orderedNeeds.length === 0 && (
            <li className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>—</li>
          )}
        </ul>
      </div>

      {/* Nice to have + Not needed */}
      <div className="grid gap-4 md:grid-cols-2">
        {otherCols.map((col) => {
          const list = byClass(col.key);
          return (
            <div key={col.key} className={`rounded-lg border-t-2 ${col.color} border-x border-b border-card-border bg-card p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{col.label}</h4>
                <span className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{list.length}</span>
              </div>
              <ul className="space-y-2">
                {list.map((it) => (
                  <li key={it.id} className="flex items-start gap-1.5 text-foreground" style={{ fontSize: "var(--text-sm)", lineHeight: 1.35 }}>
                    {answerFor(answers, it.id)?.critical && <Star size={12} className="mt-1 shrink-0 text-[hsl(var(--chart-4))]" fill="currentColor" />}
                    <span>{it.text}</span>
                  </li>
                ))}
                {list.length === 0 && <li className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>—</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel icon={<Star size={15} className="text-[hsl(var(--chart-4))]" fill="currentColor" />} title={t("t4r_comp_report_kritische_sc")}>
          {critical.length ? critical.map((it) => <Line key={it.id}>{it.text}</Line>) : <Empty />}
        </Panel>
        <Panel icon={<AlertTriangle size={15} className="text-destructive" />} title={t("t4r_comp_mr_doorgestroomd")}>
          {conflicts.length ? conflicts.map((a) => <Line key={a.itemId}>{itemText(a.itemId, taal)}</Line>) : <Empty text={t("t4r_comp_mr_geen_afwijkingen")} />}
        </Panel>
      </div>
    </div>
  );
}

// ---- Drempels --------------------------------------------------------------
function Drempels({ sessionId, module, answers, taal = STANDAARD_TAAL }: Ctx) {
  const upsert = useUpsertAnswer(sessionId);
  const groups = [
    { title: "Contextuele drempel", why: "Bepaalt of de rolcontext bepaalde condities minimaal vereist.", ids: ["M9-01", "M9-02", "M9-03"] },
    { title: "Profieldrempel", why: "Bepaalt of op kritische profielclusters een minimummatch aanwezig is.", ids: ["M9-04", "M9-05", "M9-06"] },
  ];
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.title} className="rounded-xl border border-card-border bg-card p-5">
          <div className="mb-1 flex items-center gap-2 text-primary">
            <ShieldCheck size={17} />
            <h4 className="font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{g.title}</h4>
          </div>
          <p className="mb-4 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>{g.why}</p>
          <div className="space-y-2.5">
            {g.ids.map((id) => {
              const item = module.items.find((i) => i.id === id)!;
              const a = answerFor(answers, id);
              return <ThresholdRow key={id} item={item} answer={a} upsert={upsert} taal={taal} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ThresholdRow({ item, answer, upsert, taal = STANDAARD_TAAL }: { item: LibraryItem; answer?: Answer; upsert: ReturnType<typeof useUpsertAnswer>; taal?: Taal }) {
  const t = maakVertaler(taal);
  const val = answer?.contextValue;
  const opts = [
    { v: "gehaald", label: t("t4r_comp_mr_gehaald"), cls: "border-primary bg-primary/10 text-primary" },
    { v: "niet-gehaald", label: t("t4r_comp_mr_niet_gehaald"), cls: "border-destructive bg-destructive/10 text-destructive" },
    { v: "nvt", label: t("t4r_comp_mr_nvt"), cls: "border-border bg-muted text-muted-foreground" },
  ];
  return (
    <div className="rounded-lg border border-border bg-background p-3.5">
      <p className="mb-2.5 text-foreground" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{item.text}</p>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const active = val === o.v;
          return (
            <button
              key={o.v}
              data-testid={`threshold-${item.id}-${o.v}`}
              onClick={() => upsert.mutate({ itemId: item.id, contextValue: active ? null : o.v })}
              className={`rounded-md border px-3 py-1.5 transition-colors ${active ? o.cls : "border-border text-muted-foreground hover-elevate"}`}
              style={{ fontSize: "var(--text-xs)" }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Risico ----------------------------------------------------------------
function Risico({ sessionId, module, answers, taal = STANDAARD_TAAL }: Ctx) {
  const t = maakVertaler(taal);
  const upsert = useUpsertAnswer(sessionId);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-card-border bg-card p-5">
        <div className="mb-1 flex items-center gap-2 text-destructive">
          <ShieldAlert size={17} />
          <h4 className="font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>{t("t4r_comp_mr_risicodrempel")}</h4>
        </div>
        <p className="mb-4 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_mr_fragiel_detectie")}
        </p>
        <div className="space-y-2.5">
          {module.items.filter((i) => i.label === "risico" && i.type === "drempel").map((item) => (
            <ThresholdRow key={item.id} item={item} answer={answerFor(answers, item.id)} upsert={upsert} taal={taal} />
          ))}
        </div>
      </div>

      {module.items.filter((i) => i.type !== "drempel").map((item) => (
        <ContextRow key={item.id} item={item} answer={answerFor(answers, item.id)} sessionId={sessionId} upsert={upsert} taal={taal} />
      ))}
    </div>
  );
}

// ---- Finalisatie -----------------------------------------------------------
// Kernprincipe van de finalisatie: alignment als beslissingscriterium, geen consensus.
function AlignmentVsConsensus({ taal = STANDAARD_TAAL }: { taal?: Taal }) {
  const t = maakVertaler(taal);
  return (
    <div className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5 shadow-[0_1px_3px_rgba(60,45,25,0.05)]">
      <div className="flex items-center gap-2.5 border-b border-primary/20 px-5 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/12 text-primary">
          <Compass size={15} />
        </span>
        <h4 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>
          {t("t4r_comp_avc_titel")}
        </h4>
      </div>
      <div className="px-5 py-4">
        <p className="mb-4 max-w-3xl text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_avc_intro")}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-primary/25 bg-card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-primary">
              <Handshake size={15} />
              <span className="font-semibold" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_avc_align_label")}</span>
            </div>
            <ul className="space-y-1.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
              <li>{t("t4r_comp_avc_align_1")}</li>
              <li>{t("t4r_comp_avc_align_2")}</li>
              <li>{t("t4r_comp_avc_align_3")}</li>
              <li>{t("t4r_comp_avc_align_4")}</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
              <X size={15} />
              <span className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{t("t4r_comp_avc_cons_label")}</span>
            </div>
            <ul className="space-y-1.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
              <li>{t("t4r_comp_avc_cons_1")}</li>
              <li>{t("t4r_comp_avc_cons_2")}</li>
              <li>{t("t4r_comp_avc_cons_3")}</li>
              <li>{t("t4r_comp_avc_cons_4")}</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
          {t("t4r_comp_avc_slot")}
        </p>
      </div>
    </div>
  );
}

function Finalisatie({ sessionId, answers, taal = STANDAARD_TAAL }: { sessionId: number; answers: Answer[]; taal?: Taal }) {
  const t = maakVertaler(taal);
  const upsert = useUpsertAnswer(sessionId);
  const conflicts = answers.filter((a) => a.conflict);

  return (
    <div className="space-y-5">
      <AlignmentVsConsensus taal={taal} />
      <div className="rounded-xl border border-card-border bg-card p-5">
        <h4 className="mb-1 font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>
          {t("t4r_comp_mr_finale_beslissing")}
        </h4>
        <p className="mb-4 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {t("t4r_comp_mr_finale_intro")}
        </p>
        {conflicts.length === 0 ? (
          <p className="text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_mr_geen_discussiepunten")}
          </p>
        ) : (
          <div className="space-y-3">
            {conflicts.map((a) => (
              <FinalRow key={a.itemId} answer={a} upsert={upsert} taal={taal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FinalRow({ answer, upsert, taal = STANDAARD_TAAL }: { answer: Answer; upsert: ReturnType<typeof useUpsertAnswer>; taal?: Taal }) {
  const t = maakVertaler(taal);
  const [reason, setReason] = useState(answer.finalReason ?? "");
  const decision = answer.finalDecision;
  return (
    <div className="rounded-lg border border-border bg-background p-3.5">
      <p className="mb-2.5 text-foreground" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{itemText(answer.itemId, taal)}</p>
      <div className="flex flex-wrap gap-2">
        <button
          data-testid={`final-alignment-${answer.itemId}`}
          onClick={() => upsert.mutate({ itemId: answer.itemId, finalDecision: decision === "alignment" ? null : "alignment" })}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 transition-colors ${decision === "alignment" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate"}`}
          style={{ fontSize: "var(--text-xs)" }}
        >
          <Check size={13} /> {t("t4r_comp_mr_alignment_bevestigd")}
        </button>
        <button
          data-testid={`final-rest-${answer.itemId}`}
          onClick={() => upsert.mutate({ itemId: answer.itemId, finalDecision: decision === "ondanks-restverschil" ? null : "ondanks-restverschil" })}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 transition-colors ${decision === "ondanks-restverschil" ? "border-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/10 text-[hsl(var(--chart-4))]" : "border-border text-muted-foreground hover-elevate"}`}
          style={{ fontSize: "var(--text-xs)" }}
        >
          <AlertTriangle size={13} /> {t("t4r_comp_mr_ondanks_restverschil")}
        </button>
      </div>
      {decision === "ondanks-restverschil" && (
        <Textarea
          data-testid={`final-reason-${answer.itemId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => upsert.mutate({ itemId: answer.itemId, finalReason: reason || null })}
          placeholder={t("t4r_comp_mr_reden_ph")}
          className="mt-2.5"
          rows={2}
        />
      )}
    </div>
  );
}

// ---- helpers ---------------------------------------------------------------
function itemText(id: string, taal: Taal = STANDAARD_TAAL): string {
  for (const m of MODULES) {
    const it = m.items.find((i) => i.id === id);
    if (it) return itemTekst(it.id, it.text, taal);
  }
  return id;
}
function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h4 className="font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>{title}</h4>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Line({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground" style={{ fontSize: "var(--text-xs)", lineHeight: 1.4 }}>{children}</p>;
}
function Empty({ text = "Nog niets vastgelegd." }: { text?: string }) {
  return <p className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>{text}</p>;
}
