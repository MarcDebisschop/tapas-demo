// ---------------------------------------------------------------------------
// OpvolgingPerInstrument - opvolging van ingevulde/niet-ingevulde
// vragenlijsten PER INSTRUMENT.
//
// Twee niveaus, allebei achter de adminsessie:
//   niveau 1: GET /api/admin/opvolging-per-instrument         (alle afnames)
//   niveau 2: GET /api/organisatie/opvolging-per-instrument   (één organisatie)
//
// Er bestaat in dit platform geen server-geverifieerde organisatie-identiteit
// (geen org-login, geen organisatieId in de sessie). Daarom is de
// organisatieweergave hier een adminweergave met verplichte organisatiekeuze;
// zie server/routes/opvolging.ts voor de volledige motivering.
//
// Alle cijfers komen rechtstreeks uit de endpoints; er wordt hier niets
// herberekend of geschat.
// ---------------------------------------------------------------------------

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, ChevronDown, ChevronRight } from "lucide-react";

interface OpvolgingRij {
  instrumentId: string;
  label: string;
  totaal: number;
  voltooid: number;
  inUitvoering: number;
  nietGestart: number;
  voltooiingsgraad: number;
}

interface OpvolgingAntwoord {
  niveau: string;
  organisatieId: number | null;
  organisatieNaam: string | null;
  gegenereerdOp: string;
  instrumenten: OpvolgingRij[];
  totalen: Omit<OpvolgingRij, "instrumentId" | "label">;
}

interface AfnameRegel {
  id: number;
  respondentCode: string;
  name: string | null;
  status: string;
  instrumentLabel: string;
  organisatieNaam: string | null;
  createdAt: string | null;
}

const ALLE_ORGANISATIES = "alle";

function getal(n: number): string {
  return String(n);
}

function graad(n: number): string {
  return `${String(n).replace(".", ",")}%`;
}

// Onderliggende afnames van één instrument, opgehaald via de uitgebreide
// adminlijst. De organisatiefilter wordt meegegeven zodat de detaillijst
// exact dezelfde verzameling toont als de telling erboven.
function AfnameDetail({
  instrumentId,
  organisatieId,
}: {
  instrumentId: string;
  organisatieId: string;
}) {
  const params = new URLSearchParams({ instrument: instrumentId });
  if (organisatieId !== ALLE_ORGANISATIES) params.set("organisatie_id", organisatieId);
  const url = `/api/admin/afnames?${params.toString()}`;

  const { data, isLoading } = useQuery<AfnameRegel[]>({ queryKey: [url] });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!data || data.length === 0) {
    return (
      <p className="py-3 text-xs text-muted-foreground">
        Geen afnames voor dit instrument.
      </p>
    );
  }

  return (
    <table className="w-full text-xs" data-testid={`tabel-afnames-${instrumentId}`}>
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1.5 pr-3 font-medium">Code</th>
          <th className="py-1.5 pr-3 font-medium">Naam</th>
          <th className="py-1.5 pr-3 font-medium">Organisatie</th>
          <th className="py-1.5 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {data.map((a) => (
          <tr key={a.id} className="border-b last:border-0">
            <td className="py-1.5 pr-3 tabular-nums text-foreground">{a.respondentCode}</td>
            <td className="py-1.5 pr-3 text-foreground">{a.name ?? "-"}</td>
            <td className="py-1.5 pr-3 text-muted-foreground">{a.organisatieNaam ?? "-"}</td>
            <td className="py-1.5">
              <Badge variant={a.status === "voltooid" ? "secondary" : "outline"} className="text-[10px]">
                {a.status}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function OpvolgingPerInstrument() {
  const [orgKeuze, setOrgKeuze] = useState<string>(ALLE_ORGANISATIES);
  const [open, setOpen] = useState<string | null>(null);

  const { data: organisaties } = useQuery<any[]>({ queryKey: ["/api/organisaties"] });

  // Niveau 2 zodra er een organisatie gekozen is, anders niveau 1.
  const url =
    orgKeuze === ALLE_ORGANISATIES
      ? "/api/admin/opvolging-per-instrument"
      : `/api/organisatie/opvolging-per-instrument?organisatie_id=${encodeURIComponent(orgKeuze)}`;

  const { data, isLoading } = useQuery<OpvolgingAntwoord>({ queryKey: [url] });

  return (
    <Card className="mt-10" data-testid="kaart-opvolging-per-instrument">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
              Opvolging per instrument
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Hoeveel vragenlijsten zijn ingevuld en hoeveel staan nog open, per instrument.
              Klik op een rij voor de onderliggende afnames.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Label className="text-xs">Organisatie</Label>
            <Select
              value={orgKeuze}
              onValueChange={(v) => {
                setOrgKeuze(v);
                setOpen(null);
              }}
            >
              <SelectTrigger className="mt-1" data-testid="select-opvolging-org">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALLE_ORGANISATIES}>Alle organisaties</SelectItem>
                {(organisaties ?? []).map((o: any) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {orgKeuze !== ALLE_ORGANISATIES && (
          <p className="mb-3 text-xs text-muted-foreground" data-testid="opvolging-scope-melding">
            Enkel de afnames van deze organisatie. Afnames zonder organisatie (particuliere
            aankopen) en afnames van andere organisaties blijven buiten beeld.
          </p>
        )}

        {isLoading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="tabel-opvolging-per-instrument">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Instrument</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Totaal</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Voltooid</th>
                  <th className="py-1.5 pr-3 text-right font-medium">In uitvoering</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Niet gestart</th>
                  <th className="py-1.5 text-right font-medium">Voltooiingsgraad</th>
                </tr>
              </thead>
              <tbody>
                {data.instrumenten.map((r) => {
                  const isOpen = open === r.instrumentId;
                  return (
                    <Fragment key={r.instrumentId}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.instrumentId)}
                        className="cursor-pointer border-b hover:bg-muted/40"
                        data-testid={`rij-opvolging-${r.instrumentId}`}
                      >
                        <td className="py-2 pr-3 text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            )}
                            {r.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(r.totaal)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(r.voltooid)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(r.inUitvoering)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(r.nietGestart)}</td>
                        <td className="py-2 text-right tabular-nums text-foreground">{graad(r.voltooiingsgraad)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b bg-muted/20">
                          <td colSpan={6} className="px-3 py-2">
                            <AfnameDetail instrumentId={r.instrumentId} organisatieId={orgKeuze} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-sm font-medium" data-testid="rij-opvolging-totalen">
                  <td className="py-2 pr-3 text-foreground">Totaal</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(data.totalen.totaal)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(data.totalen.voltooid)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(data.totalen.inUitvoering)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-foreground">{getal(data.totalen.nietGestart)}</td>
                  <td className="py-2 text-right tabular-nums text-foreground">{graad(data.totalen.voltooiingsgraad)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
