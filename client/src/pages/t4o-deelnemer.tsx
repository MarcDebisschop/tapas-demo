import { useParams } from "wouter";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Info } from "lucide-react";

/**
 * TaPas 4 Organizations — respondent-invulflow (route #/t4o/r/:token).
 * ------------------------------------------------------------------
 * Haalt het instrument + de respondent-context op, filtert de items op de
 * ring van de respondent (binnen/midden/buiten) en toont de secties één
 * voor één. Per item-type een eigen renderer: likert/congruentie (agree5),
 * energie (energyBalance), batterij (0-10 slider), en forced-choice
 * (single/multi/rank). UI-strings hardcoded NL conform het contract.
 */

type Ring = "binnen" | "midden" | "buiten";
type ItemType = "likert" | "congruence" | "energy" | "battery" | "forced-choice-single" | "forced-choice-multi" | "forced-choice-rank";
type Item = {
  id: string;
  rings: Ring[];
  itemType: ItemType;
  prompt: { nl: string };
  choiceSet?: string;
  select?: number;
  rank?: number;
};
type Section = { type: string; ringOnly?: Ring; items: string[]; instructions: { nl: string } };
type ChoiceOption = { value: string; label: { nl: string } };
type Instrument = {
  responseScales: {
    agree5: { options: { value: number; label: { nl: string } }[] };
    energyBalance: { options: { value: number; label: { nl: string } }[] };
    battery: { min: number; max: number };
  };
  choiceSets: Record<string, ChoiceOption[]>;
  items: Item[];
  sections: Section[];
};
type Ctx = { respondent: { groep: string; ring: Ring }; sessie: { orgNaam: string }; ring: Ring; reedsIngevuld: boolean };

type Waarde = number | string | string[];

const NAVY = "#16384a";

