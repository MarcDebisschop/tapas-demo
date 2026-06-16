import { useParams, Link } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  useSession,
  useStakeholders,
  useAnswers,
  usePatchSession,
} from "@/t4r/lib/session-data";
import { MODULES } from "@/t4r/library";
import { vertaalModules, zoneLabel, statusLabel } from "@/t4r/library-i18n";
import { AppHeader } from "@/components/Brand";
import { StakeholderSetup } from "@/t4r/components/stakeholder-setup";
import { ModuleRender } from "@/t4r/components/module-render";
import { SummaryPanel } from "@/t4r/components/summary-panel";
import { ReportView } from "@/t4r/components/report-view";
import { MatchModule } from "@/t4r/components/match-module";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Lock,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  Languages,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

/**
 * T4Recruitment — facilitator-sessiescherm (ingeplugde versie).
 * ------------------------------------------------------------------
 * Eén-op-één overgenomen stappenlogica uit de stand-alone app, met een
 * extra collaboratieve schil: het kringbeheer (uitnodigingen per rol)
 * draait op de platform-sessie (Fase 2). Het vergrendelen van de kring
 * reserveert het sessietarief via PATCH .../sessions/:id { closedRing }.
 */

// --- Kringtypes (platform-sessie, Fase 2) ----------------------------------
type Kringlid = {
  id: number;
  rol: "facilitator" | "stakeholder" | "observer";
  naam: string | null;
  email: string | null;
  inviteToken: string;
  status: string;
};
type PlatformSessie = {
  id: number;
  titel: string;
  status: string;
  kringVergrendeld: boolean;
  kring: Kringlid[];
};

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

