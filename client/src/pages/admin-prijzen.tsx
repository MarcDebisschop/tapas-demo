// =============================================================================
// client/src/pages/admin-prijzen.tsx  —  NIEUW BESTAND (Werkprotocol Regel 2)
// -----------------------------------------------------------------------------
// Admin-scherm voor de beheerbare privé-aankoopprijzen. Toont een tabel met
// instrument, bedrag (€, incl. btw) en actief-toggle. Prijs bewerken → PUT naar
// /api/admin/prive-prijzen/:instrumentId. Wordt beschermd door AdminLoginGate
// (via de route in App.tsx). Alle teksten in het Nederlands (Vlaams).
// =============================================================================

import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { ArrowLeft, Check, Pencil, X, Euro } from "lucide-react";

interface AdminPrijs {
  instrumentId: string;
  naam: string;
  bedragInclBtwCent: number;
  bedragInclBtw: number;
  actief: boolean;
  bijgewerktOp: string;
}

function euro(cent: number): string {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(cent / 100);
}

export default function AdminPrijzen() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<AdminPrijs[]>({ queryKey: ["/api/admin/prive-prijzen"] });

  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [bedragEuro, setBedragEuro] = useState("");
  const [bezig, setBezig] = useState(false);

  function startBewerken(p: AdminPrijs) {
    setBewerkId(p.instrumentId);
    setBedragEuro((p.bedragInclBtwCent / 100).toFixed(2));
  }

  async function bewaar(instrumentId: string) {
    const bedrag = Number(bedragEuro.replace(",", "."));
    if (!Number.isFinite(bedrag) || bedrag <= 0) {
      toast({ title: "Ongeldig bedrag", description: "Geef een bedrag groter dan 0 op.", variant: "destructive" });
      return;
    }
    setBezig(true);
    try {
      await apiRequest("PUT", `/api/admin/prive-prijzen/${instrumentId}`, {
        bedragInclBtwCent: Math.round(bedrag * 100),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/prive-prijzen"] });
      setBewerkId(null);
      toast({ title: "Opgeslagen", description: "De prijs is bijgewerkt." });
    } catch (e: any) {
      toast({ title: "Opslaan mislukt", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBezig(false);
    }
  }

  async function toggleActief(p: AdminPrijs) {
    try {
      await apiRequest("PUT", `/api/admin/prive-prijzen/${p.instrumentId}`, { actief: !p.actief });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/prive-prijzen"] });
      toast({ title: "Bijgewerkt", description: `${p.naam} is nu ${!p.actief ? "actief" : "inactief"}.` });
    } catch (e: any) {
      toast({ title: "Wijzigen mislukt", description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/admin">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-terug-admin">
            <ArrowLeft className="h-4 w-4" /> Terug naar beheer
          </a>
        </Link>
        <h1 className="mt-4 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <Euro className="h-5 w-5 text-primary" /> Instrument-prijzen
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Beheer de prijzen (incl. btw) voor privé-aankopen van particulieren.
        </p>

        <Card className="mt-6">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-5 text-sm text-muted-foreground">Laden…</p>
            ) : !data || data.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Nog geen prijzen ingesteld.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Bedrag (incl. btw)</TableHead>
                    <TableHead>Actief</TableHead>
                    <TableHead className="text-right">Actie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((p) => {
                    const inBewerking = bewerkId === p.instrumentId;
                    return (
                      <TableRow key={p.instrumentId} data-testid={`row-prijs-${p.instrumentId}`}>
                        <TableCell className="font-medium text-foreground">
                          {p.naam}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{p.instrumentId}</span>
                        </TableCell>
                        <TableCell>
                          {inBewerking ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">€</span>
                              <Input
                                value={bedragEuro}
                                onChange={(e) => setBedragEuro(e.target.value)}
                                className="h-8 w-28"
                                inputMode="decimal"
                                data-testid={`input-bedrag-${p.instrumentId}`}
                              />
                            </div>
                          ) : (
                            <span className="text-foreground" data-testid={`text-bedrag-${p.instrumentId}`}>
                              {euro(p.bedragInclBtwCent)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={p.actief}
                            onCheckedChange={() => toggleActief(p)}
                            data-testid={`switch-actief-${p.instrumentId}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {inBewerking ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button size="sm" onClick={() => bewaar(p.instrumentId)} disabled={bezig} data-testid={`button-bewaar-${p.instrumentId}`}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setBewerkId(null)} data-testid={`button-annuleer-${p.instrumentId}`}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => startBewerken(p)} data-testid={`button-bewerk-${p.instrumentId}`}>
                              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Bewerk
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
