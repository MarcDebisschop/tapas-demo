import { useMemo, useState } from "react";
import { PROFIELEN } from "@/twominscan/profielen";
import { kleurVolgorde } from "@/twominscan/data";
import { bouwRapportData } from "@/twominscan/content";
import { ontleedEGCode } from "@/twominscan/egcode";
import { KLEUR, KLEUR_HEX } from "@/twominscan/theme";
import { maakT, type Vertaler, type Taal } from "@/twominscan/i18n";
import { normaliseerTaal } from "@shared/talen";
import { Temperamentenwiel, initialenVan, positieByWielpositie, sectorLabel, wielAlsPng } from "@/temperamentenwiel";

// 2MINSCAN rapport — T4P Business Kompas-stijl, Energetic Flow-inhoud.
// 14 hoofdstukken. Web-weergave + print (PDF via venster-print).

// Anker rond het wiel op de wielpagina. De printbalk zoekt daarmee de getekende
// SVG op om ze als beeld mee te sturen naar de gedownloade PDF.
const WIELPAGINA_ID = "tw-rapportwiel";

// ?d= staat in location.search (gezet via window.location.href = "?d=...#/pad")
function parseData() {
  const raw = new URLSearchParams(window.location.search).get("d");
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

export default function TwominscanRapport() {
  const [payload] = useState(() => parseData());
  const taal: Taal = normaliseerTaal(payload?.taal ?? "nl");
  const tr = useMemo(() => maakT(taal), [taal]);

  const data = useMemo(() => {
    if (!payload) return null;
    const profiel =
      PROFIELEN.find((p) => p.egCode === payload.profielCode) ?? PROFIELEN[0];
    return bouwRapportData({
      naam: payload.naam || "",
      datum: payload.datum || new Date().toLocaleDateString("nl-BE"),
      egCode: payload.egCode || profiel.egCode,
      egCodePositief: payload.egCodePositief || profiel.egCode,
      minSegment: payload.minSegment ?? null,
      profiel,
    }, taal);
  }, [payload, taal]);

  if (!data) {
    return (
      <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>
        {tr("ui.rapport.geen_data", "Geen profielgegevens gevonden. Doorloop eerst de 2MINSCAN-afname.")}
      </div>
    );
  }

  const ontleed = ontleedEGCode(data.egCode, taal);
  const ieLabel = payload?.ie?.label ?? "";
  // Organisatie is optioneel: alleen tonen wanneer ze bij de afname is ingevuld.
  const organisatie: string = (payload?.organisatie ?? "").trim();
  // Portretfoto is altijd optioneel. Ontbreekt ze, dan toont het rapport niets:
  // geen leeg kader en geen melding dat er iets mist.
  const foto: Portret | null = leesPortret(payload?.foto);

  // AANBEVOLEN selectie-sleutel voor de officiële PDF: de volledige gemeten
  // kleurvolgorde + de apart gemeten X-stand. Samen wijzen die naar precies
  // één van de 24 bestaande profielen (nooit een onbestaande combinatie).
  const volgorde: string[] | undefined = payload?.score ? kleurVolgorde(payload.score) : undefined;
  const xStand: string | undefined = payload?.ie?.xStand ?? undefined;

  return (
    <div className="twominscan-pagina rapport-achtergrond" style={{ background: "#e8e6df", minHeight: "100vh", paddingBottom: 60 }}>
      <PrintBalk tr={tr} egCode={data.egCode} volgorde={volgorde} xStand={xStand} naam={data.naam} datum={data.datum} taal={taal} wielpositie={data.wielpositie} organisatie={organisatie} kleurvolgordeLabel={data.kleurvolgordeLabel} />
      <div className="rapport-doc" style={docStyle}>
        <Cover data={data} ieLabel={ieLabel} organisatie={organisatie} foto={foto} tr={tr} />
        <Inhoud tr={tr} />
        <Leeswijzer tr={tr} />
        <H1 data={data} ontleed={ontleed} ieLabel={ieLabel} score={payload?.score} tr={tr} />
        <H2 data={data} tr={tr} />
        <H3 tr={tr} />
        <H4 data={data} ontleed={ontleed} tr={tr} />
        <H5 data={data} tr={tr} />
        <H6 data={data} tr={tr} />
        <H7 data={data} ontleed={ontleed} tr={tr} />
        <H8 data={data} tr={tr} />
        <H9 data={data} tr={tr} />
        <H10 data={data} tr={tr} />
        <H11 data={data} ieLabel={ieLabel} tr={tr} />
        <H11Wiel data={data} tr={tr} />
        <Slot data={data} tr={tr} />
      </div>

      <style>{printCss}</style>
    </div>
  );
}

const docStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  background: "#fff",
  color: KLEUR.inkt,
  fontFamily: "Georgia, 'Times New Roman', serif",
};

