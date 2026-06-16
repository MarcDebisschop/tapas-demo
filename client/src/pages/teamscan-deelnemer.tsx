import { useParams } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, ShieldCheck, ArrowUp, ArrowDown, Info, Languages } from "lucide-react";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";

function TaalKiezer({ uiTaal, setUiTaal, label }: { uiTaal: Taal; setUiTaal: (t: Taal) => void; label: string }) {
  return (
    <Select value={uiTaal} onValueChange={(v) => setUiTaal(normaliseerTaal(v))}>
      <SelectTrigger className="h-9 w-auto gap-1.5 px-2.5" data-testid="select-ui-taal" aria-label={label}>
        <Languages className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TALEN.map((taal) => (
          <SelectItem key={taal} value={taal} data-testid={`option-taal-${taal}`}>
            {TAAL_CODES[taal]} · {TAAL_NAMEN[taal]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * TaPas Teamscan — deelnemerscherm op de publieke link /teamscan/r/:token.
 * ------------------------------------------------------------------
 * Een teamlid vult anoniem de drie meetblokken in:
 *   A. Fundament (8 stellingen, 1-5)
 *   B. Team-functioneren / Lencioni (38 stellingen, 1-5, gemengd getoond)
 *   C. Vertrouwensanatomie: rangschik 5 elementen (1=belangrijkst) + scoor
 *      de prestatie per element (1-5).
 * Reflectie- en ontwikkelinstrument — geen diagnose of beoordeling.
 */

type Itembank = {
  schaal: { labels: Record<string, string> };
  blokken: {
    A_fundament: { naam: string; instructie: string; items: { id: string; tekst: string }[] };
    B_lencioni: { naam: string; instructie: string; items: { id: number; tekst: string }[] };
    C_vertrouwensanatomie: {
      naam: string;
      instructie: string;
      elementen: { id: string; naam: string; omschrijving: string }[];
      prestatie: { labels: Record<string, string> };
    };
  };
};

type DeelnemerCtx = {
  deelnemer: { id: number; label: string; sessieId: number };
  sessie: { teamNaam: string } | null;
  reedsIngevuld: boolean;
};

const SCHAAL = [1, 2, 3, 4, 5];

function LikertRij({
  tekst,
  labels,
  waarde,
  onKies,
}: {
  tekst: string;
  labels: Record<string, string>;
  waarde: number | undefined;
  onKies: (n: number) => void;
}) {
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #eef1f2" }}>
      <div style={{ marginBottom: 8, fontSize: 15 }}>{tekst}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {SCHAAL.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onKies(n)}
            style={{
              flex: "1 1 0",
              minWidth: 84,
              padding: "8px 6px",
              borderRadius: 8,
              border: waarde === n ? "2px solid #16384a" : "1px solid #d6dcdf",
              background: waarde === n ? "#16384a" : "#fff",
              color: waarde === n ? "#fff" : "#16384a",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: waarde === n ? 700 : 500,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>{n}</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>{labels[String(n)]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TeamscanDeelnemer() {
  const [uiTaal, setUiTaal] = useState<Taal>(STANDAARD_TAAL);
  const t = maakVertaler(uiTaal);
  const { token } = useParams<{ token: string }>();
  const { data: itembank } = useQuery<Itembank>({
    queryKey: ["/api/teamscan/itembank", uiTaal],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/teamscan/itembank?taal=${uiTaal}`);
      return res.json();
    },
  });
  const { data: ctx } = useQuery<DeelnemerCtx>({ queryKey: [`/api/teamscan/deelnemer/${token}`] });

  const [fundament, setFundament] = useState<Record<string, number>>({});
  const [lencioni, setLencioni] = useState<Record<string, number>>({});
  const [prestatie, setPrestatie] = useState<Record<string, number>>({});
  const [volgorde, setVolgorde] = useState<string[]>([]);
  const [klaar, setKlaar] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  // Init rang-volgorde zodra de itembank geladen is.
  useEffect(() => {
    if (itembank && volgorde.length === 0) {
      setVolgorde(itembank.blokken.C_vertrouwensanatomie.elementen.map((e) => e.id));
    }
  }, [itembank, volgorde.length]);

  const indienen = useMutation({
    mutationFn: async () => {
      const vertrouwenRanking: Record<string, number> = {};
      volgorde.forEach((id, i) => (vertrouwenRanking[id] = i + 1));
      await apiRequest("POST", `/api/teamscan/deelnemer/${token}/antwoorden`, {
        fundament,
        lencioni,
        vertrouwenRanking,
        vertrouwenPrestatie: prestatie,
      });
    },
    onSuccess: () => setKlaar(true),
    onError: (e: any) => setFout(String(e?.message ?? e)),
  });

  const fundItems = itembank?.blokken.A_fundament.items ?? [];
  const lencItems = itembank?.blokken.B_lencioni.items ?? [];
  const elementen = itembank?.blokken.C_vertrouwensanatomie.elementen ?? [];

  const voortgang = useMemo(() => {
    const totaal = fundItems.length + lencItems.length + elementen.length + 1; // +1 voor ranking
    let gedaan = Object.keys(fundament).length + Object.keys(lencioni).length + Object.keys(prestatie).length;
    if (volgorde.length === elementen.length && elementen.length > 0) gedaan += 1;
    return totaal ? Math.round((gedaan / totaal) * 100) : 0;
  }, [fundament, lencioni, prestatie, volgorde, fundItems.length, lencItems.length, elementen.length]);

  const compleet =
    fundItems.every((it) => fundament[it.id] != null) &&
    lencItems.every((it) => lencioni[String(it.id)] != null) &&
    elementen.every((el) => prestatie[el.id] != null) &&
    volgorde.length === elementen.length;

  function verplaats(i: number, richting: -1 | 1) {
    const j = i + richting;
    if (j < 0 || j >= volgorde.length) return;
    const kopie = [...volgorde];
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    setVolgorde(kopie);
  }

  if (ctx?.reedsIngevuld || klaar) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader right={<TaalKiezer uiTaal={uiTaal} setUiTaal={setUiTaal} label={t("taal_kiezer_label")} />} />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
          <CheckCircle2 size={56} color="#3f8f5b" style={{ marginBottom: 16 }} />
          <h1 style={{ color: "#16384a" }}>{t("ts_dn_klaar_titel")}</h1>
          <p style={{ color: "#5b6b73", fontSize: 16 }}>
            {t("ts_dn_klaar_tekst")}
          </p>
        </div>
      </div>
    );
  }

  if (!itembank || !ctx) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader right={<TaalKiezer uiTaal={uiTaal} setUiTaal={setUiTaal} label={t("taal_kiezer_label")} />} />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: 64, textAlign: "center", color: "#5b6b73" }}>
          {t("algemeen_laden")}
        </div>
      </div>
    );
  }

  const presLabels = itembank.blokken.C_vertrouwensanatomie.prestatie.labels;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader right={<TaalKiezer uiTaal={uiTaal} setUiTaal={setUiTaal} label={t("taal_kiezer_label")} />} />
      {/* sticky voortgangsbalk */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: "1px solid #eef1f2", padding: "10px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5b6b73", marginBottom: 6 }}>
            <span>{t("ts_home_titel")}{ctx.sessie ? ` · ${ctx.sessie.teamNaam}` : ""}</span>
            <span>{voortgang}% {t("ts_dn_voortgang")}</span>
          </div>
          <div style={{ height: 6, background: "#eef1f2", borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${voortgang}%`, background: "#16384a", borderRadius: 3, transition: "width .2s" }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 80px" }}>
        <div style={{ background: "#f1f5f7", borderLeft: "4px solid #16384a", padding: "12px 16px", borderRadius: "0 6px 6px 0", color: "#5b6b73", fontSize: 13, marginBottom: 24, display: "flex", gap: 10 }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t("ts_dn_disclaimer")}</span>
        </div>

        {/* BLOK A — Fundament */}
        <h2 style={{ color: "#16384a", fontSize: 22 }}>{itembank.blokken.A_fundament.naam}</h2>
        <p style={{ color: "#5b6b73" }}>{itembank.blokken.A_fundament.instructie}</p>
        {fundItems.map((it) => (
          <LikertRij
            key={it.id}
            tekst={it.tekst}
            labels={itembank.schaal.labels}
            waarde={fundament[it.id]}
            onKies={(n) => setFundament((p) => ({ ...p, [it.id]: n }))}
          />
        ))}

        {/* BLOK B — Lencioni 38 */}
        <h2 style={{ color: "#16384a", fontSize: 22, marginTop: 40 }}>{itembank.blokken.B_lencioni.naam}</h2>
        <p style={{ color: "#5b6b73" }}>{itembank.blokken.B_lencioni.instructie}</p>
        {lencItems.map((it) => (
          <LikertRij
            key={it.id}
            tekst={it.tekst}
            labels={itembank.schaal.labels}
            waarde={lencioni[String(it.id)]}
            onKies={(n) => setLencioni((p) => ({ ...p, [String(it.id)]: n }))}
          />
        ))}

        {/* BLOK C — Vertrouwensanatomie */}
        <h2 style={{ color: "#16384a", fontSize: 22, marginTop: 40 }}>{itembank.blokken.C_vertrouwensanatomie.naam}</h2>
        <p style={{ color: "#5b6b73" }}>{itembank.blokken.C_vertrouwensanatomie.instructie}</p>

        <h3 style={{ color: "#16384a", marginTop: 18 }}>{t("ts_dn_rang_titel")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {volgorde.map((id, i) => {
            const el = elementen.find((e) => e.id === id)!;
            return (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  background: "#fff",
                  border: "1px solid #d6dcdf",
                  borderRadius: 10,
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#16384a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: "#16384a" }}>{el.naam}</div>
                  <div style={{ fontSize: 13, color: "#5b6b73" }}>{el.omschrijving}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button type="button" onClick={() => verplaats(i, -1)} disabled={i === 0} style={{ border: "1px solid #d6dcdf", background: "#fff", borderRadius: 6, padding: 4, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.4 : 1 }} aria-label={t("ts_dn_naar_boven")}>
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" onClick={() => verplaats(i, 1)} disabled={i === volgorde.length - 1} style={{ border: "1px solid #d6dcdf", background: "#fff", borderRadius: 6, padding: 4, cursor: i === volgorde.length - 1 ? "default" : "pointer", opacity: i === volgorde.length - 1 ? 0.4 : 1 }} aria-label={t("ts_dn_naar_beneden")}>
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <h3 style={{ color: "#16384a", marginTop: 28 }}>{t("ts_dn_prestatie_titel")}</h3>
        {elementen.map((el) => (
          <LikertRij
            key={el.id}
            tekst={el.naam + " — " + el.omschrijving}
            labels={presLabels}
            waarde={prestatie[el.id]}
            onKies={(n) => setPrestatie((p) => ({ ...p, [el.id]: n }))}
          />
        ))}

        {fout && (
          <div style={{ marginTop: 20, padding: 12, background: "#fdecea", border: "1px solid #f5c6c2", borderRadius: 8, color: "#c0473f", fontSize: 14 }}>
            {fout}
          </div>
        )}

        <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Button onClick={() => { setFout(null); indienen.mutate(); }} disabled={!compleet || indienen.isPending} size="lg">
            {indienen.isPending ? t("ts_dn_indienen_bezig") : t("ts_dn_indienen")}
          </Button>
          {!compleet && <span style={{ color: "#5b6b73", fontSize: 13 }}>{t("ts_dn_onvolledig")}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#5b6b73", fontSize: 12, marginLeft: "auto" }}>
            <ShieldCheck size={15} /> {t("ts_dn_anoniem")}
          </span>
        </div>
      </div>
    </div>
  );
}
