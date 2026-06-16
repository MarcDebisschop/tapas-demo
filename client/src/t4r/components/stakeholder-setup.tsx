import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useStakeholders, usePatchSession } from "../lib/session-data";
import type { Session } from "../lib/t4r-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import {
  STANDAARD_TAAL,
  maakVertaler,
  type Taal,
} from "@shared/i18n";

const STAKEHOLDER_ROLES = [
  "Opdrachtgever / hiring manager",
  "Directe leidinggevende",
  "HR-verantwoordelijke / talentpartner",
  "Inhoudelijk expert / rolkenner",
  "Externe facilitator / TaPas-begeleider",
];

export function StakeholderSetup({ session, taal = STANDAARD_TAAL }: { session: Session; taal?: Taal }) {
  const t = maakVertaler(taal);
  const { data: stakeholders } = useStakeholders(session.id);
  const patch = usePatchSession(session.id);
  const [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState({
    name: "",
    stakeholderRole: STAKEHOLDER_ROLES[0],
    systemRole: "stakeholder",
  });

  const add = useMutation({
    mutationFn: async () => {
      const voting = form.systemRole !== "observer";
      const res = await apiRequest("POST", `/api/t4r/sessions/${session.id}/stakeholders`, {
        ...form,
        voting,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", session.id, "stakeholders"] });
      setForm({ ...form, name: "" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/stakeholders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", session.id, "stakeholders"] }),
  });

  const voting = (stakeholders ?? []).filter((s) => s.voting);
  const canClose = voting.length >= 2 && confirmed;

  const closeRing = () => {
    patch.mutate({ closedRing: true, status: "geopend" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div>
          <h2 className="text-foreground" style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
            {t("t4r_comp_sh_titel")}
          </h2>
          <p className="mt-1 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_sh_intro")}
          </p>
        </div>

        {/* Toevoegformulier */}
        <div className="rounded-lg border border-card-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              data-testid="input-stakeholder-name"
              placeholder={t("t4r_comp_sh_naam_placeholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select value={form.stakeholderRole} onValueChange={(v) => setForm({ ...form, stakeholderRole: v })}>
              <SelectTrigger data-testid="select-stakeholder-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAKEHOLDER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              data-testid="button-add-stakeholder"
              disabled={!form.name.trim() || add.isPending}
              onClick={() => add.mutate()}
            >
              <Plus size={16} className="mr-1" /> {t("t4r_comp_sh_toevoegen")}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
              {t("t4r_comp_sh_systeemrol")}
            </span>
            <Select value={form.systemRole} onValueChange={(v) => setForm({ ...form, systemRole: v })}>
              <SelectTrigger data-testid="select-system-role" className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facilitator">{t("t4r_comp_sh_facilitator")}</SelectItem>
                <SelectItem value="stakeholder">{t("t4r_comp_sh_stemgerechtigd")}</SelectItem>
                <SelectItem value="observer">{t("t4r_comp_sh_observer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lijst */}
        <div className="overflow-hidden rounded-lg border border-card-border">
          <table>
            <thead className="bg-sidebar text-muted-foreground">
              <tr style={{ fontSize: "var(--text-xs)" }}>
                <th className="px-4 py-2.5 text-left font-medium">{t("t4r_comp_sh_col_naam")}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t("t4r_comp_sh_col_rol")}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t("t4r_comp_sh_col_systeemrol")}</th>
                <th className="px-4 py-2.5 text-left font-medium">{t("t4r_comp_sh_col_stem")}</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {(stakeholders ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border" data-testid={`row-stakeholder-${s.id}`} style={{ fontSize: "var(--text-sm)" }}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.stakeholderRole}</td>
                  <td className="px-4 py-2.5 capitalize text-muted-foreground">{s.systemRole}</td>
                  <td className="px-4 py-2.5">
                    {s.voting ? (
                      <span className="text-primary" style={{ fontSize: "var(--text-xs)" }}>
                        {t("t4r_comp_sh_stem_ja")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
                        {t("t4r_comp_sh_stem_nee")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!session.closedRing && (
                      <button
                        data-testid={`button-remove-stakeholder-${s.id}`}
                        onClick={() => remove.mutate(s.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(stakeholders ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
                    {t("t4r_comp_sh_geen_stakeholders")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sluitingsgate */}
      <div className="lg:pt-12">
        <div className="rounded-lg border border-card-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ShieldCheck size={18} />
            <h3 className="font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>
              {t("t4r_comp_sh_sluiting_titel")}
            </h3>
          </div>
          <p className="mb-4 text-muted-foreground" style={{ fontSize: "var(--text-sm)" }}>
            {t("t4r_comp_sh_sluiting_intro")}
          </p>

          {voting.length < 2 && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-border bg-background p-3 text-muted-foreground" style={{ fontSize: "var(--text-xs)" }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{t("t4r_comp_sh_min_twee")}</span>
            </div>
          )}

          <label className="mb-4 flex cursor-pointer items-start gap-2.5">
            <Checkbox
              data-testid="checkbox-confirm-ring"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(!!v)}
              className="mt-0.5"
            />
            <span className="text-foreground" style={{ fontSize: "var(--text-sm)", lineHeight: 1.4 }}>
              {t("t4r_comp_sh_bevestig_sluiting")}
            </span>
          </label>

          <Button data-testid="button-close-ring" className="w-full" disabled={!canClose || patch.isPending} onClick={closeRing}>
            <Lock size={15} className="mr-1.5" /> {t("t4r_comp_sh_open_sessie")}
          </Button>
        </div>
      </div>
    </div>
  );
}
