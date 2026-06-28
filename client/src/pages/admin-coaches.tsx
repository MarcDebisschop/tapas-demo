// ---------------------------------------------------------------------------
// AdminCoaches — gereconstrueerd uit originele bundle (index-CxFhBwUz.js)
// Functienaam in bundle: eye()
// Constanten uit bundle: Gd="/api/admin/coaches", dU={...}, ej=[...], ZW=[...], Yxe={...}
// Sub-componenten: AccreditatiesDialog (nye)
// ---------------------------------------------------------------------------

import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { apiRequest } from "@/lib/queryClient";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Award,
  Image,
} from "lucide-react";


// -----------------------------------------------------------------------
// Constanten (exact uit bundle)
// -----------------------------------------------------------------------

const COACHES_API = "/api/admin/coaches";

const DEFAULT_FORM = {
  naam: "",
  plaats: "",
  regioSleutel: "Vlaanderen",
  land: "BE",
  expertise: "",
  email: "",
  fotoUrl: "",
  opleidingTitel: "",
  behaaldOp: "",
  toestemmingRegister: false,
  zichtbaarInRegister: false,
  actief: true,
};

const REGIO_OPTIES = [
  "Antwerpen",
  "Oost-Vlaanderen",
  "West-Vlaanderen",
  "Vlaams-Brabant",
  "Limburg",
  "Brussel",
  "Vlaanderen",
];

const LANDEN = [
  "BE","NL","LU","FR","DE","ES","IT","PT","IE","AT","DK","SE","FI","PL",
  "CZ","SK","HU","RO","BG","GR","HR","SI","EE","LV","LT","MT","CY","GB",
  "CH","NO","andere",
];

const LANDEN_NAMEN: Record<string, string> = {
  BE:"België",NL:"Nederland",LU:"Luxemburg",FR:"Frankrijk",DE:"Duitsland",
  ES:"Spanje",IT:"Italië",PT:"Portugal",IE:"Ierland",AT:"Oostenrijk",
  DK:"Denemarken",SE:"Zweden",FI:"Finland",PL:"Polen",CZ:"Tsjechië",
  SK:"Slowakije",HU:"Hongarije",RO:"Roemenië",BG:"Bulgarije",GR:"Griekenland",
  HR:"Kroatië",SI:"Slovenië",EE:"Estland",LV:"Letland",LT:"Litouwen",
  MT:"Malta",CY:"Cyprus",GB:"Verenigd Koninkrijk",CH:"Zwitserland",
  NO:"Noorwegen",andere:"Andere",
};

