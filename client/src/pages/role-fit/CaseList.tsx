// ---------------------------------------------------------------------------
// CaseList: overzicht van de Role Fit-cases waartoe de beheerder toegang heeft
// (need-to-know) en het formulier om een case te starten vanuit een afgerond
// T4P Business Kompas-profiel. Route: /admin/role-fit
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Briefcase } from "lucide-react";
import {
  BESLISDOELEN,
  BESLISDOEL_LABEL,
  RECHTSGRONDEN,
  RECHTSGROND_LABEL,
  CASE_STATUS_LABEL,
  type CaseStatus,
} from "@shared/role-fit";
import { RF_API, foutTekst, rfPost } from "./api";

type Kandidaat = { id: number; naam: string; rol: string | null; organisatieId: number; taal: string };
type Beheerder = { id: number; naam: string; email: string; organisatieId: number | null; isPrior: boolean };
type CaseRij = {
  id: number;
  kandidaatLabel: string;
  functieTitel: string;
  beslisdoel: string;
  status: CaseStatus;
  bewaarTot: string;
  rollen: string[];
};

const ROL_LABEL: Record<string, string> = {
  owner: "eigenaar",
  prior: "prior",
  recruiter: "recruiter",
  hiring_manager: "hiring manager",
  signer: "ondertekenaar",
  reviewer: "reviewer",
};