function PrintBalk({ tr, egCode, volgorde, xStand, naam, datum, taal, wielpositie, organisatie, kleurvolgordeLabel }: { tr: Vertaler; egCode: string; volgorde?: string[]; xStand?: string; naam?: string; datum?: string; taal: Taal; wielpositie?: string; organisatie?: string; kleurvolgordeLabel?: string }) {
  const [bezig, setBezig] = useState(false);

  // De wielpagina die op het scherm staat mee laten reizen naar de PDF. Het
  // beeld komt letterlijk uit de weergave, zodat de kleurvolgorde per positie
  // maar op één plaats getekend blijft (client/src/temperamentenwiel).
  async function bouwWielbijlage() {
    const positie = wielpositie ? positieByWielpositie(wielpositie) : null;
    if (!positie || !wielpositie) return undefined;
    const svg = document.querySelector<SVGSVGElement>(`#${WIELPAGINA_ID} svg`);
    if (!svg) return undefined;
    const png = await wielAlsPng(svg);
    if (!png) return undefined;
    return {
      png,
      wielpositie,
      kop: tr("ui.h11wiel.kop", "JOUW PLAATS OP HET TEMPERAMENTENWIEL"),
      titel: tr("ui.h11wiel.titel", "Waar jouw energie op het wiel staat"),
      lead: tr(
        "ui.h11wiel.lead",
        "Het temperamentenwiel is een energetische gedragsvisualisatie. Elke positie op het wiel heeft haar eigen volgorde van vier energiekleuren: de eerste kleur in de buitenste band, daarna de tweede en de derde, en in de kern de kleur die energie kost. Jouw markering staat op de positie die bij jouw kleurvolgorde hoort.",
      ),
      positieLabel: tr("ui.h11.wielpositie", "Wielpositie"),
      kleurvolgorde: kleurvolgordeLabel || wielpositie,
      sectorTitel: tr("ui.h11wiel.sector.titel", "Sector op het wiel"),
      sectorLabel: sectorLabel(positie),
    };
  }

  // Download het OFFICIËLE, vooraf ontwikkelde energetische rapport-PDF
  // (24 profielen × 5 talen, eigen layout) met naam + datum geïnjecteerd op
  // pagina 1. Dit is het bindende document — niet de web-print van deze pagina.
  async function downloadOfficielePdf() {
    if (bezig) return;
    setBezig(true);
    try {
      const resp = await fetch("/api/twominscan/rapport.pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Stuur bij voorkeur de kleurvolgorde + X-stand (robuust: altijd één van
        // de 24). egCode blijft meegaan als terugval voor de server.
        body: JSON.stringify({
          egCode,
          volgorde: volgorde && volgorde.length >= 2 ? volgorde : undefined,
          xStand: xStand || undefined,
          naam: naam || undefined,
          taal,
          datum: datum || undefined,
          // Ontbreekt de wielpagina op het scherm, dan gaat het rapport gewoon
          // zonder bijlage mee: de download mag daar niet op stranden.
          wielbijlage: await bouwWielbijlage(),
        }),
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const veilig = (naam || `2MINSCAN-${egCode}`).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "2MINSCAN";
      a.download = `${veilig}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // Terugval: browser-print van de web-weergave als het endpoint faalt.
      console.error("[2MINSCAN] officiële PDF mislukt, terugval op print:", e);
      window.print();
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: KLEUR.petrol, color: "#fff", padding: "10px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ fontWeight: 800, letterSpacing: 1 }}>2MINSCAN</span>
      <span style={{ fontSize: 12, opacity: 0.85 }}>{tr("ui.subtitel", "Energetisch Gedragsprofiel")}</span>
      <button
        onClick={downloadOfficielePdf}
        disabled={bezig}
        style={{ marginLeft: "auto", background: KLEUR.goud, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: bezig ? "wait" : "pointer", opacity: bezig ? 0.7 : 1 }}
      >
        {bezig ? tr("ui.rapport.download_bezig", "⏳ Rapport wordt opgehaald…") : tr("ui.rapport.download_pdf", "⬇ Download als PDF")}
      </button>
      <BewaarVoorTeam
        tr={tr}
        naam={naam}
        wielpositie={wielpositie}
        egCode={egCode}
        organisatie={organisatie}
        taal={taal}
        datum={datum}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bewaren voor het teamwiel
// ---------------------------------------------------------------------------
// Eén knop die enkel bewaart wat een teamwiel nodig heeft: naam, eventueel de
// organisatie, de EG-code en de wielpositie. Geen antwoorden, geen scores, geen
// foto. De teamwielpagina kan de deelnemers daarna zelf inladen in plaats van
// dat iemand de wielposities moet overtypen.
function BewaarVoorTeam({
  tr,
  naam,
  wielpositie,
  egCode,
  organisatie,
  taal,
  datum,
}: {
  tr: Vertaler;
  naam?: string;
  wielpositie?: string;
  egCode: string;
  organisatie?: string;
  taal: Taal;
  datum?: string;
}) {
  const [stand, setStand] = useState<"klaar" | "bezig" | "bewaard" | "fout">("klaar");

  if (!naam?.trim() || !wielpositie?.trim()) return null;

  async function bewaar() {
    if (stand === "bezig" || stand === "bewaard") return;
    setStand("bezig");
    try {
      const resp = await fetch("/api/twominscan/afname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam,
          wielpositie,
          egCode,
          organisatie: organisatie || undefined,
          taal,
          datum: datum || undefined,
        }),
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      setStand("bewaard");
    } catch (e) {
      console.error("[2MINSCAN] bewaren voor het teamwiel mislukt:", e);
      setStand("fout");
    }
  }

  const label =
    stand === "bewaard"
      ? tr("ui.rapport.bewaard_team", "In de teamlijst")
      : stand === "bezig"
        ? tr("ui.rapport.bewaren_bezig", "Bezig…")
        : stand === "fout"
          ? tr("ui.rapport.bewaren_fout", "Bewaren lukte niet — opnieuw")
          : tr("ui.rapport.bewaar_team", "Bewaar voor teamrapport");

  return (
    <button
      onClick={bewaar}
      disabled={stand === "bezig" || stand === "bewaard"}
      title={tr(
        "ui.rapport.bewaar_team_uitleg",
        "Bewaart enkel naam, organisatie, EG-code en wielpositie, zodat deze afname in een teamwiel kan meegaan.",
      )}
      style={{
        background: "transparent",
        color: "#fff",
        border: "1.5px solid rgba(255,255,255,.55)",
        borderRadius: 8,
        padding: "8px 14px",
        fontWeight: 700,
        fontSize: 13,
        cursor: stand === "bezig" || stand === "bewaard" ? "default" : "pointer",
        opacity: stand === "bewaard" ? 0.75 : 1,
      }}
    >
      {label}
    </button>
  );
}

// ---- gedeelde bouwstenen ----

function Pagina({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <section className="pagina" style={{ padding: "46px 54px", borderBottom: `1px solid ${KLEUR.lijn}`, position: "relative" }}>
      {children}
      <Voet kicker={kicker} />
    </section>
  );
}

function Voet({ kicker }: { kicker?: string }) {
  return (
    <div style={{ marginTop: 34, paddingTop: 10, borderTop: `1px solid ${KLEUR.lijn}`, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#8a8a8a", fontFamily: "Arial, sans-serif", letterSpacing: 0.5 }}>
      <span style={{ color: KLEUR.petrol, fontWeight: 700 }}>2MINSCAN · {kicker ?? "ENERGETISCH GEDRAGSPROFIEL"}</span>
      <span>© TaPasCity · www.tapascity.com · info@tapascity.com</span>
    </div>
  );
}

function kickerVan(tr: Vertaler, sleutel: string, fallback: string): string {
  return tr(`ui.rapport.kicker.${sleutel}`, fallback);
}

function HoofdTitel({ nr, titel, lead }: { nr: string; titel: string; lead?: string }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span style={{ fontFamily: "Arial, sans-serif", fontSize: 40, fontWeight: 800, color: KLEUR.goud, lineHeight: 1 }}>{nr}</span>
        <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 27, fontWeight: 800, color: KLEUR.petrol, margin: 0, lineHeight: 1.12 }}>{titel}</h2>
      </div>
      <div style={{ height: 2, background: KLEUR.petrol, margin: "10px 0 16px" }} />
      {lead && <p style={{ fontStyle: "italic", color: "#5b5b5b", margin: "0 0 20px", fontSize: 14.5 }}>{lead}</p>}
    </>
  );
}

function InfoBlok({ kop, kleur, children }: { kop: string; kleur: string; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: `5px solid ${kleur}`, background: zachtVan(kleur), borderRadius: "0 8px 8px 0", padding: "14px 18px", marginBottom: 12 }}>
      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11.5, fontWeight: 800, letterSpacing: 1.4, color: kleur, marginBottom: 5 }}>{kop}</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function zachtVan(hex: string): string {
  // lichte tint achter het infoblok
  const tint: Record<string, string> = {
    [KLEUR.teal]: "#EAF2EF",
    [KLEUR.goud]: "#FBF3E0",
    [KLEUR.roest]: "#F8EAE6",
    [KLEUR.petrol]: "#EAF1F0",
    [KLEUR.aubergine]: "#F3E9EF",
  };
  return tint[hex] ?? "#F4F2EC";
}

function Kaart({ titel, children, accent }: { titel?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ border: `1px solid ${KLEUR.lijn}`, borderLeft: accent ? `4px solid ${accent}` : `1px solid ${KLEUR.lijn}`, borderRadius: 10, padding: "14px 16px", background: "#fff" }}>
      {titel && <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, color: KLEUR.petrol, fontSize: 14, marginBottom: 5 }}>{titel}</div>}
      <div style={{ fontSize: 13.8, lineHeight: 1.55, color: "#3a3a3a" }}>{children}</div>
    </div>
  );
}

// ---- COVER ----
/**
 * Een portret dat de deelnemer zelf meegaf, of dat de coach bevestigde vanaf een
 * pagina die de organisatie zelf publiceerde. `bron` is dan die pagina.
 */
export interface Portret {
  src: string;
  bron?: string;
}

/** Aanvaardt alleen een data-URL of een https-adres van een afbeelding. */
export function leesPortret(ruw: any): Portret | null {
  const src = typeof ruw === "string" ? ruw : typeof ruw?.src === "string" ? ruw.src : "";
  const veilig = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(src) || /^https:\/\//i.test(src);
  if (!veilig) return null;
  const bron = typeof ruw?.bron === "string" && ruw.bron.trim() ? ruw.bron.trim() : undefined;
  return { src, bron };
}

/** Leesbare herkomst onder een portret: de website, niet het volledige adres. */
export function bronLabel(bron?: string): string | null {
  if (!bron) return null;
  try {
    return new URL(bron).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Portretbeeld({
  foto,
  naam,
  breedte,
  tr,
}: {
  foto: Portret;
  naam: string;
  breedte: number;
  tr: Vertaler;
}) {
  const host = bronLabel(foto.bron);
  return (
    <figure style={{ margin: 0, width: breedte, flexShrink: 0 }}>
      <img
        src={foto.src}
        alt={naam || ""}
        style={{
          width: breedte,
          height: Math.round(breedte * 1.25),
          objectFit: "cover",
          borderRadius: 3,
          border: `1px solid ${KLEUR.lijn}`,
          display: "block",
        }}
      />
      {host ? (
        <figcaption style={{ fontFamily: "Arial, sans-serif", fontSize: 8.5, color: "#9a9a9a", marginTop: 5, lineHeight: 1.3 }}>
          {tr("ui.foto.bron", "Foto")}: {host}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Cover({ data, ieLabel, organisatie, foto, tr }: { data: any; ieLabel: string; organisatie?: string; foto?: Portret | null; tr: Vertaler }) {
  return (
    <section className="pagina cover" style={{ padding: "60px 54px 50px", minHeight: 560, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 20, color: KLEUR.petrol }}>TaPasCity</span>
        <div style={{ flex: 1, height: 2, background: KLEUR.petrol }} />
      </div>

      <div style={{ marginTop: 70 }}>
        <div style={{ fontFamily: "Arial, sans-serif", color: KLEUR.goud, fontWeight: 800, letterSpacing: 4, fontSize: 14 }}>2MINSCAN</div>
        <h1 style={{ fontFamily: "Arial, sans-serif", fontSize: 52, fontWeight: 800, color: KLEUR.petrol, margin: "6px 0 4px", lineHeight: 1 }}>
          {tr("ui.cover.titel1", "Energetisch")}
        </h1>
        <h1 style={{ fontFamily: "Arial, sans-serif", fontSize: 52, fontWeight: 800, color: KLEUR.petrol, margin: 0, lineHeight: 1 }}>
          {tr("ui.cover.titel2", "Gedragsprofiel")}
        </h1>
        <p style={{ fontStyle: "italic", color: "#5b5b5b", fontSize: 17, marginTop: 14 }}>
          {data.kerntitel}
        </p>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 40, display: "flex", gap: 26, alignItems: "flex-end" }}>
        {foto ? <Portretbeeld foto={foto} naam={data.naam || ""} breedte={104} tr={tr} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 1, background: KLEUR.lijn, marginBottom: 18 }} />
        <Veld label={tr("ui.cover.naam", "NAAM")} waarde={data.naam || "—"} />
        {organisatie ? <Veld label={tr("ui.cover.organisatie", "ORGANISATIE")} waarde={organisatie} /> : null}
        <Veld label={tr("ui.cover.datum", "DATUM")} waarde={data.datum} />
        <Veld label={tr("ui.cover.egcode", "EG-CODE")} waarde={data.egCode} mono />
        <Veld label={tr("ui.cover.energiestand", "ENERGIESTAND")} waarde={ieLabel ? cap(ieLabel) : "—"} />
        <div style={{ height: 1, background: KLEUR.lijn, margin: "18px 0 10px" }} />
        <div style={{ fontFamily: "Arial, sans-serif", letterSpacing: 2, fontSize: 11.5, color: KLEUR.teal, fontWeight: 700 }}>
          {tr("ui.cover.vertrouwelijk", "VERTROUWELIJK PROFIELRAPPORT")}
        </div>
        </div>
      </div>
    </section>
  );
}

function Veld({ label, waarde, mono }: { label: string; waarde: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
      <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: 1.5, color: "#9a9a9a", width: 130, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 700, color: KLEUR.inkt, fontFamily: mono ? "monospace" : undefined, fontSize: mono ? 16 : 15 }}>{waarde}</span>
    </div>
  );
}

// ---- INHOUD ----
function Inhoud({ tr }: { tr: Vertaler }) {
  const itemsNl = [
    "Energie in één oogopslag", "De lezing in 2 minuten", "Wat meet de 2MINSCAN?",
    "Jouw EG-code vertaald", "Hoe jij energie geeft aan anderen", "Wat jij in teams op gang brengt",
    "De context die jou oplaadt", "Waar energie weglekt", "Wanneer energie onder druk komt",
    "Samenwerken met andere energietypes", "Leiderschap, equivalenten en integer gebruik",
    "Een persoonlijke uitnodiging",
  ];
  const items = itemsNl.map((t, i) => tr(`ui.inhoud.${i}`, t));
  return (
    <Pagina kicker={kickerVan(tr, "inhoud", "INHOUD")}>
      <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 30, fontWeight: 800, color: KLEUR.petrol, margin: "0 0 6px" }}>{tr("ui.inhoud.titel", "Inhoud")}</h2>
      <div style={{ height: 2, background: KLEUR.petrol, marginBottom: 14 }} />
      {items.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${KLEUR.lijn}` }}>
          <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, color: KLEUR.goud, width: 28 }}>{String(i + 1).padStart(2, "0")}</span>
          <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 600, color: KLEUR.inkt, fontSize: 15 }}>{t}</span>
        </div>
      ))}
    </Pagina>
  );
}

