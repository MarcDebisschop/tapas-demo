import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ArrowRight, Building2 } from "lucide-react";

/**
 * TaPas 4 Organizations — facilitatorscherm (route #/t4o).
 * ------------------------------------------------------------------
 * Een facilitator maakt een organisatie-afname en opent bestaande
 * afnames. De afname loopt in drie ringen (leiding, medewerkers, externe
 * stakeholders) die samen één organisatieprofiel vormen. UI-strings zijn
 * hardcoded in het Nederlands conform het T4O-contract (additief; raakt
 * de gedeelde vertaalbestanden niet).
 */

type Sessie = { id: number; orgNaam: string; orgLabel: string; status: string; createdAt: number };

export default function T4OHome() {
  const { data: sessies } = useQuery<Sessie[]>({ queryKey: ["/api/t4o/sessies"] });
  const [orgNaam, setOrgNaam] = useState("");
  const [orgLabel, setOrgLabel] = useState("");

  const maak = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/t4o/sessies", { orgNaam, orgLabel });
      return res.json();
    },
    onSuccess: () => {
      setOrgNaam("");
      setOrgLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/t4o/sessies"] });
    },
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader />
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ color: "#5b6b73", fontSize: 13, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 8 }}>
          TaPas 4 Organizations
        </div>
        <h1 style={{ color: "#16384a", fontSize: 30, margin: "0 0 6px" }}>Organisatie-talentprofiel</h1>
        <p style={{ color: "#5b6b73", fontSize: 16, maxWidth: 660 }}>
          Breng het emergente talent van een organisatie in kaart via een afname in drie groepen — leiding,
          medewerkers en externe stakeholders. De antwoorden worden per groep samengevoegd tot één
          organisatieprofiel.
        </p>

        {/* Nieuwe afname */}
        <div style={{ background: "#fff", border: "1px solid #eef1f2", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 0 }}>Nieuwe afname</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 240px" }}>
              <Label>Naam van de organisatie</Label>
              <Input value={orgNaam} onChange={(e) => setOrgNaam(e.target.value)} placeholder="Bijv. Stichting De Brug" />
            </div>
            <div style={{ flex: "1 1 240px" }}>
              <Label>Korte omschrijving (optioneel)</Label>
              <Input value={orgLabel} onChange={(e) => setOrgLabel(e.target.value)} placeholder="Bijv. sociale onderneming, 40 medewerkers" />
            </div>
            <Button onClick={() => maak.mutate()} disabled={!orgNaam || maak.isPending}>
              <Plus size={16} style={{ marginRight: 6 }} /> Afname aanmaken
            </Button>
          </div>
        </div>

        {/* Fundament-blok */}
        <div style={{ background: "#16384a", color: "#fff", borderRadius: 12, padding: 24, marginTop: 24 }}>
          <div style={{ color: "#b08b3f", fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
            Het fundament
          </div>
          <h2 style={{ color: "#fff", fontSize: 20, marginTop: 0 }}>T4O kijkt door de linkermonocle</h2>
          <p style={{ color: "#cdd8de", fontSize: 14 }}>
            De TaPas Master View vat het hele gedachtegoed in één beeld: een bril met twee lenzen. De rechterlens
            kijkt naar het individu en leest hem van binnen naar buiten — wie hij in essentie is (BE), wat hij kan
            (DO), wat hij realiseert (HAVE). Dat meet de T4P.
          </p>
          <p style={{ color: "#cdd8de", fontSize: 14 }}>
            De linkerlens kijkt naar de organisatie via de Golden Circle: waarom ze bestaat (WHY), hoe ze werkt
            (HOW), wat ze voortbrengt (WHAT). Dat is wat T4O meet.
          </p>
          <p style={{ color: "#cdd8de", fontSize: 14, marginBottom: 0 }}>
            Het neusbruggetje verbindt mens en organisatie — emotioneel (psychologische veiligheid, betrokkenheid)
            én zakelijk (loon naar werken). Omdat beide lenzen dezelfde taal van talent en energie spreken, kunnen
            we ze samenbrengen: de match tussen wie een mens is en wie een organisatie is.
          </p>
        </div>

        {/* Bestaande afnames */}
        <h2 style={{ color: "#16384a", fontSize: 18, marginTop: 36 }}>Bestaande afnames</h2>
        {(!sessies || sessies.length === 0) && (
          <p style={{ color: "#5b6b73" }}>Nog geen afnames. Maak hierboven de eerste aan.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessies?.map((s) => (
            <Link key={s.id} href={`/t4o/sessie/${s.id}`}>
              <a style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #eef1f2", borderRadius: 10, padding: "14px 18px", cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#16384a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#16384a" }}>{s.orgNaam}</div>
                    <div style={{ fontSize: 13, color: "#5b6b73" }}>{s.orgLabel || "—"} · {s.status}</div>
                  </div>
                  <ArrowRight size={18} color="#5b6b73" />
                </div>
              </a>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 40 }}>
          <Link href="/"><a style={{ color: "#16384a", fontSize: 14 }}>Terug naar het platform</a></Link>
        </div>
      </div>
    </div>
  );
}