function inEenJaar(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const LEEG = {
  afnameId: "",
  functieTitel: "",
  beslisdoel: "selectie",
  senioriteit: "",
  beslisdatum: "",
  recruiterNaam: "",
  recruiterEmail: "",
  recruiterAdminId: "",
  hmNaam: "",
  hmEmail: "",
  hmAdminId: "",
  signerAdminId: "",
  reviewerAdminId: "",
  rechtsgrond: "precontractuele_maatregelen",
  kandidaatGeinformeerd: false,
  bewaarTot: inEenJaar(),
};

export default function RoleFitCaseList() {
  const { toast } = useToast();
  const [, naar] = useLocation();
  const [nieuw, setNieuw] = useState(false);
  const [f, setF] = useState({ ...LEEG });
  const zet = (k: keyof typeof LEEG, v: any) => setF((o) => ({ ...o, [k]: v }));

  const { data: cases = [], isLoading } = useQuery<CaseRij[]>({ queryKey: [`${RF_API}/cases`] });
  const { data: kandidaten = [] } = useQuery<Kandidaat[]>({ queryKey: [`${RF_API}/afname-kandidaten`], enabled: nieuw });
  const gekozen = kandidaten.find((k) => String(k.id) === f.afnameId);
  const { data: beheerders = [] } = useQuery<Beheerder[]>({
    queryKey: [`${RF_API}/beheerders${gekozen ? `?organisatieId=${gekozen.organisatieId}` : ""}`],
    enabled: nieuw,
  });

  const maak = useMutation({
    mutationFn: () => {
      const optNum = (s: string) => (s ? Number(s) : null);
      return rfPost<{ id: number; ontbrekendeConstructen: string[] }>("/cases", {
        afnameId: Number(f.afnameId),
        functieTitel: f.functieTitel,
        beslisdoel: f.beslisdoel,
        senioriteit: f.senioriteit,
        beslisdatum: f.beslisdatum,
        taal: "nl",
        recruiterNaam: f.recruiterNaam,
        recruiterEmail: f.recruiterEmail,
        recruiterAdminId: optNum(f.recruiterAdminId),
        hmNaam: f.hmNaam,
        hmEmail: f.hmEmail,
        hmAdminId: optNum(f.hmAdminId),
        signerAdminId: Number(f.signerAdminId),
        reviewerAdminId: optNum(f.reviewerAdminId),
        rechtsgrond: f.rechtsgrond,
        kandidaatGeinformeerd: f.kandidaatGeinformeerd,
        bewaarTot: f.bewaarTot,
      });
    },
    onSuccess: (r) => {
      if (r.ontbrekendeConstructen.length) {
        toast({ title: "Case gestart", description: `Niet in het profiel: ${r.ontbrekendeConstructen.join(", ")}. Die dimensies blijven niet beoordeelbaar.` });
      } else {
        toast({ title: "Case gestart" });
      }
      naar(`/admin/role-fit/${r.id}`);
    },
    onError: (e) => toast({ title: "Case niet gestart", description: foutTekst(e), variant: "destructive" }),
  });

  const klaar =
    f.afnameId && f.functieTitel.trim() && f.recruiterNaam.trim() && f.recruiterEmail.trim() && f.hmNaam.trim() && f.hmEmail.trim() && f.signerAdminId && f.kandidaatGeinformeerd;

  const beheerderKeuze = (veld: keyof typeof LEEG, optioneel: boolean, testid: string) => (
    <Select value={(f[veld] as string) || (optioneel ? "geen" : "")} onValueChange={(v) => zet(veld, v === "geen" ? "" : v)}>
      <SelectTrigger data-testid={testid}>
        <SelectValue placeholder="Kies een beheerder" />
      </SelectTrigger>
      <SelectContent>
        {optioneel && <SelectItem value="geen">Geen account (enkel via link)</SelectItem>}
        {beheerders.map((b) => (
          <SelectItem key={b.id} value={String(b.id)}>
            {b.naam} ({b.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/admin">
          <a className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Terug naar beheer
          </a>
        </Link>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold" data-testid="rf-titel">Recruitment &amp; Role Fit</h1>
            <p className="text-sm text-muted-foreground">
              Beslisondersteuning bij een selectie of interne mobiliteit. Het systeem neemt nooit zelf een besluit; een aangeduide ondertekenaar tekent.
            </p>
          </div>
          <Button onClick={() => setNieuw((x) => !x)} data-testid="rf-nieuw">
            <Plus className="mr-1 h-4 w-4" /> Nieuwe case
          </Button>
        </div>

        {nieuw && (
          <Card className="mb-6">
            <CardContent className="grid gap-4 p-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Kandidaat (afgerond T4P Business Kompas-profiel)</Label>
                <Select value={f.afnameId} onValueChange={(v) => zet("afnameId", v)}>
                  <SelectTrigger data-testid="rf-afname">
                    <SelectValue placeholder={kandidaten.length ? "Kies een profiel" : "Geen bruikbaar profiel gevonden"} />
                  </SelectTrigger>
                  <SelectContent>
                    {kandidaten.map((k) => (
                      <SelectItem key={k.id} value={String(k.id)}>
                        {k.naam} {k.rol ? `(${k.rol})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Functie</Label>
                <Input value={f.functieTitel} onChange={(e) => zet("functieTitel", e.target.value)} data-testid="rf-functie" />
              </div>
              <div>
                <Label>Beslisdoel</Label>
                <Select value={f.beslisdoel} onValueChange={(v) => zet("beslisdoel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BESLISDOELEN.map((b) => <SelectItem key={b} value={b}>{BESLISDOEL_LABEL[b]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Senioriteit (optioneel)</Label>
                <Input value={f.senioriteit} onChange={(e) => zet("senioriteit", e.target.value)} />
              </div>
              <div>
                <Label>Beoogde beslisdatum (optioneel)</Label>
                <Input type="date" value={f.beslisdatum} onChange={(e) => zet("beslisdatum", e.target.value)} />
              </div>
              <div>
                <Label>Recruiter: naam</Label>
                <Input value={f.recruiterNaam} onChange={(e) => zet("recruiterNaam", e.target.value)} data-testid="rf-recruiter-naam" />
              </div>
              <div>
                <Label>Recruiter: e-mail</Label>
                <Input type="email" value={f.recruiterEmail} onChange={(e) => zet("recruiterEmail", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Recruiter: beheerdersaccount</Label>
                {beheerderKeuze("recruiterAdminId", true, "rf-recruiter-admin")}
              </div>
              <div>
                <Label>Hiring manager: naam</Label>
                <Input value={f.hmNaam} onChange={(e) => zet("hmNaam", e.target.value)} data-testid="rf-hm-naam" />
              </div>
              <div>
                <Label>Hiring manager: e-mail</Label>
                <Input type="email" value={f.hmEmail} onChange={(e) => zet("hmEmail", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Hiring manager: beheerdersaccount</Label>
                {beheerderKeuze("hmAdminId", true, "rf-hm-admin")}
              </div>
              <div>
                <Label>Ondertekenaar van het besluit</Label>
                {beheerderKeuze("signerAdminId", false, "rf-signer")}
              </div>
              <div>
                <Label>Reviewer (optioneel)</Label>
                {beheerderKeuze("reviewerAdminId", true, "rf-reviewer")}
              </div>
              <div>
                <Label>Rechtsgrond</Label>
                <Select value={f.rechtsgrond} onValueChange={(v) => zet("rechtsgrond", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECHTSGRONDEN.map((r) => <SelectItem key={r} value={r}>{RECHTSGROND_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bewaren tot</Label>
                <Input type="date" value={f.bewaarTot} onChange={(e) => zet("bewaarTot", e.target.value)} />
              </div>
              <label className="flex items-start gap-2 text-sm md:col-span-2">
                <Checkbox checked={f.kandidaatGeinformeerd} onCheckedChange={(v) => zet("kandidaatGeinformeerd", v === true)} data-testid="rf-geinformeerd" />
                <span>De kandidaat is geinformeerd over dit gebruik van het profiel, het doel en de bewaartermijn.</span>
              </label>
              <div className="flex justify-end gap-2 md:col-span-2">
                <Button variant="outline" onClick={() => { setNieuw(false); setF({ ...LEEG }); }}>Annuleren</Button>
                <Button disabled={!klaar || maak.isPending} onClick={() => maak.mutate()} data-testid="rf-start">Case starten</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : cases.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Nog geen cases waartoe u toegang hebt.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {cases.map((c) => (
              <Link key={c.id} href={`/admin/role-fit/${c.id}`}>
                <a data-testid={`rf-case-${c.id}`}>
                  <Card className="transition hover:border-primary">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{c.functieTitel}</div>
                          <div className="text-sm text-muted-foreground">
                            {c.kandidaatLabel}, {BESLISDOEL_LABEL[c.beslisdoel as keyof typeof BESLISDOEL_LABEL] ?? c.beslisdoel}, bewaren tot {c.bewaarTot}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {c.rollen.map((r) => <Badge key={r} variant="outline">{ROL_LABEL[r] ?? r}</Badge>)}
                        <Badge>{CASE_STATUS_LABEL[c.status] ?? c.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