function Leeswijzer({ tr }: { tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "leeswijzer", "LEESWIJZER")}>
      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11.5, fontWeight: 800, letterSpacing: 1.4, color: KLEUR.teal, marginBottom: 8 }}>{tr("ui.leeswijzer.kop", "HOE JE DIT RAPPORT LEEST")}</div>
      <p style={{ fontSize: 15, lineHeight: 1.7 }}>
        {tr("ui.leeswijzer.tekst", "Dit is geen typologisch eindpunt. Het is een praktische energieroute die helpt zien wat jou in professionele interactie voedt, belast en opnieuw in balans brengt. De EG-code wordt nergens als label gelezen, maar steeds als taal voor energie in gedrag. Lees het profiel als een vriendelijke spiegel — niet om jezelf vast te zetten, maar om bewuster met je energie om te gaan in verbinding met anderen.")}
      </p>
    </Pagina>
  );
}

// ---- 01 Energie in één oogopslag ----
function H1({ data, ontleed, ieLabel, score, tr }: { data: any; ontleed: any; ieLabel: string; score: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "flow", "FLOW")}>
      <HoofdTitel nr="01" titel={tr("ui.h1.titel", "Jouw energie in één oogopslag")} lead={tr("ui.h1.lead", "Wat je geeft, wat je nodig hebt, waar energie weglekt en hoe je opnieuw in balans komt.")} />

      {/* EG-codeband + energiekost */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px", background: KLEUR.teal, borderRadius: 12, padding: "16px 20px", color: "#fff" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: 1.5, opacity: 0.85, fontWeight: 700 }}>{tr("ui.kop.energiestroom", "ENERGIESTROOM")}</div>
          <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1 }}>{data.egCodePositief}</div>
          <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>{data.kleurvolgordeLabel}</div>
        </div>
        {data.minSegment && (
          <div style={{ flex: "0 1 200px", background: KLEUR.roest, borderRadius: 12, padding: "16px 20px", color: "#fff" }}>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: 1.5, opacity: 0.85, fontWeight: 700 }}>{tr("ui.kop.energiekost", "ENERGIEKOST")}</div>
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "monospace" }}>{data.minSegment}</div>
            <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>{ontleed.min?.titel?.toLowerCase()}</div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#9a9a9a", fontFamily: "Arial, sans-serif", marginTop: -8, marginBottom: 18 }}>{tr("ui.h1.eg_legenda", "EG = Energetisch Gedrag · energiestand:")} {ieLabel || "—"}</div>

      {/* 4 kwadranten */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InfoBlok kop={tr("ui.kop.geeft_energie", "GEEFT ENERGIE")} kleur={KLEUR.teal}>{data.geeftEnergie}</InfoBlok>
        <InfoBlok kop={tr("ui.kop.krijgt_energie", "KRIJGT ENERGIE")} kleur={KLEUR.teal}>{data.krijgtEnergie}</InfoBlok>
        <InfoBlok kop={tr("ui.kop.verliest_energie", "VERLIEST ENERGIE")} kleur={KLEUR.roest}>{data.verliestEnergie}</InfoBlok>
        <InfoBlok kop={tr("ui.kop.herstelt_energie", "HERSTELT ENERGIE")} kleur={KLEUR.goud}>{data.herstelt}</InfoBlok>
      </div>

      <InfoBlok kop={tr("ui.kop.kernbeweging", "DE KERNBEWEGING")} kleur={KLEUR.petrol}>{data.kernzin}</InfoBlok>
    </Pagina>
  );
}

