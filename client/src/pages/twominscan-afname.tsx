import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ALLE_WOORDEN, IE_STELLINGEN, berekenKleurScores, berekenIE } from "@/twominscan/data";
import { matchProfiel } from "@/twominscan/profielen";
import { KLEUR } from "@/twominscan/theme";
import { maakT, Vertaler, Taal, STANDAARD_TAAL } from "@/twominscan/i18n";

// 2MINSCAN afname — Energetisch Gedragsprofiel.
// Stap 1: kies 8 van 32 woorden (sterkste herkenning).
// Stap 2: kies uit de resterende 24 nog eens 8 woorden.
// Stap 3: 21 stellingen (intro/extravert), kruis alle herkenbare aan.
// Geen localStorage — alle state in React.

type Stap = "intro" | "ronde1" | "ronde2" | "stellingen" | "berekenen";

function shuffle<T>(arr: T[], seed = 42): T[] {
  // deterministische shuffle zodat de volgorde stabiel blijft binnen een sessie
  const a = [...arr];
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TwominscanAfname() {
  const [, navigate] = useLocation();
  const [stap, setStap] = useState<Stap>("intro");
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const [naam, setNaam] = useState("");
  const tr = useMemo(() => maakT(taal), [taal]);
  const [ronde1, setRonde1] = useState<string[]>([]);
  const [ronde2, setRonde2] = useState<string[]>([]);
  const [stellingen, setStellingen] = useState<Set<number>>(new Set());

  const gemengd = useMemo(() => shuffle(ALLE_WOORDEN), []);
  const ronde2Pool = useMemo(
    () => gemengd.filter((w) => !ronde1.includes(w.woord)),
    [gemengd, ronde1]
  );

  function toggleRonde1(w: string) {
    setRonde1((cur) => {
      if (cur.includes(w)) return cur.filter((x) => x !== w);
      if (cur.length >= 8) return cur;
      return [...cur, w];
    });
  }
  function toggleRonde2(w: string) {
    setRonde2((cur) => {
      if (cur.includes(w)) return cur.filter((x) => x !== w);
      if (cur.length >= 8) return cur;
      return [...cur, w];
    });
  }
  function toggleStelling(nr: number) {
    setStellingen((cur) => {
      const next = new Set(cur);
      if (next.has(nr)) next.delete(nr);
      else next.add(nr);
      return next;
    });
  }

  function rond_af() {
    const score = berekenKleurScores(ronde1, ronde2);
    const ie = berekenIE(stellingen);
    const match = matchProfiel(score, ie.xStand);
    // resultaat doorgeven via URL-params (geen storage)
    const payload = encodeURIComponent(
      JSON.stringify({
        naam,
        taal,
        datum: new Date().toLocaleDateString("nl-BE"),
        score,
        ie: { uitkomst: ie.uitkomst, label: ie.label, verschil: ie.verschil, xStand: ie.xStand },
        egCode: match.egCodeIngevuld,
        egCodePositief: match.egCodePositief,
        minSegment: match.minSegment,
        profielCode: match.profiel.egCode,
        exact: match.exacteMatch,
      })
    );
    navigate(`/2minscan/rapport?d=${payload}`);
  }

  function toonVoorbeeldrapport() {
    const d = encodeURIComponent(JSON.stringify({ naam: "Nathalie Wouters", taal: "nl", datum: "25/6/2026", score: { blauw: 2, groen: 9, geel: 10, rood: 3 }, ie: { uitkomst: "meer_extravert", label: "uitgesproken extravert", verschil: -3, xStand: "EE" }, egCode: "RgEEO-a", egCodePositief: "RgEEO", minSegment: "-a", profielCode: "RgXO-a", exact: true }));
    navigate(`/2minscan/rapport?d=${d}`);
  }

  return (
    <div style={{ minHeight: "100vh", background: KLEUR.zacht, color: KLEUR.inkt }}>
      <TopBalk taal={taal} setTaal={setTaal} tr={tr} />
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 64px" }}>
        {stap === "intro" && (
          <IntroBlok naam={naam} setNaam={setNaam} start={() => setStap("ronde1")} toonDemo={toonVoorbeeldrapport} tr={tr} />
        )}

        {stap === "ronde1" && (
          <WoordKeuze
            tr={tr}
            titel={tr("ui.afname.ronde1.titel", "Ronde 1 — kies de 8 woorden die je het méést kenmerken")}
            subtitel={tr("ui.afname.ronde1.subtitel", "Duid uit alle begrippen de 8 aan die het sterkst bij jou passen in een professionele context.")}
            woorden={gemengd}
            gekozen={ronde1}
            max={8}
            onToggle={toggleRonde1}
            terug={() => setStap("intro")}
            verder={() => setStap("ronde2")}
            verderActief={ronde1.length === 8}
          />
        )}

        {stap === "ronde2" && (
          <WoordKeuze
            tr={tr}
            titel={tr("ui.afname.ronde2.titel", "Ronde 2 — kies nog eens 8 woorden die je óók herkent")}
            subtitel={tr("ui.afname.ronde2.subtitel", "Uit de overige begrippen duid je nu de 8 aan die ook bij je passen, maar net iets minder sterk.")}
            woorden={ronde2Pool}
            gekozen={ronde2}
            max={8}
            onToggle={toggleRonde2}
            terug={() => setStap("ronde1")}
            verder={() => setStap("stellingen")}
            verderActief={ronde2.length === 8}
          />
        )}

        {stap === "stellingen" && (
          <Stellingen
            tr={tr}
            gekozen={stellingen}
            onToggle={toggleStelling}
            terug={() => setStap("ronde2")}
            verder={rond_af}
          />
        )}
      </div>
    </div>
  );
}

const TALEN_KEUZE: { code: Taal; label: string }[] = [
  { code: "nl", label: "NL" },
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
  { code: "ru", label: "RU" },
];

function TopBalk({ taal, setTaal, tr }: { taal: Taal; setTaal: (t: Taal) => void; tr: Vertaler }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${KLEUR.lijn}`,
        background: "#fff",
        padding: "14px 20px",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontWeight: 800, letterSpacing: 1, color: KLEUR.petrol, fontSize: 18 }}>
          2MINSCAN
        </span>
        <span style={{ color: KLEUR.teal, fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>
          {tr("ui.afname.topbalk.subtitel", "ENERGETISCH GEDRAGSPROFIEL")}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          {TALEN_KEUZE.map((t) => (
            <button
              key={t.code}
              onClick={() => setTaal(t.code)}
              style={{
                border: "none", background: "none", cursor: "pointer",
                fontSize: 12, fontWeight: taal === t.code ? 800 : 500,
                color: taal === t.code ? KLEUR.petrol : "#9a9a9a",
                padding: "2px 5px", borderRadius: 6,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntroBlok({
  naam, setNaam, start, toonDemo, tr,
}: { naam: string; setNaam: (v: string) => void; start: () => void; toonDemo: () => void; tr: Vertaler }) {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ color: KLEUR.goud, fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>
        {tr("ui.afname.intro.kicker", "WELKOM")}
      </div>
      <h1 style={{ color: KLEUR.petrol, fontSize: 38, lineHeight: 1.1, margin: "8px 0 14px", fontWeight: 800 }}>
        {tr("ui.afname.intro.titel", "Breng je energie in kaart")}
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: KLEUR.inkt, maxWidth: 620 }}>
        {tr("ui.afname.intro.tekst", "De 2MINSCAN brengt in beeld hoe jij energie geeft en krijgt in samenwerking met anderen. Je doorloopt drie korte stappen. Er zijn geen goede of foute antwoorden — kies wat het meest spontaan bij je past.")}
      </p>

      <div style={{ display: "grid", gap: 12, margin: "22px 0", maxWidth: 620 }}>
        <StapKaart nr="1" titel={tr("ui.afname.stap1.titel", "Kies 8 woorden")} tekst={tr("ui.afname.stap1.tekst", "De begrippen die je het méést kenmerken.")} />
        <StapKaart nr="2" titel={tr("ui.afname.stap2.titel", "Kies nog 8 woorden")} tekst={tr("ui.afname.stap2.tekst", "De begrippen die je óók herkent.")} />
        <StapKaart nr="3" titel={tr("ui.afname.stap3.titel", "21 korte stellingen")} tekst={tr("ui.afname.stap3.tekst", "Kruis aan wat op jou van toepassing is.")} />
      </div>

      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: KLEUR.petrol, marginBottom: 6 }}>
        {tr("ui.afname.naam.label", "Je naam (optioneel)")}
      </label>
      <input
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder={tr("ui.afname.naam.placeholder", "bv. Anne-Sofie Bogaerts")}
        style={{
          width: "100%", maxWidth: 420, padding: "11px 14px", fontSize: 15,
          border: `1px solid ${KLEUR.lijn}`, borderRadius: 10, background: "#fff",
          outline: "none",
        }}
      />
      <div style={{ marginTop: 26, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <PrimaireKnop onClick={start}>{tr("ui.afname.start", "Start de 2MINSCAN →")}</PrimaireKnop>
        <button
          onClick={toonDemo}
          style={{
            display: "inline-block",
            padding: "11px 18px",
            borderRadius: 10,
            border: `1.5px solid ${KLEUR.petrol}`,
            background: "transparent",
            color: KLEUR.petrol,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {tr("ui.afname.demo", "Bekijk voorbeeldrapport →")}
        </button>
      </div>
    </div>
  );
}

function StapKaart({ nr, titel, tekst }: { nr: string; titel: string; tekst: string }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", background: "#fff", border: `1px solid ${KLEUR.lijn}`, borderRadius: 12, padding: "12px 16px" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: KLEUR.petrol, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
        {nr}
      </div>
      <div>
        <div style={{ fontWeight: 700, color: KLEUR.petrol }}>{titel}</div>
        <div style={{ fontSize: 13, color: "#6b6b6b" }}>{tekst}</div>
      </div>
    </div>
  );
}

function WoordKeuze({
  tr, titel, subtitel, woorden, gekozen, max, onToggle, terug, verder, verderActief,
}: {
  tr: Vertaler;
  titel: string; subtitel: string;
  woorden: { woord: string; kleur: string }[];
  gekozen: string[]; max: number;
  onToggle: (w: string) => void;
  terug: () => void; verder: () => void; verderActief: boolean;
}) {
  return (
    <div>
      <div style={{ color: KLEUR.goud, fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>{tr("ui.afname.selectie", "SELECTIE")}</div>
      <h2 style={{ color: KLEUR.petrol, fontSize: 26, margin: "6px 0 6px", fontWeight: 800, lineHeight: 1.2 }}>
        {titel}
      </h2>
      <p style={{ color: "#5f5f5f", fontSize: 15, margin: "0 0 8px", maxWidth: 720 }}>{subtitel}</p>

      <TellerBalk gekozen={gekozen.length} max={max} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 10,
          margin: "18px 0 26px",
        }}
      >
        {woorden.map((w) => {
          const actief = gekozen.includes(w.woord);
          const vol = gekozen.length >= max && !actief;
          return (
            <button
              key={w.woord}
              onClick={() => onToggle(w.woord)}
              disabled={vol}
              style={{
                textAlign: "left",
                padding: "13px 14px",
                borderRadius: 12,
                border: actief ? `2px solid ${KLEUR.petrol}` : `1px solid ${KLEUR.lijn}`,
                background: actief ? "#fff" : "#fff",
                boxShadow: actief ? `0 2px 10px rgba(31,78,74,0.14)` : "none",
                cursor: vol ? "not-allowed" : "pointer",
                opacity: vol ? 0.45 : 1,
                position: "relative",
                transition: "all .12s ease",
                fontSize: 14.5,
                fontWeight: actief ? 700 : 500,
                color: actief ? KLEUR.petrol : KLEUR.inkt,
              }}
            >
              <span
                style={{
                  display: "inline-block", width: 9, height: 9, borderRadius: "50%",
                  marginRight: 9, verticalAlign: "middle",
                  background: actief ? KLEUR.teal : "#cfcabd",
                }}
              />
              {tr("woord." + w.woord, w.woord)}
              {actief && (
                <span style={{ position: "absolute", top: 8, right: 10, color: KLEUR.teal, fontWeight: 800 }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      <NavRij tr={tr} terug={terug} verder={verder} verderActief={verderActief}
        verderLabel={verderActief ? tr("ui.afname.verder", "Verder →") : `${tr("ui.afname.kies_nog", "Kies nog")} ${max - gekozen.length}`} />
    </div>
  );
}

function TellerBalk({ gekozen, max }: { gekozen: number; max: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
      <div style={{ flex: 1, maxWidth: 340, height: 8, background: "#e7e2d6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${(gekozen / max) * 100}%`, height: "100%", background: KLEUR.teal, transition: "width .2s ease" }} />
      </div>
      <div style={{ fontWeight: 800, color: gekozen === max ? KLEUR.teal : KLEUR.goud, fontSize: 15 }}>
        {gekozen} / {max}
      </div>
    </div>
  );
}

