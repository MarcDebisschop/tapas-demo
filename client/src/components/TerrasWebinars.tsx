// ---------------------------------------------------------------------------
// client/src/components/TerrasWebinars.tsx
// Additieve terras-weergave: KOMENDE webinars met inschrijfmogelijkheid.
// Hergebruikt weergave/logica uit client/src/pages/webinars.tsx (niet gewijzigd).
// Route-context: lounge-kamer "terras".
// ---------------------------------------------------------------------------
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Play, RefreshCw } from "lucide-react";
import { useUiTaal } from "@/contexts/TaalContext";

const API_BASE = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();

function statusKleur(status: string) {
  const map: Record<string, string> = { gepland: "#1a5fa8", live: "#2E7D5A", afgerond: "#7a7468", geannuleerd: "#A13544" };
  return map[status] || "#7a7468";
}

function typeLabel(type: string) {
  const map: Record<string, string> = { must: "Must", facultatief: "Facultatief", practitioner_inbreng: "Practitioner" };
  return map[type] || type;
}

export default function TerrasWebinars() {
  const { t } = useUiTaal();

  const webinarsQuery = useQuery({
    queryKey: ["/api/webinars/mijn"],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/webinars/mijn`).then(r => r.json()),
  });

  const inschrijvenMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `${API_BASE}/api/webinars/${id}/inschrijven`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/webinars/mijn"] }),
  });

  const checkinMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `${API_BASE}/api/webinars/${id}/checkin`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/webinars/mijn"] }),
  });

  const alle = webinarsQuery.data?.webinars || [];
  const komende = alle.filter((w: any) => w.status === "gepland" || w.status === "live");

  return (
    <div>
      {/* Kop — behoudt de terras-frame titel/eyebrow uit de lounge */}
      <div className="max-w-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: "#14213d" }}>
          {t("lounge_kamer_terras_eyebrow")}
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem] sm:leading-[1.15]">
          {t("lounge_kamer_terras_naam")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Kennisdelen · Groeien · Verbinden
        </p>
      </div>

      {/* Webinar-lijst — kaart-lay-out hergebruikt uit webinars.tsx (kalender) */}
      <div className="mt-8">
        {webinarsQuery.isLoading ? (
          <div className="text-center py-12"><RefreshCw className="w-6 h-6 animate-spin mx-auto" style={{ color: "#14213d" }} /></div>
        ) : komende.length === 0 ? (
          <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: "#d8c9a3" }} />
              <p style={{ color: "#7a7468" }}>Nog geen webinars gepland.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {komende.map((w: any) => (
              <Card key={w.id} style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
                <CardContent className="p-5">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <Badge style={{ background: w.type === "must" ? "#A13544" + "20" : "#f4f1ec", color: w.type === "must" ? "#A13544" : "#7a7468", fontSize: 11 }}>
                          {typeLabel(w.type)}
                        </Badge>
                        <Badge style={{ background: statusKleur(w.status) + "20", color: statusKleur(w.status), fontSize: 11 }}>
                          {w.status}
                        </Badge>
                        {w.thema && <Badge style={{ background: "#f4f1ec", color: "#14213d", fontSize: 11 }}>{w.thema}</Badge>}
                      </div>
                      <h3 style={{ color: "#14213d", fontWeight: 600, fontSize: 16, margin: "0 0 4px" }}>{w.titel}</h3>
                      {w.spreker && <p style={{ color: "#7a7468", fontSize: 13 }}>Spreker: {w.spreker}</p>}
                      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                        <span style={{ fontSize: 13, color: "#7a7468" }}>
                          <Calendar className="inline w-3 h-3 mr-1" />
                          {new Date(w.datum).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        <span style={{ fontSize: 13, color: "#7a7468" }}>
                          <Clock className="inline w-3 h-3 mr-1" />
                          {w.duur_minuten} min
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 120 }}>
                      {w.status === "gepland" && !w.ingeschreven_at && (
                        <Button size="sm" style={{ background: "#14213d", color: "#d8c9a3" }}
                          onClick={() => inschrijvenMut.mutate(w.id)}>
                          Inschrijven
                        </Button>
                      )}
                      {w.status === "gepland" && w.ingeschreven_at && (
                        <Badge style={{ background: "#2E7D5A20", color: "#2E7D5A" }}>Ingeschreven ✓</Badge>
                      )}
                      {w.status === "live" && (
                        <Button size="sm" style={{ background: "#2E7D5A", color: "#fff" }}
                          onClick={() => checkinMut.mutate(w.id)}>
                          <Play className="w-3 h-3 mr-1" /> Check-in
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
