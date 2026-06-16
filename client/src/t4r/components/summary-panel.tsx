import type { Answer } from "../lib/t4r-schema";
import { classificationItems, MODULES } from "../library";
import { itemTekst } from "../library-i18n";
import { Star, AlertTriangle } from "lucide-react";
import {
  STANDAARD_TAAL,
  maakVertaler,
  type Taal,
} from "@shared/i18n";

function itemText(id: string, taal: Taal): string {
  for (const m of MODULES) {
    const it = m.items.find((i) => i.id === id);
    if (it) return itemTekst(it.id, it.text, taal);
  }
  return id;
}

export function SummaryPanel({ answers, taal = STANDAARD_TAAL }: { answers: Answer[]; taal?: Taal }) {
  const t = maakVertaler(taal);
  const classItems = classificationItems();
  const need = answers.filter((a) => a.classification === "need");
  const nice = answers.filter((a) => a.classification === "nice");
  const notNeeded = answers.filter((a) => a.classification === "not-needed");
  const critical = answers.filter((a) => a.critical);
  const conflicts = answers.filter((a) => a.conflict);
  const total = classItems.length;
  const classified = need.length + nice.length + notNeeded.length;

  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-24 space-y-4">
        <div className="rounded-lg border border-card-border bg-card p-4">
          <h4 className="mb-3 font-semibold text-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_sum_profiel_opbouw")}
          </h4>
          <div className="space-y-2.5">
            <Bar label="Need to have" value={need.length} total={total || 1} color="hsl(var(--primary))" />
            <Bar label="Nice to have" value={nice.length} total={total || 1} color="hsl(var(--chart-4))" />
            <Bar label="Not needed" value={notNeeded.length} total={total || 1} color="hsl(var(--muted-foreground))" />
          </div>
          <div className="mt-3 border-t border-border pt-2 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
            {t("t4r_comp_sum_geclassificeerd")
              .replace("{n}", String(classified))
              .replace("{total}", String(total))}
          </div>
        </div>

        <div className="rounded-lg border border-card-border bg-card p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[hsl(var(--chart-4))]">
            <Star size={13} fill="currentColor" />
            <h4 className="font-semibold" style={{ fontSize: "var(--text-sm)" }}>
              {t("t4r_comp_sum_kritische_sc")}
            </h4>
          </div>
          {critical.length ? (
            <ul className="space-y-1.5">
              {critical.map((a) => (
                <li key={a.itemId} className="text-muted-foreground" style={{ fontSize: "var(--text-xs)", lineHeight: 1.4 }}>
                  {itemText(a.itemId, taal)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
              {t("t4r_comp_sum_geen_criteria")}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-card-border bg-card p-4">
          <div className="mb-2 flex items-center gap-1.5 text-destructive">
            <AlertTriangle size={13} />
            <h4 className="font-semibold" style={{ fontSize: "var(--text-sm)" }}>
              {t("t4r_comp_sum_discussiepunten")}
            </h4>
          </div>
          {conflicts.length ? (
            <ul className="space-y-1.5">
              {conflicts.map((a) => (
                <li key={a.itemId} className="text-muted-foreground" style={{ fontSize: "var(--text-xs)", lineHeight: 1.4 }}>
                  {itemText(a.itemId, taal)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
              {t("t4r_comp_sum_geen_punten")}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between" style={{ fontSize: "var(--text-xs)" }}>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
