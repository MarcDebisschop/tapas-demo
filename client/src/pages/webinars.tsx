// ---------------------------------------------------------------------------
// client/src/pages/webinars.tsx — M3: Webinar Ecosysteem (TaPas Terras)
// Route: /webinars (practitioners) & /admin/webinars (beheer)
// ---------------------------------------------------------------------------
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Monitor, Calendar, Archive, Star, CheckCircle, Users,
  Plus, ChevronRight, Play, Clock, RefreshCw, MessageSquare, ChevronLeft,
} from "lucide-react";

const API_BASE = (() => { const _s = "__PORT_5000__"; return _s.startsWith("__") ? "" : "/" + _s; })();

function statusKleur(status: string) {
  const map: Record<string, string> = { gepland: "#1a5fa8", live: "#2E7D5A", afgerond: "#7a7468", geannuleerd: "#A13544" };
  return map[status] || "#7a7468";
}

function typeLabel(type: string) {
  const map: Record<string, string> = { must: "Must", facultatief: "Facultatief", practitioner_inbreng: "Practitioner" };
  return map[type] || type;
}

function StarRating({ onRate }: { onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  const [rated, setRated] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => { setRated(n); onRate(n); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
          <Star className="w-5 h-5" style={{ fill: n <= (hover || rated) ? "#d8c9a3" : "none", color: "#d8c9a3" }} />
        </button>
      ))}
    </div>
  );
}

