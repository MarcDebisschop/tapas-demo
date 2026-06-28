import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShieldCheck, UserPlus, Languages, Award, Lock } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import { PLATFORMDELEN, type Platformdeel } from "@shared/platformdelen";

interface BeheerderMetToegang {
  id: number;
  naam: string;
  email: string;
  organisatie: string;
  isPrior: boolean;
  toegevoegdDoor: string | null;
  actief: boolean;
  createdAt: string;
  toegang: Record<string, boolean>;
}

const QK = "/api/toegang/beheerders";

export default function AdminToegang() {
  const { toast } = useToast();
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  // Handelende prior beheerder (governance-actor). Default = eerste actieve prior.
  const [actorId, setActorId] = useState<string>("");

  // Stap 1: minimale lijst (id + naam) om de actor-kiezer te vullen. Deze open
  // endpoint lekt geen e-mailadressen. Stap 2: zodra een prior-actor gekozen is,
  // halen we de volledige lijst (incl. toegang-matrix) op met ?actorId=.
  const { data: minimaalLijst } = useQuery<BeheerderMetToegang[]>({ queryKey: [QK] });
  const priors = useMemo(
    () => (minimaalLijst ?? []).filter((b) => b.isPrior && b.actief),
    [minimaalLijst],
  );
  const effectActor = actorId || (priors[0] ? String(priors[0].id) : "");

  const { data: volledigeLijst, isLoading } = useQuery<BeheerderMetToegang[]>({
    queryKey: [`${QK}?actorId=${effectActor}`],
    enabled: !!effectActor,
  });
  const beheerders = volledigeLijst;

  const modules = PLATFORMDELEN.filter((d) => d.type === "module");
  const accreditaties = PLATFORMDELEN.filter((d) => d.type === "accreditatie");

  // Nieuwe beheerder dialog.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nbNaam, setNbNaam] = useState("");
  const [nbEmail, setNbEmail] = useState("");
  const [nbOrg, setNbOrg] = useState("");
  const [nbPrior, setNbPrior] = useState(false);
  const [bezig, setBezig] = useState(false);

  const naam = (d: Platformdeel) => d.naam[uiTaal] ?? d.naam.nl;
  const omschrijving = (d: Platformdeel) => d.omschrijving[uiTaal] ?? d.omschrijving.nl;

  function vereisActor(): string | null {
    if (!effectActor) {
      toast({ title: t("tg_titel"), description: t("tg_geen_actor"), variant: "destructive" });
      return null;
    }
    return effectActor;
  }

  async function toggleToegang(b: BeheerderMetToegang, deelId: string, waarde: boolean) {
    const actor = vereisActor();
    if (!actor) return;
    try {
      await apiRequest("POST", "/api/toegang/zet", {
        actorId: Number(actor),
        beheerderId: b.id,
        platformdeel: deelId,
        toegestaan: waarde,
      });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith(QK) });
    } catch (e: any) {
      toast({ title: t("tg_fout"), description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  async function toggleActief(b: BeheerderMetToegang) {
    const actor = vereisActor();
    if (!actor) return;
    try {
      await apiRequest("POST", `/api/toegang/beheerders/${b.id}/actief`, {
        actorId: Number(actor),
        actief: !b.actief,
      });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith(QK) });
      toast({ title: t("tg_titel"), description: t("tg_opgeslagen") });
    } catch (e: any) {
      toast({ title: t("tg_fout"), description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  async function maakBeheerder() {
    const actor = vereisActor();
    if (!actor) return;
    setBezig(true);
    try {
      await apiRequest("POST", "/api/toegang/beheerders", {
        actorId: Number(actor),
        naam: nbNaam.trim(),
        email: nbEmail.trim(),
        organisatie: nbPrior ? "TaPasCity" : (nbOrg.trim() || "TaPasCity"),
        isPrior: nbPrior,
        actief: true,
      });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith(QK) });
      toast({ title: t("tg_titel"), description: t("tg_opgeslagen") });
      setDialogOpen(false);
      setNbNaam("");
      setNbEmail("");
      setNbOrg("");
      setNbPrior(false);
    } catch (e: any) {
      toast({ title: t("tg_fout"), description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
                <SelectTrigger className="h-8 w-[112px]" data-testid="select-ui-taal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TALEN.map((code) => (
                    <SelectItem key={code} value={code} data-testid={`option-ui-taal-${code}`}>
                      {TAAL_NAMEN[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/admin">
              <Button size="sm" variant="outline" data-testid="link-admin">← Admin beheer</Button>
            </Link>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("tg_titel")}</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t("tg_intro")}</p>

        {/* Actor-kiezer */}
        <Card className="mt-6">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Label>{t("tg_actor")}</Label>
              <Select value={effectActor} onValueChange={setActorId}>
                <SelectTrigger className="w-[260px]" data-testid="select-actor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priors.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} data-testid={`option-actor-${p.id}`}>
                      {p.naam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("tg_actor_hint")}</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-nieuwe-beheerder">
              <UserPlus className="mr-1.5 h-4 w-4" /> {t("tg_nieuwe_beheerder")}
            </Button>
          </CardContent>
        </Card>

        {/* Beheerders + toegangsmatrix */}
        {isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {(beheerders ?? []).map((b) => (
              <Card key={b.id} data-testid={`card-beheerder-${b.id}`} className={b.actief ? "" : "opacity-70"}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-foreground" data-testid={`text-naam-${b.id}`}>{b.naam}</span>
                        {b.isPrior && (
                          <Badge variant="outline" className="border-accent/30 bg-accent/15 text-accent" data-testid={`badge-prior-${b.id}`}>
                            <Award className="mr-1 h-3 w-3" /> {t("tg_prior")}
                          </Badge>
                        )}
                        {!b.actief && (
                          <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive" data-testid={`badge-disabled-${b.id}`}>
                            <Lock className="mr-1 h-3 w-3" /> {t("tg_gedisabled")}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {b.email} · {b.organisatie}
                        {b.toegevoegdDoor ? ` · ${t("tg_toegevoegd_door")}: ${b.toegevoegdDoor}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActief(b)}
                      data-testid={`button-actief-${b.id}`}
                    >
                      {b.actief ? t("tg_deactiveer") : t("tg_heractiveer")}
                    </Button>
                  </div>

                  {/* Modules */}
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("tg_modules")}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {modules.map((d) => (
                        <label
                          key={d.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/50 px-3 py-2"
                          data-testid={`row-${b.id}-${d.id}`}
                        >
                          <span className="text-sm text-foreground">{naam(d)}</span>
                          <Switch
                            checked={!!b.toegang[d.id]}
                            disabled={!b.actief || b.isPrior}
                            onCheckedChange={(v) => toggleToegang(b, d.id, v)}
                            data-testid={`switch-${b.id}-${d.id}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Accreditatie */}
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("tg_accreditatie")}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {accreditaties.map((d) => (
                        <label
                          key={d.id}
                          className="flex items-start justify-between gap-3 rounded-md border px-3 py-2"
                          style={{ borderColor: "hsl(var(--gold) / 0.5)", background: "hsl(var(--gold) / 0.06)" }}
                          data-testid={`row-${b.id}-${d.id}`}
                        >
                          <span className="text-sm">
                            <span className="font-medium" style={{ color: "hsl(var(--gold))" }}>{naam(d)}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{omschrijving(d)}</span>
                          </span>
                          <Switch
                            checked={!!b.toegang[d.id]}
                            disabled={!b.actief || b.isPrior}
                            onCheckedChange={(v) => toggleToegang(b, d.id, v)}
                            data-testid={`switch-${b.id}-${d.id}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-nieuwe-beheerder">
          <DialogHeader>
            <DialogTitle>{t("tg_nieuwe_beheerder")}</DialogTitle>
            <DialogDescription>{t("tg_veld_prior_hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="nb-naam">{t("tg_veld_naam")}</Label>
              <Input id="nb-naam" value={nbNaam} onChange={(e) => setNbNaam(e.target.value)} data-testid="input-nb-naam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-email">{t("tg_veld_email")}</Label>
              <Input id="nb-email" type="email" value={nbEmail} onChange={(e) => setNbEmail(e.target.value)} data-testid="input-nb-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nb-org">{t("tg_veld_org")}</Label>
              <Input
                id="nb-org"
                value={nbPrior ? "TaPasCity" : nbOrg}
                disabled={nbPrior}
                onChange={(e) => setNbOrg(e.target.value)}
                data-testid="input-nb-org"
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="text-sm">
                <span className="font-medium text-foreground">{t("tg_veld_prior")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t("tg_veld_prior_hint")}</span>
              </span>
              <Switch checked={nbPrior} onCheckedChange={setNbPrior} data-testid="switch-nb-prior" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-nb-annuleer">
              {t("tg_annuleren")}
            </Button>
            <Button onClick={maakBeheerder} disabled={bezig || !nbNaam.trim() || !nbEmail.trim()} data-testid="button-nb-opslaan">
              {t("tg_toevoegen")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