export default function T4RSession() {
  const params = useParams();
  const id = Number(params.id);
  const { data: session } = useSession(id);
  const { data: stakeholders } = useStakeholders(id);
  const { data: answers } = useAnswers(id);
  const patch = usePatchSession(id);

  const [step, setStep] = useState(0);
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  if (!session) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="mx-auto max-w-5xl px-4 py-20 text-center text-muted-foreground">
          {t("t4r_sessie_laden")}
        </div>
      </div>
    );
  }

  const ans = answers ?? [];
  const sh = stakeholders ?? [];

  // step 0 = kringbeheer + stakeholdersetup; 1..N = modules; N+1 = rapport; N+2 = match
  const modules = vertaalModules(uiTaal);
  const inModules = step >= 1 && step <= modules.length;
  const currentModule = inModules ? modules[step - 1] : null;
  const onReport = step === MODULES.length + 1;
  const onMatch = step === MODULES.length + 2;
  const locked = session.status === "vergrendeld";

  const steps: { label: string; zone: string }[] = [
    { label: t("t4r_sessie_kring"), zone: "sessie" },
    ...modules.map((m) => ({ label: m.title, zone: m.zone })),
    { label: t("t4r_sessie_rolprofiel"), zone: "finalisatie" },
    { label: t("t4r_sessie_vergelijkende_studie"), zone: "finalisatie" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-3">
            <TaalKiezer uiTaal={uiTaal} setUiTaal={setUiTaal} label={t("taal_kiezer_ui_label")} />
            <Link href="/t4r">
              <a className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-t4r-home">
                {t("t4r_sessie_alle_trajecten")}
              </a>
            </Link>
          </div>
        }
      />

      {/* Sessiekop */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <h1
            className="font-serif font-semibold text-foreground"
            style={{ fontSize: "var(--text-lg)" }}
          >
            {session.functionTitle}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {session.orgLabel} · {session.roleType} · {session.roleLevel} ·{" "}
            <span className="font-medium">
              {statusLabel(session.status, uiTaal)}
            </span>
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 sm:px-6">
        {/* Stepper-zijbalk */}
        <nav className="hidden w-56 shrink-0 lg:block">
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <StepItem
                key={i}
                index={i}
                label={s.label}
                zone={s.zone}
                active={step === i}
                onClick={() => setStep(i)}
              />
            ))}
          </ol>
        </nav>

        {/* Hoofdgebied */}
        <main className="min-w-0 flex-1">
          {step === 0 && (
            <div className="space-y-6">
              <KringBeheer session={session} locked={locked} taal={uiTaal} />
              <StakeholderSetup session={session} taal={uiTaal} />
            </div>
          )}

          {inModules && currentModule && (
            <div className="space-y-6">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
                  {zoneLabel(currentModule.zone, uiTaal)}
                </p>
                <h2
                  className="font-serif font-semibold text-foreground"
                  style={{ fontSize: "var(--text-lg)" }}
                >
                  {currentModule.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{currentModule.intro}</p>
              </div>

              <ModuleRender sessionId={id} module={currentModule} answers={ans} taal={uiTaal} />

              {(currentModule.zone === "profielbouw" ||
                currentModule.zone === "finalisatie") && <SummaryPanel answers={ans} taal={uiTaal} />}
            </div>
          )}

          {onReport && (
            <ReportView
              session={session}
              stakeholders={sh}
              answers={ans}
              onLock={() => patch.mutate({ status: "vergrendeld" })}
              locked={locked}
              taal={uiTaal}
            />
          )}

          {onMatch && <MatchModule session={session} stakeholders={sh} answers={ans} taal={uiTaal} />}

          {/* Navigatie */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              data-testid="button-prev"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("t4r_sessie_vorige")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("t4r_sessie_stap_van")
                .replace("{stap}", String(step + 1))
                .replace("{totaal}", String(steps.length))}
            </span>
            <Button
              disabled={step === steps.length - 1}
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              data-testid="button-next"
            >
              {t("t4r_sessie_volgende")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Stepper-item ----------------------------------------------------------
function StepItem({
  index,
  label,
  active,
  onClick,
}: {
  index: number;
  label: string;
  zone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover-elevate ${
          active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground"
        }`}
        data-testid={`step-${index}`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {index + 1}
        </span>
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

// --- Kringbeheer (collaboratieve schil op de platform-sessie) --------------
function KringBeheer({
  session,
  locked,
  taal,
}: {
  session: { id: number; platformSessieId?: number | null };
  locked: boolean;
  taal: Taal;
}) {
  const t = maakVertaler(taal);
  const platformId = session.platformSessieId ?? null;
  const { data: platform } = useQuery<PlatformSessie>({
    queryKey: ["/api/sessies", platformId],
    enabled: !!platformId,
  });

  const [rol, setRol] = useState<"stakeholder" | "observer">("stakeholder");
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [gekopieerd, setGekopieerd] = useState<number | null>(null);
  const [vergrendelFout, setVergrendelFout] = useState<string | null>(null);

  const voegToe = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sessies/${platformId}/kring`, {
        rol,
        naam: naam || undefined,
        email: email || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      setNaam("");
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/sessies", platformId] });
    },
  });

  const verwijder = useMutation({
    mutationFn: async (lidId: number) => {
      await apiRequest("DELETE", `/api/sessies/${platformId}/kring/${lidId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sessies", platformId] }),
  });

  const vergrendel = useMutation({
    mutationFn: async () => {
      setVergrendelFout(null);
      // Sluit de kring in de T4R-inhoud: dit reserveert via de brug het
      // sessietarief op de platform-sessie (PATCH .../sessions/:id closedRing).
      const res = await apiRequest("PATCH", `/api/t4r/sessions/${session.id}`, {
        closedRing: true,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Vergrendelen mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t4r/sessions", session.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessies", platformId] });
    },
    onError: (e: unknown) => {
      setVergrendelFout(e instanceof Error ? e.message : "Vergrendelen mislukt");
    },
  });

  const kopieer = (lid: Kringlid) => {
    const link = `${window.location.origin}/#/r/${lid.inviteToken}`;
    navigator.clipboard.writeText(link);
    setGekopieerd(lid.id);
    setTimeout(() => setGekopieerd(null), 1500);
  };

  if (!platformId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        {t("t4r_sessie_geen_platform")}
      </div>
    );
  }

  const kring = platform?.kring ?? [];
  const kringVergrendeld = platform?.kringVergrendeld ?? false;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="font-serif font-semibold text-foreground" style={{ fontSize: "var(--text-base)" }}>
          {t("t4r_sessie_aanwervingskring")}
        </h2>
        {kringVergrendeld && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> {t("t4r_sessie_kring_vergrendeld")}
          </span>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        {t("t4r_sessie_kring_intro")}
      </p>

      {/* Lijst van kringleden */}
      {kring.length > 0 && (
        <ul className="mb-4 divide-y divide-border rounded-md border border-border">
          {kring.map((lid) => (
            <li key={lid.id} className="flex items-center gap-3 px-3 py-2.5">
              {lid.rol === "observer" ? (
                <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <Users className="h-4 w-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {lid.naam || t("t4r_sessie_naamloos")}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {lid.rol === "observer" ? "observer" : "stakeholder"}
                  </span>
                </p>
                {lid.email && (
                  <p className="truncate text-xs text-muted-foreground">{lid.email}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{lid.status}</span>
              <button
                onClick={() => kopieer(lid)}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover-elevate"
                title={t("t4r_sessie_link_kopieren")}
                data-testid={`button-copy-${lid.id}`}
              >
                {gekopieerd === lid.id ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              {!kringVergrendeld && (
                <button
                  onClick={() => verwijder.mutate(lid.id)}
                  className="rounded-md border border-border p-1.5 text-muted-foreground hover-elevate"
                  title={t("t4r_sessie_verwijderen")}
                  data-testid={`button-remove-${lid.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Toevoegen */}
      {!kringVergrendeld && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">{t("t4r_sessie_rol_label")}</label>
            <Select value={rol} onValueChange={(v) => setRol(v as "stakeholder" | "observer")}>
              <SelectTrigger className="w-36" data-testid="select-kring-rol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stakeholder">Stakeholder</SelectItem>
                <SelectItem value="observer">Observer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">{t("t4r_sessie_naam_label")}</label>
            <Input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder={t("t4r_sessie_naam_placeholder")}
              className="w-40"
              data-testid="input-kring-naam"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">{t("t4r_sessie_email_label")}</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("t4r_sessie_email_placeholder")}
              className="w-48"
              data-testid="input-kring-email"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => voegToe.mutate()}
            disabled={voegToe.isPending}
            data-testid="button-add-kringlid"
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("t4r_sessie_toevoegen")}
          </Button>
        </div>
      )}

      {/* Vergrendelen */}
      {!locked && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("t4r_sessie_vergrendel_intro")}
            </p>
            <Button
              onClick={() => vergrendel.mutate()}
              disabled={vergrendel.isPending || kring.length === 0}
              data-testid="button-lock-ring"
            >
              <Lock className="mr-1 h-4 w-4" />
              {t("t4r_sessie_kring_vergrendelen")}
            </Button>
          </div>
          {vergrendelFout && (
            <p className="mt-2 text-sm text-destructive" data-testid="text-lock-error">
              {vergrendelFout}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
