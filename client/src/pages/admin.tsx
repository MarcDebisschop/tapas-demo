import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { useAdminAuth } from "@/components/AdminLoginGate";
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
import { Copy, Check, Send, UserPlus, Bell, Languages, Settings2, ChartColumn, GraduationCap, Mail, KeyRound, Users, CreditCard, BarChart2, Building2, ArrowRight, Layers, Euro, FileSpreadsheet, Sparkles, Power, MonitorPlay, Palette, Network, LogOut, ShieldCheck } from "lucide-react";
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
import { useUiTaal } from "@/contexts/TaalContext";
import {
  LEEFTIJDSBANDEN,
  isMinderjarigInstrument,
  toegestaneBandenVoor,
  vereistOuderlijkeToestemming,
} from "@shared/leeftijd";

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
  // De afmeldweg komt uit de poort zelf: die kent de sessie en wist ze.
  const { afmelden } = useAdminAuth();

  // Admin-interfacetaal = losse voorkeur (React-state, geen localStorage), zonder data-impact.
  const { uiTaal, setUiTaal, t } = useUiTaal();

  const { data, isLoading } = useQuery<Afname[]>({ queryKey: ["/api/admin/afnames"] });
  const { data: organisaties } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });
  // De scope komt van de server, uit dezelfde bron als de guards. `isPrior`
  // alleen volstaat niet: prior is `isPrior` EN de prior-organisatie, dus een
  // scherm dat enkel naar de vlag kijkt zou ruimer zijn dan wat de server
  // toestaat. Zichtbaarheid is hier een kwestie van rust in het scherm; de
  // echte grendel zit op de server.
  const { data: mijnProfiel } = useQuery<{
    isPrior: boolean;
    scope?: "prior" | "organisatie" | "geen";
    organisatieId?: number | null;
    organisatieNaam?: string | null;
  }>({ queryKey: ["/api/admin/me"] });
  // Staat er een verzendweg ingesteld? Zolang dat niet zo is, mag het scherm geen
  // verzending beloven; het zegt dat dan vooraf in plaats van achteraf.
  const { data: mailweg } = useQuery<{ ingesteld: boolean }>({ queryKey: ["/api/admin/mailweg"] });
  const isPrior = mijnProfiel?.scope === "prior";
  const eigenOrganisatieNaam = mijnProfiel?.organisatieNaam ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [invName, setInvName] = useState("");
  const [invCompany, setInvCompany] = useState("");
  const [invRole, setInvRole] = useState("");
  const [invOrg, setInvOrg] = useState("geen");
  const [invNiveau, setInvNiveau] = useState("");
  const [invInstrument, setInvInstrument] = useState("");
  // Afnametaal = vaste eigenschap, vastgelegd bij aanmaken van de uitnodiging.
  const [invTaal, setInvTaal] = useState<Taal>(STANDAARD_TAAL);
  // Het adres waarnaar de uitnodiging mag vertrekken, en bij de instrumenten voor
  // minderjarigen: wie dat adres toebehoort en in welke leeftijdsgroep de
  // deelnemer zit. Die twee zijn daar geen extra vragen maar de voorwaarde om
  // überhaupt een adres te mogen bewaren (AVG art. 8).
  const [invEmail, setInvEmail] = useState("");
  const [invOntvangerRol, setInvOntvangerRol] = useState("deelnemer");
  const [invBand, setInvBand] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  // Wat er met het bericht gebeurde bij het aanmaken: de stand zoals de server ze
  // meldt, plus de toelichting. Het scherm beweert nooit meer dan dit.
  const [mailUitkomst, setMailUitkomst] = useState<{ status: string; melding: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Wachtwoord-wijzigen dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwHuidig, setPwHuidig] = useState("");
  const [pwNieuw, setPwNieuw] = useState("");
  const [pwBevestig, setPwBevestig] = useState("");
  const [pwBezig, setPwBezig] = useState(false);

  // Instruments query
  // De registry-endpoint (/api/instruments) levert instrumentId (string),
  // name en flowType. Eerder stond hier ten onrechte { id:number; naam } —
  // waardoor de instrumentkoppeling in de uitnodiging leeg bleef.
  const { data: instruments } = useQuery<{ instrumentId: string; name: string; flowType: string }[]>({ queryKey: ["/api/instruments"] });
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

  // Eén weg naar de server, met of zonder verzending. Het adres gaat altijd mee
  // wanneer het ingevuld is: ook zonder verstuurwens is het nuttig, want dan kan de
  // herinnering later wel vertrekken zonder dat iemand het adres moet opzoeken.
  async function maakUitnodiging(verstuur: boolean) {
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
        deelnemerEmail: invEmail.trim() || undefined,
        ontvangerRol: invEmail.trim() ? ontvangerRol : undefined,
        leeftijdsband: invBand || undefined,
        verstuurMail: verstuur || undefined,
        // De server kent het publieke adres niet uit zichzelf; het bericht heeft het
        // nodig om een link te kunnen bevatten die werkelijk opent.
        origin: `${window.location.origin}${window.location.pathname}`,
      });
      const inv: Afname = await res.json();
      const link = deelnemerLink(inv.inviteToken!);
      setCreatedLink(link);
      if (verstuur && inv.mailStatus) {
        setMailUitkomst({ status: inv.mailStatus, melding: inv.mailMelding ?? "" });
      } else {
        setMailUitkomst(null);
      }
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

  // De belknop. Die stond hier als "markeer herinnerd" en zette alleen een datum;
  // nu vertrekt er werkelijk een herinnering wanneer er een adres bekend is. De
  // melding zegt precies wat er gebeurde, ook wanneer dat "niets" is.
  async function verstuurHerinnering(id: number) {
    try {
      const res = await apiRequest("POST", `/api/afnames/${id}/herinner`, {
        origin: `${window.location.origin}${window.location.pathname}`,
      });
      const uit: Afname = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/afnames"] });
      const gelukt = uit.mailStatus === "verstuurd";
      toast({
        title: t("admin_herinnering_titel"),
        description:
          uit.mailStatus === "geen-adres"
            ? t("admin_herinnering_geen_adres")
            : (uit.mailMelding ?? (gelukt ? t("admin_mail_verstuurd") : t("admin_mail_fout"))),
        variant: gelukt ? undefined : "destructive",
      });
    } catch (e: any) {
      toast({
        title: t("admin_herinnering_titel"),
        description: String(e?.message ?? e),
        variant: "destructive",
      });
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
    setInvEmail("");
    setInvOntvangerRol("deelnemer");
    setInvBand("");
    setCreatedLink(null);
    setMailUitkomst(null);
  }

  // Welk instrument staat er gekozen? Leeg betekent het standaardinstrument, en dat
  // is nooit een instrument voor minderjarigen; daarom volstaat de gekozen waarde.
  const vraagtLeeftijdsgroep = isMinderjarigInstrument(invInstrument || null);
  const bandenVoorInstrument = toegestaneBandenVoor(invInstrument || null) ?? LEEFTIJDSBANDEN;
  // Onder de drempel mag het adres niet van de jongere zelf zijn. Het scherm zegt
  // dat vooraf; de server houdt dezelfde regel aan en is de echte grendel.
  const moetNaarVerantwoordelijke =
    vraagtLeeftijdsgroep && !!invBand && vereistOuderlijkeToestemming(invInstrument || null, invBand as any);
  // Wie "de deelnemer zelf" koos en daarna een leeftijdsgroep onder de drempel
  // aanwijst, staat met een keuze die niet meer mag. Dan schuift het scherm naar
  // "ouder" in plaats van een leeg keuzeveld te tonen; de beheerder kan nog altijd
  // voogd of begeleider kiezen.
  const ontvangerRol =
    moetNaarVerantwoordelijke && invOntvangerRol === "deelnemer" ? "ouder" : invOntvangerRol;

  // Enkel de prior kiest vrij een afnemer. Een organisatiebeheerder heeft maar
  // een mogelijke keuze en de server legt die toch al op; een dropdown met een
  // enkel item suggereert onterecht dat er iets te kiezen valt.
  const openOrganisaties = isPrior && organisaties && organisaties.length > 0;

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
            {/* Snelknoppen — data-testid's bewaard voor compatibiliteit */}
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
            {/* Afmelden. Zonder deze knop bleef een sessie 24 uur openstaan en
                was er geen enkele weg terug naar de aanmeldpoort: wie eenmaal
                binnen was, kwam een dag lang zonder wachtwoord binnen. */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => { void afmelden(); }}
              data-testid="button-admin-afmelden"
            >
              <LogOut className="mr-1.5 h-4 w-4" /> Afmelden
            </Button>
          </div>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("admin_titel")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("admin_intro")}</p>

        {/* Organisatiecontext: maak zichtbaar wiens gegevens dit scherm toont,
            zodat niemand platformcijfers vermoedt waar er organisatiecijfers
            staan. */}
        {eigenOrganisatieNaam && (
          <p className="mt-1 text-sm font-medium text-foreground" data-testid="tekst-organisatiecontext">
            U bekijkt: {eigenOrganisatieNaam}
          </p>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* CLUSTERTEGELS — R32: 4 groepen, alle data-testid's bewaard       */}
        {/* ---------------------------------------------------------------- */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cluster 1: Deelnemers & Afnames */}
          <div className="rounded-xl border border-t-[3px] border-border p-5" style={{ borderTopColor: "hsl(var(--primary))" }}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}>
                <Users className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">Deelnemers</span>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => { resetDialog(); setDialogOpen(true); }}
                data-testid="button-open-invite"
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" /> Uitnodigen
              </button>
              <Link href="/start">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-new-afname">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" /> Nieuwe afname
                </a>
              </Link>
              <Link href="/admin/toegang">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-toegang">
                  <Settings2 className="h-3.5 w-3.5 shrink-0" /> Toegang
                </a>
              </Link>
              <Link href="/admin/bulk-import">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-bulk-import">
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" /> Bulk-import (Excel)
                </a>
              </Link>
            </div>
          </div>

          {/* Cluster 2: Financieel & Credits */}
          <div className="rounded-xl border border-t-[3px] border-border p-5" style={{ borderTopColor: "hsl(142 70% 35%)" }}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "hsl(142 70% 35%/0.1)", color: "hsl(142 70% 35%)" }}>
                <CreditCard className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">Financieel</span>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Link href="/admin/credits">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-credits">
                  <CreditCard className="h-3.5 w-3.5 shrink-0" /> Credits &amp; saldo
                </a>
              </Link>
              {/* Instrument-prijzen en factuur-huisstijl gelden platformbreed
                  en horen dus bij de prior. Credits en saldo blijven wel
                  staan: dat is het eigen saldo van de organisatie. */}
              {isPrior && (
                <>
              <Link href="/admin/prijzen">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-prijzen">
                  <Euro className="h-3.5 w-3.5 shrink-0" /> Instrument-prijzen
                </a>
              </Link>
              <Link href="/admin/factuurhuisstijl">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-factuurhuisstijl">
                  <Palette className="h-3.5 w-3.5 shrink-0" /> Factuur-huisstijl
                </a>
              </Link>
                </>
              )}
            </div>
          </div>

          {/* Cluster 3: Kwaliteit & Inhoud */}
          <div className="rounded-xl border border-t-[3px] border-border p-5" style={{ borderTopColor: "hsl(262 70% 50%)" }}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "hsl(262 70% 50%/0.1)", color: "hsl(262 70% 50%)" }}>
                <BarChart2 className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">Kwaliteit</span>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Link href="/admin/inzichten">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-inzichten">
                  <ChartColumn className="h-3.5 w-3.5 shrink-0" /> Inzichten
                </a>
              </Link>
              <Link href="/admin/kwaliteit">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-kwaliteit-cluster">
                  <BarChart2 className="h-3.5 w-3.5 shrink-0" /> Kwaliteitsmonitor
                </a>
              </Link>
              {/* De bekwaamheidsmodule bestond wel als schermenreeks onder
                  /admin/bekwaamheid, maar stond in geen enkel menu. Ze was dus
                  alleen te bereiken door de adreslijn met de hand in te tikken.
                  Deze regel maakt de reeks vindbaar vanuit het beheerdersplein. */}
              {isPrior && (
                <Link href="/admin/bekwaamheid">
                  <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-bekwaamheid">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Bekwaamheid
                  </a>
                </Link>
              )}
              {isPrior && (
                <Link href="/admin/vraagbeheer">
                  <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-vraagbeheer">
                    <Settings2 className="h-3.5 w-3.5 shrink-0" /> Vraagbeheer
                  </a>
                </Link>
              )}
              {isPrior && (
                <Link href="/admin/duidingbeheer">
                  <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-duidingbeheer">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" /> Duidingsbeheer
                  </a>
                </Link>
              )}
              {isPrior && (
                <Link href="/admin/instrumentengids">
                  <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-instrumentengids">
                    <Layers className="h-3.5 w-3.5 shrink-0" /> Instrumentengids
                  </a>
                </Link>
              )}
              {isPrior && (
                <Link href="/admin/beschikbaarheid">
                  <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-beschikbaarheid">
                    <Power className="h-3.5 w-3.5 shrink-0" /> Instrument-vrijgave
                  </a>
                </Link>
              )}
            </div>
          </div>

          {/* Cluster 4: Organisatie & Communicatie */}
          <div className="rounded-xl border border-t-[3px] border-border p-5" style={{ borderTopColor: "hsl(var(--gold))" }}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "hsl(var(--gold)/0.1)", color: "hsl(var(--gold))" }}>
                <Building2 className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">Organisatie</span>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Link href="/t4o">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-t4o">
                  <Building2 className="h-3.5 w-3.5 shrink-0" /> TaPas 4 Organizations
                </a>
              </Link>
              <Link href="/admin/trajecten">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-regiekamer">
                  <Network className="h-3.5 w-3.5 shrink-0" /> Regiekamer
                </a>
              </Link>
              <Link href="/admin/academy">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-academy-beheer">
                  <GraduationCap className="h-3.5 w-3.5 shrink-0" /> Academy
                </a>
              </Link>
              <Link href="/admin/webinars">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-webinars-beheer">
                  <MonitorPlay className="h-3.5 w-3.5 shrink-0" /> Webinars
                </a>
              </Link>
              <Link href="/admin/mailbeheer">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-mailbeheer">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> Mailbeheer
                </a>
              </Link>
              <Link href="/admin/coaches">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-coaches">
                  <Users className="h-3.5 w-3.5 shrink-0" /> Coaches
                </a>
              </Link>
              <Link href="/coach">
                <a className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground" data-testid="link-coach-omgeving">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" /> Coach-omgeving
                </a>
              </Link>
            </div>
          </div>
        </div>

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
                          {/* De stand van het bericht. Staat er niets, dan vertrok er
                              nooit een bericht, en dat zegt het scherm ook zo. */}
                          {isInvite && (
                            <span
                              className={
                                a.mailStand === "verstuurd"
                                  ? "ml-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                                  : a.mailStand
                                    ? "ml-1.5 text-xs text-amber-600 dark:text-amber-400"
                                    : "ml-1.5 text-xs text-muted-foreground"
                              }
                              data-testid={`text-mailstand-${a.id}`}
                            >
                              {a.mailStand === "verstuurd"
                                ? t("admin_mail_verstuurd")
                                : a.mailStand === "gesimuleerd"
                                  ? t("admin_mail_gesimuleerd")
                                  : a.mailStand === "fout"
                                    ? t("admin_mail_fout")
                                    : t("admin_mail_niets")}
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
                                  onClick={() => verstuurHerinnering(a.id)}
                                  data-testid={`button-remind-${a.id}`}
                                  disabled={a.heeftMailadres === false || mailweg?.ingesteld === false}
                                  title={
                                    a.heeftMailadres === false
                                      ? t("admin_herinnering_geen_adres")
                                      : mailweg?.ingesteld === false
                                        ? t("admin_mail_geen_weg")
                                        : t("admin_herinnering_titel")
                                  }
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
                        <SelectItem key={i.instrumentId} value={i.instrumentId}>{i.name}</SelectItem>
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
              {/* Leeftijdsgroep: alleen bij de instrumenten voor minderjarigen, en
                  daar staat ze vóór het adres, want ze bepaalt naar wie het mag. */}
              {vraagtLeeftijdsgroep && (
                <div className="space-y-2">
                  <Label>{t("admin_veld_leeftijdsband")}</Label>
                  <Select value={invBand || "geen"} onValueChange={(v) => setInvBand(v === "geen" ? "" : v)}>
                    <SelectTrigger data-testid="select-invite-leeftijdsband">
                      <SelectValue placeholder={t("veld_kies_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geen">{t("veld_kies_placeholder")}</SelectItem>
                      {bandenVoorInstrument.map((b) => (
                        <SelectItem key={b} value={b} data-testid={`option-invite-band-${b}`}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("admin_leeftijdsband_hint")}</p>
                </div>
              )}
              {/* Het adres. Blijft leeg mogelijk: dan wordt er enkel een link
                  aangemaakt, precies zoals dit scherm het altijd deed. */}
              <div className="space-y-2">
                <Label htmlFor="inv-email">{t("admin_veld_mail")}</Label>
                <Input
                  id="inv-email"
                  type="email"
                  autoComplete="off"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder={t("admin_veld_mail_ph")}
                  data-testid="input-invite-email"
                />
                <p className="text-xs text-muted-foreground">{t("admin_veld_mail_hint")}</p>
              </div>
              {invEmail.trim() !== "" && (
                <div className="space-y-2">
                  <Label>{t("admin_veld_ontvanger")}</Label>
                  <Select value={ontvangerRol} onValueChange={setInvOntvangerRol}>
                    <SelectTrigger data-testid="select-invite-ontvanger"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {!moetNaarVerantwoordelijke && (
                        <SelectItem value="deelnemer">{t("admin_ontvanger_deelnemer")}</SelectItem>
                      )}
                      <SelectItem value="ouder">{t("admin_ontvanger_ouder")}</SelectItem>
                      <SelectItem value="voogd">{t("admin_ontvanger_voogd")}</SelectItem>
                      <SelectItem value="begeleider">{t("admin_ontvanger_begeleider")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {moetNaarVerantwoordelijke && (
                    <p className="text-xs text-muted-foreground" data-testid="text-invite-verantwoordelijke">
                      {t("admin_mail_naar_verantwoordelijke")}
                    </p>
                  )}
                </div>
              )}
              {/* Geen verzendweg ingesteld: dat hoort de beheerder te weten vóór hij
                  op versturen duwt, niet erna. */}
              {mailweg?.ingesteld === false && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400" data-testid="text-mailweg-waarschuwing">
                  {t("admin_mail_geen_weg")}
                </p>
              )}
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
              {/* De stand van het bericht, in de woorden van de server. Bij een
                  gesimuleerde of mislukte verzending blijft de link eronder de weg
                  naar binnen, dus er gaat niets verloren. */}
              {mailUitkomst && (
                <div
                  className={
                    mailUitkomst.status === "verstuurd"
                      ? "rounded-md border border-accent/30 bg-accent/10 p-2 text-xs text-foreground"
                      : "rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400"
                  }
                  data-testid="text-invite-mailstand"
                >
                  <span className="font-medium">
                    {mailUitkomst.status === "verstuurd"
                      ? t("admin_mail_verstuurd")
                      : mailUitkomst.status === "gesimuleerd"
                        ? t("admin_mail_gesimuleerd")
                        : t("admin_mail_fout")}
                  </span>
                  {mailUitkomst.melding ? <span> {mailUitkomst.melding}</span> : null}
                </div>
              )}
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
              <div className="flex flex-col gap-2 sm:flex-row">
                {/* De oude weg blijft bestaan en blijft volwaardig: een link
                    aanmaken en die zelf doorgeven. */}
                <Button
                  variant="outline"
                  onClick={() => maakUitnodiging(false)}
                  disabled={submitting}
                  data-testid="button-create-invite"
                >
                  {submitting ? t("admin_knop_bezig") : t("admin_knop_alleen_link")}
                </Button>
                <Button
                  onClick={() => maakUitnodiging(true)}
                  disabled={
                    submitting ||
                    invEmail.trim() === "" ||
                    (vraagtLeeftijdsgroep && !invBand) ||
                    mailweg?.ingesteld === false
                  }
                  data-testid="button-create-and-send-invite"
                >
                  <Send className="mr-1.5 h-4 w-4" />
                  {submitting ? t("admin_knop_bezig") : t("admin_knop_aanmaken_versturen")}
                </Button>
              </div>
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
