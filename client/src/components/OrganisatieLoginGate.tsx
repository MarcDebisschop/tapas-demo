// ---------------------------------------------------------------------------
// OrganisatieLoginGate - beschermt het organisatieportaal (fase 7).
//
// Een organisatie logt rechtstreeks in met e-mail en wachtwoord en krijgt een
// eigen sessie (`organisatieId`), volledig los van de admin- en coachsessie.
// De gate bevraagt `/api/organisatie/me`; die vertelt WELKE organisatie de
// sessie toebehoort. De frontend leidt dat nooit zelf af uit een URL of een
// keuzelijst, want dan zou de organisatie te kiezen zijn.
//
// Anders dan de admin- en coachgate is er hier BEWUST geen demo-terugval op
// vaste inloggegevens: een organisatieportaal toont klantgegevens en die mogen
// niet met een lege inlog te bereiken zijn.
// ---------------------------------------------------------------------------

import { useState, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/Brand";
import { Building2, LogIn, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Branding } from "@shared/branding";

export interface OrganisatieProfiel {
  ok: boolean;
  organisatieId: number;
  naam: string;
  /** Personalisatie (fase 9). Altijd aanwezig, velden mogen null zijn. */
  branding: Branding;
}

interface OrganisatieAuthCtx {
  organisatie: OrganisatieProfiel;
  afmelden: () => void;
}

const OrganisatieAuth = createContext<OrganisatieAuthCtx | null>(null);

export function useOrganisatieAuth(): OrganisatieAuthCtx {
  const ctx = useContext(OrganisatieAuth);
  if (!ctx) throw new Error("useOrganisatieAuth hoort binnen OrganisatieLoginGate.");
  return ctx;
}

export function OrganisatieLoginGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: profiel, isLoading } = useQuery<OrganisatieProfiel | null>({
    queryKey: ["/api/organisatie/me"],
    queryFn: getQueryFn<OrganisatieProfiel | null>({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);

  async function inloggen(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !wachtwoord) return;
    setBezig(true);
    try {
      await apiRequest("POST", "/api/organisatie/login", {
        email: email.trim(),
        wachtwoord,
      });
      await qc.invalidateQueries({ queryKey: ["/api/organisatie/me"] });
    } catch {
      // Bewust een algemene melding: onderscheid maken tussen "onbekend
      // e-mailadres" en "verkeerd wachtwoord" verklapt welke organisaties
      // bestaan.
      toast({
        title: "Inloggen mislukt",
        description: "E-mailadres of wachtwoord klopt niet, of de login staat uit.",
        variant: "destructive",
      });
    } finally {
      setBezig(false);
    }
  }

  async function afmelden() {
    try {
      await apiRequest("POST", "/api/organisatie/logout", {});
    } catch {
      /* negeer */
    }
    await qc.invalidateQueries({ queryKey: ["/api/organisatie/me"] });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profiel) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col items-center justify-center px-4 py-12">
          <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Organisatieportaal</h1>
              <p className="text-sm text-muted-foreground">
                Log in met de inloggegevens van uw organisatie. U ziet uitsluitend uw eigen
                deelnemers en afnames.
              </p>
            </div>

            <form onSubmit={inloggen} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-email">E-mailadres</Label>
                <Input
                  id="org-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="organisatie@example.be"
                  data-testid="input-organisatie-email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-wachtwoord">Wachtwoord</Label>
                <Input
                  id="org-wachtwoord"
                  type="password"
                  autoComplete="current-password"
                  value={wachtwoord}
                  onChange={(ev) => setWachtwoord(ev.target.value)}
                  placeholder=". . . . . . . ."
                  data-testid="input-organisatie-wachtwoord"
                />
              </div>
              <Button
                type="submit"
                disabled={bezig}
                className="mt-2 w-full"
                data-testid="button-organisatie-login"
              >
                {bezig ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                Inloggen
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OrganisatieAuth.Provider value={{ organisatie: profiel, afmelden }}>
      {children}
    </OrganisatieAuth.Provider>
  );
}