export default function Webinars() {
  const [tab, setTab] = useState<"kalender" | "archief" | "topics" | "admin">("kalender");
  const [zoek, setZoek] = useState("");
  const [nieuwWebinar, setNieuwWebinar] = useState(false);
  const [nieuwTopic, setNieuwTopic] = useState(false);
  const [nieuwWebinarForm, setNieuwWebinarForm] = useState({ titel: "", datum: "", type: "must", beschrijving: "", thema: "", instrument: "", duur_minuten: 60 });
  const [nieuwTopicForm, setNieuwTopicForm] = useState({ titel: "", beschrijving: "", thema: "", instrument: "", gewenste_datum: "" });

  const webinarsQuery = useQuery({
    queryKey: ["/api/webinars/mijn"],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/webinars/mijn`).then(r => r.json()),
  });

  const archiefQuery = useQuery({
    queryKey: ["/api/webinars/archief", zoek],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/webinars/archief?q=${encodeURIComponent(zoek)}`).then(r => r.json()),
    enabled: tab === "archief",
  });

  const adminQuery = useQuery({
    queryKey: ["/api/webinars"],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/webinars`).then(r => r.json()),
    enabled: tab === "admin",
  });

  const topicsQuery = useQuery({
    queryKey: ["/api/webinars/mijn-topics"],
    queryFn: () => apiRequest("GET", `${API_BASE}/api/webinars/mijn-topics`).then(r => r.json()),
    enabled: tab === "topics",
  });

  const inschrijvenMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `${API_BASE}/api/webinars/${id}/inschrijven`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/webinars/mijn"] }),
  });

  const checkinMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `${API_BASE}/api/webinars/${id}/checkin`).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/webinars/mijn"] }),
  });

  const ratingMut = useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: number }) =>
      apiRequest("POST", `${API_BASE}/api/webinars/${id}/rating`, { rating }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/webinars/mijn"] }),
  });

  const aanmakenMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `${API_BASE}/api/webinars`, body).then(r => r.json()),
    onSuccess: () => {
      setNieuwWebinar(false);
      queryClient.invalidateQueries({ queryKey: ["/api/webinars"] });
    },
  });

  const topicMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `${API_BASE}/api/webinars/topics`, body).then(r => r.json()),
    onSuccess: () => {
      setNieuwTopic(false);
      queryClient.invalidateQueries({ queryKey: ["/api/webinars/mijn-topics"] });
    },
  });

  const webinars = webinarsQuery.data?.webinars || [];
  const archief = archiefQuery.data?.webinars || [];
  const adminWebinars = adminQuery.data?.webinars || [];
  const topics = topicsQuery.data?.topics || [];

  const tabs = [
    { id: "kalender", label: "Kalender", icon: Calendar },
    { id: "archief", label: "Archief", icon: Archive },
    { id: "topics", label: "Mijn topics", icon: MessageSquare },
    { id: "admin", label: "Beheer", icon: Monitor },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#f4f1ec" }}>
      {/* Header */}
      <div style={{ background: "#14213d", padding: "24px 32px" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p style={{ color: "#d8c9a3", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>
              TaPas Lounge
            </p>
            <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>
              TaPas Terras — Webinars
            </h1>
            <p style={{ color: "#d8c9a3", fontSize: 14, marginTop: 4, opacity: 0.8 }}>
              Kennisdelen · Groeien · Verbinden
            </p>
          </div>
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
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e4dc" }}>
        <div className="max-w-5xl mx-auto flex gap-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{
                padding: "14px 20px", border: "none", background: "none", cursor: "pointer",
                borderBottom: tab === t.id ? "3px solid #14213d" : "3px solid transparent",
                color: tab === t.id ? "#14213d" : "#7a7468", fontWeight: tab === t.id ? 600 : 400,
                fontSize: 14, display: "flex", alignItems: "center", gap: 6,
              }}>
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">

        {/* KALENDER */}
        {tab === "kalender" && (
          <div>
            {webinarsQuery.isLoading ? (
              <div className="text-center py-12"><RefreshCw className="w-6 h-6 animate-spin mx-auto" style={{ color: "#14213d" }} /></div>
            ) : webinars.length === 0 ? (
              <Card style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: "#d8c9a3" }} />
                  <p style={{ color: "#7a7468" }}>Nog geen webinars gepland.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {webinars.map((w: any) => (
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
                          {/* Rating als afgerond */}
                          {w.status === "afgerond" && !w.rating && (
                            <div style={{ marginTop: 8 }}>
                              <p style={{ fontSize: 12, color: "#7a7468", marginBottom: 4 }}>Geef een beoordeling:</p>
                              <StarRating onRate={(r) => ratingMut.mutate({ id: w.id, rating: r })} />
                            </div>
                          )}
                          {w.rating && (
                            <div style={{ marginTop: 6, display: "flex", gap: 2 }}>
                              {[1,2,3,4,5].map(n => <Star key={n} className="w-4 h-4" style={{ fill: n <= w.rating ? "#d8c9a3" : "none", color: "#d8c9a3" }} />)}
                            </div>
                          )}
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
                          {w.status === "afgerond" && w.opname_url && (
                            <Button size="sm" variant="outline"
                              onClick={() => window.open(w.opname_url, "_blank")}>
                              <Play className="w-3 h-3 mr-1" /> Opname
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
        )}

        {/* ARCHIEF */}
        {tab === "archief" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <input
                type="text" placeholder="Zoek op titel, thema…" value={zoek}
                onChange={e => setZoek(e.target.value)}
                style={{ width: "100%", border: "1px solid #d4cfc8", borderRadius: 8, padding: "10px 16px", fontSize: 14, background: "#fff" }}
              />
            </div>
            <div className="flex flex-col gap-4">
              {archief.map((w: any) => (
                <Card key={w.id} style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
                  <CardContent className="p-5" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                        {w.thema && <Badge style={{ background: "#f4f1ec", color: "#7a7468", fontSize: 11 }}>{w.thema}</Badge>}
                        {w.instrument && <Badge style={{ background: "#f4f1ec", color: "#7a7468", fontSize: 11 }}>{w.instrument}</Badge>}
                      </div>
                      <h3 style={{ color: "#14213d", fontWeight: 600, marginBottom: 4 }}>{w.titel}</h3>
                      <div style={{ fontSize: 13, color: "#7a7468" }}>
                        {new Date(w.datum).toLocaleDateString("nl-BE")} · {w.kijkers_totaal || 0} kijkers
                        {w.gem_kijktijd_min ? ` · gem. ${w.gem_kijktijd_min} min` : ""}
                      </div>
                      {w.rating_gemiddeld && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#7a7468" }}>
                          ★ {w.rating_gemiddeld} / 5 ({w.rating_count} beoordelingen)
                        </div>
                      )}
                    </div>
                    {w.opname_url && (
                      <Button size="sm" variant="outline" onClick={() => window.open(w.opname_url, "_blank")}>
                        <Play className="w-3 h-3 mr-1" /> Bekijken
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {archief.length === 0 && (
                <div className="text-center py-12" style={{ color: "#7a7468" }}>Geen opnames gevonden.</div>
              )}
            </div>
          </div>
        )}

        {/* TOPICS */}
        {tab === "topics" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#14213d", fontWeight: 600, fontSize: 18 }}>Mijn webinar-topics</h2>
              <Button style={{ background: "#14213d", color: "#d8c9a3" }} onClick={() => setNieuwTopic(!nieuwTopic)}>
                <Plus className="w-4 h-4 mr-1" /> Topic indienen
              </Button>
            </div>

            {nieuwTopic && (
              <Card style={{ background: "#fff", border: "2px solid #d8c9a3", marginBottom: 20 }}>
                <CardHeader><CardTitle style={{ color: "#14213d", fontSize: 16 }}>Nieuw topic indienen</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {[
                    { key: "titel", label: "Titel *", type: "text" },
                    { key: "beschrijving", label: "Beschrijving", type: "textarea" },
                    { key: "thema", label: "Thema", type: "text" },
                    { key: "instrument", label: "Instrument", type: "text" },
                    { key: "gewenste_datum", label: "Gewenste datum", type: "date" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 13, color: "#14213d", fontWeight: 500 }}>{f.label}</label>
                      {f.type === "textarea" ? (
                        <textarea
                          value={(nieuwTopicForm as any)[f.key]}
                          onChange={e => setNieuwTopicForm(p => ({ ...p, [f.key]: e.target.value }))}
                          style={{ width: "100%", border: "1px solid #d4cfc8", borderRadius: 6, padding: "8px 12px", marginTop: 4, minHeight: 80, fontSize: 14 }}
                        />
                      ) : (
                        <input type={f.type}
                          value={(nieuwTopicForm as any)[f.key]}
                          onChange={e => setNieuwTopicForm(p => ({ ...p, [f.key]: e.target.value }))}
                          style={{ width: "100%", border: "1px solid #d4cfc8", borderRadius: 6, padding: "8px 12px", marginTop: 4, fontSize: 14 }}
                        />
                      )}
                    </div>
                  ))}
                  <Button style={{ background: "#14213d", color: "#d8c9a3" }}
                    onClick={() => topicMut.mutate(nieuwTopicForm)}
                    disabled={!nieuwTopicForm.titel || topicMut.isPending}>
                    Indienen
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-3">
              {topics.map((t: any) => (
                <Card key={t.id} style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
                  <CardContent className="p-4">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h3 style={{ color: "#14213d", fontWeight: 600, marginBottom: 4 }}>{t.titel}</h3>
                        {t.beschrijving && <p style={{ fontSize: 13, color: "#7a7468", marginBottom: 4 }}>{t.beschrijving}</p>}
                        <div style={{ fontSize: 12, color: "#7a7468" }}>
                          {new Date(t.created_at).toLocaleDateString("nl-BE")}
                        </div>
                      </div>
                      <Badge style={{
                        background: t.status === "goedgekeurd" ? "#2E7D5A20" : t.status === "afgewezen" ? "#A1354420" : "#f4f1ec",
                        color: t.status === "goedgekeurd" ? "#2E7D5A" : t.status === "afgewezen" ? "#A13544" : "#7a7468",
                      }}>
                        {t.status}
                      </Badge>
                    </div>
                    {t.admin_notities && (
                      <div style={{ marginTop: 8, padding: "8px 12px", background: "#f4f1ec", borderRadius: 6, fontSize: 13, color: "#14213d" }}>
                        <strong>Reactie:</strong> {t.admin_notities}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {topics.length === 0 && (
                <div className="text-center py-8" style={{ color: "#7a7468" }}>Je hebt nog geen topics ingediend.</div>
              )}
            </div>
          </div>
        )}

        {/* ADMIN BEHEER */}
        {tab === "admin" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ color: "#14213d", fontWeight: 600, fontSize: 18 }}>Webinars beheren</h2>
              <Button style={{ background: "#14213d", color: "#d8c9a3" }} onClick={() => setNieuwWebinar(!nieuwWebinar)}>
                <Plus className="w-4 h-4 mr-1" /> Webinar aanmaken
              </Button>
            </div>

            {nieuwWebinar && (
              <Card style={{ background: "#fff", border: "2px solid #d8c9a3", marginBottom: 20 }}>
                <CardHeader><CardTitle style={{ color: "#14213d", fontSize: 16 }}>Nieuw webinar</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {[
                    { key: "titel", label: "Titel *" },
                    { key: "datum", label: "Datum *", type: "datetime-local" },
                    { key: "beschrijving", label: "Beschrijving" },
                    { key: "thema", label: "Thema" },
                    { key: "instrument", label: "Instrument" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 13, color: "#14213d", fontWeight: 500 }}>{f.label}</label>
                      <input type={f.type || "text"}
                        value={(nieuwWebinarForm as any)[f.key]}
                        onChange={e => setNieuwWebinarForm(p => ({ ...p, [f.key]: e.target.value }))}
                        style={{ width: "100%", border: "1px solid #d4cfc8", borderRadius: 6, padding: "8px 12px", marginTop: 4, fontSize: 14 }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 13, color: "#14213d", fontWeight: 500 }}>Type</label>
                    <select value={nieuwWebinarForm.type}
                      onChange={e => setNieuwWebinarForm(p => ({ ...p, type: e.target.value }))}
                      style={{ width: "100%", border: "1px solid #d4cfc8", borderRadius: 6, padding: "8px 12px", marginTop: 4, fontSize: 14 }}>
                      <option value="must">Must</option>
                      <option value="facultatief">Facultatief</option>
                      <option value="practitioner_inbreng">Practitioner-inbreng</option>
                    </select>
                  </div>
                  <Button style={{ background: "#14213d", color: "#d8c9a3" }}
                    onClick={() => aanmakenMut.mutate(nieuwWebinarForm)}
                    disabled={!nieuwWebinarForm.titel || !nieuwWebinarForm.datum || aanmakenMut.isPending}>
                    Aanmaken
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-3">
              {adminWebinars.map((w: any) => (
                <Card key={w.id} style={{ background: "#fff", border: "1px solid #e8e4dc" }}>
                  <CardContent className="p-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                        <Badge style={{ background: "#f4f1ec", color: "#14213d", fontSize: 11 }}>{typeLabel(w.type)}</Badge>
                        <Badge style={{ background: statusKleur(w.status) + "20", color: statusKleur(w.status), fontSize: 11 }}>{w.status}</Badge>
                      </div>
                      <h3 style={{ color: "#14213d", fontWeight: 600 }}>{w.titel}</h3>
                      <div style={{ fontSize: 13, color: "#7a7468" }}>
                        {new Date(w.datum).toLocaleDateString("nl-BE")} · {w.duur_minuten} min
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button size="sm" variant="outline"
                        onClick={() => window.open(`${API_BASE}/api/webinars/admin/aanwezigheid/${w.id}`, "_blank")}>
                        <Users className="w-3 h-3 mr-1" /> Aanwezigheid
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <Button variant="outline"
                onClick={() => window.open(`${API_BASE}/api/webinars/admin/rapport?jaar=${new Date().getFullYear()}`, "_blank")}>
                <CheckCircle className="w-4 h-4 mr-1" /> Jaarrapport aanwezigheid
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