// ---- 02 De lezing in 2 minuten ----
function H2({ data, tr }: { data: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "flow", "FLOW")}>
      <HoofdTitel nr="02" titel={tr("ui.h2.titel", "De lezing in 2 minuten")} lead={tr("ui.h2.lead", "Een compacte samenvatting van hoe deze energie spontaan werkt in samenwerking.")} />
      <div style={{ display: "flex", gap: 22 }}>
        <div style={{ flex: 1 }}>
          {data.lezing2min.map((p: string, i: number) => (
            <p key={i} style={{ fontSize: 14.8, lineHeight: 1.65, margin: "0 0 12px" }}>{p}</p>
          ))}
        </div>
        <div style={{ width: 130, display: "flex", flexDirection: "column", gap: 10 }}>
          <Pill kleur={KLEUR.teal} label={tr("ui.pill.natuurlijk", "Natuurlijk stromend")} />
          <Pill kleur={KLEUR.goud} label={tr("ui.pill.afstemmen", "Bewust afstemmen")} />
          <Pill kleur={KLEUR.roest} label={tr("ui.pill.onder_druk", "Onder druk")} />
        </div>
      </div>
      <InfoBlok kop={tr("ui.kop.in_een_beeld", "IN \u00c9\u00c9N BEELD")} kleur={KLEUR.teal}>
        {floreertZin(data, tr)}
      </InfoBlok>
    </Pagina>
  );
}
function Pill({ kleur, label }: { kleur: string; label: string }) {
  return (
    <div style={{ background: kleur, color: "#fff", borderRadius: 10, padding: "16px 10px", textAlign: "center", fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 12.5, lineHeight: 1.25 }}>{label}</div>
  );
}
function floreertZin(data: any, tr: Vertaler): string {
  const voornaam = data.naam ? data.naam.split(" ")[0] : tr("ui.algemeen.deze_persoon", "Deze persoon");
  const dom = data.profiel.kleurvolgorde[0];
  const map: Record<string, string> = {
    rood: "floreert in contexten waar duidelijke doelen, tempo en ruimte om te beslissen samenkomen.",
    geel: "floreert in contexten waar contact, afwisseling, gezamenlijke teamspirit en betekenisvolle beweging samenkomen.",
    groen: "floreert in contexten waar menselijkheid, samenwerking, gezamenlijke teamspirit en betekenisvolle beweging samenkomen.",
    blauw: "floreert in contexten waar zorgvuldigheid, rust en ruimte om grondig te werken samenkomen.",
  };
  const staart = tr(`ui.floreert.${dom}`, map[dom]);
  const tpl = tr("ui.floreert.tpl", "{naam} {staart}");
  return tpl.replace("{naam}", voornaam).replace("{staart}", staart);
}

