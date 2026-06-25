import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import type { Afname, OrganisatieMetSaldo } from "@/lib/types";
import { Copy, Check, Send, UserPlus, Bell, Languages, Settings2, ChartColumn, GraduationCap, Mail, KeyRound } from "lucide-react";
import { LegeStaat } from "@/components/LegeStaat";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  DATE_LOCALE,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

// Statuslabels per taal — gebonden aan de admin-interfacetaal.
const STATUS_LABEL: Record<Taal, Record<string, string>> = {
  nl: {
    uitgenodigd: "Uitgenodigd",
    deel1: "Bezig (deel 1)",
    deel2: "Bezig (deel 2)",
    voltooid: "Voltooid",
    consent: "Toestemming",
    geannuleerd: "Geannuleerd",
  },
  fr: {
    uitgenodigd: "Invité",
    deel1: "En cours (partie 1)",
    deel2: "En cours (partie 2)",
    voltooid: "Terminé",
    consent: "Consentement",
    geannuleerd: "Annulé",
  },
  en: {
    uitgenodigd: "Invited",
    deel1: "In progress (part 1)",
    deel2: "In progress (part 2)",
    voltooid: "Completed",
    consent: "Consent",
    geannuleerd: "Cancelled",
  },
  es: {
    uitgenodigd: "Invitado",
    deel1: "En curso (parte 1)",
    deel2: "En curso (parte 2)",
    voltooid: "Completado",
    consent: "Consentimiento",
    geannuleerd: "Cancelado",
  },
  ru: {
    uitgenodigd: "Приглашён",
    deel1: "В процессе (часть 1)",
    deel2: "В процессе (часть 2)",
    voltooid: "Завершено",
    consent: "Согласие",
    geannuleerd: "Отменено",
  },
};

// Bovenregel voor de lege-staat-illustratie (vlucht-signatuur).
const EMPTY_OOG: Record<Taal, string> = {
  nl: "NOG NIETS OP DE RADAR",
  fr: "RIEN ENCORE SUR LE RADAR",
  en: "NOTHING ON THE RADAR YET",
  es: "NADA EN EL RADAR TODAV\u00cdA",
  ru: "\u041f\u041e\u041a\u0410 \u041d\u0418\u0427\u0415\u0413\u041e \u041d\u0410 \u0420\u0410\u0414\u0410\u0420\u0415",
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    voltooid: "bg-accent/15 text-accent border-accent/30",
    deel1: "bg-primary/10 text-primary border-primary/20",
    deel2: "bg-primary/10 text-primary border-primary/20",
    uitgenodigd: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
    geannuleerd: "bg-destructive/10 text-destructive border-destructive/20",
    consent: "bg-muted text-muted-foreground border-border",
  };
  return map[status] ?? "bg-muted text-muted-foreground border-border";
}

function deelnemerLink(token: string): string {
  // Hash-routed link die we naar de deelnemer sturen.
  return `${window.location.origin}${window.location.pathname}#/deelnemer/${token}`;
}

