import { useState } from "react";
import { useLocation, useParams } from "wouter";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Afname } from "@/lib/types";
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2, Globe, Info } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  normaliseerTaal,
  maakVertaler,
  type Taal,
} from "@shared/i18n";

interface UitnodigingView {
  afnameId: number;
  token: string;
  name: string;
  company: string | null;
  role: string | null;
  status: string;
  taal: Taal;
  reedsGestart: boolean;
  voltooid: boolean;
}

export default function Deelnemer() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [baseline, setBaseline] = useState(5);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);

  const { data, isLoading, isError } = useQuery<UitnodigingView>({
    queryKey: ["/api/uitnodigingen", token],
    enabled: !!token,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Vul de velden + taal voor met wat de beheerder al meegaf (eenmalig).
  if (data && !prefilled) {
    if (data.name) setName(data.name);
    if (data.company) setCompany(data.company);
    if (data.role) setRole(data.role);
    setTaal(normaliseerTaal(data.taal));
    setPrefilled(true);
  }

  // Vertaal alle UI in de (eventueel gewisselde) taal van de deelnemer.
  const t = maakVertaler(taal);

  async function start() {
    if (!data) return;
    if (!name.trim()) {
      toast({ title: t("fout_naam_ontbreekt_titel"), description: t("fout_naam_ontbreekt"), variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: t("fout_consent_titel"), description: t("fout_consent"), variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/uitnodigingen/${token}/start`, {
        name: name.trim(),
        company: company.trim() || undefined,
        role: role.trim() || undefined,
        baselineEnergy: baseline,
        consentGiven: true,
        taal,
      });
      const afname: Afname = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/uitnodigingen", token] });
      navigate(`/afname/${afname.id}/deel1`);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      toast({ title: t("fout_start_titel"), description: msg, variant: "destructive" });
      setSubmitting(false);
    }
  }

  // --- Laad-status ---
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 sm:px-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" data-testid="status-loading" />
          <p className="mt-3 text-sm text-muted-foreground">Even geduld…</p>
        </main>
      </div>
    );
  }

  // --- Ongeldige / verlopen link ---
  if (isError || !data) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" data-testid="status-invalid" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("link_ongeldig_titel")}</h1>
              <p className="max-w-md text-sm text-muted-foreground">{t("link_ongeldig_tekst")}</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Reeds voltooid ---
  if (data.voltooid) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-accent" data-testid="status-voltooid" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("link_voltooid_titel")}</h1>
              <p className="max-w-md text-sm text-muted-foreground">{t("link_voltooid_tekst")}</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Reeds gestart maar nog niet klaar: ga verder ---
  if (data.reedsGestart) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-accent" data-testid="status-gestart" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("link_gestart_titel")}</h1>
              <p className="max-w-md text-sm text-muted-foreground">{t("link_gestart_tekst")}</p>
              <Button
                onClick={() => navigate(`/afname/${data.afnameId}/${data.status === "deel2" ? "deel2" : "deel1"}`)}
                size="lg"
                data-testid="button-verder"
              >
                {t("knop_verder")}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // --- Landingsscherm: taalkeuze + toestemming + baseline + identiteit ---
  const taalGewijzigd = taal !== normaliseerTaal(data.taal);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("deel_welkom_titel")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("deel_welkom_intro")}</p>

        <Card className="mt-6">
          <CardContent className="space-y-5 p-6">
            {/* Taal-escape-hatch: kies de taal van de volledige keten vóór de start. */}
            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 flex-shrink-0 text-primary" />
                <Label htmlFor="taal">{t("taal_kiezer_label")}</Label>
              </div>
              <Select value={taal} onValueChange={(v) => setTaal(normaliseerTaal(v))}>
                <SelectTrigger id="taal" data-testid="select-taal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TALEN.map((code) => (
                    <SelectItem key={code} value={code} data-testid={`option-taal-${code}`}>
                      {TAAL_NAMEN[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {taalGewijzigd && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="text-taal-waarschuwing">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {t("taal_kiezer_waarschuwing")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t("veld_naam_verplicht")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("veld_naam_placeholder")} data-testid="input-name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company">{t("veld_bedrijf")}</Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t("optioneel")} data-testid="input-company" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t("veld_functie")}</Label>
                <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("optioneel")} data-testid="input-role" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("veld_baseline")}</Label>
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
              <p className="text-xs text-muted-foreground">{t("veld_baseline_hint")}</p>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{t("consent_titel")}</p>
                  <p className="text-sm text-muted-foreground">{t("consent_uitleg")}</p>
                  <label className="flex items-center gap-2 pt-1 text-sm text-foreground">
                    <Checkbox checked={consent} onCheckedChange={(c) => setConsent(Boolean(c))} data-testid="checkbox-consent" />
                    {t("consent_checkbox")}
                  </label>
                </div>
              </div>
            </div>

            <Button onClick={start} disabled={submitting} className="w-full" size="lg" data-testid="button-confirm-start">
              {submitting ? t("knop_start_bezig") : t("knop_start")}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