// ---- 03 Wat meet de 2MINSCAN ----
function H3({ tr }: { tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "kader", "KADER")}>
      <HoofdTitel nr="03" titel={tr("ui.h3.titel", "Wat meet de 2MINSCAN?")} lead={tr("ui.h3.lead", "De 2MINSCAN beschrijft energetisch gedrag in professionele context: hoe iemand energie geeft, krijgt, behoudt en verliest in samenwerking.")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Kaart titel={tr("ui.h3.kaart1.titel", "Gedrag")} accent={KLEUR.teal}>{tr("ui.h3.kaart1.tekst", "Wat iemand spontaan toont in interactie met collega's, teams, medewerkers of coachees.")}</Kaart>
        <Kaart titel={tr("ui.h3.kaart2.titel", "Energie-effect")} accent={KLEUR.teal}>{tr("ui.h3.kaart2.tekst", "Hoe dat gedrag energie opent, versterkt, blokkeert of onder druk zet.")}</Kaart>
        <Kaart titel={tr("ui.h3.kaart3.titel", "Werkcontext")} accent={KLEUR.teal}>{tr("ui.h3.kaart3.tekst", "Welke omgeving dit gedrag ondersteunt, zichtbaar maakt of leegtrekt.")}</Kaart>
      </div>
      <InfoBlok kop={tr("ui.h3.niet.kop", "NIET GEBRUIKEN ALS")} kleur={KLEUR.roest}>
        {tr("ui.h3.niet.tekst", "Geen talenttest. Geen passiemeting. Geen selectie-instrument. Geen potentieelbeoordeling. Geen diagnose.")}
      </InfoBlok>
      <InfoBlok kop={tr("ui.h3.wel.kop", "WEL GEBRUIKEN VOOR")} kleur={KLEUR.goud}>
        {tr("ui.h3.wel.tekst", "Reflectie, coaching, teamontwikkeling, leiderschapsontwikkeling, communicatie en contextafstemming.")}
      </InfoBlok>
    </Pagina>
  );
}

// ---- 04 EG-code vertaald ----
function H4({ data, ontleed, tr }: { data: any; ontleed: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "code", "CODE")}>
      <HoofdTitel nr="04" titel={tr("ui.h4.titel", "Hoe jouw energie beweegt")} lead={tr("ui.h4.lead", "De EG-code wordt hier niet als label gelezen, maar als taal voor energie in professioneel gedrag.")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {ontleed.letters.map((l: any, i: number) => {
          const breed = (l.letter || "").length > 1; // intro/extravert-blok = twee tekens
          return (
          <div key={i} style={{ border: `1px solid ${KLEUR.lijn}`, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10 }}>
            <div style={{ width: breed ? 40 : 30, height: 30, borderRadius: breed ? 8 : "50%", background: KLEUR.aubergine, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0, fontFamily: "monospace", fontSize: breed ? 13 : 15 }}>{l.letter}</div>
            <div>
              <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 700, color: KLEUR.petrol, fontSize: 13.5 }}>{l.titel}</div>
              <div style={{ fontSize: 12.5, color: "#555", lineHeight: 1.45 }}>{l.uitleg}</div>
            </div>
          </div>
          );
        })}
        {data.minSegment && ontleed.min && (
          <div style={{ border: `1px solid ${KLEUR.roest}`, background: "#F8EAE6", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10 }}>
            <div style={{ width: 38, height: 30, borderRadius: 8, background: KLEUR.roest, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0, fontFamily: "monospace" }}>{data.minSegment}</div>
            <div>
              <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 700, color: KLEUR.roest, fontSize: 13.5 }}>{ontleed.min.titel}</div>
              <div style={{ fontSize: 12.5, color: "#555", lineHeight: 1.45 }}>{ontleed.min.uitleg}</div>
            </div>
          </div>
        )}
      </div>
    </Pagina>
  );
}

// ---- 05 Hoe jij energie geeft ----
function H5({ data, tr }: { data: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "flow", "FLOW")}>
      <HoofdTitel nr="05" titel={tr("ui.h5.titel", "Hoe jij energie geeft aan anderen")} lead={tr("ui.h5.lead", "Zo ervaren anderen jouw energiestijl in samenwerking.")} />
      <InfoBlok kop={tr("ui.kop.geeft_energie", "GEEFT ENERGIE")} kleur={KLEUR.teal}>{data.geeftEnergie}</InfoBlok>
      <InfoBlok kop={tr("ui.kop.krijgt_energie", "KRIJGT ENERGIE")} kleur={KLEUR.teal}>{data.krijgtEnergie}</InfoBlok>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
        <Kaart titel={tr("ui.h5.kaart1.titel", "Zo ervaren anderen jou")} accent={KLEUR.goud}>{anderenZin(data, tr)}</Kaart>
        <Kaart titel={tr("ui.h5.kaart2.titel", "Zo ervaar jij een team")} accent={KLEUR.goud}>{teamZin(data, tr)}</Kaart>
      </div>
    </Pagina>
  );
}
function anderenZin(data: any, tr: Vertaler): string {
  const map: Record<string, string> = {
    rood: "Daadkrachtig, helder, doelgericht, beslissend en gericht op vooruitgang.",
    geel: "Warm, enthousiast, verbindend, motiverend en gericht op gezamenlijke beweging.",
    groen: "Warm, empathisch, verbindend, rustgevend en gericht op gezamenlijke beweging.",
    blauw: "Helder, zorgvuldig, betrouwbaar, nuchter en gericht op kwaliteit.",
  };
  const dom = data.profiel.kleurvolgorde[0];
  return tr(`ui.anderen.${dom}`, map[dom]);
}
function teamZin(data: any, tr: Vertaler): string {
  const map: Record<string, string> = {
    rood: "Als een systeem dat richting en tempo nodig heeft om resultaat te boeken.",
    geel: "Als een levend systeem waarin energie, ideeën en sfeer mee bepalen of werk stroomt.",
    groen: "Als een levend systeem waarin sfeer, vertrouwen en onuitgesproken noden mee bepalen of werk stroomt.",
    blauw: "Als een systeem dat helderheid, structuur en betrouwbaarheid nodig heeft om te functioneren.",
  };
  const dom = data.profiel.kleurvolgorde[0];
  return tr(`ui.team.${dom}`, map[dom]);
}

