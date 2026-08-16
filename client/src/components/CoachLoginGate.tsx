// ---------------------------------------------------------------------------
// CoachLoginGate: beschermt het practitioner-dashboard.
// Aparte coach-sessie (coachId) volledig los van de admin-sessie.
// Deze poort vult niets in voor de gebruiker. Er staan hier geen inloggegevens
// in de code, want alles wat hier staat, staat in de browser van elke bezoeker.
// Iedere coach meldt zich aan met het eigen e-mailadres en wachtwoord.
// ---------------------------------------------------------------------------

import { useState, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/Brand";
import { BookOpen, LogIn, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface CoachProfiel {
  naam: string;
  email: string;
  isPrior: boolean;
}

interface CoachAuthCtx {
  coach: CoachProfiel;
  afmelden: () => void;
}

const CoachAuth = createContext<CoachAuthCtx | null>(null);

export function useCoachAuth(): CoachAuthCtx {
  const ctx = useContext(CoachAuth);
  if (!ctx) throw new Error("useCoachAuth must be used inside CoachLoginGate");
  return ctx;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------
interface Props {
  children: React.ReactNode;
}

export function CoachLoginGate({ children }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: profiel, isLoading } = useQuery<CoachProfiel | null>({
    queryKey: ["/api/coach/me"],
    queryFn: getQueryFn<CoachProfiel | null>({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);

  async function inloggen(e: React.FormEvent) {
    e.preventDefault();
    // Beide velden zijn verplicht. De poort vult niets in voor de gebruiker:
    // wat hier zou staan, staat in de browser van elke bezoeker.
    const stuurEmail = email.trim();
    const stuurWachtwoord = wachtwoord;
    if (!stuurEmail || !stuurWachtwoord) return;
    setBezig(true);
    try {
      await apiRequest("POST", "/api/coach/login", {
        email: stuurEmail,
        wachtwoord: stuurWachtwoord,
      });
      await qc.invalidateQueries({ queryKey: ["/api/coach/me"] });
    } catch {
      toast({
        title: "Inloggen mislukt",
        description: "E-mailadres klopt niet of account is niet actief.",
        variant: "destructive",
      });
    } finally {
      setBezig(false);
    }
  }

  async function afmelden() {
    try { await apiRequest("POST", "/api/coach/logout", {}); } catch { /* negeer */ }
    await qc.invalidateQueries({ queryKey: ["/api/coach/me"] });
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
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Practitioner-omgeving</h1>
              <p className="text-sm text-muted-foreground">
                Log in met je coach-account om toegang te krijgen tot je persoonlijke dashboard.
              </p>
            </div>

            <form onSubmit={inloggen} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="coach-email">E-mailadres</Label>
                <Input
                  id="coach-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="coach@example.com"
                  data-testid="input-coach-email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="coach-wachtwoord">Wachtwoord</Label>
                <Input
                  id="coach-wachtwoord"
                  type="password"
                  autoComplete="current-password"
                  value={wachtwoord}
                  onChange={(ev) => setWachtwoord(ev.target.value)}
                  placeholder="••••••••"
                  data-testid="input-coach-wachtwoord"
                />
              </div>
              <Button
                type="submit"
                disabled={bezig || email.trim() === "" || wachtwoord === ""}
                className="mt-2 w-full"
                data-testid="button-coach-login"
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
    <CoachAuth.Provider value={{ coach: profiel, afmelden }}>
      {children}
    </CoachAuth.Provider>
  );
}
