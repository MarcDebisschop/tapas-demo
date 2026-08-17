// ---------------------------------------------------------------------------
// AdminMailbeheer — gereconstrueerd uit originele bundle (index-CxFhBwUz.js)
// Functienaam in bundle: u8e()
// Sub-componenten: d8e (template rij), f8e (huisstijl tab), h8e (whitelabel tab)
// API: /api/admin/mailteksten, /api/admin/mailhuisstijl, /api/organisaties
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";


// -----------------------------------------------------------------------
// Template rij (d8e uit bundle)
// -----------------------------------------------------------------------
function MailTemplateRij({ template, werktaal, labels }: {
  template: any;
  werktaal: string;
  labels: { herstel: string; standaard: string; bewaar: string; bewaard: string };
}) {
  const { toast } = useToast();
  const bestaande = template.teksten?.[werktaal] ?? { onderwerp: "", body: "" };
  const [onderwerp, setOnderwerp] = useState(bestaande.onderwerp ?? "");
  const [body, setBody] = useState(bestaande.body ?? "");

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/admin/mailteksten/${template.templateKey}/${werktaal}`, { onderwerp, body }),
    onSuccess: () => toast({ description: labels.bewaard }),
    onError: (e: any) => toast({ description: String(e?.message ?? e), variant: "destructive" }),
  });

  return (
    <Card data-testid={`card-template-${template.templateKey}`}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium text-foreground capitalize">{template.templateKey}</p>
          {template.isStandaard && (
            <span className="text-xs text-muted-foreground">{labels.standaard}</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`onderwerp-${template.templateKey}`}>Onderwerp</Label>
          <Input
            id={`onderwerp-${template.templateKey}`}
            value={onderwerp}
            onChange={(e) => setOnderwerp(e.target.value)}
            data-testid={`input-onderwerp-${template.templateKey}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`body-${template.templateKey}`}>Berichttekst</Label>
          <Textarea
            id={`body-${template.templateKey}`}
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            data-testid={`input-body-${template.templateKey}`}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            data-testid={`button-bewaar-${template.templateKey}`}
          >
            {labels.bewaar}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOnderwerp(bestaande.onderwerp ?? "");
              setBody(bestaande.body ?? "");
            }}
            data-testid={`button-herstel-${template.templateKey}`}
          >
            {labels.herstel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Tab: Huisstijl (f8e uit bundle)
// -----------------------------------------------------------------------
function TabHuisstijl({ huisstijl, labels, onToast }: {
  huisstijl: any;
  labels: { logo: string; accent: string; afzender: string; bewaar: string; uitleg: string };
  onToast: () => void;
}) {
  const [logo, setLogo] = useState(huisstijl?.logo ?? "");
  const [accent, setAccent] = useState(huisstijl?.accentKleur ?? "#e87c20");
  const [afzender, setAfzender] = useState(huisstijl?.afzender ?? "");

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest("PUT", "/api/admin/mailhuisstijl", { logo, accentKleur: accent, afzender }),
    onSuccess: onToast,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{labels.uitleg}</p>
      <div className="space-y-2">
        <Label>{labels.logo}</Label>
        <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" data-testid="input-logo" />
      </div>
      <div className="space-y-2">
        <Label>{labels.accent}</Label>
        <div className="flex items-center gap-2">
          <Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-14 p-1" data-testid="input-accent" />
          <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="w-32 font-mono text-sm" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{labels.afzender}</Label>
        <Input value={afzender} onChange={(e) => setAfzender(e.target.value)} placeholder="TaPasCity <noreply@tapascity.com>" data-testid="input-afzender" />
      </div>
      <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="button-bewaar-huisstijl">
        {labels.bewaar}
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------
// Tab: Whitelabel (h8e uit bundle)
// -----------------------------------------------------------------------
function TabWhitelabel({ organisaties, labels, onToast }: {
  organisaties: any[];
  labels: { kies: string; logo: string; accent: string; afzender: string; bewaar: string; uitleg: string };
  onToast: () => void;
}) {
  const [orgId, setOrgId] = useState("");
  const [logo, setLogo] = useState("");
  const [accent, setAccent] = useState("#e87c20");
  const [afzender, setAfzender] = useState("");

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/admin/mailhuisstijl/org/${orgId}`, { logo, accentKleur: accent, afzender }),
    onSuccess: onToast,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{labels.uitleg}</p>
      <div className="space-y-2">
        <Label>{labels.kies}</Label>
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger data-testid="select-whitelabel-org">
            <SelectValue placeholder={labels.kies} />
          </SelectTrigger>
          <SelectContent>
            {organisaties.map((o: any) => (
              <SelectItem key={o.id} value={String(o.id)}>{o.naam}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {orgId && (
        <>
          <div className="space-y-2">
            <Label>{labels.logo}</Label>
            <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" />
          </div>
          <div className="space-y-2">
            <Label>{labels.accent}</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-14 p-1" />
              <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="w-32 font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{labels.afzender}</Label>
            <Input value={afzender} onChange={(e) => setAfzender(e.target.value)} />
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !orgId}>
            {labels.bewaar}
          </Button>
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Verzendlogboek
//
// Waarom dit tabblad bestaat. De stand van een verzending (verstuurd,
// gesimuleerd, fout) was tot nu enkel te zien in het antwoord van de route die
// de mail aanstootte. Sloot je dat scherm, dan was het spoor weg. Toen een
// deelnemer meldde dat een uitnodiging niet aankwam, was achteraf niet vast te
// stellen of het bericht ooit vertrokken was. De verzendmodule bewaart nu elke
// poging en dit tabblad leest die terug, jongste regel eerst.
//
// Wat er niet in staat: de persoonlijke link en de berichttekst. Wie het logboek
// mag lezen, hoort daarmee geen deelnemersdeur te kunnen openen.
// -----------------------------------------------------------------------
function TabVerzendlog({ n }: { n: (s: any) => string }) {
  const [status, setStatus] = useState("alles");
  const [soort, setSoort] = useState("alles");
  const [zoek, setZoek] = useState("");
  const [zoekActief, setZoekActief] = useState("");

  const vraag = new URLSearchParams();
  if (status !== "alles") vraag.set("status", status);
  if (soort !== "alles") vraag.set("soort", soort);
  if (zoekActief.trim()) vraag.set("zoek", zoekActief.trim());
  const sleutel = `/api/admin/mailverzendlog${vraag.toString() ? `?${vraag.toString()}` : ""}`;

  const { data, isLoading, refetch } = useQuery<any>({ queryKey: [sleutel] });

  const statusLabel = (s: string) =>
    s === "verstuurd"
      ? n("mailverzendlog_status_verstuurd")
      : s === "gesimuleerd"
        ? n("mailverzendlog_status_gesimuleerd")
        : n("mailverzendlog_status_fout");

  const soortLabel = (s: string) =>
    s === "uitnodiging"
      ? n("mailverzendlog_soort_uitnodiging")
      : s === "toegangsmail"
        ? n("mailverzendlog_soort_toegangsmail")
        : s === "aanmeldlink"
          ? n("mailverzendlog_soort_aanmeldlink")
          : n("mailverzendlog_soort_bericht");

  const kanaalLabel = (k: string) =>
    k === "brevo-api"
      ? n("mailverzendlog_kanaal_brevo")
      : k === "smtp"
        ? n("mailverzendlog_kanaal_smtp")
        : n("mailverzendlog_kanaal_geen");

  // De stand bepaalt de kleur van het merkteken. Naast de kleur staat altijd het
  // woord zelf, want kleur alleen is voor een deel van de lezers geen informatie.
  const standKleur = (s: string) =>
    s === "verstuurd"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : s === "gesimuleerd"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-red-500/15 text-red-700 dark:text-red-300";

  const regels: any[] = data?.regels ?? [];
  const telling = data?.telling ?? { verstuurd: 0, gesimuleerd: 0, fout: 0 };

  return (
    <div className="space-y-4" data-testid="paneel-verzendlog">
      <p className="text-sm text-muted-foreground">{n("mailverzendlog_uitleg")}</p>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {n("mailverzendlog_kanaal_nu")}: <span className="font-medium text-foreground">{kanaalLabel(data?.kanaal ?? "geen")}</span>
        </span>
        <span className="text-muted-foreground" data-testid="tekst-verzendlog-telling">
          {statusLabel("verstuurd")} {telling.verstuurd} / {statusLabel("gesimuleerd")} {telling.gesimuleerd} / {statusLabel("fout")} {telling.fout}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{n("mailverzendlog_kol_status")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-44" data-testid="select-verzendlog-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alles">{n("mailverzendlog_alles")}</SelectItem>
              <SelectItem value="verstuurd">{statusLabel("verstuurd")}</SelectItem>
              <SelectItem value="gesimuleerd">{statusLabel("gesimuleerd")}</SelectItem>
              <SelectItem value="fout">{statusLabel("fout")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{n("mailverzendlog_kol_soort")}</Label>
          <Select value={soort} onValueChange={setSoort}>
            <SelectTrigger className="h-9 w-48" data-testid="select-verzendlog-soort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alles">{n("mailverzendlog_alles")}</SelectItem>
              <SelectItem value="uitnodiging">{soortLabel("uitnodiging")}</SelectItem>
              <SelectItem value="toegangsmail">{soortLabel("toegangsmail")}</SelectItem>
              <SelectItem value="aanmeldlink">{soortLabel("aanmeldlink")}</SelectItem>
              <SelectItem value="bericht">{soortLabel("bericht")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="verzendlog-zoek">{n("mailverzendlog_zoek")}</Label>
          <Input
            id="verzendlog-zoek"
            className="h-9 w-64"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setZoekActief(zoek);
            }}
            data-testid="input-verzendlog-zoek"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setZoekActief(zoek);
            refetch();
          }}
          data-testid="knop-verzendlog-vernieuw"
        >
          {n("mailverzendlog_vernieuw")}
        </Button>
      </div>

      {data?.logboekOntbreekt && (
        <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="tekst-verzendlog-ontbreekt">
          {n("mailverzendlog_ontbreekt")}
        </p>
      )}

      {!isLoading && !data?.logboekOntbreekt && regels.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="tekst-verzendlog-leeg">
          {n("mailverzendlog_leeg")}
        </p>
      )}

      {regels.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {/* Enkelvoud en meervoud staan als aparte sleutel in de tabel: "1 regels"
                is fout in elke taal die deze tabel kent. */}
            {(data?.totaal ?? regels.length) === 1
              ? n("mailverzendlog_totaal_een")
              : n("mailverzendlog_totaal").replace("{aantal}", String(data?.totaal ?? regels.length))}
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm" data-testid="tabel-verzendlog">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium sm:px-3">{n("mailverzendlog_kol_tijdstip")}</th>
                  <th className="px-2 py-2 font-medium sm:px-3">{n("mailverzendlog_kol_soort")}</th>
                  <th className="px-2 py-2 font-medium sm:px-3">{n("mailverzendlog_kol_ontvanger")}</th>
                  {/* Op een smal scherm blijven tijdstip, soort, ontvanger en stand
                      staan. Onderwerp, kanaal en melding wijken dan, want anders
                      breekt het adres in onleesbare stukken. Op een breed scherm
                      staat alles er. */}
                  <th className="hidden px-3 py-2 font-medium md:table-cell">{n("mailverzendlog_kol_onderwerp")}</th>
                  <th className="px-2 py-2 font-medium sm:px-3">{n("mailverzendlog_kol_status")}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">{n("mailverzendlog_kol_kanaal")}</th>
                  <th className="hidden px-3 py-2 font-medium lg:table-cell">{n("mailverzendlog_kol_melding")}</th>
                </tr>
              </thead>
              <tbody>
                {regels.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top" data-testid={`rij-verzendlog-${r.id}`}>
                    {/* Op een smal scherm staat de dag zonder jaartal, zodat de
                        stand er nog naast past. Vanaf sm staat het volledige
                        tijdstip er. */}
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums text-muted-foreground sm:px-3">
                      <span className="sm:hidden">
                        {new Date(r.tijdstip).toLocaleString("nl-BE", { day: "2-digit", month: "2-digit" })}
                        {" "}
                        {new Date(r.tijdstip).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="hidden sm:inline">
                        {new Date(r.tijdstip).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:whitespace-nowrap sm:px-3">{soortLabel(r.soort)}</td>
                    <td className="px-2 py-2 break-all sm:px-3 md:whitespace-nowrap md:break-normal">{r.ontvanger}</td>
                    <td className="hidden max-w-[22rem] px-3 py-2 text-muted-foreground md:table-cell">{r.onderwerp}</td>
                    <td className="whitespace-nowrap px-2 py-2 sm:px-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${standKleur(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-muted-foreground sm:table-cell">{kanaalLabel(r.kanaal)}</td>
                    <td className="hidden max-w-[20rem] px-3 py-2 text-xs text-muted-foreground break-words lg:table-cell">{r.melding ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Hoofdcomponent — gereconstrueerd uit u8e() in bundle
// -----------------------------------------------------------------------
export default function AdminMailbeheer() {
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const n = maakVertaler(taal);
  const { toast } = useToast();
  const [werktaal, setWerktaal] = useState("nl");

  const { data: mailteksten } = useQuery<any>({ queryKey: ["/api/admin/mailteksten"] });
  const { data: mailhuisstijl } = useQuery<any>({ queryKey: ["/api/admin/mailhuisstijl"] });
  const { data: organisaties } = useQuery<any[]>({ queryKey: ["/api/organisaties"] });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <Select value={taal} onValueChange={(v) => setTaal(normaliseerTaal(v))}>
              <SelectTrigger className="h-9 w-auto px-2.5" data-testid="select-ui-taal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["nl", "fr", "en", "es", "ru"] as Taal[]).map((l) => (
                  <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/admin">
              <Button size="sm" variant="outline" data-testid="link-admin-terug">← Admin beheer</Button>
            </Link>
          </div>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">{n("mailbeheer_titel")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{n("mailbeheer_uitleg")}</p>

        <Tabs defaultValue="teksten">
          <TabsList>
            <TabsTrigger value="teksten" data-testid="tab-teksten">{n("mailbeheer_tab_teksten")}</TabsTrigger>
            <TabsTrigger value="huisstijl" data-testid="tab-huisstijl">{n("mailbeheer_tab_huisstijl")}</TabsTrigger>
            <TabsTrigger value="whitelabel" data-testid="tab-whitelabel">{n("mailbeheer_tab_whitelabel")}</TabsTrigger>
            <TabsTrigger value="verzendlog" data-testid="tab-verzendlog">{n("mailbeheer_tab_verzendlog")}</TabsTrigger>
          </TabsList>

          <TabsContent value="teksten" className="mt-4">
            {/* Werktaal kiezer */}
            <div className="mb-4 flex items-center gap-3">
              <Label className="text-sm">{n("mailbeheer_werktaal")}</Label>
              <Select value={werktaal} onValueChange={(v) => setWerktaal(normaliseerTaal(v))}>
                <SelectTrigger className="h-9 w-32" data-testid="select-werktaal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(mailteksten?.talen ?? ["nl","fr","en","es","ru"]).map((l: string) => (
                    <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-6">
              {(mailteksten?.templates ?? []).map((tmpl: any) => (
                <MailTemplateRij
                  key={tmpl.templateKey}
                  template={tmpl}
                  werktaal={werktaal}
                  labels={{
                    herstel: n("mailbeheer_herstel"),
                    standaard: n("mailbeheer_standaard"),
                    bewaar: n("mailbeheer_bewaar"),
                    bewaard: n("mailbeheer_bewaard"),
                  }}
                />
              ))}
              {(!mailteksten?.templates || mailteksten.templates.length === 0) && (
                <p className="text-sm text-muted-foreground">Nog geen mailtemplates beschikbaar.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="huisstijl" className="mt-4">
            <TabHuisstijl
              huisstijl={mailhuisstijl}
              labels={{
                logo: n("mailbeheer_logo"),
                accent: n("mailbeheer_accent"),
                afzender: n("mailbeheer_afzender"),
                bewaar: n("mailbeheer_bewaar"),
                uitleg: n("mailbeheer_huisstijl_uitleg"),
              }}
              onToast={() => toast({ description: n("mailbeheer_bewaard") })}
            />
          </TabsContent>

          <TabsContent value="whitelabel" className="mt-4">
            <TabWhitelabel
              organisaties={organisaties ?? []}
              labels={{
                kies: n("mailbeheer_kies_org"),
                logo: n("mailbeheer_logo"),
                accent: n("mailbeheer_accent"),
                afzender: n("mailbeheer_afzender"),
                bewaar: n("mailbeheer_bewaar"),
                uitleg: n("mailbeheer_whitelabel_uitleg"),
              }}
              onToast={() => toast({ description: n("mailbeheer_bewaard") })}
            />
          </TabsContent>

          <TabsContent value="verzendlog" className="mt-4">
            <TabVerzendlog n={n} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