// ---- 06 Wat jij in teams op gang brengt ----
function H6({ data, tr }: { data: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "flow", "FLOW")}>
      <HoofdTitel nr="06" titel={tr("ui.h6.titel", "Wat jij in teams op gang brengt")} lead={tr("ui.h6.lead", "Hoe jouw energie effect heeft op anderen — zonder dit als talent of beoordeling te lezen.")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {data.teamEffecten.map((t: any, i: number) => (
          <Kaart key={i} titel={t.titel} accent={KLEUR.teal}>{t.tekst}</Kaart>
        ))}
      </div>
      <InfoBlok kop={tr("ui.h6.kop", "WAT DIT IN SAMENWERKING DOET")} kleur={KLEUR.goud}>
        {tr("ui.h6.prefix", "Je energie brengt beweging in een team:")} {samenwerkingZin(data, tr)}
      </InfoBlok>
    </Pagina>
  );
}
function samenwerkingZin(data: any, tr: Vertaler): string {
  const map: Record<string, string> = {
    rood: "doelen worden scherper, beslissingen sneller en de groep komt vooruit.",
    geel: "de sfeer wordt opener, ideeën gaan stromen en mensen haken makkelijker aan.",
    groen: "vertrouwen wordt groter, spanning wordt bespreekbaarder en een team kan opnieuw zoeken naar wat wél mogelijk is.",
    blauw: "zaken worden helderder, kwaliteit stijgt en risico's worden bespreekbaar.",
  };
  const dom = data.profiel.kleurvolgorde[0];
  return tr(`ui.samenwerking.${dom}`, map[dom]);
}

// ---- 07 Context die oplaadt ----
function H7({ data, ontleed, tr }: { data: any; ontleed: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "context", "CONTEXT")}>
      <HoofdTitel nr="07" titel={tr("ui.h7.titel", "De context die jou oplaadt")} lead={tr("ui.h7.lead", "Energie ontstaat in de wisselwerking tussen jouw gedrag en de omgeving waarin je werkt.")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {data.context.map((c: any, i: number) => (
          <div key={i} style={{ border: `1px solid ${KLEUR.lijn}`, borderTop: `4px solid ${KLEUR.teal}`, borderRadius: 10, padding: "13px 15px" }}>
            <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, color: KLEUR.petrol, fontSize: 14, marginBottom: 8 }}>{c.thema}</div>
            <div style={{ fontSize: 12.5, marginBottom: 8 }}><b style={{ color: KLEUR.teal }}>{tr("ui.h7.geeft", "Geeft energie")}</b><br />{c.geeft}</div>
            <div style={{ fontSize: 12.5 }}><b style={{ color: KLEUR.roest }}>{tr("ui.h7.bewaakt", "Vraagt bewaking")}</b><br />{c.bewaakt}</div>
          </div>
        ))}
      </div>
    </Pagina>
  );
}

// ---- 08 Waar energie weglekt ----
function H8({ data, tr }: { data: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "friction", "FRICTION")}>
      <HoofdTitel nr="08" titel={tr("ui.h8.titel", "Waar energie weglekt")} lead={tr("ui.h8.lead", "Energieverlies wordt zichtbaar wanneer de omgeving te weinig ruimte laat voor wat jou natuurlijk voedt.")} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {data.frictiePunten.map((f: string, i: number) => (
          <span key={i} style={{ background: "#F8EAE6", color: KLEUR.roest, border: `1px solid ${KLEUR.roest}33`, borderRadius: 99, padding: "7px 14px", fontSize: 13, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>{f}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InfoBlok kop={tr("ui.h8.waarom.kop", "WAAROM DIT ENERGIE KOST")} kleur={KLEUR.roest}>{data.verliestEnergie}</InfoBlok>
        <InfoBlok kop={tr("ui.h8.helpt.kop", "WAT HELPT")} kleur={KLEUR.goud}>{data.herstelt}</InfoBlok>
      </div>
      {data.minSegment && (
        <InfoBlok kop={tr("ui.h8.legende.kop", "LEGENDE VAN DE EG-CODE")} kleur={KLEUR.petrol}>
          {tr("ui.h8.legende.tekst", "Hoofdletters tonen wat energie geeft of richting geeft in gedrag. Een minteken toont energiekost. In {egCode} betekent {minSegment} dat dit deel sneller energie kost dan geeft.").replace("{egCode}", data.egCode).replace("{minSegment}", data.minSegment)}
        </InfoBlok>
      )}
    </Pagina>
  );
}

// ---- 09 Schaduw onder druk ----
function H9({ data, tr }: { data: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "shadow", "SHADOW")}>
      <HoofdTitel nr="09" titel={tr("ui.h9.titel", "Wanneer energie onder druk komt")} lead={tr("ui.h9.lead", "Stressreflexen tonen niet wie je bent. Ze tonen waar energie onder druk staat en waar bewuste vertraging helpt.")} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(data.schaduwwoorden.length ? data.schaduwwoorden : ["ongeduldig", "afstandelijk", "koppig"]).map((w: string, i: number) => (
          <span key={i} style={{ border: `1px solid ${KLEUR.aubergine}`, color: KLEUR.aubergine, borderRadius: 99, padding: "7px 15px", fontSize: 13, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>{w}</span>
        ))}
      </div>
      <InfoBlok kop={tr("ui.h9.kop", "GEEN OORDEEL, WEL INFORMATIE")} kleur={KLEUR.aubergine}>
        {tr("ui.h9.tekst", "Deze signalen worden bruikbaar wanneer je ze ziet als uitnodiging om te vertragen, je grens te benoemen en opnieuw af te stemmen. Het kennen van je schaduwkant helpt je de positieve kern erachter terug te vinden.")}
      </InfoBlok>
    </Pagina>
  );
}

// ---- 10 Samenwerken met andere types ----
function H10({ data, tr }: { data: any; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "align", "ALIGN")}>
      <HoofdTitel nr="10" titel={tr("ui.h10.titel", "Samenwerken met profielen die anders schakelen")} lead={tr("ui.h10.lead", "Sommige profielen krijgen energie van een heel andere stijl. Dan helpt het om jouw stijl beter vertaalbaar te maken.")} />
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, background: "#EAF2EF", borderLeft: `5px solid ${KLEUR.teal}`, borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, color: KLEUR.teal, fontSize: 13, marginBottom: 6 }}>{tr("ui.h10.eigen.kop", "JOUW NATUURLIJKE STIJL")}</div>
          {data.afstemming.eigen.map((e: string, i: number) => <div key={i} style={{ fontSize: 14 }}>{e}</div>)}
        </div>
        <div style={{ flex: 1, background: "#F8EAE6", borderLeft: `5px solid ${KLEUR.roest}`, borderRadius: "0 8px 8px 0", padding: "14px 18px" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, color: KLEUR.roest, fontSize: 13, marginBottom: 6 }}>{tr("ui.h10.ander.kop", "STIJL DIE AFSTEMMING VRAAGT")}</div>
          {data.afstemming.ander.map((e: string, i: number) => <div key={i} style={{ fontSize: 14 }}>{e}</div>)}
        </div>
      </div>
      <InfoBlok kop={tr("ui.h10.vertaal.kop", "VERTAALGEDRAG")} kleur={KLEUR.goud}>{data.afstemming.vertaal}</InfoBlok>
      <InfoBlok kop={tr("ui.h10.brug.kop", "DE BRUGZIN")} kleur={KLEUR.petrol}>
        {tr("ui.h10.brug.tekst", "Je hoeft je stijl niet te verliezen. Je maakt haar alleen beter ontvangbaar voor mensen die anders opladen.")}
      </InfoBlok>
    </Pagina>
  );
}

