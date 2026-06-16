import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, ArrowRight, Briefcase, Languages } from "lucide-react";
import type { Session } from "@/t4r/lib/t4r-schema";
import { statusLabel as statusLabelI18n } from "@/t4r/library-i18n";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

type OrgMetSaldo = { id: number; naam: string; saldo?: { beschikbaar?: number } };

function TaalKiezer({ uiTaal, setUiTaal, label }: { uiTaal: Taal; setUiTaal: (t: Taal) => void; label: string }) {
  return (
    <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
      <SelectTrigger className="h-9 w-auto gap-1.5 px-2.5" data-testid="select-ui-taal" aria-label={label}>
        <Languages className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TALEN.map((taal) => (
          <SelectItem key={taal} value={taal} data-testid={`option-taal-${taal}`}>
            {TAAL_CODES[taal]} · {TAAL_NAMEN[taal]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * T4Recruitment — facilitator-startscherm (ingeplugde versie).
 * ------------------------------------------------------------------
 * Toont de eigen T4R-sessies en laat de facilitator een nieuw
 * rolprofiel-traject starten. Bij het aanmaken hangt het traject aan
 * een platform-sessie (Fase 2) zodat het sessietarief (credits) via de
 * collaboratieve laag wordt gereserveerd zodra de kring vergrendelt.
 */

export default function T4RHome() {
  const [, navigate] = useLocation();
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);
  const [open, setOpen] = useState(false);
  const { data: sessions } = useQuery<Session[]>({ queryKey: ["/api/t4r/sessions"] });
  const { data: organisaties } = useQuery<OrgMetSaldo[]>({ queryKey: ["/api/organisaties"] });

  const [form, setForm] = useState({
    functionTitle: "",
    orgLabel: "",
    roleType: "",
    roleLevel: "",
    fillMode: "live",
    endMoment: "",
  });

  // Betaalbron: precies één van beide (organisatie-credits OF licentiesleutel).
  const [betaalwijze, setBetaalwijze] = useState<"organisatie" | "licentie">("organisatie");
  const [organisatieId, setOrganisatieId] = useState<string>("");
  const [licentieSleutel, setLicentieSleutel] = useState<string>("");
  const [fout, setFout] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      setFout(null);
      // 1) Platform-sessie aanmaken (draagt de credits / collaboratieve kring).
      const betaalbron =
        betaalwijze === "organisatie"
          ? { organisatieId: Number(organisatieId) }
          : { licentieSleutel: licentieSleutel.trim() };
      const platformRes = await apiRequest("POST", "/api/sessies", {
        titel: form.functionTitle || t("t4r_home_dialog_titel"),
        taal: uiTaal,
        ...betaalbron,
      });
      const platform = await platformRes.json();
      // 2) T4R-inhoudsessie aanmaken, gekoppeld aan de platform-sessie.
      const res = await apiRequest("POST", "/api/t4r/sessions", {
        ...form,
        platformSessieId: platform.id,
      });
      return res.json();
    },
    onSuccess: (s: Session) => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions"] });
      setOpen(false);
      navigate(`/t4r/sessie/${s.id}`);
    },
    onError: (e: unknown) => {
      setFout(e instanceof Error ? e.message : t("t4r_home_aanmaken_mislukt"));
    },
  });

  const betaalbronValid =
    betaalwijze === "organisatie" ? !!organisatieId : !!licentieSleutel.trim();
  const valid =
    form.functionTitle.trim() &&
    form.orgLabel.trim() &&
    form.roleType.trim() &&
    form.roleLevel.trim() &&
    form.endMoment.trim() &&
    betaalbronValid;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-3">
            <Link href="/">
              <a className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-platform">
                {t("algemeen_platform")}
              </a>
            </Link>
            <TaalKiezer uiTaal={uiTaal} setUiTaal={setUiTaal} label={t("taal_kiezer_label")} />
          </div>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Hero */}
        <section className="mb-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-primary">
            {t("t4r_home_eyebrow")}
          </p>
          <h1
            className="font-serif font-semibold tracking-tight text-foreground"
            style={{ fontSize: "var(--text-xl)" }}
          >
            {t("t4r_home_titel")}
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {t("t4r_home_intro")}
          </p>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="mt-6" data-testid="button-new-session">
                <Plus className="mr-2 h-4 w-4" />
                {t("t4r_home_nieuw_knop")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif">{t("t4r_home_dialog_titel")}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="functionTitle">{t("t4r_home_functietitel")}</Label>
                  <Input
                    id="functionTitle"
                    value={form.functionTitle}
                    onChange={(e) => setForm({ ...form, functionTitle: e.target.value })}
                    placeholder={t("t4r_home_functietitel_ph")}
                    data-testid="input-function-title"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="orgLabel">{t("t4r_home_org")}</Label>
                  <Input
                    id="orgLabel"
                    value={form.orgLabel}
                    onChange={(e) => setForm({ ...form, orgLabel: e.target.value })}
                    placeholder={t("t4r_home_org_ph")}
                    data-testid="input-org-label"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="roleType">{t("t4r_home_roltype")}</Label>
                    <Select
                      value={form.roleType}
                      onValueChange={(v) => setForm({ ...form, roleType: v })}
                    >
                      <SelectTrigger id="roleType" data-testid="select-role-type">
                        <SelectValue placeholder={t("t4r_home_kies")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leidinggevend">{t("t4r_home_roltype_leidinggevend")}</SelectItem>
                        <SelectItem value="expert">{t("t4r_home_roltype_expert")}</SelectItem>
                        <SelectItem value="ondersteunend">{t("t4r_home_roltype_ondersteunend")}</SelectItem>
                        <SelectItem value="commercieel">{t("t4r_home_roltype_commercieel")}</SelectItem>
                        <SelectItem value="project">{t("t4r_home_roltype_project")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="roleLevel">{t("t4r_home_rolniveau")}</Label>
                    <Select
                      value={form.roleLevel}
                      onValueChange={(v) => setForm({ ...form, roleLevel: v })}
                    >
                      <SelectTrigger id="roleLevel" data-testid="select-role-level">
                        <SelectValue placeholder={t("t4r_home_kies")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">{t("t4r_home_niveau_junior")}</SelectItem>
                        <SelectItem value="medior">{t("t4r_home_niveau_medior")}</SelectItem>
                        <SelectItem value="senior">{t("t4r_home_niveau_senior")}</SelectItem>
                        <SelectItem value="strategisch">{t("t4r_home_niveau_strategisch")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="endMoment">{t("t4r_home_afrondmoment")}</Label>
                  <Input
                    id="endMoment"
                    type="date"
                    value={form.endMoment}
                    onChange={(e) => setForm({ ...form, endMoment: e.target.value })}
                    data-testid="input-end-moment"
                  />
                </div>

                {/* Betaalbron — precies één: organisatie-credits OF licentie. */}
                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <Label className="mb-2 block">{t("t4r_home_betaalbron")}</Label>
                  <div className="mb-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={betaalwijze === "organisatie" ? "default" : "outline"}
                      onClick={() => setBetaalwijze("organisatie")}
                      data-testid="button-pay-org"
                    >
                      {t("t4r_home_org_credits")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={betaalwijze === "licentie" ? "default" : "outline"}
                      onClick={() => setBetaalwijze("licentie")}
                      data-testid="button-pay-licentie"
                    >
                      {t("t4r_home_licentie")}
                    </Button>
                  </div>
                  {betaalwijze === "organisatie" ? (
                    <Select value={organisatieId} onValueChange={setOrganisatieId}>
                      <SelectTrigger data-testid="select-org">
                        <SelectValue placeholder={t("t4r_home_kies_org")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(organisaties ?? []).map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            {o.naam}
                            {o.saldo?.beschikbaar != null
                              ? ` · ${o.saldo.beschikbaar} ${t("t4r_home_credits")}`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={licentieSleutel}
                      onChange={(e) => setLicentieSleutel(e.target.value)}
                      placeholder={t("t4r_home_licentie_ph")}
                      data-testid="input-licentie"
                    />
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("t4r_home_tarief_hint")}
                  </p>
                </div>

                {fout && (
                  <p className="text-sm text-destructive" data-testid="text-error">
                    {fout}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!valid || create.isPending}
                  data-testid="button-create-session"
                >
                  {create.isPending ? t("t4r_home_aanmaken_bezig") : t("t4r_home_aanmaken")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        {/* Sessielijst */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("t4r_home_lopend")}
          </h2>
          {!sessions || sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t("t4r_home_leeg")}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sessions.map((s) => (
                <Link key={s.id} href={`/t4r/sessie/${s.id}`}>
                  <a
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover-elevate"
                    data-testid={`card-session-${s.id}`}
                  >
                    <div>
                      <p className="font-medium text-foreground">{s.functionTitle}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {s.orgLabel} · {s.roleType} · {s.roleLevel}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                        data-testid={`status-${s.id}`}
                      >
                        {statusLabelI18n(s.status, uiTaal)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
