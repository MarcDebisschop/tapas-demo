// ---------------------------------------------------------------------------
// AdminAcademy — gereconstrueerd uit originele bundle (index-CxFhBwUz.js)
// Functienaam in bundle: r8e()
// Sub-componenten: i8e (inschrijvingen), a8e (vragen), s8e (opleidingen),
//                  o8e (sessies), l8e (docenten), c8e (register)
// API: /api/academy/inschrijvingen, /api/academy/vragen, /api/academy/docenten
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQc } from "@/lib/queryClient";
import {
  TALEN,
  TAAL_NAMEN,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";


// -----------------------------------------------------------------------
// Tab: Inschrijvingen (i8e uit bundle)
// -----------------------------------------------------------------------
function TabInschrijvingen({ t, toast }: { t: (s: string) => string; toast: any }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/academy/inschrijvingen"] });
  const qc = useQueryClient();

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PUT", `/api/academy/inschrijvingen/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/academy/inschrijvingen"] });
      toast({ title: t("acad_admin_titel"), description: t("acad_admin_opgeslagen") });
    },
    onError: (e: any) => toast({ title: t("acad_fout_titel"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="tekst-geen-inschrijvingen">{t("acad_admin_leeg")}</p>;
  }

  const statusKleuren: Record<string, string> = {
    nieuw: "bg-blue-500/10 text-blue-600",
    bevestigd: "bg-green-500/10 text-green-600",
    geannuleerd: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-3">
      {data.map((r: any) => (
        <Card key={r.id} data-testid={`card-inschrijving-${r.id}`}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-foreground">{r.naam}</p>
              <p className="text-sm text-muted-foreground">{r.email} · {r.type}</p>
              {r.opleiding_titel && <p className="text-xs text-muted-foreground mt-0.5">{r.opleiding_titel}</p>}
              {r.bericht && <p className="mt-1 text-xs text-muted-foreground italic">{r.bericht}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{r.aangemaakt_op?.slice(0, 10)}</p>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              <Badge className={statusKleuren[r.status] ?? "bg-muted text-foreground"} data-testid={`badge-status-${r.id}`}>
                {t(`acad_admin_status_${r.status}`) || r.status}
              </Badge>
              <Select
                value={r.status}
                onValueChange={(v) => statusMut.mutate({ id: r.id, status: v })}
              >
                <SelectTrigger className="h-8 w-36" data-testid={`select-status-${r.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nieuw">{t("acad_admin_status_nieuw")}</SelectItem>
                  <SelectItem value="bevestigd">{t("acad_admin_status_bevestigd")}</SelectItem>
                  <SelectItem value="geannuleerd">{t("acad_admin_status_geannuleerd")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Tab: Vragen (a8e uit bundle)
// -----------------------------------------------------------------------
function TabVragen({ t, toast }: { t: (s: string) => string; toast: any }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/academy/vragen"] });
  const qc = useQueryClient();

  const afgehandeldMut = useMutation({
    mutationFn: ({ id, afgehandeld }: { id: number; afgehandeld: boolean }) =>
      apiRequest("PUT", `/api/academy/vragen/${id}`, { afgehandeld }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/academy/vragen"] });
      toast({ title: t("acad_admin_titel"), description: t("acad_admin_opgeslagen") });
    },
    onError: (e: any) => toast({ title: t("acad_fout_titel"), description: String(e?.message ?? e), variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="tekst-geen-vragen">{t("acad_admin_leeg")}</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((v: any) => (
        <Card key={v.id} data-testid={`card-vraag-${v.id}`} className={v.afgehandeld ? "opacity-60" : ""}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-foreground">{v.naam}</p>
              <p className="text-sm text-muted-foreground">{v.email}</p>
              {v.onderwerp && <p className="text-xs font-medium text-foreground mt-1">{v.onderwerp}</p>}
              <p className="mt-1 text-sm text-foreground">{v.bericht}</p>
              <p className="mt-1 text-xs text-muted-foreground">{v.aangemaakt_op?.slice(0, 10)}</p>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              {v.afgehandeld ? (
                <Badge className="bg-green-500/10 text-green-600">{t("acad_admin_afgehandeld")}</Badge>
              ) : (
                <Badge className="bg-blue-500/10 text-blue-600">{t("acad_admin_open")}</Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => afgehandeldMut.mutate({ id: v.id, afgehandeld: !v.afgehandeld })}
                data-testid={`button-toggle-afgehandeld-${v.id}`}
              >
                {v.afgehandeld ? t("acad_admin_open") : t("acad_admin_afgehandeld")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Tab: Opleidingen (s8e uit bundle — vereenvoudigd)
// -----------------------------------------------------------------------
function TabOpleidingen({ t, toast }: { t: (s: string) => string; toast: any }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/academy/admin/opleidingen"] });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground" data-testid="tekst-geen-opleidingen">{t("acad_admin_leeg")}</p>
        <p className="text-xs text-muted-foreground">{t("acad_opl_leeg")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((o: any) => (
        <Card key={o.id} data-testid={`card-opleiding-${o.id}`}>
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-foreground">{o.titel}</p>
              <p className="text-sm text-muted-foreground">{o.slug}</p>
              {o.korteOmschrijving && <p className="mt-1 text-xs text-muted-foreground">{o.korteOmschrijving}</p>}
            </div>
            <Badge variant={o.actief ? "default" : "outline"}>
              {o.actief ? t("acad_admin_actief") : t("acad_admin_concept")}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Tab: Sessies (o8e uit bundle — vereenvoudigd)
// -----------------------------------------------------------------------
function TabSessies({ t, toast }: { t: (s: string) => string; toast: any }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/academy/admin/sessies"] });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("acad_admin_leeg")}</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((s: any) => (
        <Card key={s.id} data-testid={`card-sessie-${s.id}`}>
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-foreground">{s.startdatum}</p>
              <p className="text-sm text-muted-foreground">{s.format}{s.locatie ? ` · ${s.locatie}` : ""}</p>
            </div>
            <Badge variant="outline">{s.status ?? t("acad_admin_sessie_status_gepland")}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Tab: Docenten (l8e uit bundle — vereenvoudigd)
// -----------------------------------------------------------------------
function TabDocenten({ t, toast }: { t: (s: string) => string; toast: any }) {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/academy/admin/docenten"] });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("acad_doc_leeg")}</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((d: any) => (
        <Card key={d.id} data-testid={`card-docent-${d.id}`}>
          <CardContent className="flex flex-col p-5">
            {d.fotoPad && (
              <img
                src={d.fotoPad}
                alt={d.naam}
                className="aspect-square w-full rounded-lg object-cover"
                loading="lazy"
              />
            )}
            <p className="mt-4 text-base font-semibold text-foreground">{d.naam}</p>
            {d.rol && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{d.rol}</p>}
            {d.bio && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.bio}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------
// Tab: Register (c8e uit bundle)
// -----------------------------------------------------------------------
function TabRegister({ t }: { t: (s: string) => string }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground" data-testid="text-register-verwijzing">
          {t("acad_admin_register_uitleg")}
        </p>
        <Link href="/admin/coaches">
          <Button data-testid="button-naar-coaches-register">{t("acad_admin_register_knop")}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Hoofdcomponent — gereconstrueerd uit r8e() in bundle
// -----------------------------------------------------------------------
export default function AdminAcademy() {
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const n = maakVertaler(taal);
  const { toast } = useToast();

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
              <Button variant="outline" size="sm" data-testid="link-terug-admin">← Admin beheer</Button>
            </Link>
          </div>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-academy-admin-titel">
          {n("acad_admin_titel")}
        </h1>
        <Tabs defaultValue="inschrijvingen" className="mt-6">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="inschrijvingen" data-testid="tab-inschrijvingen">{n("acad_admin_tab_inschrijvingen")}</TabsTrigger>
            <TabsTrigger value="vragen" data-testid="tab-vragen">{n("acad_admin_tab_vragen")}</TabsTrigger>
            <TabsTrigger value="opleidingen" data-testid="tab-opleidingen">{n("acad_admin_tab_opleidingen")}</TabsTrigger>
            <TabsTrigger value="sessies" data-testid="tab-sessies">{n("acad_admin_tab_sessies")}</TabsTrigger>
            <TabsTrigger value="docenten" data-testid="tab-docenten">{n("acad_admin_tab_docenten")}</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">{n("acad_admin_tab_register")}</TabsTrigger>
          </TabsList>
          <TabsContent value="inschrijvingen" className="mt-4">
            <TabInschrijvingen t={n} toast={toast} />
          </TabsContent>
          <TabsContent value="vragen" className="mt-4">
            <TabVragen t={n} toast={toast} />
          </TabsContent>
          <TabsContent value="opleidingen" className="mt-4">
            <TabOpleidingen t={n} toast={toast} />
          </TabsContent>
          <TabsContent value="sessies" className="mt-4">
            <TabSessies t={n} toast={toast} />
          </TabsContent>
          <TabsContent value="docenten" className="mt-4">
            <TabDocenten t={n} toast={toast} />
          </TabsContent>
          <TabsContent value="register" className="mt-4">
            <TabRegister t={n} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
