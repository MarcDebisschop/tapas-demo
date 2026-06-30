// ---------------------------------------------------------------------------
// AcademyJester — gereconstrueerd uit originele bundle (index-CxFhBwUz.js)
// Functienaam in bundle: n8e()
// Toont de Jester galerij als iframe van /jester-galerij/index.html
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { useState as useFormState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Award, CheckCircle } from "lucide-react";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import { ChevronLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Accreditatie-aanvraagformulier (Fase 4 — item 2.7)
// Coach self-service: modal met naam, email, certificering en motivatie.
// ---------------------------------------------------------------------------
const API_BASE_JESTER = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();

function AccreditatieModal({ open, onSluit }: { open: boolean; onSluit: () => void }) {
  const [naam, setNaam] = useFormState("");
  const [email, setEmail] = useFormState("");
  const [certificering, setCertificering] = useFormState("");
  const [motivatie, setMotivatie] = useFormState("");
  const [verstuurd, setVerstuurd] = useFormState(false);
  const [fout, setFout] = useFormState<string | null>(null);

  const mutatie = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `${API_BASE_JESTER}/api/toegang/accreditatie-aanvraag`, {
        naam,
        email,
        certificering,
        motivatie,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Onbekende fout");
      }
      return res.json();
    },
    onSuccess: () => setVerstuurd(true),
    onError: (e: Error) => setFout(e.message),
  });

  function herstel() {
    setNaam(""); setEmail(""); setCertificering(""); setMotivatie("");
    setVerstuurd(false); setFout(null);
    onSluit();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) herstel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            TaPas Jester accreditatie aanvragen
          </DialogTitle>
          <DialogDescription>
            Vul onderstaand formulier in. TaPasCity neemt contact met je op om je aanvraag te bespreken.
          </DialogDescription>
        </DialogHeader>

        {verstuurd ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Aanvraag ingediend!</p>
            <p className="text-sm text-muted-foreground">
              Je aanvraag is opgeslagen. TaPasCity neemt zo snel mogelijk contact op via <strong>{email}</strong>.
            </p>
            <Button onClick={herstel} variant="outline" size="sm">Sluiten</Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); setFout(null); mutatie.mutate(); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="aanvraag-naam">Naam</Label>
              <Input
                id="aanvraag-naam"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                placeholder="Volledige naam"
                required
                minLength={2}
                data-testid="aanvraag-naam"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aanvraag-email">E-mailadres</Label>
              <Input
                id="aanvraag-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@voorbeeld.be"
                required
                data-testid="aanvraag-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aanvraag-cert">Relevante certificering(en)</Label>
              <Input
                id="aanvraag-cert"
                value={certificering}
                onChange={(e) => setCertificering(e.target.value)}
                placeholder="bv. ICF ACC, EMCC EIA, ..."
                required
                minLength={3}
                data-testid="aanvraag-certificering"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aanvraag-mot">Motivatie</Label>
              <Textarea
                id="aanvraag-mot"
                value={motivatie}
                onChange={(e) => setMotivatie(e.target.value)}
                placeholder="Vertel waarom je TaPas Jester coach wilt worden..."
                rows={4}
                required
                minLength={20}
                data-testid="aanvraag-motivatie"
              />
            </div>
            {fout && (
              <p className="text-xs text-red-500" role="alert">{fout}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={herstel}>
                Annuleren
              </Button>
              <Button type="submit" size="sm" disabled={mutatie.isPending}>
                {mutatie.isPending ? "Verzenden…" : "Aanvraag indienen"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AcademyJester() {
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const [accreditatieOpen, setAccreditatieOpen] = useFormState(false);
  const n = maakVertaler(taal);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[hsl(222_47%_5%)]">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            {/* 2.7 — Self-service accreditatieknop */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAccreditatieOpen(true)}
              data-testid="knop-accreditatie-aanvragen"
              className="hidden sm:flex"
            >
              <Award className="mr-1.5 h-4 w-4 text-amber-500" />
              Accreditatie aanvragen
            </Button>
            <Select value={taal} onValueChange={(v) => setTaal(normaliseerTaal(v))}>
              <SelectTrigger
                className="h-9 w-auto gap-1.5 px-2.5"
                data-testid="select-ui-taal"
                aria-label={n("taal_kiezer_label")}
              >
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
            <Link href="/academy">
              <Button variant="ghost" size="sm" data-testid="link-terug-academy">
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                {n("jester_terug_academy")}
              </Button>
            </Link>
          </div>
        }
      />
      <iframe
        src="/jester-galerij/index.html"
        title={n("jester_galerij_titel")}
        className="w-full flex-1 border-0"
        style={{ minHeight: "calc(100dvh - 56px)" }}
        data-testid="frame-jester-galerij"
      />
      <AccreditatieModal open={accreditatieOpen} onSluit={() => setAccreditatieOpen(false)} />
    </div>
  );
}
