// ---------------------------------------------------------------------------
// AdminKwaliteitEvaluaties — beheerpagina voor de organisatie-evaluatieflow
// van de module Kwaliteit & Evaluaties (route /admin/kwaliteit-evaluaties).
// Fase 1, deelstap 1: sessies aanmaken, contactpersonen/coaches beheren,
// uitnodigingen versturen, ingediende evaluaties en signalen bekijken.
// Deelnemerscampagnes, coach-zelfevaluatie en het volledige kwaliteits-
// dashboard (§11-14) volgen in een latere fase.
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ClipboardCheck, Plus, Mail, AlertTriangle, ArrowLeft } from "lucide-react";

const API = "/api/admin/kwaliteit-evaluaties";

type Organisatie = { id: number; naam: string };
type Sessie = {
  id: number;
  titel: string;
  organisatieId: number;
  organisatieNaam: string | null;
  coachId: number | null;
  startDatetime: string;
  taal: string;
  aantalDeelnemersVerwacht: number | null;
  bevestigdeDoelstellingen: string[];
  status: string;
};
type Contact = { id: number; naam: string; email: string; functie: string | null; organisatieId: number };
type Coach = { id: number; naam: string; email: string | null };
type Evaluatie = {
  id: number;
  sessieId: number;
  opleidingTitel: string | null;
  organisatieNaam: string | null;
  status: string;
  scoreTotaal: number | null;
  signaalNiveau: string | null;
  ingediendOp: string | null;
};
type Signaal = {
  id: number;
  sessieId: number;
  organisatieId: number;
  ernst: string;
  types: string[];
  beschrijving: string | null;
  status: string;
  aangemaaktOp: string;
};

