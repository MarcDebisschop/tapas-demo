import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODULES } from "@/t4r/library";
import { vertaalModule, zoneLabel } from "@/t4r/library-i18n";
import { Eye, Lock, CheckCircle2, Info, ShieldCheck, Languages } from "lucide-react";
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

/**
 * T4Recruitment — kringlid-/deelnemerscherm op de publieke link /r/:token.
 * ------------------------------------------------------------------
 * Een kringlid komt binnen via zijn persoonlijke, rolgebonden link.
 * Observers krijgen alleen-lezen; stakeholders geven hun individuele
 * perspectief per profielmodule. Die input voedt de alignmentsessie die
 * de facilitator faciliteert — de beslissing steunt op alignment (kan ik
 * er existentieel achter staan?), niet op kortetermijnconsensus.
 *
 * De input wordt als vrije-vorm contract bewaard via PUT /api/r/:token/input;
 * de facilitator blijft eigenaar van het canonieke rolprofiel.
 */

// De modules waarop een kringlid zinvol een perspectief kan geven
// (profielbouw + finalisatie); contextkalibratie blijft facilitatorwerk.
const PERSPECTIEF_MODULES = MODULES.filter(
  (m) => m.zone === "profielbouw" || m.zone === "finalisatie",
);

type RView = {
  rol: "facilitator" | "stakeholder" | "observer";
  readOnly: boolean;
  naam: string | null;
  lidId: number;
  sessie: {
    id: number;
    titel: string;
    taal: string;
    status: string;
    kringVergrendeld: boolean;
    sessieState: Record<string, unknown> | null;
  };
};

export default function T4RDeelnemer() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const { data, isLoading, isError } = useQuery<RView>({
    queryKey: ["/api/r", token],
    enabled: !!token,
  });

  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);
  const perspectiefModules = PERSPECTIEF_MODULES.map((m) => vertaalModule(m, uiTaal));
  const [perspectief, setPerspectief] = useState<Record<string, string>>({});
  const [algemeen, setAlgemeen] = useState("");
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [taalAangepast, setTaalAangepast] = useState(false);

  // Initiële interfacetaal volgt de sessietaal, tenzij de deelnemer zelf kiest.
  useEffect(() => {
    if (data?.sessie?.taal && !taalAangepast) {
      setUiTaal(normaliseerTaal(data.sessie.taal));
    }
  }, [data?.sessie?.taal, taalAangepast]);

  function kiesTaal(taal: Taal) {
    setTaalAangepast(true);
    setUiTaal(taal);
  }

  const bewaar = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/r/${token}/input`, {
        perspectief,
        algemeen,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Opslaan mislukt");
      }
      return res.json();
    },
    onSuccess: () => {
      setOpgeslagen(true);
      setTimeout(() => setOpgeslagen(false), 2500);
      queryClient.invalidateQueries({ queryKey: ["/api/r", token] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader right={<TaalKiezer uiTaal={uiTaal} setUiTaal={kiesTaal} label={t("taal_kiezer_label")} />} />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted-foreground">
          {t("t4r_dn_laden")}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader right={<TaalKiezer uiTaal={uiTaal} setUiTaal={kiesTaal} label={t("taal_kiezer_label")} />} />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-muted-foreground">
            {t("t4r_dn_ongeldig")}
          </p>
        </div>
      </div>
    );
  }

  const readOnly = data.readOnly;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader right={<TaalKiezer uiTaal={uiTaal} setUiTaal={kiesTaal} label={t("taal_kiezer_label")} />} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Kop */}
        <header className="mb-6">
          <p className="mb-1 text-sm font-medium uppercase tracking-wide text-primary">
            {t("t4r_dn_eyebrow")}
          </p>
          <h1
            className="font-serif font-semibold text-foreground"
            style={{ fontSize: "var(--text-xl)" }}
          >
            {data.sessie.titel}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            {readOnly ? (
              <>
                <Eye className="h-4 w-4" /> {t("t4r_dn_observer")}
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> {t("t4r_dn_welkom")}{data.naam ? `, ${data.naam}` : ""}. {t("t4r_dn_welkom_rest")}
              </>
            )}
          </p>
        </header>

        {/* Alignment-kader */}
        <div className="mb-6 flex gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            {t("t4r_dn_alignment_kader")}
          </p>
        </div>

        {data.sessie.kringVergrendeld ? (
          <>
            {/* Perspectief per profielmodule */}
            <div className="space-y-5">
              {perspectiefModules.map((m) => (
                <section key={m.key} className="rounded-lg border border-border bg-card p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
                    {zoneLabel(m.zone, uiTaal)}
                  </p>
                  <h2
                    className="mb-1 font-serif font-semibold text-foreground"
                    style={{ fontSize: "var(--text-base)" }}
                  >
                    {m.title}
                  </h2>
                  <p className="mb-3 text-sm text-muted-foreground">{m.intro}</p>
                  <Textarea
                    value={perspectief[m.key] ?? ""}
                    onChange={(e) =>
                      setPerspectief((p) => ({ ...p, [m.key]: e.target.value }))
                    }
                    placeholder={t("t4r_dn_perspectief_ph")}
                    rows={3}
                    disabled={readOnly}
                    data-testid={`textarea-${m.key}`}
                  />
                </section>
              ))}

              <section className="rounded-lg border border-border bg-card p-4">
                <h2
                  className="mb-1 font-serif font-semibold text-foreground"
                  style={{ fontSize: "var(--text-base)" }}
                >
                  {t("t4r_dn_alignment_titel")}
                </h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  {t("t4r_dn_alignment_intro")}
                </p>
                <Textarea
                  value={algemeen}
                  onChange={(e) => setAlgemeen(e.target.value)}
                  placeholder={t("t4r_dn_alignment_ph")}
                  rows={4}
                  disabled={readOnly}
                  data-testid="textarea-algemeen"
                />
              </section>
            </div>

            {!readOnly && (
              <div className="mt-6 flex items-center gap-3">
                <Button
                  onClick={() => bewaar.mutate()}
                  disabled={bewaar.isPending}
                  data-testid="button-save-input"
                >
                  {bewaar.isPending ? t("t4r_dn_bewaar_bezig") : t("t4r_dn_bewaar")}
                </Button>
                {opgeslagen && (
                  <span className="flex items-center gap-1 text-sm text-primary" data-testid="text-saved">
                    <CheckCircle2 className="h-4 w-4" /> {t("t4r_dn_bewaard")}
                  </span>
                )}
                {bewaar.isError && (
                  <span className="text-sm text-destructive">
                    {(bewaar.error as Error)?.message}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex gap-3 rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {t("t4r_dn_vergrendeld_wacht")}
          </div>
        )}
      </main>
    </div>
  );
}
