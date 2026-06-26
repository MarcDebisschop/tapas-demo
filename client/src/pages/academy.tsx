// ---------------------------------------------------------------------------
// Academy (publiek) — gereconstrueerd uit originele bundle (index-CxFhBwUz.js)
// Functienaam in bundle: t8e()
// API: /api/academy/opleidingen, /api/academy/docenten, /api/coaches/publiek
// Routes: /academy (publiek), /academy/jester (iframe galerij)
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import {
  ChevronRight,
  Award,
  GraduationCap,
  MessageCircle,
  Users,
  Star,
  Shield,
  ChevronLeft,
  Home,
} from "lucide-react";

// Scroll naar sectie-id
function scrollNaar(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// Academy avatar (e8e uit bundle)
function CoachAvatar({ naam, fotoPad }: { naam: string; fotoPad?: string }) {
  if (fotoPad) {
    return (
      <img
        src={fotoPad}
        alt={naam}
        className="h-12 w-12 shrink-0 rounded-full object-cover academy-kaart"
        loading="lazy"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full academy-avatar text-base">
      {naam.charAt(0) ?? "?"}
    </div>
  );
}

// Sessie-label helper
function sessieLabel(sessie: any, t: (s: string) => string): string {
  const format =
    sessie.format === "blended"
      ? t("acad_admin_format_blended")
      : sessie.format === "incompany"
      ? t("acad_admin_format_incompany")
      : t("acad_admin_format_online");
  return `${sessie.startdatum} · ${format}${sessie.locatie ? ` · ${sessie.locatie}` : ""}`;
}

// -----------------------------------------------------------------------
// Hoofdcomponent — gereconstrueerd uit t8e() in bundle
// -----------------------------------------------------------------------
export default function Academy() {
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const n = maakVertaler(taal);
  const { toast } = useToast();

  const { data: opleidingenData, isLoading: laadOpl } = useQuery<any[]>({
    queryKey: ["/api/academy/opleidingen"],
  });
  const { data: docentenData, isLoading: laadDoc } = useQuery<any[]>({
    queryKey: ["/api/academy/docenten"],
  });
  const { data: coachesData } = useQuery<any[]>({
    queryKey: ["/api/coaches/publiek"],
  });

  const [geselecteerdeOpl, setGeselecteerdeOpl] = useState<any | null>(null);

  // Inschrijf formulier state
  const [inschrijfType, setInschrijfType] = useState("deelnemer");
  const [inschrijfNaam, setInschrijfNaam] = useState("");
  const [inschrijfEmail, setInschrijfEmail] = useState("");
  const [inschrijfOrg, setInschrijfOrg] = useState("");
  const [inschrijfAantal, setInschrijfAantal] = useState("");
  const [inschrijfSessie, setInschrijfSessie] = useState("geen");
  const [inschrijfBericht, setInschrijfBericht] = useState("");

  function resetInschrijf() {
    setInschrijfType("deelnemer");
    setInschrijfNaam("");
    setInschrijfEmail("");
    setInschrijfOrg("");
    setInschrijfAantal("");
    setInschrijfSessie("geen");
    setInschrijfBericht("");
  }

  const inschrijfMut = useMutation({
    mutationFn: async () => {
      if (!geselecteerdeOpl) throw new Error("Geen opleiding");
      const payload = {
        opleidingId: geselecteerdeOpl.id,
        sessieId: inschrijfSessie !== "geen" ? Number(inschrijfSessie) : null,
        type: inschrijfType,
        naam: inschrijfNaam.trim(),
        email: inschrijfEmail.trim(),
        taal,
        organisatieNaam: inschrijfType === "organisatie" ? inschrijfOrg.trim() : "",
        aantalDeelnemers: inschrijfType === "organisatie" && inschrijfAantal ? Number(inschrijfAantal) : null,
        bericht: inschrijfBericht.trim(),
      };
      return (await apiRequest("POST", "/api/academy/inschrijvingen", payload)).json();
    },
    onSuccess: () => {
      toast({ title: n("acad_inschrijf_succes_titel"), description: n("acad_inschrijf_succes_body") });
      setGeselecteerdeOpl(null);
      resetInschrijf();
    },
    onError: () => {
      toast({ title: n("acad_fout_titel"), description: n("acad_fout_body"), variant: "destructive" });
    },
  });

  // Vraag formulier state
  const [vraagOpen, setVraagOpen] = useState(false);
  const [vraagFormTitel, setVraagFormTitel] = useState("");
  const [vraagNaam, setVraagNaam] = useState("");
  const [vraagEmail, setVraagEmail] = useState("");
  const [vraagOnderwerp, setVraagOnderwerp] = useState("");
  const [vraagBericht, setVraagBericht] = useState("");

  function openVraagForm(titel: string, onderwerp: string) {
    setVraagFormTitel(titel);
    setVraagOnderwerp(onderwerp);
    setVraagNaam("");
    setVraagEmail("");
    setVraagBericht("");
    setVraagOpen(true);
  }

  const vraagMut = useMutation({
    mutationFn: async () => {
      const payload = {
        naam: vraagNaam.trim(),
        email: vraagEmail.trim(),
        taal,
        onderwerp: vraagOnderwerp.trim(),
        bericht: vraagBericht.trim(),
      };
      return (await apiRequest("POST", "/api/academy/vragen", payload)).json();
    },
    onSuccess: () => {
      toast({ title: n("acad_vraag_succes_titel"), description: n("acad_vraag_succes_body") });
      setVraagOpen(false);
    },
    onError: () => {
      toast({ title: n("acad_fout_titel"), description: n("acad_fout_body"), variant: "destructive" });
    },
  });

  const opleidingen = opleidingenData ?? [];
  const docenten = docentenData ?? [];
  const coaches = coachesData ?? [];

  // Accreditatieniveaus
  const accreditatieNiveaus = [
    { titel: n("acad_accr_n1_titel"), body: n("acad_accr_n1_body") },
    { titel: n("acad_accr_n2_titel"), body: n("acad_accr_n2_body") },
    { titel: n("acad_accr_n3_titel"), body: n("acad_accr_n3_body") },
  ];

  return (
    <div className="academy-observatorium min-h-[100dvh]">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <Select value={taal} onValueChange={(v) => setTaal(normaliseerTaal(v))}>
              <SelectTrigger className="h-9 w-auto gap-1.5 px-2.5" data-testid="select-ui-taal" aria-label={n("taal_kiezer_label")}>
                <span className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TALEN.map((l) => (
                  <SelectItem key={l} value={l} data-testid={`option-taal-${l}`}>
                    {TAAL_CODES[l]} · {TAAL_NAMEN[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="link-home">{n("acad_terug_home")}</Button>
            </Link>
          </div>
        }
      />

      {/* Hero */}
      <section className="academy-hero relative isolate overflow-hidden">
        <div
          className="academy-hero-bg absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: "url(/academy/observatorium-hero.png)" }}
          aria-hidden="true"
        />
        <div className="academy-hero-overlay absolute inset-0 -z-10" aria-hidden="true" />
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 sm:py-32">
          <h1 className="academy-titel text-3xl font-semibold tracking-tight sm:text-5xl" data-testid="text-academy-titel">
            TaPasAcademy
          </h1>
          <p className="academy-hero-sub mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" data-testid="text-academy-subtitel">
            {n("acad_hero_subtitel")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="academy-cta-primary" onClick={() => scrollNaar("academy-opleidingen")} data-testid="button-naar-opleidingen">
              {n("acad_hero_cta_opleidingen")}
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button variant="outline" className="academy-cta-secondary" onClick={() => scrollNaar("academy-vraag")} data-testid="button-naar-vraag">
              {n("acad_hero_cta_vraag")}
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">

        {/* Intro sectie */}
        <section data-testid="section-intro">
          <h2 className="academy-kop text-xl font-semibold tracking-tight sm:text-2xl">{n("acad_intro_titel")}</h2>
          <p className="academy-tekst mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">{n("acad_intro_body")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="academy-kaart" data-testid="card-intro-opleiding">
              <CardContent className="p-6">
                <div className="academy-icoon flex h-10 w-10 items-center justify-center rounded-lg">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="academy-kaart-kop mt-4 text-base font-semibold">{n("acad_intro_opleiding_titel")}</h3>
                <p className="academy-tekst mt-1.5 text-sm leading-relaxed">{n("acad_intro_opleiding_body")}</p>
              </CardContent>
            </Card>
            <Card className="academy-kaart" data-testid="card-intro-onderzoek">
              <CardContent className="flex h-full flex-col p-6">
                <div className="academy-icoon flex h-10 w-10 items-center justify-center rounded-lg">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <h3 className="academy-kaart-kop mt-4 text-base font-semibold">{n("acad_intro_onderzoek_titel")}</h3>
                <p className="academy-tekst mt-1.5 flex-1 text-sm leading-relaxed">{n("acad_intro_onderzoek_body")}</p>
                <div className="mt-4">
                  <Link href="/admin/inzichten">
                    <Button variant="outline" size="sm" className="academy-cta-secondary" data-testid="link-onderzoek">
                      {n("acad_intro_onderzoek_cta")}
                      <ChevronRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Opleidingen sectie */}
        <section id="academy-opleidingen" className="mt-16 scroll-mt-20 sm:mt-20" data-testid="section-opleidingen">
          <h2 className="academy-kop text-xl font-semibold tracking-tight sm:text-2xl">{n("acad_opl_titel")}</h2>
          <p className="academy-tekst mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">{n("acad_opl_intro")}</p>
          {laadOpl ? (
            <p className="academy-tekst mt-6 text-sm" data-testid="text-opleidingen-laden">{n("acad_laden")}</p>
          ) : opleidingen.length === 0 ? (
            <p className="academy-tekst mt-6 text-sm" data-testid="text-opleidingen-leeg">{n("acad_opl_leeg")}</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {opleidingen.map((opl: any) => (
                <Card key={opl.id} className="academy-kaart flex flex-col" data-testid={`card-opl-${opl.slug}`}>
                  <CardContent className="flex flex-1 flex-col p-5">
                    <div className="academy-icoon flex h-10 w-10 items-center justify-center rounded-lg">
                      <Star className="h-5 w-5" />
                    </div>
                    <h3 className="academy-kaart-kop mt-4 text-base font-semibold">{opl.titel}</h3>
                    <p className="academy-tekst mt-1.5 text-sm leading-relaxed">{opl.korteOmschrijving}</p>
                    {opl.accreditatieNiveau ? (
                      <div className="mt-3 flex items-center gap-1.5">
                        <Shield className="academy-badge-icoon h-4 w-4" />
                        <span className="academy-badge text-xs font-medium">{n("acad_opl_badge_accreditatie")}</span>
                      </div>
                    ) : null}
                    <div className="academy-meta mt-3 flex items-start gap-1.5 text-xs">
                      <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-medium">{n("acad_opl_start_label")}: </span>
                        {opl.sessies?.length > 0 ? opl.sessies[0].startdatum : n("acad_opl_start_indicatief")}
                      </span>
                    </div>
                    <div className="mt-4 flex-1" />
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="academy-cta-secondary w-full"
                        onClick={() => { resetInschrijf(); setGeselecteerdeOpl(opl); }}
                        data-testid={`button-inschrijven-${opl.slug}`}
                      >
                        {n("acad_opl_cta")}
                        <ChevronRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Accreditatie sectie */}
        <section className="mt-16 sm:mt-20" data-testid="section-accreditatie">
          <h2 className="academy-kop text-xl font-semibold tracking-tight sm:text-2xl">{n("acad_accr_titel")}</h2>
          <p className="academy-tekst mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">{n("acad_accr_intro")}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {accreditatieNiveaus.map((niveau, i) => (
              <Card key={i} className="academy-kaart" data-testid={`card-niveau-${i}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2">
                    <span className="academy-niveau-nr text-xs font-semibold">{String(i + 1).padStart(2, "0")}</span>
                    <Shield className="academy-badge-icoon h-4 w-4" />
                  </div>
                  <h3 className="academy-kaart-kop mt-3 text-base font-semibold">{niveau.titel}</h3>
                  <p className="academy-tekst mt-1.5 text-sm leading-relaxed">{niveau.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Jester kaart */}
          <Link href="/academy/jester">
            <a className="academy-jester-kaart mt-4 block rounded-xl border p-5 sm:p-6" data-testid="link-academy-jester">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                <img
                  src="/jester/jester-zegel.png"
                  alt=""
                  aria-hidden="true"
                  className="academy-jester-zegel h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
                />
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <h3 className="academy-jester-titel text-lg font-semibold sm:text-xl">{n("acad_accr_n4_titel")}</h3>
                  <p className="academy-jester-body mt-2 text-sm leading-relaxed">{n("acad_accr_n4_body")}</p>
                  <span className="academy-jester-cta mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
                    {n("acad_accr_n4_cta")}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </a>
          </Link>
          <p className="academy-meta mt-4 text-xs leading-relaxed" data-testid="text-accr-voet">{n("acad_accr_voet")}</p>
          <div className="academy-ethiek mt-5 rounded-lg border-l-2 py-3 pl-4 pr-4" data-testid="text-accr-ethiek">
            <p className="academy-tekst text-sm leading-relaxed">{n("acad_accr_ethiek")}</p>
          </div>
        </section>

        {/* Docenten sectie */}
        <section className="mt-16 sm:mt-20" data-testid="section-docenten">
          <h2 className="academy-kop text-xl font-semibold tracking-tight sm:text-2xl">{n("acad_doc_titel")}</h2>
          {laadDoc ? (
            <p className="academy-tekst mt-6 text-sm" data-testid="text-docenten-laden">{n("acad_laden")}</p>
          ) : docenten.length === 0 ? (
            <p className="academy-tekst mt-6 text-sm" data-testid="text-docenten-leeg">{n("acad_doc_leeg")}</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {docenten.map((doc: any) => (
                <Card key={doc.id} className="academy-kaart flex flex-col" data-testid={`card-docent-${doc.id}`}>
                  <CardContent className="flex flex-1 flex-col p-5">
                    {doc.fotoPad && (
                      <img
                        src={doc.fotoPad}
                        alt={doc.naam}
                        className="aspect-square w-full rounded-lg object-cover"
                        loading="lazy"
                      />
                    )}
                    <h3 className="academy-kaart-kop mt-4 text-base font-semibold">{doc.naam}</h3>
                    <p className="academy-meta mt-0.5 text-xs font-medium">{doc.rol}</p>
                    <p className="academy-tekst mt-2 text-sm leading-relaxed">{doc.bio}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <p className="academy-meta mt-4 text-xs leading-relaxed" data-testid="text-docenten-voet">{n("acad_doc_voet")}</p>
        </section>

        {/* Register sectie (coaches) */}
        <section className="mt-16 sm:mt-20" data-testid="section-register">
          <h2 className="academy-kop text-xl font-semibold tracking-tight sm:text-2xl">{n("acad_register_titel")}</h2>
          <p className="academy-tekst mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">{n("acad_register_body")}</p>
          {coaches.length === 0 ? (
            <Card className="academy-kaart academy-binnenkort mt-6" data-testid="card-register-binnenkort">
              <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="academy-icoon flex h-12 w-12 items-center justify-center rounded-full">
                  <Users className="h-6 w-6" />
                </div>
                <p className="academy-tekst text-sm font-medium">{n("acad_register_binnenkort")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map((coach: any) => (
                <Card key={coach.id} className="academy-kaart flex flex-col" data-testid={`card-coach-${coach.id}`}>
                  <CardContent className="flex flex-1 flex-col p-5">
                    <CoachAvatar naam={coach.naam} fotoPad={coach.fotoUrl} />
                    <h3 className="academy-kaart-kop mt-4 text-base font-semibold">{coach.naam}</h3>
                    {coach.opleidingTitel && <p className="academy-meta mt-1 text-xs">{coach.opleidingTitel}</p>}
                    {coach.plaats && <p className="academy-meta mt-0.5 text-xs">{coach.plaats}</p>}
                    {coach.instrumenten?.length > 0 && (
                      <div className="mt-3">
                        <p className="academy-meta text-xs font-medium">{n("acad_register_accreditaties")}:</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {coach.instrumenten.map((inst: any) => (
                            <span
                              key={inst.id}
                              className="academy-badge rounded-full px-2.5 py-0.5 text-xs"
                              data-testid={`badge-instrument-${coach.id}-${inst.id}`}
                            >
                              {inst.naam}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Vraag / contact sectie */}
        <section id="academy-vraag" className="mt-16 scroll-mt-20 sm:mt-20" data-testid="section-vraag">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="academy-kaart" data-testid="card-vraag">
              <CardContent className="flex h-full flex-col p-6">
                <div className="academy-icoon flex h-10 w-10 items-center justify-center rounded-lg">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <h3 className="academy-kaart-kop mt-4 text-base font-semibold">{n("acad_vraag_titel")}</h3>
                <p className="academy-tekst mt-1.5 flex-1 text-sm leading-relaxed">{n("acad_vraag_body")}</p>
                <div className="mt-4">
                  <Button
                    className="academy-cta-primary"
                    onClick={() => openVraagForm(n("acad_vraag_form_titel"), "")}
                    data-testid="button-vraag-open"
                  >
                    {n("acad_vraag_cta")}
                    <ChevronRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="academy-kaart" data-testid="card-org">
              <CardContent className="flex h-full flex-col p-6">
                <div className="academy-icoon flex h-10 w-10 items-center justify-center rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="academy-kaart-kop mt-4 text-base font-semibold">{n("acad_org_titel")}</h3>
                <p className="academy-tekst mt-1.5 flex-1 text-sm leading-relaxed">{n("acad_org_body")}</p>
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="academy-cta-secondary"
                    onClick={() => openVraagForm(n("acad_org_form_titel"), n("acad_org_titel"))}
                    data-testid="button-org-open"
                  >
                    {n("acad_org_cta")}
                    <ChevronRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer */}
        <footer className="academy-footer mt-16 border-t pt-6 sm:mt-20" data-testid="academy-footer">
          <p className="academy-meta text-xs leading-relaxed">{n("acad_footer")}</p>
          <Link href="/">
            <a className="academy-footer-link mt-2 inline-flex items-center gap-1.5 text-xs font-medium" data-testid="link-footer-home">
              <Home className="h-3.5 w-3.5" />
              {n("acad_terug_home")}
            </a>
          </Link>
        </footer>
      </main>

      {/* Inschrijf dialog */}
      <Dialog open={geselecteerdeOpl !== null} onOpenChange={(open) => { if (!open) setGeselecteerdeOpl(null); }}>
        <DialogContent className="academy-observatorium max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-inschrijven">
          <DialogHeader>
            <DialogTitle>{n("acad_inschrijf_titel")}{geselecteerdeOpl ? ` — ${geselecteerdeOpl.titel}` : ""}</DialogTitle>
            <DialogDescription>{n("acad_inschrijf_intro")}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); inschrijfMut.mutate(); }}
          >
            <div className="space-y-2">
              <Label>{n("acad_inschrijf_type")}</Label>
              <RadioGroup value={inschrijfType} onValueChange={setInschrijfType} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="deelnemer" id="type-deelnemer" data-testid="radio-deelnemer" />
                  <Label htmlFor="type-deelnemer" className="font-normal">{n("acad_inschrijf_type_deelnemer")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="organisatie" id="type-organisatie" data-testid="radio-organisatie" />
                  <Label htmlFor="type-organisatie" className="font-normal">{n("acad_inschrijf_type_organisatie")}</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-naam">{n("acad_veld_naam")}</Label>
              <Input id="i-naam" value={inschrijfNaam} onChange={(e) => setInschrijfNaam(e.target.value)} required data-testid="input-naam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="i-email">{n("acad_veld_email")}</Label>
              <Input id="i-email" type="email" value={inschrijfEmail} onChange={(e) => setInschrijfEmail(e.target.value)} required data-testid="input-email" />
            </div>
            {inschrijfType === "organisatie" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="i-org">{n("acad_veld_organisatie")}</Label>
                  <Input id="i-org" value={inschrijfOrg} onChange={(e) => setInschrijfOrg(e.target.value)} required data-testid="input-organisatie" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="i-aantal">{n("acad_veld_aantal")}</Label>
                  <Input id="i-aantal" type="number" min="1" value={inschrijfAantal} onChange={(e) => setInschrijfAantal(e.target.value)} data-testid="input-aantal" />
                </div>
              </>
            )}
            {geselecteerdeOpl?.sessies?.length > 0 && (
              <div className="space-y-2">
                <Label>{n("acad_veld_startmoment")}</Label>
                <Select value={inschrijfSessie} onValueChange={setInschrijfSessie}>
                  <SelectTrigger data-testid="select-sessie"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geen">{n("acad_veld_startmoment_geen")}</SelectItem>
                    {geselecteerdeOpl.sessies.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{sessieLabel(s, n)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="i-bericht">{n("acad_veld_bericht")}</Label>
              <Textarea id="i-bericht" rows={3} value={inschrijfBericht} onChange={(e) => setInschrijfBericht(e.target.value)} data-testid="input-bericht" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setGeselecteerdeOpl(null)} data-testid="button-inschrijf-annuleren">{n("acad_annuleren")}</Button>
              <Button type="submit" className="academy-cta-primary" disabled={inschrijfMut.isPending} data-testid="button-inschrijf-verzenden">
                {inschrijfMut.isPending ? n("acad_bezig") : n("acad_verzenden")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vraag dialog */}
      <Dialog open={vraagOpen} onOpenChange={setVraagOpen}>
        <DialogContent className="academy-observatorium max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-vraag">
          <DialogHeader>
            <DialogTitle>{vraagFormTitel}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); vraagMut.mutate(); }}
          >
            <div className="space-y-2">
              <Label htmlFor="v-naam">{n("acad_veld_naam")}</Label>
              <Input id="v-naam" value={vraagNaam} onChange={(e) => setVraagNaam(e.target.value)} required data-testid="input-v-naam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-email">{n("acad_veld_email")}</Label>
              <Input id="v-email" type="email" value={vraagEmail} onChange={(e) => setVraagEmail(e.target.value)} required data-testid="input-v-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-onderwerp">{n("acad_veld_onderwerp")}</Label>
              <Input id="v-onderwerp" value={vraagOnderwerp} onChange={(e) => setVraagOnderwerp(e.target.value)} data-testid="input-v-onderwerp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-bericht">{n("acad_veld_vraag")}</Label>
              <Textarea id="v-bericht" rows={4} value={vraagBericht} onChange={(e) => setVraagBericht(e.target.value)} required data-testid="input-v-bericht" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setVraagOpen(false)} data-testid="button-vraag-annuleren">{n("acad_annuleren")}</Button>
              <Button type="submit" className="academy-cta-primary" disabled={vraagMut.isPending} data-testid="button-vraag-verzenden">
                {vraagMut.isPending ? n("acad_bezig") : n("acad_vraag_verzenden")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