export default function T4ODeelnemer() {
  const { token } = useParams<{ token: string }>();
  const { data: instrument } = useQuery<Instrument>({ queryKey: ["/api/t4o/instrument"] });
  const { data: ctx } = useQuery<Ctx>({ queryKey: [`/api/t4o/respondent/${token}`] });

  const [antwoorden, setAntwoorden] = useState<Record<string, Waarde>>({});
  const [stap, setStap] = useState(0);
  const [klaar, setKlaar] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [toonRust, setToonRust] = useState(false);

  const ring = ctx?.ring;

  // Zichtbare secties voor deze ring (ringOnly + minstens één item in de ring).
  const secties = useMemo(() => {
    if (!instrument || !ring) return [];
    const itemById = Object.fromEntries(instrument.items.map((it) => [it.id, it]));
    return instrument.sections.filter((s) => {
      if (s.ringOnly && s.ringOnly !== ring) return false;
      if (s.type === "intro" || s.type === "outro") return true;
      return s.items.some((id) => itemById[id]?.rings.includes(ring));
    });
  }, [instrument, ring]);

  const itemById = useMemo(
    () => (instrument ? Object.fromEntries(instrument.items.map((it) => [it.id, it])) : {}),
    [instrument],
  );

  function itemsVanSectie(s: Section): Item[] {
    if (!ring) return [];
    return s.items.map((id) => itemById[id]).filter((it): it is Item => !!it && it.rings.includes(ring));
  }

  function setWaarde(id: string, w: Waarde) {
    setAntwoorden((p) => ({ ...p, [id]: w }));
  }

  function itemCompleet(it: Item): boolean {
    const w = antwoorden[it.id];
    if (it.itemType === "forced-choice-rank") return Array.isArray(w) && w.length === (it.rank ?? 3);
    if (it.itemType === "forced-choice-multi") return Array.isArray(w) && w.length === (it.select ?? 2);
    return w != null && w !== "";
  }

  const indienen = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/t4o/respondent/${token}/antwoorden`, antwoorden);
    },
    onSuccess: () => setKlaar(true),
    onError: (e: any) => setFout(String(e?.message ?? e)),
  });

  if (ctx?.reedsIngevuld || klaar) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px", textAlign: "center" }}>
          <CheckCircle2 size={56} color="#3f8f5b" style={{ marginBottom: 16 }} />
          <h1 style={{ color: NAVY }}>{ctx?.reedsIngevuld && !klaar ? "Bedankt — jullie invulling is al ontvangen." : "Bedankt voor het invullen."}</h1>
          <p style={{ color: "#5b6b73", fontSize: 16 }}>
            Jullie antwoorden worden samengevoegd tot een organisatie-talentprofiel. Er is geen verdere actie nodig.
          </p>
        </div>
      </div>
    );
  }

  if (!instrument || !ctx) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: 64, textAlign: "center", color: "#5b6b73" }}>Laden…</div>
      </div>
    );
  }

  if (secties.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
        <AppHeader />
        <div style={{ maxWidth: 640, margin: "0 auto", padding: 64, textAlign: "center", color: "#5b6b73" }}>
          Deze link is niet (meer) geldig.
        </div>
      </div>
    );
  }

  const huidige = secties[stap];
  const isIntro = huidige.type === "intro";
  const isOutro = huidige.type === "outro";
  const sectieItems = itemsVanSectie(huidige);
  const sectieCompleet = sectieItems.every(itemCompleet);
  const laatsteInvulStap = stap >= secties.length - 1 || secties.slice(stap + 1).every((s) => s.type === "outro");
  const voortgang = Math.round(((stap + 1) / secties.length) * 100);

  function volgende() {
    setFout(null);
    if (stap < secties.length - 1) {
      setStap(stap + 1);
      setToonRust(true);
      setTimeout(() => setToonRust(false), 1400);
      window.scrollTo({ top: 0 });
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8f9" }}>
      <AppHeader />
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: "1px solid #eef1f2", padding: "10px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5b6b73", marginBottom: 6 }}>
            <span>Organisatie-talentprofiel{ctx.sessie ? ` · ${ctx.sessie.orgNaam}` : ""}</span>
            <span>{voortgang}%</span>
          </div>
          <div style={{ height: 6, background: "#eef1f2", borderRadius: 3 }}>
            <div style={{ height: "100%", width: `${voortgang}%`, background: NAVY, borderRadius: 3, transition: "width .2s" }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 24px 80px" }}>
        {toonRust && (
          <div style={{ background: "#f1f5f7", borderLeft: "4px solid #16384a", padding: "12px 16px", borderRadius: "0 6px 6px 0", color: "#5b6b73", fontSize: 14, marginBottom: 20 }}>
            Even ademen. De volgende ronde kijkt scherper.
          </div>
        )}

        {isIntro ? (
          <div>
            <h1 style={{ color: NAVY, fontSize: 26 }}>Welkom</h1>
            <p style={{ color: "#5b6b73", fontSize: 16 }}>{huidige.instructions.nl}</p>
            <Button size="lg" onClick={volgende} style={{ marginTop: 12 }}>Beginnen</Button>
          </div>
        ) : isOutro ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <CheckCircle2 size={48} color="#3f8f5b" style={{ marginBottom: 12 }} />
            <p style={{ color: "#5b6b73", fontSize: 16 }}>{huidige.instructions.nl}</p>
          </div>
        ) : (
          <>
            <div style={{ background: "#f1f5f7", borderLeft: "4px solid #16384a", padding: "12px 16px", borderRadius: "0 6px 6px 0", color: "#5b6b73", fontSize: 14, marginBottom: 20, display: "flex", gap: 10 }}>
              <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{huidige.instructions.nl}</span>
            </div>

            {sectieItems.map((it) => (
              <ItemRenderer
                key={it.id}
                item={it}
                instrument={instrument}
                waarde={antwoorden[it.id]}
                setWaarde={(w) => setWaarde(it.id, w)}
              />
            ))}

            {fout && (
              <div style={{ marginTop: 20, padding: 12, background: "#fdecea", border: "1px solid #f5c6c2", borderRadius: 8, color: "#c0473f", fontSize: 14 }}>
                Er ging iets mis bij het indienen. Probeer het opnieuw.
              </div>
            )}

            <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {laatsteInvulStap ? (
                <Button size="lg" onClick={() => { setFout(null); indienen.mutate(); }} disabled={!sectieCompleet || indienen.isPending}>
                  {indienen.isPending ? "Bezig…" : "Antwoorden indienen"}
                </Button>
              ) : (
                <Button size="lg" onClick={volgende} disabled={!sectieCompleet}>Verder</Button>
              )}
              {!sectieCompleet && <span style={{ color: "#5b6b73", fontSize: 13 }}>Beantwoord eerst alle vragen in deze ronde.</span>}
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#5b6b73", fontSize: 12, marginLeft: "auto" }}>
                <ShieldCheck size={15} /> Anonieme invulling
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ItemRenderer({
  item,
  instrument,
  waarde,
  setWaarde,
}: {
  item: Item;
  instrument: Instrument;
  waarde: Waarde | undefined;
  setWaarde: (w: Waarde) => void;
}) {
  const prompt = item.prompt.nl;

  if (item.itemType === "battery") {
    const { min, max } = instrument.responseScales.battery;
    const v = typeof waarde === "number" ? waarde : Math.round((min + max) / 2);
    return (
      <div style={{ padding: "16px 0", borderBottom: "1px solid #eef1f2" }}>
        <div style={{ marginBottom: 10, fontSize: 15 }}>{prompt}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <input type="range" min={min} max={max} value={v} onChange={(e) => setWaarde(Number(e.target.value))} style={{ flex: 1 }} />
          <div style={{ width: 44, textAlign: "center", fontWeight: 700, fontSize: 20, color: NAVY }}>{typeof waarde === "number" ? waarde : "–"}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5b6b73" }}>
          <span>Leegloop ({min})</span><span>Vol ({max})</span>
        </div>
      </div>
    );
  }

  if (item.itemType === "energy") {
    const opts = instrument.responseScales.energyBalance.options;
    const kleuren: Record<number, string> = { [-1]: "#c0473f", 0: "#9aa7ac", 1: "#3f8f5b" };
    return (
      <div style={{ padding: "14px 0", borderBottom: "1px solid #eef1f2" }}>
        <div style={{ marginBottom: 8, fontSize: 15 }}>{prompt}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {opts.map((o) => {
            const gekozen = waarde === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setWaarde(o.value)}
                style={{
                  flex: "1 1 0", minWidth: 110, padding: "10px 6px", borderRadius: 8,
                  border: gekozen ? `2px solid ${kleuren[o.value]}` : "1px solid #d6dcdf",
                  background: gekozen ? kleuren[o.value] : "#fff",
                  color: gekozen ? "#fff" : NAVY, cursor: "pointer", fontSize: 13, fontWeight: gekozen ? 700 : 500,
                }}
              >
                {o.label.nl}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.itemType === "likert" || item.itemType === "congruence") {
    const opts = instrument.responseScales.agree5.options;
    return (
      <div style={{ padding: "14px 0", borderBottom: "1px solid #eef1f2" }}>
        <div style={{ marginBottom: 8, fontSize: 15 }}>{prompt}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {opts.map((o) => {
            const gekozen = waarde === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setWaarde(o.value)}
                style={{
                  flex: "1 1 0", minWidth: 84, padding: "8px 6px", borderRadius: 8,
                  border: gekozen ? `2px solid ${NAVY}` : "1px solid #d6dcdf",
                  background: gekozen ? NAVY : "#fff", color: gekozen ? "#fff" : NAVY,
                  cursor: "pointer", fontSize: 13, fontWeight: gekozen ? 700 : 500,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700 }}>{o.value}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{o.label.nl}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Forced-choice varianten
  const opties = item.choiceSet ? instrument.choiceSets[item.choiceSet] ?? [] : [];

  if (item.itemType === "forced-choice-single") {
    return (
      <div style={{ padding: "14px 0", borderBottom: "1px solid #eef1f2" }}>
        <div style={{ marginBottom: 8, fontSize: 15 }}>{prompt}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opties.map((o) => {
            const gekozen = waarde === o.value;
            return (
              <button key={o.value} type="button" onClick={() => setWaarde(o.value)}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 8, border: gekozen ? `2px solid ${NAVY}` : "1px solid #d6dcdf", background: gekozen ? "#eef2f4" : "#fff", color: NAVY, cursor: "pointer", fontSize: 14, fontWeight: gekozen ? 700 : 500 }}>
                {o.label.nl}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.itemType === "forced-choice-multi") {
    const n = item.select ?? 2;
    const gekozenLijst = Array.isArray(waarde) ? waarde : [];
    function toggle(v: string) {
      let next: string[];
      if (gekozenLijst.includes(v)) next = gekozenLijst.filter((x) => x !== v);
      else if (gekozenLijst.length < n) next = [...gekozenLijst, v];
      else next = gekozenLijst;
      setWaarde(next);
    }
    return (
      <div style={{ padding: "14px 0", borderBottom: "1px solid #eef1f2" }}>
        <div style={{ marginBottom: 4, fontSize: 15 }}>{prompt}</div>
        <div style={{ fontSize: 13, color: "#5b6b73", marginBottom: 8 }}>{`Kies er precies ${n}.`}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {opties.map((o) => {
            const gekozen = gekozenLijst.includes(o.value);
            return (
              <button key={o.value} type="button" onClick={() => toggle(o.value)}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 8, border: gekozen ? `2px solid ${NAVY}` : "1px solid #d6dcdf", background: gekozen ? "#eef2f4" : "#fff", color: NAVY, cursor: "pointer", fontSize: 14, fontWeight: gekozen ? 700 : 500 }}>
                {o.label.nl}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // forced-choice-rank
  const rankN = item.rank ?? 3;
  const gekozenRang = Array.isArray(waarde) ? waarde : [];
  function toggleRang(v: string) {
    let next: string[];
    if (gekozenRang.includes(v)) next = gekozenRang.filter((x) => x !== v);
    else if (gekozenRang.length < rankN) next = [...gekozenRang, v];
    else next = gekozenRang;
    setWaarde(next);
  }
  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #eef1f2" }}>
      <div style={{ marginBottom: 4, fontSize: 15 }}>{prompt}</div>
      <div style={{ fontSize: 13, color: "#5b6b73", marginBottom: 8 }}>{`Kies en rangschik jullie top ${rankN}.`}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {opties.map((o) => {
          const idx = gekozenRang.indexOf(o.value);
          const gekozen = idx >= 0;
          return (
            <button key={o.value} type="button" onClick={() => toggleRang(o.value)}
              style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "12px 14px", borderRadius: 8, border: gekozen ? `2px solid ${NAVY}` : "1px solid #d6dcdf", background: gekozen ? "#eef2f4" : "#fff", color: NAVY, cursor: "pointer", fontSize: 14, fontWeight: gekozen ? 700 : 500 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: gekozen ? NAVY : "#e6eaec", color: gekozen ? "#fff" : "#5b6b73", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                {gekozen ? idx + 1 : ""}
              </span>
              {o.label.nl}
            </button>
          );
        })}
      </div>
    </div>
  );
}
