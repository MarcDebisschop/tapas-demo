// ---------------------------------------------------------------------------
// client/src/pages/reis-t4kids-start.tsx — NIEUW BESTAND (strikt additief).
//
// Kindvriendelijke instappagina voor de T4Kids-ontdekkingsreis. Vanuit de
// instrumentengids ("Ontdek T4Kids") landt de bezoeker hier. Deze pagina maakt
// een T4Kids-afname aan (POST /api/afnames met instrumentId "t4kids") en
// navigeert daarna naar de bestaande belevings-route /reis/:id.
//
// Waarom een aparte startpagina? De reis-route (/reis/:id) heeft een echt
// afname-id nodig; ze kan niet rechtstreeks met de slug "t4kids" starten.
// Deze pagina levert dat id op dezelfde manier als deelnemer.tsx doet, maar
// dan als open demo-instap voor de pilot. Geen enkel bestaand instrument of
// pad wordt gewijzigd (Werkprotocol Regel 2).
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useLocation } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Afname } from "@/lib/types";
import { Compass, Sparkles } from "lucide-react";

export default function ReisT4KidsStart() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [naam, setNaam] = useState("");
  const [bezig, setBezig] = useState(false);

  async function start() {
    if (bezig) return;
    setBezig(true);
    try {
      const res = await apiRequest("POST", "/api/afnames", {
        name: naam.trim() || "Ontdekkingsreiziger",
        baselineEnergy: 5,
        consentGiven: true,
        taal: "nl",
        instrumentId: "t4kids",
      });
      const afname: Afname = await res.json();
      navigate(`/reis/${afname.id}`);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      toast({
        title: "Oeps, de reis kon niet starten",
        description: msg,
        variant: "destructive",
      });
      setBezig(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-accent">
          <Compass className="h-4 w-4" />
          T4Kids · De Ontdekkingsreis
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Klaar voor je ontdekkingsreis?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Je gaat op reis langs drie eilanden. Onderweg ontdek je waar jij nu
          energie van krijgt en welke dingen je graag doet. Er zijn geen punten
          en geen goed of fout — gewoon jouw keuzes. Klaar? Zet je naam erbij en
          vertrek.
        </p>

        <Card className="mt-6">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="t4kids-naam">Hoe heet je?</Label>
              <Input
                id="t4kids-naam"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                placeholder="Je voornaam"
                data-testid="input-t4kids-naam"
              />
              <p className="text-xs text-muted-foreground">
                Dit komt bovenaan je eigen ontdekkingsboekje te staan.
              </p>
            </div>
            <Button
              onClick={start}
              disabled={bezig}
              className="w-full"
              size="lg"
              data-testid="button-start-t4kids-reis"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {bezig ? "Je reis wordt klaargemaakt…" : "Start mijn ontdekkingsreis"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
