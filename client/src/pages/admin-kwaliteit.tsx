// ---------------------------------------------------------------------------
// client/src/pages/admin-kwaliteit.tsx — M1: Kwaliteitsmonitor Dashboard
// Route: /admin/kwaliteit (via AdminLoginGate in App.tsx)
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Users, BarChart2, Mail, RefreshCw, Settings, FileText, ChevronLeft,
} from "lucide-react";

const API_BASE = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();

function statusKleur(status: string) {
  const map: Record<string, string> = {
    actief: "bg-green-100 text-green-800",
    norm_gehaald: "bg-blue-100 text-blue-800",
    achterstand_25: "bg-yellow-100 text-yellow-800",
    achterstand_50: "bg-red-100 text-red-800",
    opgeschort: "bg-gray-200 text-gray-700",
    uitzondering: "bg-purple-100 text-purple-800",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    actief: "Op schema",
    norm_gehaald: "Norm gehaald ✓",
    achterstand_25: "Lichte achterstand",
    achterstand_50: "Zware achterstand",
    opgeschort: "Opgeschort",
    uitzondering: "Uitzonderingsstatus",
  };
  return map[status] || status;
}

export default function AdminKwaliteit() {
  const jaar = new Date().getFullYear();
  const [geselecteerd, setGeselecteerd] = useState<number | null>(null);
  const [alertTrap, setAlertTrap] = useState<number>(2);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/kwaliteit/dashboard", jaar],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/kwaliteit/dashboard?jaar=${jaar}`).then(r => r.json()),
  });

  const kwartaalQuery = useQuery({
    queryKey: ["/api/kwaliteit/rapport/kwartaal"],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/kwaliteit/rapport/kwartaal`).then(r => r.json()),
  });

  const normMutation = useMutation({
    mutationFn: ({ id, norm }: { id: number; norm: number }) =>
      apiRequest("PUT", `${API_BASE}/api/kwaliteit/${id}/norm?jaar=${jaar}`, { norm }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/kwaliteit/dashboard"] }),
  });

  const alertMutation = useMutation({
    mutationFn: ({ id, trap }: { id: number; trap: number }) =>
      apiRequest("POST", `${API_BASE}/api/kwaliteit/${id}/alert?jaar=${jaar}`, { trap }).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  const actieMutation = useMutation({
    mutationFn: ({ id, actie }: { id: number; actie: string }) =>
      apiRequest("POST", `${API_BASE}/api/kwaliteit/${id}/actie?jaar=${jaar}`, { actie }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/kwaliteit/dashboard"] }); setGeselecteerd(null); },
  });

  const herbereken = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `${API_BASE}/api/kwaliteit/${id}/herbereken?jaar=${jaar}`).then(r => r.json()),
    onSuccess: () => refetch(),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f4f1ec" }}>
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#14213d" }} />
        <p style={{ color: "#7a7468" }}>Kwaliteitsdata laden…</p>
      </div>
    </div>
  );

  const practitioners = data?.practitioners || [];
  const kwartaal = kwartaalQuery.data;

  const opgeSel = geselecteerd !== null ? practitioners.find((p: any) => p.beheerder_id === geselecteerd) : null;

  return (
    <div className="min-h-screen" style={{ background: "#f4f1ec" }}>
      {/* Header */}
      <div style={{ background: "#14213d", padding: "24px 32px" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p style={{ color: "#d8c9a3", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
              TaPas Platform
            </p>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>
              Kwaliteitsmonitor Practitioners
            </h1>
            <p style={{ color: "#d8c9a3", fontSize: 14, marginTop: 4, opacity: 0.8 }}>
              Afname-monitoring {jaar} — M1
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin">
              <Button
                variant="outline"
                size="sm"
                style={{ borderColor: "#d8c9a3", color: "#d8c9a3", background: "transparent" }}
                data-testid="link-back"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Terug naar admin
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              style={{ borderColor: "#d8c9a3", color: "#d8c9a3", background: "transparent" }}
              onClick={() => refetch()}
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Herbereken
            </Button>
            <Button
              variant="outline"
              size="sm"
              style={{ borderColor: "#d8c9a3", color: "#d8c9a3", background: "transparent" }}
              onClick={() => window.open(`${API_BASE}/api/kwaliteit/rapport/kwartaal`, '_blank')}
            >
              <FileText className="w-4 h-4 mr-1" /> Kwartaalrapport
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">

        {/* Samenvatting tiles */}
        {kwartaal && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Totaal practitioners", value: kwartaal.samenvatting?.totaal_practitioners, icon: Users, kleur: "#14213d" },
              { label: "Op schema", value: kwartaal.samenvatting?.op_schema, icon: CheckCircle, kleur: "#2E7D5A" },
              { label: "Lichte achterstand", value: kwartaal.samenvatting?.achterstand_licht, icon: TrendingDown, kleur: "#8B6914" },
              { label: "Norm gehaald", value: kwartaal.samenvatting?.norm_gehaald, icon: TrendingUp, kleur: "#1a5fa8" },
            ].map(t => (
              <Card key={t.label} style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
                <CardContent className="p-4 flex items-center gap-3">
                  <t.icon className="w-8 h-8 flex-shrink-0" style={{ color: t.kleur }} />
                  <div>
                    <p style={{ fontSize: 28, fontWeight: 700, color: t.kleur, lineHeight: 1 }}>{t.value ?? "—"}</p>
                    <p style={{ fontSize: 12, color: "#7a7468", marginTop: 2 }}>{t.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabel practitioners */}
        <Card style={{ background: "#fff", border: "1px solid #e8e4dc", marginBottom: 24 }}>
          <CardHeader style={{ borderBottom: "1px solid #e8e4dc", paddingBottom: 12 }}>
            <CardTitle style={{ color: "#14213d", fontSize: 16 }}>
              <BarChart2 className="inline w-4 h-4 mr-2" />
              Afname-overzicht {jaar}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#f4f1ec", borderBottom: "1px solid #e8e4dc" }}>
                    {["Naam", "Afnames", "Norm", "Verwacht", "Progressie", "Status", "Alerts", "Acties"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", color: "#14213d", fontWeight: 600, textAlign: "left", fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {practitioners.map((p: any) => (
                    <tr key={p.beheerder_id} style={{ borderBottom: "1px solid #f0ede6" }}
                        className="hover:bg-amber-50 cursor-pointer"
                        onClick={() => setGeselecteerd(p.beheerder_id === geselecteerd ? null : p.beheerder_id)}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600, color: "#14213d" }}>{p.naam}</div>
                        <div style={{ fontSize: 11, color: "#7a7468" }}>{p.email}</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: "#14213d" }}>{p.afnames_count}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#7a7468" }}>{p.norm}</td>
                      <td style={{ padding: "10px 12px", color: "#7a7468" }}>{p.verwacht}</td>
                      <td style={{ padding: "10px 12px", minWidth: 120 }}>
                        <div style={{ background: "#e8e4dc", borderRadius: 4, height: 8, overflow: "hidden" }}>
                          <div style={{
                            background: p.progressie_pct >= 100 ? "#2E7D5A" : p.progressie_pct >= 75 ? "#d8c9a3" : p.progressie_pct >= 50 ? "#8B6914" : "#A13544",
                            width: `${Math.min(p.progressie_pct, 100)}%`, height: "100%", borderRadius: 4,
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#7a7468", marginTop: 2, display: "block" }}>{p.progressie_pct}%</span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusKleur(p.status_berekend)}`}>
                          {statusLabel(p.status_berekend)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div className="flex gap-1">
                          {p.alert_trap1_sent ? <span className="text-xs bg-yellow-100 text-yellow-700 px-1 rounded">T1</span> : null}
                          {p.alert_trap2_sent ? <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">T2</span> : null}
                          {p.alert_trap3_sent ? <span className="text-xs bg-red-100 text-red-700 px-1 rounded">T3</span> : null}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="outline" style={{ fontSize: 11, padding: "2px 8px" }}
                            onClick={() => herbereken.mutate(p.beheerder_id)}>
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detail panel */}
        {opgeSel && (
          <Card style={{ background: "#fff", border: "2px solid #d8c9a3" }}>
            <CardHeader style={{ borderBottom: "1px solid #e8e4dc", background: "#f4f1ec" }}>
              <CardTitle style={{ color: "#14213d" }}>
                {opgeSel.naam} — Acties & Detail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Norm aanpassen */}
                <div>
                  <h3 style={{ color: "#14213d", fontWeight: 600, marginBottom: 8 }}>
                    <Settings className="inline w-4 h-4 mr-1" /> Norm aanpassen
                  </h3>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number" min={1} max={500}
                      defaultValue={opgeSel.norm}
                      id="norm-input"
                      style={{ border: "1px solid #d4cfc8", borderRadius: 6, padding: "6px 12px", width: 80 }}
                    />
                    <Button
                      size="sm"
                      style={{ background: "#14213d", color: "#d8c9a3" }}
                      onClick={() => {
                        const v = Number((document.getElementById('norm-input') as HTMLInputElement)?.value);
                        normMutation.mutate({ id: opgeSel.beheerder_id, norm: v });
                      }}>
                      Opslaan
                    </Button>
                  </div>
                </div>

                {/* Alert versturen */}
                <div>
                  <h3 style={{ color: "#14213d", fontWeight: 600, marginBottom: 8 }}>
                    <Mail className="inline w-4 h-4 mr-1" /> Alert versturen
                  </h3>
                  <div className="flex gap-2 items-center">
                    <select
                      value={alertTrap}
                      onChange={e => setAlertTrap(Number(e.target.value))}
                      style={{ border: "1px solid #d4cfc8", borderRadius: 6, padding: "6px 12px" }}>
                      <option value={1}>Trap 1 — Intern signaal</option>
                      <option value={2}>Trap 2 — Practitioner mail</option>
                      <option value={3}>Trap 3 — Escalatie</option>
                    </select>
                    <Button
                      size="sm"
                      style={{ background: alertTrap === 3 ? "#A13544" : "#14213d", color: "#d8c9a3" }}
                      onClick={() => alertMutation.mutate({ id: opgeSel.beheerder_id, trap: alertTrap })}>
                      <Mail className="w-3 h-3 mr-1" /> Verstuur
                    </Button>
                  </div>
                </div>

                {/* Status-acties */}
                <div>
                  <h3 style={{ color: "#14213d", fontWeight: 600, marginBottom: 8 }}>
                    <AlertTriangle className="inline w-4 h-4 mr-1" /> Statuut-acties
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" style={{ borderColor: "#A13544", color: "#A13544" }}
                      onClick={() => actieMutation.mutate({ id: opgeSel.beheerder_id, actie: "opschorten" })}>
                      Opschorten
                    </Button>
                    <Button size="sm" variant="outline" style={{ borderColor: "#7a39bb", color: "#7a39bb" }}
                      onClick={() => actieMutation.mutate({ id: opgeSel.beheerder_id, actie: "uitzondering" })}>
                      Uitzonderingsstatus
                    </Button>
                    <Button size="sm" variant="outline" style={{ borderColor: "#2E7D5A", color: "#2E7D5A" }}
                      onClick={() => actieMutation.mutate({ id: opgeSel.beheerder_id, actie: "herstel" })}>
                      Herstellen
                    </Button>
                  </div>
                </div>

                {/* Statistieken */}
                <div>
                  <h3 style={{ color: "#14213d", fontWeight: 600, marginBottom: 8 }}>Statistieken</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div style={{ background: "#f4f1ec", borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ color: "#7a7468", fontSize: 11 }}>Afnames</div>
                      <div style={{ color: "#14213d", fontWeight: 700 }}>{opgeSel.afnames_count} / {opgeSel.norm}</div>
                    </div>
                    <div style={{ background: "#f4f1ec", borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ color: "#7a7468", fontSize: 11 }}>Verwacht nu</div>
                      <div style={{ color: "#14213d", fontWeight: 700 }}>{opgeSel.verwacht}</div>
                    </div>
                    <div style={{ background: "#f4f1ec", borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ color: "#7a7468", fontSize: 11 }}>Progressie</div>
                      <div style={{ color: "#14213d", fontWeight: 700 }}>{opgeSel.progressie_pct}%</div>
                    </div>
                    <div style={{ background: "#f4f1ec", borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ color: "#7a7468", fontSize: 11 }}>Voorspelling einde jaar</div>
                      <div style={{ color: "#14213d", fontWeight: 700 }}>{opgeSel.voorspelling_einde_jaar}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