// ---- 11 Leiderschap + equivalenten + alert ----
function H11({ data, ieLabel, tr }: { data: any; ieLabel: string; tr: Vertaler }) {
  return (
    <Pagina kicker={kickerVan(tr, "lead_balance", "LEAD & BALANCE")}>
      <HoofdTitel nr="11" titel={tr("ui.h11.titel", "Leiderschap, equivalenten en integer gebruik")} lead={tr("ui.h11.lead", "Leiderschap wordt hier gelezen als energie-effect op anderen, niet als formele macht of positie.")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {data.leiderschap.map((l: any, i: number) => (
          <Kaart key={i} titel={l.titel} accent={KLEUR.teal}>{l.tekst}</Kaart>
        ))}
      </div>
      <InfoBlok kop={tr("ui.h11.relationeel.kop", "RELATIONEEL ENERGIE-EFFECT")} kleur={KLEUR.goud}>{data.leiderschapSamenvatting}</InfoBlok>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "8px 0" }}>
        <Kaart titel={tr("ui.h11.mbti.titel", "MBTI-equivalent")} accent={KLEUR.aubergine}>
          <b>{data.mbti}</b><br /><span style={{ fontSize: 12, color: "#777" }}>{tr("ui.h11.mbti.disclaimer", "Discrete vertaaltaal, geen officiële MBTI-testuitslag.")}</span>
        </Kaart>
        <Kaart titel={tr("ui.h11.insights.titel", "Insights Discovery")} accent={KLEUR.aubergine}>
          <b>{tr("ui.h11.wielpositie", "Wielpositie")} {data.wielpositie}</b>
          <div style={{ marginTop: 5, marginBottom: 2 }}><Kleurvolgorde volgorde={data.profiel.kleurvolgorde} /></div>
          <span style={{ fontSize: 12, color: "#777" }}>{tr("ui.h11.insights.disclaimer", "Aanvullende taal, geen officiële Insights-uitslag.")}</span>
        </Kaart>
      </div>

      <InfoBlok kop={tr("ui.h11.nuance.kop", "BELANGRIJKE WETENSCHAPPELIJKE NUANCE")} kleur={KLEUR.roest}>
        {tr("ui.h11.nuance.tekst", "De 2MINSCAN vertrekt vanuit Jungiaans geïnspireerde voorkeuren. Die theorie is niet op dezelfde manier gevalideerd als moderne psychometrische modellen. Toch kan ze een bruikbare taal bieden om groepsdynamica, voorkeursgedrag en energiebehoeften in een professionele context bespreekbaar te maken. De 2MINSCAN doet geen uitspraken over hoe iemand is, wat iemands potentieel is of waarom iemand dit gedrag toont.")}
      </InfoBlok>
      <InfoBlok kop={tr("ui.h11.dieper.kop", "ALS JE DIEPER WIL KIJKEN")} kleur={KLEUR.petrol}>
        {tr("ui.h11.dieper.tekst", "Wanneer de vraag niet langer gaat over energiemanagement maar over het waarom van voorkeursgedrag, talentpotentieel of diepere zijns-kenmerken, kan een TaPas Kompas een zorgvuldige vervolgstap zijn.")}
      </InfoBlok>
    </Pagina>
  );
}

