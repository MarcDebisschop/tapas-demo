/**
 * AdminFactuurhuisstijl — nieuwe admin-pagina (/admin/factuurhuisstijl).
 *
 * Facturatie-uitbreiding (additief): stel de huisstijl van de visuele PDF-factuur
 * in — logo, accentkleur en footer — op TWEE niveaus:
 *   1. Per facturerende entiteit (biller): PUT /api/billers/:id/huisstijl
 *   2. Per organisatie (override, wint van de biller): PUT /api/organisaties/:id/huisstijl
 *
 * Alle teksten Nederlands (Vlaams). Raakt geen bestaand pad aan.
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BillerEntiteit, OrganisatieMetSaldo } from "@/lib/types";
import { Palette, ArrowLeft } from "lucide-react";

const STANDAARD_KLEUR = "#b08b3f";

function LivePreview({ kleur, logo, naam, footer }: { kleur: string; logo: string; naam: string; footer: string }) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(kleur) ? kleur : STANDAARD_KLEUR;
  return (
    <div className="rounded-lg border border-border bg-white p-4 text-slate-800" data-testid="preview-huisstijl">
      <div className="flex items-center justify-between border-b-2 pb-2" style={{ borderColor: accent }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="logo" className="h-8 max-w-[120px] object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
        ) : (
          <span className="text-sm font-semibold text-slate-500">{naam || "Uw entiteit"}</span>
        )}
        <span className="text-lg font-bold" style={{ color: accent }}>FACTUUR</span>
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <div className="h-2 w-2/3 rounded bg-slate-100" />
        <div className="h-2 w-1/2 rounded bg-slate-100" />
      </div>
      <div className="mt-3 h-6 rounded" style={{ background: `${accent}22` }} />
      {footer && <p className="mt-3 border-t border-slate-100 pt-2 text-center text-[10px] text-slate-400">{footer}</p>}
    </div>
  );
}

function BillerHuisstijl({ billers }: { billers: BillerEntiteit[] }) {
  const { toast } = useToast();
  const [gekozenId, setGekozenId] = useState<string>(() => String(billers.find((b) => b.actief)?.id ?? billers[0]?.id ?? ""));
  const biller = useMemo(() => billers.find((b) => String(b.id) === gekozenId), [billers, gekozenId]);

  const [logo, setLogo] = useState(biller?.logo ?? "");
  const [kleur, setKleur] = useState(biller?.huisstijlKleur ?? STANDAARD_KLEUR);
  const [footer, setFooter] = useState(biller?.factuurFooter ?? "");
  const [bezig, setBezig] = useState(false);
  const [geladenId, setGeladenId] = useState(gekozenId);

  // Herlaad de velden wanneer een andere biller wordt gekozen.
  if (geladenId !== gekozenId && biller) {
    setLogo(biller.logo ?? "");
    setKleur(biller.huisstijlKleur ?? STANDAARD_KLEUR);
    setFooter(biller.factuurFooter ?? "");
    setGeladenId(gekozenId);
  }

  async function opslaan() {
    if (!biller) return;
    setBezig(true);
    try {
      const r = await apiRequest("PUT", `/api/billers/${biller.id}/huisstijl`, {
        logo: logo || null,
        huisstijlKleur: kleur || STANDAARD_KLEUR,
        factuurFooter: footer || null,
      }).then((x) => x.json());
      if (r?.error) throw new Error(r.error);
      queryClient.invalidateQueries({ queryKey: ["/api/billers"] });
      toast({ title: "Huisstijl opgeslagen", description: biller.naam });
    } catch (e: any) {
      toast({ title: "Opslaan mislukt", description: e?.message ?? "Onbekende fout", variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Huisstijl facturerende entiteit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Entiteit</Label>
            <Select value={gekozenId} onValueChange={setGekozenId}>
              <SelectTrigger data-testid="select-biller"><SelectValue placeholder="Kies een entiteit" /></SelectTrigger>
              <SelectContent>
                {billers.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.naam}{b.actief ? " (actief)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Logo (URL of data-URI)</Label>
            <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" data-testid="input-biller-logo" />
          </div>
          <div className="space-y-2">
            <Label>Accentkleur</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={/^#[0-9a-fA-F]{6}$/.test(kleur) ? kleur : STANDAARD_KLEUR} onChange={(e) => setKleur(e.target.value)} className="h-9 w-14 p-1" data-testid="input-biller-kleur" />
              <Input value={kleur} onChange={(e) => setKleur(e.target.value)} className="w-32 font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Footer (bv. bankgegevens, algemene voorwaarden)</Label>
            <Textarea rows={3} value={footer} onChange={(e) => setFooter(e.target.value)} data-testid="input-biller-footer" />
          </div>
          <Button onClick={opslaan} disabled={bezig || !biller} data-testid="button-biller-opslaan">Opslaan</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Voorbeeld</p>
        <LivePreview kleur={kleur} logo={logo} naam={biller?.naam ?? ""} footer={footer} />
      </div>
    </div>
  );
}

function OrganisatieHuisstijlRij({ org }: { org: OrganisatieMetSaldo }) {
  const { toast } = useToast();
  const [logo, setLogo] = useState(org.huisstijlLogo ?? "");
  const [kleur, setKleur] = useState(org.huisstijlKleur ?? "");
  const [footer, setFooter] = useState(org.huisstijlFooter ?? "");
  const [bezig, setBezig] = useState(false);

  async function opslaan() {
    setBezig(true);
    try {
      const r = await apiRequest("PUT", `/api/organisaties/${org.id}/huisstijl`, {
        huisstijlLogo: logo || null,
        huisstijlKleur: kleur || null,
        huisstijlFooter: footer || null,
      }).then((x) => x.json());
      if (r?.error) throw new Error(r.error);
      queryClient.invalidateQueries({ queryKey: ["/api/organisaties"] });
      toast({ title: "Override opgeslagen", description: org.naam });
    } catch (e: any) {
      toast({ title: "Opslaan mislukt", description: e?.message ?? "Onbekende fout", variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  return (
    <Card data-testid={`card-org-huisstijl-${org.id}`}>
      <CardContent className="grid gap-4 p-5 md:grid-cols-2">
        <div className="space-y-3">
          <p className="font-medium text-foreground">{org.naam}</p>
          <div className="space-y-2">
            <Label>Logo-override (URL of data-URI)</Label>
            <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="Laat leeg = biller-logo" data-testid={`input-org-logo-${org.id}`} />
          </div>
          <div className="space-y-2">
            <Label>Kleur-override</Label>
            <div className="flex items-center gap-2">
              <Input type="color" value={/^#[0-9a-fA-F]{6}$/.test(kleur) ? kleur : STANDAARD_KLEUR} onChange={(e) => setKleur(e.target.value)} className="h-9 w-14 p-1" data-testid={`input-org-kleur-${org.id}`} />
              <Input value={kleur} onChange={(e) => setKleur(e.target.value)} placeholder="Laat leeg = biller-kleur" className="w-40 font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Footer-override</Label>
            <Textarea rows={2} value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Laat leeg = biller-footer" data-testid={`input-org-footer-${org.id}`} />
          </div>
          <Button size="sm" onClick={opslaan} disabled={bezig} data-testid={`button-org-opslaan-${org.id}`}>Opslaan</Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Voorbeeld (override)</p>
          <LivePreview kleur={kleur || STANDAARD_KLEUR} logo={logo} naam={org.naam} footer={footer} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminFactuurhuisstijl() {
  const { data: billers, isLoading: billersLaden } = useQuery<BillerEntiteit[]>({ queryKey: ["/api/billers"] });
  const { data: orgs, isLoading: orgsLaden } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/admin/credits">
            <a className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Credits &amp; facturatie
            </a>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Palette className="h-4 w-4 text-accent" /> Factuur-huisstijl
          </span>
        </div>

        <div className="mb-8">
          <h1 className="mb-1 font-serif text-2xl font-semibold text-foreground">Factuur-huisstijl</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Bepaal het logo, de accentkleur en de footer van de visuele PDF-factuur. Een organisatie-override
            wint van de huisstijl van de facturerende entiteit.
          </p>
        </div>

        <Tabs defaultValue="biller">
          <TabsList>
            <TabsTrigger value="biller" data-testid="tab-biller">Facturerende entiteit</TabsTrigger>
            <TabsTrigger value="organisatie" data-testid="tab-organisatie">Per organisatie</TabsTrigger>
          </TabsList>

          <TabsContent value="biller" className="mt-4">
            {billersLaden ? (
              <Skeleton className="h-64 w-full" />
            ) : !billers || billers.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">Nog geen facturerende entiteit.</p>
            ) : (
              <BillerHuisstijl billers={billers} />
            )}
          </TabsContent>

          <TabsContent value="organisatie" className="mt-4 space-y-4">
            {orgsLaden ? (
              <Skeleton className="h-64 w-full" />
            ) : !orgs || orgs.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">Nog geen organisaties.</p>
            ) : (
              orgs.map((o) => <OrganisatieHuisstijlRij key={o.id} org={o} />)
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
