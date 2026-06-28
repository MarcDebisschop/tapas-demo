import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { LegeStaat } from "@/components/LegeStaat";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  OrganisatieMetSaldo,
  CreditTransactie,
  Creditpakket,
  BillerEntiteit,
  Betaling,
  Factuur,
} from "@/lib/types";
import { Coins, ArrowRightLeft, Plus, BarChart3, FileText, Download, Tag, Layers, ShieldCheck, Lock, Trash2 } from "lucide-react";

function euro(n: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(n);
}
function dt(s: string) {
  return new Date(s).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
}

const TYPE_LABELS: Record<string, string> = {
  bedrijf: "Bedrijf",
  school: "School",
  coach: "Coach",
  particulier: "Particulier",
};

// Elk transactietype krijgt een eigen, herkenbare kleur (met dark-variant).
const TX_STYLE: Record<string, string> = {
  aankoop: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  reservering: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  verbruik: "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  vrijgave: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900",
  overdracht: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900",
  correctie: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900",
};

// ---------------------------------------------------------------------------
// Organisatie aanmaken
// ---------------------------------------------------------------------------
function NieuweOrganisatie() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [type, setType] = useState("bedrijf");
  const [btw, setBtw] = useState("");
  const [kbo, setKbo] = useState("");
  const [peppolId, setPeppolId] = useState("");
  const [peppolBereikbaar, setPeppolBereikbaar] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!naam.trim()) {
      toast({ title: "Naam ontbreekt", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await apiRequest("POST", "/api/organisaties", {
        naam: naam.trim(),
        type,
        btwNummer: btw.trim() || undefined,
        kboNummer: kbo.trim() || undefined,
        peppolId: peppolId.trim() || undefined,
        peppolBereikbaar,
        email: email.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organisaties"] });
      toast({ title: "Organisatie toegevoegd" });
      setOpen(false);
      setNaam(""); setBtw(""); setKbo(""); setPeppolId(""); setEmail(""); setPeppolBereikbaar(false);
    } catch (e: any) {
      toast({ title: "Kon niet opslaan", description: String(e.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-nieuwe-organisatie">
          <Plus className="mr-1.5 h-4 w-4" /> Organisatie
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe organisatie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-naam">Naam *</Label>
            <Input id="org-naam" value={naam} onChange={(e) => setNaam(e.target.value)} data-testid="input-org-naam" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-org-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bedrijf">Bedrijf</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                  <SelectItem value="particulier">Particulier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-email">E-mail</Label>
              <Input id="org-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="facturatie@…" data-testid="input-org-email" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-btw">BTW-nummer</Label>
              <Input id="org-btw" value={btw} onChange={(e) => setBtw(e.target.value)} placeholder="BE0123.456.789" data-testid="input-org-btw" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-kbo">KBO-nummer</Label>
              <Input id="org-kbo" value={kbo} onChange={(e) => setKbo(e.target.value)} placeholder="0123456789" data-testid="input-org-kbo" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-peppol">Peppol-ID</Label>
            <Input id="org-peppol" value={peppolId} onChange={(e) => setPeppolId(e.target.value)} placeholder="0208:0123456789" data-testid="input-org-peppol" />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={peppolBereikbaar} onCheckedChange={(c) => setPeppolBereikbaar(Boolean(c))} data-testid="checkbox-peppol" />
            Bereikbaar via Peppol (factuur wordt elektronisch verstuurd)
          </label>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} data-testid="button-org-opslaan">
            {busy ? "Bezig…" : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Credits opladen
// ---------------------------------------------------------------------------
function CreditsOpladen({ organisaties, pakketten }: { organisaties: OrganisatieMetSaldo[]; pakketten: Creditpakket[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const [aantal, setAantal] = useState<string>("");
  const [busy, setBusy] = useState<"" | "registreer" | "betaal">("");

  // Prijs per credit afgeleid uit het Starter-pakket (€250 / 10 = €25 per credit).
  const starter = pakketten.find((p) => p.id === "start") ?? pakketten[0];
  const prijsPerCredit = starter ? starter.prijsExclBtw / starter.credits : 25;
  const btwTarief = 0.21;

  const n = parseInt(aantal, 10);
  const geldig = Boolean(orgId) && Number.isFinite(n) && n >= 1;
  const subtotaal = geldig ? n * prijsPerCredit : 0;
  const btw = subtotaal * btwTarief;
  const totaal = subtotaal + btw;

  function reset() {
    setOpen(false);
    setAantal("");
    setOrgId("");
  }

  async function registreer() {
    if (!geldig) {
      toast({ title: "Vul een organisatie en aantal in", variant: "destructive" });
      return;
    }
    setBusy("registreer");
    try {
      await apiRequest("POST", "/api/credits/opladen", {
        organisatieId: Number(orgId),
        aantal: n,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organisaties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/transacties"] });
      toast({ title: `${n} credits opgeladen (manuele registratie)` });
      reset();
    } catch (e: any) {
      toast({ title: "Opladen mislukt", description: String(e.message ?? e), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  async function betaalOnline() {
    if (!geldig) {
      toast({ title: "Vul een organisatie en aantal in", variant: "destructive" });
      return;
    }
    setBusy("betaal");
    try {
      // 1. Start de betaling (in productie: Mollie checkout-URL).
      const betaling: Betaling = await apiRequest("POST", "/api/betalingen", {
        organisatieId: Number(orgId),
        credits: n,
      }).then((r) => r.json());
      // 2. Webhook-equivalent: bevestig de geslaagde betaling -> laadt credits + maakt factuur.
      const { factuur }: { betaling: Betaling; factuur: Factuur } = await apiRequest(
        "POST",
        `/api/betalingen/${betaling.id}/bevestig`,
        { methode: "bancontact" },
      ).then((r) => r.json());
      queryClient.invalidateQueries({ queryKey: ["/api/organisaties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/transacties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/betalingen"] });
      queryClient.invalidateQueries({ queryKey: ["/api/facturen"] });
      const kanaal = factuur.kanaal === "peppol" ? "Peppol e-factuur" : "PDF-factuur";
      toast({
        title: `Betaling geslaagd — ${n} credits opgeladen`,
        description: `Factuur ${factuur.factuurnummer} aangemaakt (${kanaal}).`,
      });
      reset();
    } catch (e: any) {
      toast({ title: "Online betaling mislukt", description: String(e.message ?? e), variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-credits-opladen">
          <Coins className="mr-1.5 h-4 w-4" /> Credits opladen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credits opladen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Organisatie</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger data-testid="select-oplaad-org"><SelectValue placeholder="Kies organisatie" /></SelectTrigger>
              <SelectContent>
                {organisaties.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.naam}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="aantal">Aantal credits</Label>
            <Input id="aantal" type="number" min={1} value={aantal} onChange={(e) => setAantal(e.target.value)} data-testid="input-oplaad-aantal" />
          </div>
          {pakketten.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pakketten.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAantal(String(p.credits))}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover-elevate"
                  data-testid={`chip-pakket-${p.id}`}
                >
                  {p.naam} - {p.credits} - {euro(p.prijsExclBtw)}
                </button>
              ))}
            </div>
          )}
          {geldig && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" data-testid="box-oplaad-bedrag">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-muted-foreground">Subtotaal (excl. btw)</span>
                <span className="tabular-nums">{euro(subtotaal)}</span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-muted-foreground">Btw 21%</span>
                <span className="tabular-nums">{euro(btw)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                <span>Totaal (incl. btw)</span>
                <span className="tabular-nums" data-testid="text-oplaad-totaal">{euro(totaal)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {n} credits aan {euro(prijsPerCredit)} per credit.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={registreer}
            disabled={busy !== ""}
            data-testid="button-oplaad-registreer"
          >
            {busy === "registreer" ? "Bezig..." : "Registreer aankoop"}
          </Button>
          <Button
            onClick={betaalOnline}
            disabled={busy !== ""}
            data-testid="button-oplaad-betaal"
          >
            {busy === "betaal" ? "Bezig..." : "Betaal online"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ---------------------------------------------------------------------------
// Credits overdragen
// ---------------------------------------------------------------------------
function CreditsOverdragen({ organisaties }: { organisaties: OrganisatieMetSaldo[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [van, setVan] = useState("");
  const [naar, setNaar] = useState("");
  const [aantal, setAantal] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = parseInt(aantal, 10);
    if (!van || !naar || !n || n < 1) {
      toast({ title: "Vul alle velden in", variant: "destructive" });
      return;
    }
    if (van === naar) {
      toast({ title: "Bron en bestemming mogen niet gelijk zijn", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await apiRequest("POST", "/api/credits/overdracht", {
        vanOrganisatieId: Number(van),
        naarOrganisatieId: Number(naar),
        aantal: n,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/organisaties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/transacties"] });
      toast({ title: `${n} credits overgedragen` });
      setOpen(false);
      setVan(""); setNaar(""); setAantal("");
    } catch (e: any) {
      toast({ title: "Overdracht mislukt", description: String(e.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid="button-credits-overdragen">
          <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Overdragen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credits overdragen</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Boekhoudkundige overdracht van beschikbare credits tussen organisaties — ook bruikbaar bij een latere entiteitswissel.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Van</Label>
            <Select value={van} onValueChange={setVan}>
              <SelectTrigger data-testid="select-overdracht-van"><SelectValue placeholder="Bron" /></SelectTrigger>
              <SelectContent>
                {organisaties.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.naam} ({o.saldo.beschikbaar} besch.)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Naar</Label>
            <Select value={naar} onValueChange={setNaar}>
              <SelectTrigger data-testid="select-overdracht-naar"><SelectValue placeholder="Bestemming" /></SelectTrigger>
              <SelectContent>
                {organisaties.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.naam}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ov-aantal">Aantal credits</Label>
            <Input id="ov-aantal" type="number" min={1} value={aantal} onChange={(e) => setAantal(e.target.value)} data-testid="input-overdracht-aantal" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} data-testid="button-overdracht-bevestig">
            {busy ? "Bezig…" : "Overdragen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Organisaties-tab
// ---------------------------------------------------------------------------
function OrganisatiesTab() {
  const { data: orgs, isLoading } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });
  const { data: pakketten } = useQuery<Creditpakket[]>({ queryKey: ["/api/creditpakketten"] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CreditsOverdragen organisaties={orgs ?? []} />
        <CreditsOpladen organisaties={orgs ?? []} pakketten={pakketten ?? []} />
        <NieuweOrganisatie />
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !orgs || orgs.length === 0 ? (
            <LegeStaat
              oog="NOG GEEN BESTEMMINGEN"
              titel="Nog geen organisaties"
              body="Voeg een bedrijf, school of coach toe om credits te beheren."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisatie</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Factuur</TableHead>
                  <TableHead className="text-right">Beschikbaar</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Gereserveerd</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Verbruikt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.map((o) => (
                  <TableRow key={o.id} data-testid={`row-org-${o.id}`}>
                    <TableCell className="font-medium text-foreground">{o.naam}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{TYPE_LABELS[o.type] ?? o.type}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={o.factuurType === "peppol" ? "bg-accent/15 text-accent border-accent/30" : "bg-muted text-muted-foreground border-border"}>
                        {o.factuurType === "peppol" ? "Peppol" : "PDF"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground" data-testid={`saldo-besch-${o.id}`}>{o.saldo.beschikbaar}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-muted-foreground">{o.saldo.gereserveerd}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right text-muted-foreground">{o.saldo.verbruikt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grootboek-tab
// ---------------------------------------------------------------------------
function GrootboekTab() {
  const { data: txs, isLoading } = useQuery<CreditTransactie[]>({ queryKey: ["/api/credits/transacties"] });
  const { data: orgs } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });
  const orgNaam = (id: number) => orgs?.find((o) => o.id === id)?.naam ?? `#${id}`;

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !txs || txs.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">Nog geen transacties.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tijdstip</TableHead>
                <TableHead>Organisatie</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Aantal</TableHead>
                <TableHead className="hidden md:table-cell">Omschrijving</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.map((t) => (
                <TableRow key={t.id} data-testid={`row-tx-${t.id}`}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{dt(t.createdAt)}</TableCell>
                  <TableCell className="text-foreground">{orgNaam(t.organisatieId)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TX_STYLE[t.type] ?? "bg-muted text-foreground border-border"}>{t.type}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-medium ${t.aantal >= 0 ? "text-accent" : "text-foreground"}`}>
                    {t.aantal > 0 ? `+${t.aantal}` : t.aantal}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{t.omschrijving ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Facturen
// ---------------------------------------------------------------------------
const FACTUUR_API_BASE = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();

function FacturenTab() {
  const { toast } = useToast();
  const { data: facturen, isLoading } = useQuery<Factuur[]>({ queryKey: ["/api/facturen"] });
  const { data: orgs } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });
  const { data: creditnotas } = useQuery<Array<{ id: number; factuurId: number; creditnotanummer: string }>>({ queryKey: ["/api/creditnotas"] });
  const orgNaam = (id: number) => orgs?.find((o) => o.id === id)?.naam ?? `#${id}`;
  const cnVoor = (factuurId: number) => creditnotas?.find((c) => c.factuurId === factuurId);
  async function maakCreditnota(factuurId: number) {
    const reden = window.prompt("Reden voor de creditnota?", "Correctie / terugbetaling");
    if (reden == null) return;
    try {
      const cn = await apiRequest("POST", "/api/creditnotas", { factuurId, reden, creditsTerugboeken: true }).then((r) => r.json());
      if (cn?.error) throw new Error(cn.error);
      queryClient.invalidateQueries({ queryKey: ["/api/creditnotas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organisaties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credits/transacties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bestuur/kpis"] });
      toast({ title: "Creditnota aangemaakt", description: `${cn.creditnotanummer}` });
    } catch (e: any) {
      toast({ title: "Creditnota mislukt", description: e?.message ?? "Onbekende fout", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !facturen || facturen.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground" data-testid="text-facturen-leeg">
            Nog geen facturen. Facturen worden automatisch aangemaakt bij een geslaagde online betaling.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factuurnummer</TableHead>
                <TableHead>Organisatie</TableHead>
                <TableHead className="hidden sm:table-cell">Datum</TableHead>
                <TableHead className="text-right">Bedrag incl. btw</TableHead>
                <TableHead>Kanaal</TableHead>
                <TableHead className="text-right">UBL</TableHead>
                <TableHead className="text-right">Creditnota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturen.map((f) => (
                <TableRow key={f.id} data-testid={`row-factuur-${f.id}`}>
                  <TableCell className="font-medium text-foreground" data-testid={`text-factuurnummer-${f.id}`}>
                    {f.factuurnummer}
                  </TableCell>
                  <TableCell className="text-foreground">{orgNaam(f.organisatieId)}</TableCell>
                  <TableCell className="hidden sm:table-cell whitespace-nowrap text-muted-foreground">
                    {dt(f.factuurdatum)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {euro(f.bedragInclBtw / 100)}
                  </TableCell>
                  <TableCell>
                    {f.kanaal === "peppol" ? (
                      <Badge variant="outline" className="bg-accent/15 text-accent border-accent/20" data-testid={`badge-kanaal-${f.id}`}>
                        Peppol
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-foreground border-border" data-testid={`badge-kanaal-${f.id}`}>
                        PDF
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      href={`${FACTUUR_API_BASE}/api/facturen/${f.id}/peppol.json`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-accent underline-offset-2 hover:underline"
                      data-testid={`link-peppol-${f.id}`}
                    >
                      UBL JSON
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    {cnVoor(f.id) ? (
                      <Badge variant="outline" className="bg-muted text-foreground border-border" data-testid={`badge-creditnota-${f.id}`}>
                        {cnVoor(f.id)!.creditnotanummer}
                      </Badge>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => maakCreditnota(f.id)} data-testid={`button-creditnota-${f.id}`}>
                        <FileText className="mr-1 h-3.5 w-3.5" />Crediteren
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Biller aanmaken
// ---------------------------------------------------------------------------
function NieuweBiller() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [vennootschapsnaam, setVennootschapsnaam] = useState("");
  const [prefix, setPrefix] = useState("");
  const [btw, setBtw] = useState("");
  const [kbo, setKbo] = useState("");
  const [peppolId, setPeppolId] = useState("");
  const [adres, setAdres] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!naam.trim() || !vennootschapsnaam.trim() || !prefix.trim()) {
      toast({ title: "Naam, vennootschapsnaam en prefix zijn verplicht", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await apiRequest("POST", "/api/billers", {
        naam: naam.trim(),
        vennootschapsnaam: vennootschapsnaam.trim(),
        factuurPrefix: prefix.trim(),
        btwNummer: btw.trim() || undefined,
        kboNummer: kbo.trim() || undefined,
        peppolId: peppolId.trim() || undefined,
        adres: adres.trim() || undefined,
        btwTarief: 21,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/billers"] });
      toast({ title: "Biller toegevoegd", description: "Activeer deze om de entiteitswissel uit te voeren." });
      setOpen(false);
      setNaam(""); setVennootschapsnaam(""); setPrefix(""); setBtw(""); setKbo(""); setPeppolId(""); setAdres("");
    } catch (e: any) {
      toast({ title: "Kon niet opslaan", description: String(e.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-nieuwe-biller">
          <Plus className="mr-1.5 h-4 w-4" /> Entiteit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe facturerende entiteit</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Voor de latere overstap (bv. naar de PMV-entiteit). Historische facturen blijven onder de oude entiteit.
        </p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-naam">Naam *</Label>
              <Input id="b-naam" value={naam} onChange={(e) => setNaam(e.target.value)} data-testid="input-biller-naam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-prefix">Factuurprefix *</Label>
              <Input id="b-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="bv. TPC" data-testid="input-biller-prefix" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-venn">Vennootschapsnaam *</Label>
            <Input id="b-venn" value={vennootschapsnaam} onChange={(e) => setVennootschapsnaam(e.target.value)} data-testid="input-biller-venn" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-adres">Adres</Label>
            <Input id="b-adres" value={adres} onChange={(e) => setAdres(e.target.value)} data-testid="input-biller-adres" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-btw">BTW-nummer</Label>
              <Input id="b-btw" value={btw} onChange={(e) => setBtw(e.target.value)} data-testid="input-biller-btw" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-kbo">KBO-nummer</Label>
              <Input id="b-kbo" value={kbo} onChange={(e) => setKbo(e.target.value)} data-testid="input-biller-kbo" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-peppol">Peppol-ID</Label>
            <Input id="b-peppol" value={peppolId} onChange={(e) => setPeppolId(e.target.value)} placeholder="0208:…" data-testid="input-biller-peppol" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy} data-testid="button-biller-opslaan">
            {busy ? "Bezig…" : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Biller-tab
// ---------------------------------------------------------------------------
function BillerTab() {
  const { toast } = useToast();
  const { data: billers, isLoading } = useQuery<BillerEntiteit[]>({ queryKey: ["/api/billers"] });

  async function activeer(id: number) {
    try {
      await apiRequest("POST", `/api/billers/${id}/activeer`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/billers"] });
      toast({ title: "Entiteit geactiveerd", description: "Nieuwe facturen worden onder deze entiteit uitgestuurd." });
    } catch (e: any) {
      toast({ title: "Activeren mislukt", description: String(e.message ?? e), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          De actieve entiteit verschijnt op nieuwe facturen. Bij de PMV-overstap activeer je de nieuwe entiteit; oude facturen blijven onveranderd.
        </p>
        <div className="flex-shrink-0">
          <NieuweBiller />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(billers ?? []).map((b) => (
            <Card key={b.id} data-testid={`card-biller-${b.id}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{b.naam}</CardTitle>
                {b.actief ? (
                  <Badge variant="outline" className="bg-accent/15 text-accent border-accent/30">Actief</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => activeer(b.id)} data-testid={`button-activeer-${b.id}`}>Activeren</Button>
                )}
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p className="text-foreground">{b.vennootschapsnaam}</p>
                {b.adres && <p>{b.adres}{b.postcode ? `, ${b.postcode} ${b.gemeente ?? ""}` : ""}</p>}
                {b.btwNummer && <p>BTW {b.btwNummer}</p>}
                {b.peppolId && <p>Peppol {b.peppolId}</p>}
                <p>
                  Factuurnummering: <span className="font-medium text-foreground">{b.factuurPrefix}-{new Date().getFullYear()}-0001</span>
                  <span className="text-muted-foreground"> · BTW {b.btwTarief}%</span>
                </p>
                {b.geldigTot && <p>Afgesloten op {new Date(b.geldigTot).toLocaleDateString("nl-BE")}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hoofdpagina
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bestuur-tab: KPI-momentopname voor de Raad van Bestuur + boekhoudexport
// ---------------------------------------------------------------------------
interface BestuursKpis {
  gegenereerdOp: string;
  munt: string;
  omzet: { totaalExclBtw: number; totaalBtw: number; totaalInclBtw: number; nettoExclBtwNaCreditnotas: number; aantalFacturen: number; aantalCreditnotas: number };
  klanten: { aantalOrganisaties: number; aantalBetalendeOrganisaties: number; perType: Record<string, number> };
  credits: { verkocht: number; verbruikt: number; gereserveerd: number; beschikbaarUitstaand: number; verzilveringsgraad: number };
  afnames: { totaal: number; voltooid: number; inUitvoering: number; voltooiingsgraad: number; rapportenGegenereerd: number };
  betalingen: { geslaagd: number; mislukt: number; open: number; slagingsgraad: number };
  gemiddelden: { gemiddeldeOrderwaardeExclBtw: number; omzetPerBetalendeOrganisatie: number };
  gdpr: { afnamesMetPersoonsgegevens: number; geanonimiseerd: number; consentIngetrokken: number; bewaartermijnVerstreken: number };
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={`kpi-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function BestuurTab() {
  const { data: k, isLoading } = useQuery<BestuursKpis>({ queryKey: ["/api/bestuur/kpis"] });
  if (isLoading || !k) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }
  return (
    <div className="space-y-6" data-testid="bestuur-dashboard">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Omzet & facturatie</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Omzet excl. btw" value={euro(k.omzet.totaalExclBtw)} sub={`${k.omzet.aantalFacturen} facturen`} />
          <Kpi label="Btw" value={euro(k.omzet.totaalBtw)} />
          <Kpi label="Netto na creditnota's" value={euro(k.omzet.nettoExclBtwNaCreditnotas)} sub={`${k.omzet.aantalCreditnotas} creditnota's`} />
          <Kpi label="Gem. orderwaarde" value={euro(k.gemiddelden.gemiddeldeOrderwaardeExclBtw)} />
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Klanten & credits</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Organisaties" value={String(k.klanten.aantalOrganisaties)} sub={`${k.klanten.aantalBetalendeOrganisaties} betalend`} />
          <Kpi label="Credits verkocht" value={String(k.credits.verkocht)} sub={`${k.credits.beschikbaarUitstaand} uitstaand`} />
          <Kpi label="Credits verbruikt" value={String(k.credits.verbruikt)} />
          <Kpi label="Verzilveringsgraad" value={`${k.credits.verzilveringsgraad}%`} />
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Afnames & betalingen</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Afnames totaal" value={String(k.afnames.totaal)} sub={`${k.afnames.inUitvoering} lopend`} />
          <Kpi label="Voltooiingsgraad" value={`${k.afnames.voltooiingsgraad}%`} sub={`${k.afnames.voltooid} voltooid`} />
          <Kpi label="Rapporten" value={String(k.afnames.rapportenGegenereerd)} />
          <Kpi label="Betaalslagingsgraad" value={`${k.betalingen.slagingsgraad}%`} sub={`${k.betalingen.geslaagd} ok / ${k.betalingen.mislukt} mislukt`} />
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">GDPR-status</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Met persoonsgegevens" value={String(k.gdpr.afnamesMetPersoonsgegevens)} />
          <Kpi label="Geanonimiseerd" value={String(k.gdpr.geanonimiseerd)} />
          <Kpi label="Toestemming ingetrokken" value={String(k.gdpr.consentIngetrokken)} />
          <Kpi label="Bewaartermijn verstreken" value={String(k.gdpr.bewaartermijnVerstreken)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <a href={`${FACTUUR_API_BASE}/api/bestuur/boekhoudexport.csv`} target="_blank" rel="noreferrer" data-testid="link-boekhoudexport-csv">
          <Button size="sm" variant="outline"><Download className="mr-2 h-4 w-4" />Boekhoudexport (CSV)</Button>
        </a>
        <a href={`${FACTUUR_API_BASE}/api/bestuur/kpis`} target="_blank" rel="noreferrer" data-testid="link-kpis-json">
          <Button size="sm" variant="outline"><BarChart3 className="mr-2 h-4 w-4" />KPI's (JSON)</Button>
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Momentopname gegenereerd op {dt(k.gegenereerdOp)}. Bedragen in {k.munt}. Alle cijfers zijn reconstrueerbaar uit het grootboek, de facturen en de afnames.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tendenzen-tab: geaggregeerd, niet-individueel organisatiebeeld
// ---------------------------------------------------------------------------
interface OrgTendenzen {
  organisatie: string;
  aantalProfielen: number;
  voldoende: boolean;
  minimum?: number;
  energie?: { gemVragenlijst: number | null; gemBaseline: number | null; gemConsistentie: number | null };
  talentfoci?: { naam: string; gemNet: number }[];
  talentversnellers?: { naam: string; gemNet: number }[];
  drivers?: { naam: string; gemNet: number }[];
  driverBelasting?: { hoog: number; matig: number; laag: number };
  verbondenheid?: {
    psychologisch: number | null;
    billijkheid: number | null;
    zelfinvestering: number | null;
    organisatieInvestering: number | null;
  };
}

function TendenzBalk({ naam, waarde, max }: { naam: string; waarde: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(4, (Math.abs(waarde) / max) * 100)) : 4;
  const positief = waarde >= 0;
  return (
    <div className="flex items-center gap-3" data-testid={`tendenz-${naam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className="w-44 shrink-0 truncate text-sm text-foreground" title={naam}>{naam}</div>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${positief ? "bg-primary" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
        {waarde > 0 ? "+" : ""}{waarde}
      </div>
    </div>
  );
}

function TendenzenTab() {
  const { data: orgs } = useQuery<OrganisatieMetSaldo[]>({ queryKey: ["/api/organisaties"] });
  const [orgId, setOrgId] = useState<string>("");
  const { data: t, isLoading } = useQuery<OrgTendenzen>({
    queryKey: [`/api/organisaties/${orgId}/tendenzen`],
    enabled: !!orgId,
  });
  const gekozen = orgId || "";

  return (
    <div className="space-y-6" data-testid="tendenzen-dashboard">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Hoe doen we het als organisatie?</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Een geaggregeerd, niet-individueel beeld van de voltooide profielen binnen één
            organisatie: waar zit collectief de talentfocus, hoe staat het met de energie en
            de driver-belasting. Strikt anoniem — minimaal drie profielen, geen enkel individu is herleidbaar.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Label className="text-xs">Organisatie</Label>
          <Select value={gekozen} onValueChange={setOrgId}>
            <SelectTrigger data-testid="select-tendenzen-org" className="mt-1">
              <SelectValue placeholder="Kies een organisatie" />
            </SelectTrigger>
            <SelectContent>
              {(orgs ?? []).map((o) => (
                <SelectItem key={o.id} value={String(o.id)}>{o.naam}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!gekozen ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="tendenzen-leeg">
          Kies een organisatie om het collectieve beeld te zien.
        </div>
      ) : isLoading || !t ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !t.voldoende ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-6 text-sm text-foreground" data-testid="tendenzen-onvoldoende">
          <p className="font-medium">Nog onvoldoende profielen voor een anoniem beeld</p>
          <p className="mt-1 text-muted-foreground">
            {t.organisatie} heeft {t.aantalProfielen} voltooid profiel(en). Een organisatiebeeld
            wordt pas getoond vanaf {t.minimum ?? 3} profielen, zodat geen enkel individu herleidbaar is.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Profielen in beeld" value={String(t.aantalProfielen)} sub="voltooid" />
            <Kpi label="Gem. energie vragenlijst" value={t.energie?.gemVragenlijst != null ? `${t.energie.gemVragenlijst}/10` : "—"} sub={t.energie?.gemBaseline != null ? `baseline ${t.energie.gemBaseline}/10` : undefined} />
            <Kpi label="Gem. consistentie" value={t.energie?.gemConsistentie != null ? `${t.energie.gemConsistentie}/100` : "—"} />
            <Kpi label="Driver-belasting" value={`${t.driverBelasting?.laag ?? 0} laag`} sub={`${t.driverBelasting?.matig ?? 0} matig · ${t.driverBelasting?.hoog ?? 0} hoog`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Collectieve talentfoci</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(t.talentfoci ?? []).map((f) => (
                <TendenzBalk key={f.naam} naam={f.naam} waarde={f.gemNet} max={8} />
              ))}
              <p className="pt-1 text-xs text-muted-foreground">Gemiddelde nettoscore per construct over alle profielen.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Versterkend gedrag (versnellers)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(t.talentversnellers ?? []).map((f) => (
                <TendenzBalk key={f.naam} naam={f.naam} waarde={f.gemNet} max={8} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Drivers onder druk (geaggregeerd)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(t.drivers ?? []).map((f) => (
                <TendenzBalk key={f.naam} naam={f.naam} waarde={f.gemNet} max={8} />
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Reflectief, niet diagnostisch. Drivers verwijzen naar onbewuste controlemechanismen die de toegang tot talent onder druk kunnen beïnvloeden.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Verbondenheid met de organisatie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Psychologisch" value={t.verbondenheid?.psychologisch != null ? `${t.verbondenheid.psychologisch}/10` : "—"} />
                <Kpi label="Billijkheid / verloning" value={t.verbondenheid?.billijkheid != null ? `${t.verbondenheid.billijkheid}/10` : "—"} />
                <Kpi label="Zelfinvestering" value={t.verbondenheid?.zelfinvestering != null ? `${t.verbondenheid.zelfinvestering}/10` : "—"} />
                <Kpi label="Organisatie-investering" value={t.verbondenheid?.organisatieInvestering != null ? `${t.verbondenheid.organisatieInvestering}/10` : "—"} />
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Geaggregeerd beeld van {t.organisatie}. Alle cijfers zijn gemiddelden over {t.aantalProfielen} voltooide profielen; individuele resultaten worden nooit getoond.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarieven (prior-only) -- overzicht van de credit-kost per instrument, inclusief
// bundeltarieven (bv. impact-roos: 10 stuks = 5 credits). Toegankelijk via
// dezelfde governance-actor als de toegang-pagina: enkel een ACTIEVE PRIOR
// beheerder van TaPasCity ziet de tarieven (server dwingt dit af via
// /api/toegang/tarieven?actorId=).
// ---------------------------------------------------------------------------
interface PriorMinimaal {
  id: number;
  naam: string;
  isPrior: boolean;
  actief: boolean;
}

interface TariefRegel {
  instrumentId: string;
  name: string;
  flowType: "individual" | "collaborative" | "journey";
  version: string;
  description: string;
  isDefault: boolean;
  model: "per-stuk" | "bundel";
  creditCost: number;
  creditPerStuk: number;
  bundelGrootte?: number;
  bundelCredits?: number;
  tariefOmschrijving: string;
  bron: "default" | "aangepast" | "los";
  isRegistry: boolean;
  gewijzigdDoor?: string | null;
  updatedAt?: string | null;
}

const FLOW_LABELS: Record<string, string> = {
  individual: "Individueel",
  collaborative: "Collaboratief",
  journey: "Traject",
};

// Bewerk-/aanmaakdialoog voor een tariefregel. Bij een bestaand registry-
// instrument zijn naam en type vast; bij een losse regel zijn alle velden vrij.
function TariefDialoog({
  open,
  onOpenChange,
  regel,
  actorId,
  nieuw,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  regel: TariefRegel | null;
  actorId: string;
  nieuw: boolean;
}) {
  const { toast } = useToast();
  const [instrumentId, setInstrumentId] = useState("");
  const [naam, setNaam] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [flowType, setFlowType] = useState("individual");
  const [model, setModel] = useState<"per-stuk" | "bundel">("per-stuk");
  const [creditCost, setCreditCost] = useState("1");
  const [bundelGrootte, setBundelGrootte] = useState("10");
  const [bundelCredits, setBundelCredits] = useState("5");
  const [busy, setBusy] = useState(false);

  // Synchroniseer de velden telkens de dialoog opengaat.
  useMemo(() => {
    if (!open) return;
    if (regel) {
      setInstrumentId(regel.instrumentId);
      setNaam(regel.name);
      setOmschrijving(regel.description ?? "");
      setFlowType(regel.flowType);
      setModel(regel.model);
      setCreditCost(String(regel.creditCost ?? 1));
      setBundelGrootte(String(regel.bundelGrootte ?? 10));
      setBundelCredits(String(regel.bundelCredits ?? 5));
    } else {
      setInstrumentId("");
      setNaam("");
      setOmschrijving("");
      setFlowType("individual");
      setModel("per-stuk");
      setCreditCost("1");
      setBundelGrootte("10");
      setBundelCredits("5");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isRegistry = !!regel?.isRegistry;

  async function opslaan() {
    const slug =
      nieuw
        ? (instrumentId.trim() ||
            `custom-${naam.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`)
        : instrumentId.trim();
    if (!naam.trim()) {
      toast({ title: "Naam ontbreekt", variant: "destructive" });
      return;
    }
    const payload: any = {
      actorId: Number(actorId),
      instrumentId: slug,
      naam: naam.trim(),
      omschrijving: omschrijving.trim(),
      flowType,
      model,
      // creditCost moet een geheel getal zijn. Bij een bundeltarief is de
      // per-stuk-waarde niet relevant (de server leidt die af), dus sturen we
      // dan een neutrale 1 mee om validatie op een afgeleide float te vermijden.
      creditCost: model === "bundel" ? 1 : Math.max(0, Math.round(Number(creditCost) || 0)),
      isCustom: nieuw && !isRegistry,
    };
    if (model === "bundel") {
      payload.bundelGrootte = Math.max(0, Math.round(Number(bundelGrootte) || 0));
      payload.bundelCredits = Math.max(0, Math.round(Number(bundelCredits) || 0));
    }
    setBusy(true);
    try {
      await apiRequest("POST", "/api/toegang/tarieven", payload);
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/toegang/tarieven"),
      });
      toast({ title: "Tarief opgeslagen" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Kon niet opslaan", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-tarief">
        <DialogHeader>
          <DialogTitle>{nieuw ? "Nieuwe tariefregel" : `Tarief bewerken: ${regel?.name ?? ""}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {nieuw && (
            <div className="space-y-2">
              <Label htmlFor="tarief-naam">Naam</Label>
              <Input id="tarief-naam" value={naam} onChange={(e) => setNaam(e.target.value)} data-testid="input-tarief-naam" />
            </div>
          )}
          {!nieuw && isRegistry && (
            <p className="text-xs text-muted-foreground">
              Dit is een vast instrument. Je past het tarief aan; naam en type blijven ongewijzigd.
            </p>
          )}
          {nieuw && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tarief-flow">Type</Label>
                <Select value={flowType} onValueChange={setFlowType}>
                  <SelectTrigger id="tarief-flow" data-testid="select-tarief-flow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individueel</SelectItem>
                    <SelectItem value="collaborative">Collaboratief</SelectItem>
                    <SelectItem value="journey">Traject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="tarief-oms">Omschrijving</Label>
            <Input id="tarief-oms" value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} data-testid="input-tarief-omschrijving" />
          </div>

          <div className="space-y-2">
            <Label>Tariferingsmodel</Label>
            <Select value={model} onValueChange={(v) => setModel(v as "per-stuk" | "bundel")}>
              <SelectTrigger data-testid="select-tarief-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per-stuk">Per stuk (N credits per afname)</SelectItem>
                <SelectItem value="bundel">Per bundel (X stuks = N credits)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {model === "per-stuk" ? (
            <div className="space-y-2">
              <Label htmlFor="tarief-credit">Credits per afname</Label>
              <Input
                id="tarief-credit"
                type="number"
                min={0}
                value={creditCost}
                onChange={(e) => setCreditCost(e.target.value)}
                data-testid="input-tarief-creditcost"
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tarief-grootte">Aantal stuks per bundel</Label>
                <Input
                  id="tarief-grootte"
                  type="number"
                  min={1}
                  value={bundelGrootte}
                  onChange={(e) => setBundelGrootte(e.target.value)}
                  data-testid="input-tarief-bundelgrootte"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarief-bcredits">Credits per bundel</Label>
                <Input
                  id="tarief-bcredits"
                  type="number"
                  min={0}
                  value={bundelCredits}
                  onChange={(e) => setBundelCredits(e.target.value)}
                  data-testid="input-tarief-bundelcredits"
                />
              </div>
            </div>
          )}
          {model === "bundel" && (
            <p className="text-xs text-muted-foreground">
              Voorbeeld: {bundelGrootte || "?"} stuks = {bundelCredits || "?"} credits.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-tarief-annuleer">
            Annuleren
          </Button>
          <Button onClick={opslaan} disabled={busy} data-testid="button-tarief-opslaan">
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TarievenTab() {
  const { toast } = useToast();
  const { data: minimaalLijst } = useQuery<PriorMinimaal[]>({
    queryKey: ["/api/toegang/beheerders"],
  });
  const priors = useMemo(
    () => (minimaalLijst ?? []).filter((b) => b.isPrior && b.actief),
    [minimaalLijst],
  );
  const [actorId, setActorId] = useState<string>("");
  const effectActor = actorId || (priors[0] ? String(priors[0].id) : "");

  const {
    data: tarieven,
    isLoading,
    error,
  } = useQuery<TariefRegel[]>({
    queryKey: [`/api/toegang/tarieven?actorId=${effectActor}`],
    enabled: !!effectActor,
  });

  const [dialoogOpen, setDialoogOpen] = useState(false);
  const [bewerkRegel, setBewerkRegel] = useState<TariefRegel | null>(null);
  const [nieuw, setNieuw] = useState(false);

  const fmtCredits = (n: number) => {
    const afgerond = Math.round(n * 100) / 100;
    return Number.isInteger(afgerond) ? String(afgerond) : afgerond.toString().replace(".", ",");
  };

  function openBewerk(r: TariefRegel) {
    setBewerkRegel(r);
    setNieuw(false);
    setDialoogOpen(true);
  }
  function openNieuw() {
    setBewerkRegel(null);
    setNieuw(true);
    setDialoogOpen(true);
  }

  async function verwijder(r: TariefRegel) {
    const tekst = r.bron === "los"
      ? `Losse regel "${r.name}" verwijderen?`
      : `Aanpassing voor "${r.name}" terugzetten naar het standaardtarief?`;
    if (!window.confirm(tekst)) return;
    try {
      await apiRequest("DELETE", `/api/toegang/tarieven/${encodeURIComponent(r.instrumentId)}?actorId=${effectActor}`);
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/toegang/tarieven"),
      });
      toast({ title: r.bron === "los" ? "Regel verwijderd" : "Teruggezet op standaard" });
    } catch (e: any) {
      toast({ title: "Kon niet verwijderen", description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  if (priors.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden />
          Het tarievenoverzicht is uitsluitend toegankelijk voor prior beheerders van TaPasCity.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
              <Label>Prior beheerder</Label>
            </div>
            <Select value={effectActor} onValueChange={setActorId}>
              <SelectTrigger className="w-[260px]" data-testid="select-tarieven-actor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priors.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} data-testid={`option-tarieven-actor-${p.id}`}>
                    {p.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Dit overzicht is enkel zichtbaar en bewerkbaar voor prior beheerders. De server controleert de actor bij elke wijziging.
            </p>
          </div>
          <Button onClick={openNieuw} data-testid="button-nieuwe-tariefregel">
            <Plus className="mr-1.5 h-4 w-4" /> Nieuwe tariefregel
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-destructive">
            <Lock className="h-4 w-4" aria-hidden />
            {String((error as any)?.message ?? error)}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-accent" aria-hidden /> Tarieven per instrument
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tarief</TableHead>
                  <TableHead className="text-right">Per afname</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tarieven ?? []).map((r) => (
                  <TableRow key={r.instrumentId} data-testid={`tarief-rij-${r.instrumentId}`}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{r.name}</span>
                        {r.isDefault && (
                          <Badge variant="outline" className="text-xs">standaard</Badge>
                        )}
                        {r.bron === "aangepast" && (
                          <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-800 text-xs dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" data-testid={`badge-aangepast-${r.instrumentId}`}>
                            aangepast
                          </Badge>
                        )}
                        {r.bron === "los" && (
                          <Badge variant="outline" className="border-teal-200 bg-teal-100 text-teal-800 text-xs dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300" data-testid={`badge-los-${r.instrumentId}`}>
                            losse regel
                          </Badge>
                        )}
                      </div>
                      <span className="mt-0.5 block max-w-md text-xs text-muted-foreground">{r.description}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{FLOW_LABELS[r.flowType] ?? r.flowType}</span>
                    </TableCell>
                    <TableCell>
                      {r.model === "bundel" ? (
                        <Badge
                          variant="outline"
                          className="border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                          data-testid={`tarief-bundel-${r.instrumentId}`}
                        >
                          <Layers className="mr-1 h-3 w-3" /> {r.tariefOmschrijving}
                        </Badge>
                      ) : (
                        <span className="text-sm text-foreground" data-testid={`tarief-perstuk-${r.instrumentId}`}>
                          {r.tariefOmschrijving}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-sm text-foreground">
                        {fmtCredits(r.creditPerStuk)} {r.creditPerStuk === 1 ? "credit" : "credits"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openBewerk(r)} data-testid={`button-tarief-bewerk-${r.instrumentId}`}>
                          Bewerken
                        </Button>
                        {(r.bron === "los" || r.bron === "aangepast") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => verwijder(r)}
                            data-testid={`button-tarief-verwijder-${r.instrumentId}`}
                            title={r.bron === "los" ? "Verwijderen" : "Terug naar standaard"}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground">
              Instrumenten met een bundeltarief worden per vaste hoeveelheid verrekend in plaats van per stuk. Voorbeeld: de impact-roos gaat per 10: tien impact-rozen kosten samen 5 credits. De kolom Per afname toont de afgeleide kost per stuk. Een aangepast tarief kun je met de prullenbak terugzetten op het standaardtarief; losse regels worden volledig verwijderd.
            </p>
          </CardContent>
        </Card>
      )}

      <TariefDialoog
        open={dialoogOpen}
        onOpenChange={setDialoogOpen}
        regel={bewerkRegel}
        actorId={effectActor}
        nieuw={nieuw}
      />
    </div>
  );
}

export default function AdminCredits() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <Link href="/admin">
            <Button size="sm" variant="outline" data-testid="link-afnames">← Admin beheer</Button>
          </Link>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Credits & facturatie</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Beheer organisaties, creditsaldi en de facturerende entiteit. Credits worden gereserveerd bij het aanmaken van een link en verbruikt bij voltooiing.
        </p>

        <Tabs defaultValue="organisaties" className="mt-6">
          <TabsList>
            <TabsTrigger value="organisaties" data-testid="tab-organisaties">Organisaties</TabsTrigger>
            <TabsTrigger value="grootboek" data-testid="tab-grootboek">Grootboek</TabsTrigger>
            <TabsTrigger value="facturen" data-testid="tab-facturen">Facturen</TabsTrigger>
            <TabsTrigger value="tendenzen" data-testid="tab-tendenzen">Tendenzen</TabsTrigger>
            <TabsTrigger value="bestuur" data-testid="tab-bestuur">Bestuur</TabsTrigger>
            <TabsTrigger value="biller" data-testid="tab-biller">Entiteit</TabsTrigger>
            <TabsTrigger value="tarieven" data-testid="tab-tarieven">Tarieven</TabsTrigger>
          </TabsList>
          <TabsContent value="organisaties" className="mt-4">
            <OrganisatiesTab />
          </TabsContent>
          <TabsContent value="grootboek" className="mt-4">
            <GrootboekTab />
          </TabsContent>
          <TabsContent value="facturen" className="mt-4">
            <FacturenTab />
          </TabsContent>
          <TabsContent value="tendenzen" className="mt-4">
            <TendenzenTab />
          </TabsContent>
          <TabsContent value="bestuur" className="mt-4">
            <BestuurTab />
          </TabsContent>
          <TabsContent value="biller" className="mt-4">
            <BillerTab />
          </TabsContent>
          <TabsContent value="tarieven" className="mt-4">
            <TarievenTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