// ---- 11 (vervolg) Positie op het temperamentenwiel ----
// Hoort bij hoofdstuk 11 en krijgt daarom geen eigen nummer: de inhoudsopgave
// blijft ongewijzigd. De wielpositie zelf komt uit hetzelfde profiel dat de
// Insights-kaart hierboven toont.
function H11Wiel({ data, tr }: { data: any; tr: Vertaler }) {
  const deelnemers = useMemo(
    () => [{ naam: data.naam || "", initialen: initialenVan(data.naam || ""), wielpositie: data.wielpositie }],
    [data.naam, data.wielpositie],
  );

  // Onbekende wielpositie: pagina stil weglaten in plaats van een leeg wiel tonen.
  const positie = positieByWielpositie(data.wielpositie);
  if (!positie) return null;

  return (
    <Pagina kicker={kickerVan(tr, "lead_balance", "LEAD & BALANCE")}>
      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11.5, fontWeight: 800, letterSpacing: 1.4, color: KLEUR.teal, marginBottom: 8 }}>
        {tr("ui.h11wiel.kop", "JOUW PLAATS OP HET TEMPERAMENTENWIEL")}
      </div>
      <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 27, fontWeight: 800, color: KLEUR.petrol, margin: "0 0 10px", lineHeight: 1.12 }}>
        {tr("ui.h11wiel.titel", "Waar jouw energie op het wiel staat")}
      </h2>
      <div style={{ height: 2, background: KLEUR.petrol, marginBottom: 14 }} />
      <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
        {tr(
          "ui.h11wiel.lead",
          "Het temperamentenwiel is een energetische gedragsvisualisatie. Elke positie op het wiel heeft haar eigen volgorde van vier energiekleuren: de eerste kleur in de buitenste band, daarna de tweede en de derde, en in de kern de kleur die energie kost. Jouw markering staat op de positie die bij jouw kleurvolgorde hoort.",
        )}
      </p>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div id={WIELPAGINA_ID} style={{ width: 395, maxWidth: "100%" }}>
          <Temperamentenwiel
            deelnemers={deelnemers}
            titel={tr("ui.h11wiel.alt", "Temperamentenwiel met jouw positie aangeduid")}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "10px 0" }}>
        <Kaart titel={tr("ui.h11.wielpositie", "Wielpositie")} accent={KLEUR.aubergine}>
          <b style={{ fontSize: 16 }}>{data.wielpositie}</b>
          <div style={{ marginTop: 5 }}>
            <Kleurvolgorde volgorde={data.profiel.kleurvolgorde} />
          </div>
        </Kaart>
        <Kaart titel={tr("ui.h11wiel.sector.titel", "Sector op het wiel")} accent={KLEUR.teal}>
          <b>{sectorLabel(positie)}</b>
          <div style={{ fontSize: 12.5, color: "#777", marginTop: 4 }}>
            {tr("ui.h11wiel.sector.uitleg", "De sector geeft aan welke stijl van samenwerken in deze zone van het wiel energie geeft.")}
          </div>
        </Kaart>
      </div>

      <InfoBlok kop={tr("ui.h11wiel.lezen.kop", "HOE JE DEZE PLAATS LEEST")} kleur={KLEUR.goud}>
        {tr(
          "ui.h11wiel.lezen.tekst",
          "De markering zegt niets over hoeveel energie je hebt of hoe goed je iets doet. Ze laat zien in welke richting jouw energie het makkelijkst beweegt. Naast elkaar staan geeft snel begrip; tegenover elkaar staan vraagt bewuste afstemming over tempo, detail en contact.",
        )}
      </InfoBlok>
      <InfoBlok kop={tr("ui.h11wiel.team.kop", "IN EEN TEAM")} kleur={KLEUR.petrol}>
        {tr(
          "ui.h11wiel.team.tekst",
          "Staan meerdere mensen op hetzelfde wiel, dan wordt de teamdynamiek zichtbaar: waar de energie van de groep samenvalt, waar ze uit elkaar loopt en welk werk de groep als geheel energie kost. Het wiel is dan geen etiket per persoon, maar een gespreksbeeld om samen in energie te blijven.",
        )}
      </InfoBlok>
    </Pagina>
  );
}

// ---- Slot ----
function Slot({ data, tr }: { data: any; tr: Vertaler }) {
  const voornaam = data.naam ? data.naam.split(" ")[0] : "";
  return (
    <Pagina kicker={kickerVan(tr, "reminder", "REMINDER")}>
      <div style={{ fontFamily: "Arial, sans-serif", color: KLEUR.goud, fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>{tr("ui.slot.nr", "12")} · {tr("ui.slot.label", "EEN PERSOONLIJKE UITNODIGING")}</div>
      <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 30, fontWeight: 800, color: KLEUR.petrol, margin: "8px 0 18px", lineHeight: 1.15 }}>
        {tr("ui.slot.titel_prefix", "Blijf bewegen met je eigen energie")} {data.slotzin}
      </h2>
      <div style={{ background: "#fff", border: `1px solid ${KLEUR.lijn}`, borderRadius: 14, padding: "26px 28px", textAlign: "center", marginBottom: 16 }}>
        <p style={{ fontSize: 21, fontWeight: 700, color: KLEUR.petrol, lineHeight: 1.4, margin: 0 }}>
          {tr("ui.slot.centraal", "Energie is geen vast etiket. Het is een beweging tussen jou, de ander en de context waarin je werkt.")}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InfoBlok kop={tr("ui.slot.stroomt.kop", "WANNEER JE ENERGIE STROOMT")} kleur={KLEUR.teal}>
          {data.energieStroomtTekst ?? tr("ui.slot.stroomt.tekst", "Je voelt meer ruimte, verbinding en zin om samen mogelijkheden te onderzoeken.")}
        </InfoBlok>
        <InfoBlok kop={tr("ui.slot.lekt.kop", "WANNEER ENERGIE LEKT")} kleur={KLEUR.roest}>
          {tr("ui.slot.lekt.tekst", "Zie het niet als fout, maar als signaal om te vertragen, te begrenzen of opnieuw af te stemmen.")}
        </InfoBlok>
      </div>
      <p style={{ textAlign: "center", fontSize: 13, color: "#8a8a8a", marginTop: 24, fontFamily: "Arial, sans-serif" }}>
        {tr("ui.slot.footer", "2MINSCAN is een product van TaPasCity")} · www.tapascity.com · info@tapascity.com
      </p>
    </Pagina>
  );
}

// Toont de Insights-kleurvolgorde in echte kleuren, format: "kleur1 kleur2 / kleur3 - kleur4".
function Kleurvolgorde({ volgorde }: { volgorde: string[] }) {
  if (!volgorde || volgorde.length < 4) return null;
  const Naam = ({ k }: { k: string }) => (
    <span style={{ color: KLEUR_HEX[k] ?? KLEUR.inkt, fontWeight: 700 }}>{cap(k)}</span>
  );
  const sep = { color: "#9a9a9a", fontWeight: 400, margin: "0 3px" } as const;
  return (
    <div style={{ fontSize: 13, fontFamily: "Arial, sans-serif", lineHeight: 1.4 }}>
      <Naam k={volgorde[0]} /> <Naam k={volgorde[1]} />
      <span style={sep}>/</span>
      <Naam k={volgorde[2]} />
      <span style={sep}>-</span>
      <Naam k={volgorde[3]} />
    </div>
  );
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const printCss = `
  @media print {
    .no-print { display: none !important; }
    body { background: #fff !important; }
    .rapport-doc { max-width: 100% !important; box-shadow: none !important; }
    .pagina { page-break-after: always; border-bottom: none !important; }
    .pagina:last-child { page-break-after: auto; }
  }
  @page { size: A4; margin: 0; }
`;
