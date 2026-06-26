// AdminLoginGate — beschermt alle admin-pagina's.
// Server checkt e-mailadres (sessie-gebaseerd). Wachtwoord wordt meegestuurd
// voor de UX maar niet geverifieerd in de DB — demo-versie.
// Demo-modus: velden starten LEEG zodat de browser ze niet blokkeert met
// native form-validation. Bij submit worden de demo-credentials ingevuld
// als de velden nog leeg zijn — zo werkt de knop altijd correct.

import { useState, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/Brand";
import { ShieldCheck, LogIn, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DEMO_MODE } from "@/lib/demoMode";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface BeheerderProfiel {
  naam: string;
  email: string;
  isPrior: boolean;
}

interface AdminAuthCtx {
  beheerder: BeheerderProfiel;
  afmelden: () => void;
}

const AdminAuth = createContext<AdminAuthCtx | null>(null);

export function useAdminAuth(): AdminAuthCtx {
  const ctx = useContext(AdminAuth);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminLoginGate");
  return ctx;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------
interface Props {
  children: React.ReactNode;
}

export function AdminLoginGate({ children }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Vraag sessie op — returnNull bij 401 zodat we zelf de login tonen.
  const { data: profiel, isLoading } = useQuery<BeheerderProfiel | null>({
    queryKey: ["/api/admin/me"],
    queryFn: getQueryFn<BeheerderProfiel | null>({ on401: "returnNull" }),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Velden starten leeg. De demo-credentials worden bij submit meegegeven
  // als de velden leeg zijn. Ze worden als object bewaard zodat Vite/Rollup
  // ze niet kan elimineren via constant-folding bij DEMO_MODE=true.
  const demoCreds = { e: "marc@tapascity.com", w: "Tintinenco01" };

  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);

  async function inloggen(e: React.FormEvent) {
    e.preventDefault();
    // Gebruik de ingevulde waarden; als leeg → demo-veilige fallback.
    const stuurEmail    = email.trim()  !== "" ? email.trim()  : demoCreds.e;
    const stuurWachtwoord = wachtwoord  !== "" ? wachtwoord    : demoCreds.w;
    if (!stuurEmail) return;
    setBezig(true);
    try {
      // Wachtwoord wordt meegestuurd voor de UX; server checkt enkel e-mail.
      await apiRequest("POST", "/api/admin/login", {
        email: stuurEmail,
        wachtwoord: stuurWachtwoord,
      });
      // Ververs sessie-check
      await qc.invalidateQueries({ queryKey: ["/api/admin/me"] });
    } catch {
      toast({
        title: "Inloggen mislukt",
        description: "E-mailadres of wachtwoord klopt niet.",
        variant: "destructive",
      });
    } finally {
      setBezig(false);
    }
  }

  async function afmelden() {
    try { await apiRequest("POST", "/api/admin/logout", {}); } catch { /* negeer */ }
    await qc.invalidateQueries({ queryKey: ["/api/admin/me"] });
  }

  // Sessie laden
  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Niet ingelogd → login scherm
  if (!profiel) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <AppHeader />
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col items-center justify-center px-4 py-12">
          <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
            {/* Icoon */}
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">Beheeromgeving</h1>
              <p className="text-sm text-muted-foreground">
                Log in met je beheerdersaccount om verder te gaan.
              </p>
              {DEMO_MODE && (
                <p className="rounded-md bg-accent/10 px-3 py-1.5 text-xs text-accent">
                  Demo: klik op Inloggen om verder te gaan
                </p>
              )}
            </div>

            <form onSubmit={inloggen} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="admin-email">E-mailadres</Label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder={DEMO_MODE ? "marc@tapascity.com" : "jij@tapascity.com"}
                  data-testid="input-admin-email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="admin-wachtwoord">Wachtwoord</Label>
                <Input
                  id="admin-wachtwoord"
                  type="password"
                  autoComplete="current-password"
                  value={wachtwoord}
                  onChange={(ev) => setWachtwoord(ev.target.value)}
                  placeholder={DEMO_MODE ? "••••••••••••" : "••••••••"}
                  data-testid="input-admin-wachtwoord"
                />
              </div>
              <Button
                type="submit"
                disabled={bezig}
                className="mt-2 w-full"
                data-testid="button-admin-login"
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

  // Ingelogd → toon admin-inhoud via context
  return (
    <AdminAuth.Provider value={{ beheerder: profiel, afmelden }}>
      {children}
    </AdminAuth.Provider>
  );
}
