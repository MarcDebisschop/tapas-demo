import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Afname, OrganisatieMetSaldo } from "@/lib/types";
import { ShieldCheck, Languages } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

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

export default function Start() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [baseline, setBaseline] = useState(5);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [organisatieId, setOrganisatieId] = useState<string>("geen");

  const { data: organisaties } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });
  const gekozenOrg = organisaties?.find((o) => String(o.id) === organisatieId);

  async function start() {
    if (!name.trim()) {
      toast({ title: t("start_fout_naam_titel"), description: t("start_fout_naam"), variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: t("start_fout_consent_titel"), description: t("start_fout_consent"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/afnames", {
        name: name.trim(),
        company: company.trim() || undefined,
        role: role.trim() || undefined,
        baselineEnergy: baseline,
        consentGiven: true,
        organisatieId: organisatieId !== "geen" ? Number(organisatieId) : undefined,
        taal: uiTaal,
      });
      const afname: Afname = await res.json();
      navigate(`/afname/${afname.id}/deel1`);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      toast({
        title: msg.includes("credits") ? t("start_fout_credits_titel") : t("start_fout_algemeen_titel"),
        description: msg,
        variant: "destructive",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader right={<TaalKiezer uiTaal={uiTaal} setUiTaal={setUiTaal} label={t("taal_kiezer_label")} />} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("start_titel")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("start_intro")}
        </p>

        <Card className="mt-6">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t("start_naam_label")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("start_naam_ph")} data-testid="input-name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">{t("start_bedrijf_label")}</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("algemeen_optioneel")} data-testid="input-company" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t("start_functie_label")}</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("algemeen_optioneel")} data-testid="input-role" />
              </div>
            </div>

            {organisaties && organisaties.length > 0 && (
              <div className="space-y-2">
                <Label>{t("start_afnemer_label")}</Label>
                <Select value={organisatieId} onValueChange={setOrganisatieId}>
                  <SelectTrigger data-testid="select-afnemer"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geen">{t("start_afnemer_geen")}</SelectItem>
                    {organisaties.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)} disabled={o.saldo.beschikbaar < 1}>
                        {o.naam} — {o.saldo.beschikbaar} {t("start_afnemer_beschikbaar")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {gekozenOrg && (
                  <p className="text-xs text-muted-foreground" data-testid="text-afnemer-saldo">
                    {t("start_credit_hint")}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("start_baseline_label")}</Label>
                <span className="text-sm font-semibold text-primary" data-testid="text-baseline-value">{baseline} / 10</span>
              </div>
              <Slider
                value={[baseline]}
                onValueChange={(v) => setBaseline(v[0]!)}
                min={0}
                max={10}
                step={1}
                data-testid="slider-baseline"
              />
              <p className="text-xs text-muted-foreground">
                {t("start_baseline_hint")}
              </p>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{t("start_consent_titel")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("start_consent_uitleg")}
                  </p>
                  <label className="flex items-center gap-2 pt-1 text-sm text-foreground">
                    <Checkbox checked={consent} onCheckedChange={(c) => setConsent(Boolean(c))} data-testid="checkbox-consent" />
                    {t("start_consent_checkbox")}
                  </label>
                </div>
              </div>
            </div>

            <Button onClick={start} disabled={submitting} className="w-full" size="lg" data-testid="button-confirm-start">
              {submitting ? t("start_knop_bezig") : t("start_knop")}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