// -----------------------------------------------------------------------
// Foto-upload helper (gereconstrueerd uit Jxe in bundle)
// -----------------------------------------------------------------------
function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kon het bestand niet lezen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Kon de afbeelding niet laden."));
      img.onload = () => {
        const scale = Math.min(1, 512 / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas niet beschikbaar."));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// -----------------------------------------------------------------------
// AccreditatiesDialog (gereconstrueerd uit nye in bundle)
// -----------------------------------------------------------------------
interface Coach {
  id: number;
  naam: string;
  plaats: string;
  regioSleutel: string;
  land: string;
  expertise: string[];
  email: string;
  fotoUrl: string;
  opleidingTitel: string;
  behaaldOp: string;
  toestemmingRegister: boolean;
  zichtbaarInRegister: boolean;
  actief: boolean;
  demo?: boolean;
}

function AccreditatiesDialog({ coach, onClose }: { coach: Coach | null; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [toevoegen, setToevoegen] = useState(false);

  const { data: instrumenten } = useQuery<any[]>({
    queryKey: ["/api/admin/instrumenten"],
    enabled: !!coach,
  });

  const { data: accreditaties } = useQuery<any[]>({
    queryKey: [`${COACHES_API}/${coach?.id}/toegangen`],
    enabled: !!coach,
  });

  const verwijderMut = useMutation({
    mutationFn: (tid: number) =>
      apiRequest("DELETE", `${COACHES_API}/${coach?.id}/toegangen/${tid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${COACHES_API}/${coach?.id}/toegangen`] });
      toast({ description: "Accreditatie verwijderd." });
    },
  });

  const [nieuwInstrument, setNieuwInstrument] = useState("");
  const [nieuwNiveau, setNieuwNiveau] = useState("1");
  const [nieuwBehaald, setNieuwBehaald] = useState("");
  const [nieuwGeldig, setNieuwGeldig] = useState("");

  const toevoegenMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `${COACHES_API}/${coach?.id}/toegangen`, {
        instrument_id: nieuwInstrument,
        niveau: Number(nieuwNiveau),
        behaald_op: nieuwBehaald,
        geldig_tot: nieuwGeldig,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`${COACHES_API}/${coach?.id}/toegangen`] });
      toast({ description: "Accreditatie toegevoegd." });
      setToevoegen(false);
      setNieuwInstrument("");
      setNieuwNiveau("1");
      setNieuwBehaald("");
      setNieuwGeldig("");
    },
  });

  return (
    <Dialog open={!!coach} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent data-testid="dialog-accreditaties" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Accreditaties — {coach?.naam}</DialogTitle>
          <DialogDescription>Beheer de instrument-accreditaties van deze coach.</DialogDescription>
        </DialogHeader>

        {/* Lijst bestaande accreditaties */}
        <div className="space-y-2">
          {(accreditaties ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nog geen accreditaties.</p>
          )}
          {(accreditaties ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <span className="text-sm font-medium">{a.instrument_id}</span>
                <span className="ml-2 text-xs text-muted-foreground">Niveau {a.niveau}</span>
                {a.behaald_op && <span className="ml-2 text-xs text-muted-foreground">· {a.behaald_op}</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => verwijderMut.mutate(a.id)}
                data-testid={`button-verwijder-accr-${a.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* Toevoegen formulier */}
        {toevoegen ? (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="space-y-2">
              <Label>Instrument</Label>
              <Select value={nieuwInstrument} onValueChange={setNieuwInstrument}>
                <SelectTrigger data-testid="select-nieuw-instrument"><SelectValue placeholder="Kies instrument" /></SelectTrigger>
                <SelectContent>
                  {(instrumenten ?? []).map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.naam}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Niveau</Label>
                <Select value={nieuwNiveau} onValueChange={setNieuwNiveau}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1","2","3","4"].map((n) => <SelectItem key={n} value={n}>Niveau {n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Behaald op</Label>
                <Input value={nieuwBehaald} onChange={(e) => setNieuwBehaald(e.target.value)} placeholder="2024" />
              </div>
              <div className="space-y-2">
                <Label>Geldig tot</Label>
                <Input value={nieuwGeldig} onChange={(e) => setNieuwGeldig(e.target.value)} placeholder="2027" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setToevoegen(false)}>Annuleren</Button>
              <Button
                onClick={() => toevoegenMut.mutate()}
                disabled={!nieuwInstrument || toevoegenMut.isPending}
                data-testid="button-accr-opslaan"
              >
                Opslaan
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Sluiten</Button>
            <Button onClick={() => setToevoegen(true)} data-testid="button-accr-toevoegen">
              <Plus className="mr-1.5 h-4 w-4" /> Accreditatie toevoegen
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------
// Hoofdcomponent — exact gereconstrueerd uit eye() in bundle
// -----------------------------------------------------------------------
export default function AdminCoaches() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Coach[]>({ queryKey: [COACHES_API] });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bewerkId, setBewerkId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [bezig, setBezig] = useState(false);
  const [teVerwijderen, setTeVerwijderen] = useState<Coach | null>(null);
  const [accreditatiesCoach, setAccreditatiesCoach] = useState<Coach | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  // Foto upload (exact uit Jxe)
  async function verwerkFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeImageToBase64(file);
      setForm((f) => ({ ...f, fotoUrl: dataUrl }));
    } catch (err: any) {
      toast({ title: "Foto-upload mislukt", description: String(err?.message ?? err), variant: "destructive" });
    }
  }

  function nieuweCoach() {
    setBewerkId(null);
    setForm({ ...DEFAULT_FORM });
    setDialogOpen(true);
  }

  function bewerkCoach(coach: Coach) {
    setBewerkId(coach.id);
    setForm({
      naam: coach.naam,
      plaats: coach.plaats,
      regioSleutel: coach.regioSleutel,
      land: coach.land ?? "BE",
      expertise: (coach.expertise ?? []).join(", "),
      email: coach.email ?? "",
      fotoUrl: coach.fotoUrl ?? "",
      opleidingTitel: coach.opleidingTitel ?? "",
      behaaldOp: coach.behaaldOp ?? "",
      toestemmingRegister: coach.toestemmingRegister,
      zichtbaarInRegister: coach.zichtbaarInRegister,
      actief: coach.actief,
    });
    setDialogOpen(true);
  }

  function herlaadCoaches() {
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "") === COACHES_API });
  }

  async function opslaanCoach() {
    setBezig(true);
    try {
      const expertise = form.expertise.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      const payload = {
        naam: form.naam.trim(),
        plaats: form.plaats.trim(),
        regioSleutel: form.regioSleutel,
        land: form.land,
        expertise,
        email: form.email.trim(),
        fotoUrl: form.fotoUrl.trim(),
        opleidingTitel: form.opleidingTitel.trim(),
        behaaldOp: form.behaaldOp.trim(),
        toestemmingRegister: form.toestemmingRegister,
        zichtbaarInRegister: form.zichtbaarInRegister,
        actief: form.actief,
      };
      if (bewerkId == null) {
        await apiRequest("POST", COACHES_API, payload);
      } else {
        await apiRequest("PUT", `${COACHES_API}/${bewerkId}`, payload);
      }
      herlaadCoaches();
      toast({ title: "Coaches", description: "De wijziging is opgeslagen." });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Er ging iets mis", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  async function verwijderCoach() {
    if (!teVerwijderen) return;
    setBezig(true);
    try {
      await apiRequest("DELETE", `${COACHES_API}/${teVerwijderen.id}`);
      herlaadCoaches();
      toast({ title: "Coaches", description: "De coach is verwijderd." });
      setTeVerwijderen(null);
    } catch (err: any) {
      toast({ title: "Er ging iets mis", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button size="sm" variant="outline" data-testid="link-admin">← Admin beheer</Button>
            </Link>
            
          </div>
        }
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" aria-hidden />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Coaches</h1>
          </div>
          <Button onClick={nieuweCoach} data-testid="button-nieuwe-coach">
            <Plus className="mr-1.5 h-4 w-4" /> Nieuwe coach
          </Button>
        </div>

        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Hier beheert u het coachregister dat gebruikt wordt bij een doorverwijzing. De keuze
          gebeurt op regio en op expertise die past bij de hulpvraag van de deelnemer. Alleen
          actieve coaches komen in aanmerking.
        </p>

        {/* Lijst */}
        {isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <Card className="mt-6">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Er zijn nog geen coaches. Voeg er een toe met de knop hierboven.
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 space-y-4">
            {(data ?? []).map((coach) => (
              <Card
                key={coach.id}
                data-testid={`card-coach-${coach.id}`}
                className={coach.actief ? "" : "opacity-70"}
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-foreground" data-testid={`text-coach-naam-${coach.id}`}>
                        {coach.naam}
                      </span>
                      {coach.demo && (
                        <Badge variant="outline" className="border-accent/30 bg-accent/15 text-accent" data-testid={`badge-demo-${coach.id}`}>
                          Voorbeeld
                        </Badge>
                      )}
                      {!coach.actief && (
                        <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive" data-testid={`badge-inactief-${coach.id}`}>
                          Niet actief
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {coach.plaats} · {coach.regioSleutel}
                      {coach.email ? ` · ${coach.email}` : ""}
                    </p>
                    {(coach.expertise ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {coach.expertise.map((ex, i) => (
                          <Badge key={i} variant="outline" className="text-muted-foreground" data-testid={`badge-expertise-${coach.id}-${i}`}>
                            {ex}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAccreditatiesCoach(coach)}
                      data-testid={`button-accreditaties-${coach.id}`}
                    >
                      <Award className="mr-1.5 h-4 w-4" /> Accreditaties
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bewerkCoach(coach)}
                      data-testid={`button-bewerk-${coach.id}`}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" /> Bewerken
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTeVerwijderen(coach)}
                      data-testid={`button-verwijder-${coach.id}`}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" /> Verwijderen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Coach bewerken/aanmaken dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-coach" className="flex max-h-[90vh] flex-col">
          <DialogHeader>
            <DialogTitle>{bewerkId == null ? "Nieuwe coach" : "Coach bewerken"}</DialogTitle>
            <DialogDescription>Vul de gegevens van de coach in. Expertises scheidt u met een komma.</DialogDescription>
          </DialogHeader>
          <div className="-mr-2 flex-1 space-y-4 overflow-y-auto py-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="co-naam">Naam</Label>
              <Input id="co-naam" value={form.naam} onChange={(e) => setForm({ ...form, naam: e.target.value })} data-testid="input-co-naam" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-plaats">Plaats</Label>
              <Input id="co-plaats" value={form.plaats} onChange={(e) => setForm({ ...form, plaats: e.target.value })} data-testid="input-co-plaats" />
            </div>
            <div className="space-y-2">
              <Label>Regio</Label>
              <Select value={form.regioSleutel} onValueChange={(v) => setForm({ ...form, regioSleutel: v })}>
                <SelectTrigger data-testid="select-co-regio"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIO_OPTIES.map((r) => (
                    <SelectItem key={r} value={r} data-testid={`option-co-regio-${r}`}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Land</Label>
              <Select value={form.land} onValueChange={(v) => setForm({ ...form, land: v })}>
                <SelectTrigger data-testid="select-co-land"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANDEN.map((l) => (
                    <SelectItem key={l} value={l} data-testid={`option-co-land-${l}`}>{LANDEN_NAMEN[l] ?? l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-expertise">Expertise (gescheiden door komma's)</Label>
              <Input
                id="co-expertise"
                value={form.expertise}
                onChange={(e) => setForm({ ...form, expertise: e.target.value })}
                placeholder="Loopbaanbegeleiding, Veerkracht"
                data-testid="input-co-expertise"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-opleiding">Rol / specialisatie (optioneel)</Label>
              <Input
                id="co-opleiding"
                value={form.opleidingTitel}
                onChange={(e) => setForm({ ...form, opleidingTitel: e.target.value })}
                placeholder="Loopbaancoach"
                data-testid="input-co-opleiding"
              />
              <p className="text-xs text-muted-foreground">Wordt op het publieke coach-register naast de naam getoond.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-behaald">Accreditatiedatum-label (optioneel)</Label>
              <Input
                id="co-behaald"
                value={form.behaaldOp}
                onChange={(e) => setForm({ ...form, behaaldOp: e.target.value })}
                placeholder="2026"
                data-testid="input-co-behaald"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-email">E-mailadres (optioneel)</Label>
              <Input
                id="co-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                data-testid="input-co-email"
              />
            </div>
            {/* Foto */}
            <div className="space-y-2">
              <Label htmlFor="co-foto">Foto</Label>
              <div className="flex items-center gap-3">
                {form.fotoUrl.trim() && (
                  <img
                    src={form.fotoUrl.trim()}
                    alt="Voorbeeld portret"
                    className="h-12 w-12 rounded-full border border-border object-cover"
                    data-testid="preview-co-foto"
                  />
                )}
                <input
                  ref={fotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={verwerkFoto}
                  data-testid="file-co-foto"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fotoRef.current?.click()}
                  data-testid="button-co-foto-upload"
                >
                  <Image className="mr-2 h-4 w-4" />
                  Foto uploaden
                </Button>
                {form.fotoUrl.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, fotoUrl: "" })}
                    data-testid="button-co-foto-verwijder"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Verwijderen
                  </Button>
                )}
              </div>
              <Input
                id="co-foto"
                value={form.fotoUrl}
                onChange={(e) => setForm({ ...form, fotoUrl: e.target.value })}
                placeholder="of plak een afbeeldingslink (https://…)"
                data-testid="input-co-foto"
              />
              <p className="text-xs text-muted-foreground">
                Wordt op de publieke coachlijst getoond. Grote foto's worden automatisch verkleind. Laat leeg voor een neutrale weergave.
              </p>
            </div>
            {/* Switches */}
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="text-sm">
                <span className="font-medium text-foreground">Toestemming register</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">De coach gaf toestemming om in het publieke coach-register te staan.</span>
              </span>
              <Switch
                checked={form.toestemmingRegister}
                onCheckedChange={(v) => setForm({ ...form, toestemmingRegister: v })}
                data-testid="switch-co-toestemming"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="text-sm">
                <span className="font-medium text-foreground">Tonen in register</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Toont de coach op het publieke register. Pas zichtbaar met toestemming én minstens één actieve accreditatie.</span>
              </span>
              <Switch
                checked={form.zichtbaarInRegister}
                onCheckedChange={(v) => setForm({ ...form, zichtbaarInRegister: v })}
                data-testid="switch-co-zichtbaar"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="text-sm">
                <span className="font-medium text-foreground">Actief</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">Alleen actieve coaches komen in aanmerking voor een doorverwijzing.</span>
              </span>
              <Switch
                checked={form.actief}
                onCheckedChange={(v) => setForm({ ...form, actief: v })}
                data-testid="switch-co-actief"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-co-annuleer">Annuleren</Button>
            <Button
              onClick={opslaanCoach}
              disabled={bezig || !form.naam.trim() || !form.plaats.trim()}
              data-testid="button-co-opslaan"
            >
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verwijder bevestiging dialog */}
      <Dialog open={!!teVerwijderen} onOpenChange={(open) => { if (!open) setTeVerwijderen(null); }}>
        <DialogContent data-testid="dialog-verwijder-coach">
          <DialogHeader>
            <DialogTitle>Coach verwijderen</DialogTitle>
            <DialogDescription>
              Weet u zeker dat u {teVerwijderen?.naam} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeVerwijderen(null)} data-testid="button-verwijder-annuleer">Annuleren</Button>
            <Button onClick={verwijderCoach} disabled={bezig} data-testid="button-verwijder-bevestig">Verwijderen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accreditaties dialog */}
      <AccreditatiesDialog coach={accreditatiesCoach} onClose={() => setAccreditatiesCoach(null)} />
    </div>
  );
}