export default function AdminKwaliteitEvaluaties() {
  const [tab, setTab] = useState("sessies");

  const { data: sessies = [] } = useQuery<Sessie[]>({ queryKey: [`${API}/sessies`] });
  const { data: coaches = [] } = useQuery<Coach[]>({ queryKey: [`${API}/coaches`] });
  // Hergebruikt het bestaande scope-bewuste organisatie-endpoint (zie
  // server/routes/financieel.ts) i.p.v. een eigen admin-lijst te bouwen:
  // een prior-beheerder ziet alle organisaties, precies wat deze module nodig heeft.
  const { data: organisaties = [] } = useQuery<Organisatie[]>({ queryKey: ["/api/organisaties"] });
  const { data: evaluaties = [] } = useQuery<Evaluatie[]>({ queryKey: ["/api/admin/quality/evaluations"] });
  const { data: signalen = [] } = useQuery<Signaal[]>({ queryKey: ["/api/admin/quality/signals"] });

  const [nieuweSessieOpen, setNieuweSessieOpen] = useState(false);
  const [nieuweCoachOpen, setNieuweCoachOpen] = useState(false);
  const [uitnodigenSessie, setUitnodigenSessie] = useState<Sessie | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        right={
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Terug naar admin
            </Button>
          </Link>
        }
      />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-[#16384a]" />
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Kwaliteit &amp; Evaluaties</h1>
            <p className="text-sm text-slate-500">
              Organisatie-evaluatie — TaPasCity maakt kwaliteit zichtbaar, ontwikkeling mogelijk en opvolging
              aantoonbaar.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="sessies">Sessies</TabsTrigger>
            <TabsTrigger value="coaches">Coaches</TabsTrigger>
            <TabsTrigger value="evaluaties">Evaluaties</TabsTrigger>
            <TabsTrigger value="signalen">Signalen</TabsTrigger>
          </TabsList>

          <TabsContent value="sessies" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setNieuweSessieOpen(true)} style={{ backgroundColor: "#16384a" }}>
                <Plus className="h-4 w-4 mr-1" /> Nieuwe sessie
              </Button>
            </div>
            <div className="grid gap-3">
              {sessies.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{s.titel}</p>
                      <p className="text-sm text-slate-500">
                        {s.organisatieNaam ?? "—"} · {new Date(s.startDatetime).toLocaleDateString("nl-BE")} ·{" "}
                        {s.aantalDeelnemersVerwacht ?? "—"} deelnemers
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setUitnodigenSessie(s)}>
                      <Mail className="h-4 w-4 mr-1" /> Uitnodigen
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {sessies.length === 0 && <p className="text-sm text-slate-400">Nog geen sessies aangemaakt.</p>}
            </div>
          </TabsContent>

          <TabsContent value="coaches" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setNieuweCoachOpen(true)} style={{ backgroundColor: "#16384a" }}>
                <Plus className="h-4 w-4 mr-1" /> Nieuwe coach
              </Button>
            </div>
            <div className="grid gap-3">
              {coaches.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <p className="font-medium text-slate-800">{c.naam}</p>
                    <p className="text-sm text-slate-500">{c.email ?? "—"}</p>
                  </CardContent>
                </Card>
              ))}
              {coaches.length === 0 && <p className="text-sm text-slate-400">Nog geen coaches aangemaakt.</p>}
            </div>
          </TabsContent>

          <TabsContent value="evaluaties" className="space-y-4">
            <div className="grid gap-3">
              {evaluaties.map((e) => (
                <Card key={e.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{e.opleidingTitel ?? "—"}</p>
                      <p className="text-sm text-slate-500">{e.organisatieNaam ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.signaalNiveau && e.signaalNiveau !== "geen" && (
                        <Badge variant="destructive">{e.signaalNiveau}</Badge>
                      )}
                      <Badge variant={e.status === "verzonden" ? "default" : "secondary"}>{e.status}</Badge>
                      {e.scoreTotaal != null && (
                        <span className="text-sm font-semibold text-slate-700">{e.scoreTotaal.toFixed(1)}/10</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {evaluaties.length === 0 && (
                <p className="text-sm text-slate-400">Nog geen evaluaties ingediend.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="signalen" className="space-y-4">
            <div className="grid gap-3">
              {signalen.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={s.ernst === "ernstig" ? "destructive" : "secondary"}>{s.ernst}</Badge>
                        <span className="text-xs text-slate-400">
                          {new Date(s.aangemaaktOp).toLocaleString("nl-BE")}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{s.beschrijving || "(geen beschrijving)"}</p>
                      <p className="text-xs text-slate-400 mt-1">{s.types.join(", ")}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {signalen.length === 0 && <p className="text-sm text-slate-400">Geen signalen.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <NieuweSessieDialog
        open={nieuweSessieOpen}
        onOpenChange={setNieuweSessieOpen}
        organisaties={organisaties}
        coaches={coaches}
      />
      <NieuweCoachDialog open={nieuweCoachOpen} onOpenChange={setNieuweCoachOpen} />
      <UitnodigenDialog sessie={uitnodigenSessie} onOpenChange={() => setUitnodigenSessie(null)} />
    </div>
  );
}

function NieuweSessieDialog({
  open,
  onOpenChange,
  organisaties,
  coaches,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organisaties: Organisatie[];
  coaches: Coach[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [titel, setTitel] = useState("");
  const [organisatieId, setOrganisatieId] = useState<string>("");
  const [coachId, setCoachId] = useState<string>("");
  const [startDatetime, setStartDatetime] = useState("");
  const [aantal, setAantal] = useState("");
  const [doelstellingen, setDoelstellingen] = useState("");

  const maken = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `${API}/sessies`, {
        titel,
        organisatieId: Number(organisatieId),
        coachId: coachId ? Number(coachId) : undefined,
        startDatetime: startDatetime ? new Date(startDatetime).toISOString() : new Date().toISOString(),
        aantalDeelnemersVerwacht: aantal ? Number(aantal) : undefined,
        bevestigdeDoelstellingen: doelstellingen
          .split("\n")
          .map((d) => d.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${API}/sessies`] });
      toast({ title: "Sessie aangemaakt" });
      onOpenChange(false);
      setTitel("");
      setOrganisatieId("");
      setCoachId("");
      setStartDatetime("");
      setAantal("");
      setDoelstellingen("");
    },
    onError: () => toast({ title: "Kon sessie niet aanmaken", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe opleidingssessie</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titel</Label>
            <Input value={titel} onChange={(e) => setTitel(e.target.value)} />
          </div>
          <div>
            <Label>Organisatie</Label>
            <Select value={organisatieId} onValueChange={setOrganisatieId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een organisatie" />
              </SelectTrigger>
              <SelectContent>
                {organisaties.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Coach (optioneel)</Label>
            <Select value={coachId} onValueChange={setCoachId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een coach" />
              </SelectTrigger>
              <SelectContent>
                {coaches.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Startdatum en -tijd</Label>
            <Input type="datetime-local" value={startDatetime} onChange={(e) => setStartDatetime(e.target.value)} />
          </div>
          <div>
            <Label>Aantal deelnemers (verwacht)</Label>
            <Input type="number" value={aantal} onChange={(e) => setAantal(e.target.value)} />
          </div>
          <div>
            <Label>Bevestigde doelstellingen (één per lijn)</Label>
            <Textarea value={doelstellingen} onChange={(e) => setDoelstellingen(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => maken.mutate()}
            disabled={!titel || !organisatieId || maken.isPending}
            style={{ backgroundColor: "#16384a" }}
          >
            Aanmaken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NieuweCoachDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");

  const maken = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `${API}/coaches`, { naam, email: email || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${API}/coaches`] });
      toast({ title: "Coach aangemaakt" });
      onOpenChange(false);
      setNaam("");
      setEmail("");
    },
    onError: () => toast({ title: "Kon coach niet aanmaken", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe coach</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Naam</Label>
            <Input value={naam} onChange={(e) => setNaam(e.target.value)} />
          </div>
          <div>
            <Label>E-mail (optioneel)</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => maken.mutate()} disabled={!naam || maken.isPending} style={{ backgroundColor: "#16384a" }}>
            Aanmaken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UitnodigenDialog({ sessie, onOpenChange }: { sessie: Sessie | null; onOpenChange: () => void }) {
  const { toast } = useToast();
  const [contacten, setContacten] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>("");
  const [nieuweNaam, setNieuweNaam] = useState("");
  const [nieuweEmail, setNieuweEmail] = useState("");
  const [laatsteLink, setLaatsteLink] = useState<string | null>(null);

  const { data: geladenContacten } = useQuery<Contact[]>({
    queryKey: [`${API}/organisaties/${sessie?.organisatieId}/contacten`],
    enabled: !!sessie,
  });

  const contactenLijst = geladenContacten ?? [];

  const contactAanmaken = useMutation({
    mutationFn: async () => {
      if (!sessie) return null;
      const res = await apiRequest(
        "POST",
        `${API}/organisaties/${sessie.organisatieId}/contacten`,
        { naam: nieuweNaam, email: nieuweEmail },
      );
      return res.json();
    },
    onSuccess: (data) => {
      if (data) setContactId(String(data.id));
      setNieuweNaam("");
      setNieuweEmail("");
    },
  });

  const uitnodigen = useMutation({
    mutationFn: async () => {
      if (!sessie || !contactId) return null;
      const res = await apiRequest("POST", `/api/training-sessions/${sessie.id}/evaluations/invite`, {
        contactId: Number(contactId),
        origin: window.location.origin,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data) {
        setLaatsteLink(`${window.location.origin}/#/evaluatie-organisatie/${data.token}`);
        toast({ title: `Uitnodiging verstuurd (${data.mailStatus})` });
      }
    },
    onError: () => toast({ title: "Kon uitnodiging niet versturen", variant: "destructive" }),
  });

  return (
    <Dialog open={!!sessie} onOpenChange={(v) => !v && onOpenChange()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contactpersoon uitnodigen — {sessie?.titel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Bestaande contactpersoon</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een contactpersoon" />
              </SelectTrigger>
              <SelectContent>
                {contactenLijst.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.naam} ({c.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <Label>Of nieuwe contactpersoon</Label>
            <Input placeholder="Naam" value={nieuweNaam} onChange={(e) => setNieuweNaam(e.target.value)} />
            <Input placeholder="E-mail" value={nieuweEmail} onChange={(e) => setNieuweEmail(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              disabled={!nieuweNaam || !nieuweEmail || contactAanmaken.isPending}
              onClick={() => contactAanmaken.mutate()}
            >
              Contactpersoon toevoegen
            </Button>
          </div>
          {laatsteLink && (
            <p className="text-xs text-slate-500 break-all bg-slate-50 rounded p-2">{laatsteLink}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => uitnodigen.mutate()}
            disabled={!contactId || uitnodigen.isPending}
            style={{ backgroundColor: "#16384a" }}
          >
            <Mail className="h-4 w-4 mr-1" /> Uitnodiging versturen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
