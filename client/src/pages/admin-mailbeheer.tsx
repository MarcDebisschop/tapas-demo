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
        </Tabs>
      </main>
    </div>
  );
}