export default function Admin() {
  const { toast } = useToast();

  // Admin-interfacetaal = losse voorkeur (React-state, geen localStorage), zonder data-impact.
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);

  const { data, isLoading } = useQuery<Afname[]>({ queryKey: ["/api/admin/afnames"] });
  const { data: organisaties } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });
  const { data: mijnProfiel } = useQuery<{ isPrior: boolean }>({ queryKey: ["/api/admin/me"] });
  const isPrior = mijnProfiel?.isPrior === true;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [invName, setInvName] = useState("");
  const [invCompany, setInvCompany] = useState("");
  const [invRole, setInvRole] = useState("");
  const [invOrg, setInvOrg] = useState("geen");
  const [invNiveau, setInvNiveau] = useState("");
  const [invInstrument, setInvInstrument] = useState("");
  // Afnametaal = vaste eigenschap, vastgelegd bij aanmaken van de uitnodiging.
  const [invTaal, setInvTaal] = useState<Taal>(STANDAARD_TAAL);
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Wachtwoord-wijzigen dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwHuidig, setPwHuidig] = useState("");
  const [pwNieuw, setPwNieuw] = useState("");
  const [pwBevestig, setPwBevestig] = useState("");
  const [pwBezig, setPwBezig] = useState(false);

  // Instruments query
  const { data: instruments } = useQuery<{ id: number; naam: string; flowType: string }[]>({ queryKey: ["/api/instruments"] });
  const individueleInstruments = (instruments ?? []).filter((i) => i.flowType === "individual");

  const NIVEAU_OPTIES = ["cxo", "kader", "expert", "medewerker", "admin"];
  const NIVEAU_LABELS: Record<string, Record<string, string>> = {
    nl: { cxo: "CXO / Directie", kader: "Kader / Management", expert: "Expert / Specialist", medewerker: "Medewerker", admin: "Administratief" },
    fr: { cxo: "DG / Direction", kader: "Cadre / Management", expert: "Expert / Sp\u00e9cialiste", medewerker: "Employ\u00e9", admin: "Administratif" },
    en: { cxo: "CXO / Director", kader: "Manager", expert: "Expert / Specialist", medewerker: "Employee", admin: "Administrative" },
    es: { cxo: "DG / Direcci\u00f3n", kader: "Mando / Gesti\u00f3n", expert: "Experto / Especialista", medewerker: "Empleado", admin: "Administrativo" },
    ru: { cxo: "\u0414\u0438\u0440\u0435\u043a\u0442\u043e\u0440", kader: "\u041c\u0435\u043d\u0435\u0434\u0436\u0435\u0440", expert: "\u042d\u043a\u0441\u043f\u0435\u0440\u0442", medewerker: "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a", admin: "\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u0438\u0432\u043d\u044b\u0439" },
  };

  const gekozenOrg = organisaties?.find((o) => String(o.id) === invOrg);

  function resetPwDialog() {
    setPwHuidig("");
    setPwNieuw("");
    setPwBevestig("");
  }

  async function wijzigWachtwoord() {
    if (pwNieuw !== pwBevestig) {
      toast({ title: t("admin_pw_titel"), description: t("admin_pw_mismatch"), variant: "destructive" });
      return;
    }
    setPwBezig(true);
    try {
      await apiRequest("POST", "/api/admin/wachtwoord-wijzigen", { huidigWachtwoord: pwHuidig, nieuwWachtwoord: pwNieuw });
      toast({ title: t("admin_pw_titel"), description: t("admin_pw_succes") });
      setPwDialogOpen(false);
      resetPwDialog();
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      toast({ title: t("admin_pw_titel"), description: msg, variant: "destructive" });
    } finally {
      setPwBezig(false);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
      toast({ title: t("admin_toast_gekopieerd_titel"), description: t("admin_toast_gekopieerd") });
    } catch {
      toast({ title: t("admin_toast_gekopieerd_titel"), description: text, variant: "destructive" });
    }
  }

  async function maakUitnodiging() {
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/uitnodigingen", {
        name: invName.trim() || undefined,
        company: invCompany.trim() || undefined,
        role: invRole.trim() || undefined,
        roleLevel: invNiveau || undefined,
        organisatieId: invOrg !== "geen" ? Number(invOrg) : undefined,
        taal: invTaal,
        instrumentId: invInstrument || undefined,
      });
      const inv: Afname = await res.json();
      const link = deelnemerLink(inv.inviteToken!);
      setCreatedLink(link);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/afnames"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organisaties"] });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      toast({
        title: msg.includes("credits") ? t("admin_credit_hint") : t("admin_dialog_titel"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function markeerHerinnerd(id: number) {
    try {
      await apiRequest("POST", `/api/afnames/${id}/herinner`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/afnames"] });
      toast({ title: t("admin_herinnerd"), description: t("admin_herinnerd") });
    } catch (e: any) {
      toast({ title: "—", description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  function resetDialog() {
    setInvName("");
    setInvCompany("");
    setInvRole("");
    setInvOrg("geen");
    setInvNiveau("");
    setInvInstrument("");
    setInvTaal(STANDAARD_TAAL);
    setCreatedLink(null);
  }

  const openOrganisaties = organisaties && organisaties.length > 0;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            {/* Admin-interfacetaal: losse voorkeur, geen data-impact */}
            <div className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-muted-foreground" aria-hidden />
              <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
                <SelectTrigger className="h-8 w-[112px]" data-testid="select-ui-taal" aria-label={t("admin_ui_taal")}>
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
            <Link href="/admin/credits">
              <Button size="sm" variant="outline" data-testid="link-credits">{t("admin_credits")}</Button>
            </Link>
            <Link href="/admin/toegang">
              <Button size="sm" variant="outline" data-testid="link-toegang">{t("tg_nav")}</Button>
            </Link>
            <Link href="/admin/coaches">
              <Button size="sm" variant="outline" data-testid="link-coaches">{t("admin_nav_coaches")}</Button>
            </Link>
            <Link href="/admin/inzichten">
              <Button size="sm" variant="outline" data-testid="link-inzichten">
                <ChartColumn className="mr-1.5 h-4 w-4" />{t("iz_nav")}
              </Button>
            </Link>
            <Link href="/admin/academy">
              <Button size="sm" variant="outline" data-testid="link-academy-beheer">
                <GraduationCap className="mr-1.5 h-4 w-4" />{t("acad_admin_nav")}
              </Button>
            </Link>
            <Link href="/admin/mailbeheer">
              <Button size="sm" variant="outline" data-testid="link-mailbeheer">
                <Mail className="mr-1.5 h-4 w-4" />{t("mailbeheer_nav")}
              </Button>
            </Link>
            <Link href="/coach">
              <Button size="sm" variant="outline" data-testid="link-coach-omgeving">{t("admin_nav_coach_omgeving")}</Button>
            </Link>
            {isPrior && (
              <Link href="/admin/vraagbeheer">
                <Button size="sm" variant="outline" data-testid="link-vraagbeheer">
                  <Settings2 className="mr-1.5 h-4 w-4" /> Vraagbeheer
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetDialog(); setDialogOpen(true); }}
              data-testid="button-open-invite"
            >
              <UserPlus className="mr-1.5 h-4 w-4" /> {t("admin_nodig_uit")}
            </Button>
            <Link href="/start">
              <Button size="sm" data-testid="link-new-afname">{t("admin_nieuwe_afname")}</Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetPwDialog(); setPwDialogOpen(true); }}
              data-testid="button-open-wachtwoord"
            >
              <KeyRound className="mr-1.5 h-4 w-4" /> {t("admin_pw_nav")}
            </Button>
          </div>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("admin_titel")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("admin_intro")}</p>

        <Card className="mt-6">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !data || data.length === 0 ? (
              <LegeStaat
                oog={EMPTY_OOG[uiTaal]}
                titel={t("admin_geen_afnames")}
                body={t("admin_geen_afnames_hint")}
                actie={
                  <Button onClick={() => { resetDialog(); setDialogOpen(true); }} data-testid="button-empty-invite">
                    <UserPlus className="mr-1.5 h-4 w-4" /> {t("admin_nodig_uit")}
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin_col_code")}</TableHead>
                    <TableHead>{t("admin_col_naam")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("admin_col_org")}</TableHead>
                    <TableHead>{t("admin_col_status")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("admin_col_taal")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("admin_col_aangemaakt")}</TableHead>
                    <TableHead className="text-right">{t("admin_col_actie")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a) => {
                    const isInvite = a.status === "uitgenodigd";
                    const link = a.inviteToken ? deelnemerLink(a.inviteToken) : null;
                    const aTaal = normaliseerTaal(a.taal);
                    return (
                      <TableRow key={a.id} data-testid={`row-afname-${a.id}`}>
                        <TableCell className="font-medium text-foreground">{a.respondentCode}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{a.company || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(a.status)} data-testid={`status-${a.id}`}>
                            {STATUS_LABEL[uiTaal][a.status] ?? a.status}
                          </Badge>
                          {isInvite && a.herinnerdAt && (
                            <span className="ml-1.5 text-xs text-muted-foreground" data-testid={`text-reminded-${a.id}`}>
                              {t("admin_herinnerd")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-xs font-medium uppercase text-muted-foreground" data-testid={`text-taal-${a.id}`}>
                            {TAAL_CODES[aTaal]}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {new Date(a.createdAt).toLocaleDateString(DATE_LOCALE[uiTaal])}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isInvite && link && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyToClipboard(link, `row-${a.id}`)}
                                  data-testid={`button-copy-${a.id}`}
                                >
                                  {copiedId === `row-${a.id}` ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                                  <span className="ml-1 hidden sm:inline">{t("admin_knop_link")}</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markeerHerinnerd(a.id)}
                                  data-testid={`button-remind-${a.id}`}
                                  title={t("admin_herinnerd")}
                                >
                                  <Bell className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Link href={`/admin/${a.id}`}>
                              <Button variant="outline" size="sm" data-testid={`button-open-${a.id}`}>{t("admin_open")}</Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetDialog(); }}>
        <DialogContent data-testid="dialog-invite">
          <DialogHeader>
            <DialogTitle>{t("admin_dialog_titel")}</DialogTitle>
            <DialogDescription>{t("admin_dialog_uitleg")}</DialogDescription>
          </DialogHeader>

          {!createdLink ? (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="inv-name">{t("admin_veld_naam_opt")}</Label>
                <Input id="inv-name" value={invName} onChange={(e) => setInvName(e.target.value)} placeholder={t("admin_veld_naam_ph")} data-testid="input-invite-name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="inv-company">{t("admin_veld_bedrijf_opt")}</Label>
                  <Input id="inv-company" value={invCompany} onChange={(e) => setInvCompany(e.target.value)} data-testid="input-invite-company" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-role">{t("admin_veld_functie_opt")}</Label>
                  <Input id="inv-role" value={invRole} onChange={(e) => setInvRole(e.target.value)} data-testid="input-invite-role" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("veld_niveau_opt")}</Label>
                <Select value={invNiveau || "geen"} onValueChange={(v) => setInvNiveau(v === "geen" ? "" : v)}>
                  <SelectTrigger data-testid="select-invite-role-level"><SelectValue placeholder={t("veld_kies_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geen">&mdash;</SelectItem>
                    {NIVEAU_OPTIES.map((n) => (
                      <SelectItem key={n} value={n}>{NIVEAU_LABELS[uiTaal]?.[n] ?? n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {individueleInstruments.length > 1 && (
                <div className="space-y-2">
                  <Label>{t("admin_veld_instrument")}</Label>
                  <Select value={invInstrument || "standaard"} onValueChange={(v) => setInvInstrument(v === "standaard" ? "" : v)}>
                    <SelectTrigger data-testid="select-invite-instrument"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standaard">Standaard</SelectItem>
                      {individueleInstruments.map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>{i.naam}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Afnametaal: vaste eigenschap die meegaat in de uitnodiging */}
              <div className="space-y-2">
                <Label>{t("admin_veld_taal")}</Label>
                <Select value={invTaal} onValueChange={(v) => setInvTaal(normaliseerTaal(v))}>
                  <SelectTrigger data-testid="select-invite-taal"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TALEN.map((code) => (
                      <SelectItem key={code} value={code} data-testid={`option-invite-taal-${code}`}>
                        {TAAL_NAMEN[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("admin_veld_taal_hint")}</p>
              </div>
              {openOrganisaties && (
                <div className="space-y-2">
                  <Label>{t("admin_veld_afnemer")}</Label>
                  <Select value={invOrg} onValueChange={setInvOrg}>
                    <SelectTrigger data-testid="select-invite-org"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geen">{t("admin_afnemer_geen")}</SelectItem>
                      {organisaties!.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)} disabled={o.saldo.beschikbaar < 1}>
                          {o.naam} — {o.saldo.beschikbaar} {t("admin_afnemer_beschikbaar")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {gekozenOrg && (
                    <p className="text-xs text-muted-foreground">{t("admin_credit_hint")}</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 py-1">
              <div className="flex items-center gap-2 text-sm font-medium text-accent">
                <Check className="h-4 w-4" /> {t("admin_link_aangemaakt")}
              </div>
              <p className="text-sm text-muted-foreground">{t("admin_link_kopieer_hint")}</p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
                <code className="flex-1 truncate text-xs text-foreground" data-testid="text-created-link">{createdLink}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdLink, "dialog")}
                  data-testid="button-copy-created"
                >
                  {copiedId === "dialog" ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-1">{t("admin_knop_kopieer")}</span>
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {!createdLink ? (
              <Button onClick={maakUitnodiging} disabled={submitting} data-testid="button-create-invite">
                <Send className="mr-1.5 h-4 w-4" />
                {submitting ? t("admin_knop_bezig") : t("admin_knop_link_aanmaken")}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetDialog} data-testid="button-another-invite">
                  {t("admin_knop_nog_een")}
                </Button>
                <Button onClick={() => { setDialogOpen(false); resetDialog(); }} data-testid="button-close-invite">
                  {t("admin_knop_klaar")}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wachtwoord-wijzigen dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={(o) => { setPwDialogOpen(o); if (!o) resetPwDialog(); }}>
        <DialogContent data-testid="dialog-wachtwoord">
          <DialogHeader>
            <DialogTitle>{t("admin_pw_titel")}</DialogTitle>
            <DialogDescription>{t("admin_pw_uitleg")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="pw-huidig">{t("admin_pw_huidig")}</Label>
              <Input id="pw-huidig" type="password" autoComplete="current-password" value={pwHuidig} onChange={(e) => setPwHuidig(e.target.value)} data-testid="input-pw-huidig" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-nieuw">{t("admin_pw_nieuw")}</Label>
              <Input id="pw-nieuw" type="password" autoComplete="new-password" value={pwNieuw} onChange={(e) => setPwNieuw(e.target.value)} data-testid="input-pw-nieuw" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-bevestig">{t("admin_pw_bevestig")}</Label>
              <Input id="pw-bevestig" type="password" autoComplete="new-password" value={pwBevestig} onChange={(e) => setPwBevestig(e.target.value)} data-testid="input-pw-bevestig" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={wijzigWachtwoord} disabled={pwBezig || !pwHuidig || !pwNieuw || !pwBevestig} data-testid="button-pw-wijzigen">
              {pwBezig ? t("admin_knop_bezig") : t("admin_pw_titel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
