import { useState } from "react";
import type { LibraryItem } from "../library";
import type { Answer } from "../lib/t4r-schema";
import { Star, MessageSquarePlus, AlertTriangle, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  STANDAARD_TAAL,
  maakVertaler,
  type Taal,
} from "@shared/i18n";

interface Props {
  item: LibraryItem;
  answer?: Answer;
  onChange: (patch: {
    classification?: "need" | "nice" | "not-needed" | null;
    critical?: boolean;
    note?: string | null;
    conflict?: boolean;
  }) => void;
  taal?: Taal;
}

function typeBadge(item: LibraryItem, t: ReturnType<typeof maakVertaler>) {
  if (item.label === "risico") return { text: t("t4r_comp_risicogericht"), cls: "text-[hsl(var(--chart-2))]" };
  if (item.label === "drempel") return { text: t("t4r_comp_drempelgebonden"), cls: "text-[hsl(var(--chart-4))]" };
  return { text: t("t4r_comp_profielvormend"), cls: "text-primary" };
}

export function DecisionCard({ item, answer, onChange, taal = STANDAARD_TAAL }: Props) {
  const t = maakVertaler(taal);
  const [showNote, setShowNote] = useState(!!answer?.note);
  const [noteVal, setNoteVal] = useState(answer?.note ?? "");
  const selected = answer?.classification ?? null;
  const badge = typeBadge(item, t);

  const CHOICES = [
    { key: "need" as const, label: "Need to have", desc: t("t4r_comp_need_to_have_desc") },
    { key: "nice" as const, label: "Nice to have", desc: t("t4r_comp_nice_to_have_desc") },
    { key: "not-needed" as const, label: "Not needed", desc: t("t4r_comp_not_needed_desc") },
  ];

  return (
    <div className="rounded-xl border border-card-border bg-card p-6 shadow-sm" data-testid={`card-item-${item.id}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
          {item.id}
        </span>
        <span className={`font-medium ${badge.cls}`} style={{ fontSize: "var(--text-xs)" }}>
          · {badge.text}
        </span>
      </div>

      <h3 className="text-foreground" style={{ fontSize: "var(--text-lg)", fontWeight: 600, lineHeight: 1.3 }}>
        {item.text}
      </h3>
      {item.help && (
        <p className="mt-1.5 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
          {item.help}
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {CHOICES.map((c) => {
          const active = selected === c.key;
          return (
            <button
              key={c.key}
              data-testid={`choice-${item.id}-${c.key}`}
              onClick={() => onChange({ classification: active ? null : c.key })}
              className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover-elevate"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-medium ${active ? "text-primary" : "text-foreground"}`}
                  style={{ fontSize: "var(--text-sm)" }}
                >
                  {c.label}
                </span>
                {active && <Check size={15} className="text-primary" />}
              </div>
              <span className="mt-0.5 block text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
                {c.desc}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          data-testid={`critical-${item.id}`}
          disabled={selected !== "need"}
          onClick={() => onChange({ critical: !answer?.critical })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors disabled:opacity-40 ${
            answer?.critical
              ? "border-[hsl(var(--chart-4))] text-[hsl(var(--chart-4))]"
              : "border-border text-muted-foreground hover-elevate"
          }`}
          style={{ fontSize: "var(--text-xs)" }}
          title={selected !== "need" ? t("t4r_comp_kritisch_sc_hint") : ""}
        >
          <Star size={13} fill={answer?.critical ? "currentColor" : "none"} /> {t("t4r_comp_kritisch_sc")}
        </button>

        <button
          data-testid={`addnote-${item.id}`}
          onClick={() => setShowNote((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-muted-foreground hover-elevate"
          style={{ fontSize: "var(--text-xs)" }}
        >
          <MessageSquarePlus size={13} /> {t("t4r_comp_context_toevoegen")}
        </button>

        <button
          data-testid={`conflict-${item.id}`}
          onClick={() => onChange({ conflict: !answer?.conflict })}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${
            answer?.conflict
              ? "border-destructive text-destructive"
              : "border-border text-muted-foreground hover-elevate"
          }`}
          style={{ fontSize: "var(--text-xs)" }}
        >
          <AlertTriangle size={13} /> {t("t4r_comp_discussiepunt")}
        </button>
      </div>

      {showNote && (
        <Textarea
          data-testid={`note-${item.id}`}
          value={noteVal}
          onChange={(e) => setNoteVal(e.target.value)}
          onBlur={() => onChange({ note: noteVal || null })}
          placeholder={t("t4r_comp_notitie_placeholder")}
          className="mt-3"
          rows={2}
        />
      )}
    </div>
  );
}