function Stellingen({
  tr, gekozen, onToggle, terug, verder,
}: {
  tr: Vertaler;
  gekozen: Set<number>; onToggle: (nr: number) => void; terug: () => void; verder: () => void;
}) {
  return (
    <div>
      <div style={{ color: KLEUR.goud, fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>{tr("ui.afname.stelling.kicker", "STAP 3")}</div>
      <h2 style={{ color: KLEUR.petrol, fontSize: 26, margin: "6px 0 6px", fontWeight: 800 }}>
        {tr("ui.afname.stelling.titel", "Kruis élke uitspraak aan waarin je jezelf herkent")}
      </h2>
      <p style={{ color: "#5f5f5f", fontSize: 15, margin: "0 0 18px", maxWidth: 720 }}>
        {tr("ui.afname.stelling.tekst", "Er is geen minimum of maximum. Vink gewoon aan wat op jou van toepassing is.")}
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        {IE_STELLINGEN.map((s) => {
          const actief = gekozen.has(s.nr);
          return (
            <button
              key={s.nr}
              onClick={() => onToggle(s.nr)}
              style={{
                display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                padding: "12px 16px", borderRadius: 10,
                border: actief ? `2px solid ${KLEUR.petrol}` : `1px solid ${KLEUR.lijn}`,
                background: "#fff", cursor: "pointer", fontSize: 15,
                color: KLEUR.inkt, fontWeight: actief ? 600 : 400,
              }}
            >
              <span
                style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  border: actief ? `none` : `1.5px solid #c9c4b8`,
                  background: actief ? KLEUR.teal : "#fff",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800,
                }}
              >
                {actief ? "✓" : ""}
              </span>
              {tr("stelling." + s.nr, s.tekst)}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 26 }}>
        <NavRij tr={tr} terug={terug} verder={verder} verderActief={true} verderLabel={tr("ui.afname.toon_profiel", "Toon mijn profiel →")} />
      </div>
    </div>
  );
}

function NavRij({
  tr, terug, verder, verderActief, verderLabel,
}: { tr: Vertaler; terug: () => void; verder: () => void; verderActief: boolean; verderLabel: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <button
        onClick={terug}
        style={{ background: "none", border: "none", color: KLEUR.petrol, fontWeight: 700, cursor: "pointer", fontSize: 15 }}
      >
        {tr("ui.afname.terug", "← Terug")}
      </button>
      <PrimaireKnop onClick={verder} disabled={!verderActief}>
        {verderLabel}
      </PrimaireKnop>
    </div>
  );
}

function PrimaireKnop({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#b9c4c1" : KLEUR.petrol,
        color: "#fff", border: "none", borderRadius: 10,
        padding: "12px 22px", fontWeight: 700, fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background .15s ease",
      }}
    >
      {children}
    </button>
  );
}
