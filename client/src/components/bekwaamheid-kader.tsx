// ---------------------------------------------------------------------------
// client/src/components/bekwaamheid-kader.tsx — het gedeelde kader van de zes
// werkschermen van de bekwaamheidsmodule.
//
// Waarom dit bestand bestaat: de zes schermen uit het bouwplan (register,
// itembank, rondes, beoordelen, beslissingen, cyclus) zijn zes gezichten op één
// dossier. Zouden ze elk hun eigen kaartrand, hun eigen foutweergave en hun
// eigen kleurenlijst hebben, dan gaan die na de eerste wijziging uiteenlopen en
// leest de gebruiker zes verschillende platforms.
//
// Wat dit bestand bewust NIET doet:
//
//   Het rekent niet. Er staat geen enkele berekening in. Alles wat een getal is,
//   komt gerekend van de server. Een tweede rekenplaats in de browser is een
//   tweede meting, en dan is niet meer te zeggen welke in het dossier stond.
//
//   Het verbergt geen fout. `Melding` toont de tekst die de server teruggaf,
//   woordelijk. De opslaglaag schrijft haar weigeringen in taal voor een
//   beheerder; die tekst vervangen door "er ging iets mis" gooit precies de
//   informatie weg waarvoor ze geschreven is.
//
//   Het maakt niets leeg. Lege lijsten blijven zichtbaar met de reden erbij.
// ---------------------------------------------------------------------------
import type { ReactNode } from "react";

/** De vaste kleuren van de beheerderskant. Gelijk aan scherm 9.6. */
export const KLEUR = {
  achtergrond: "#f4f1ec",
  donker: "#14213d",
  accent: "#d8c9a3",
  tekst: "#2c2a26",
  zacht: "#7a7468",
  rand: "#ddd6cb",
  wit: "#ffffff",
  aandacht: "#a12c2c",
  goed: "#2f6b3c",
} as const;

/**
 * Het pad naar de server.
 *
 * De placeholder wordt bij het uitrollen vervangen door een poort. Blijft hij
 * staan, dan draait het scherm naast de server en is het pad leeg.
 */
export const API_BASE = (() => {
  const _s = "__PORT_5000__";
  return _s.startsWith("__") ? "" : "/" + _s;
})();

/** Een kaart met kop. De enige omlijning die deze schermen gebruiken. */
export function Kaart({
  kop,
  onderkop,
  rechts,
  children,
}: {
  kop: string;
  onderkop?: string;
  rechts?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: KLEUR.wit,
        border: `1px solid ${KLEUR.rand}`,
        borderRadius: 10,
        padding: "18px 20px",
        marginBottom: 18,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 17, color: KLEUR.donker, fontWeight: 600 }}>{kop}</h2>
          {onderkop ? (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: KLEUR.zacht, maxWidth: "68ch" }}>
              {onderkop}
            </p>
          ) : null}
        </div>
        {rechts ? <div style={{ flexShrink: 0 }}>{rechts}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** Een label met de waarde eronder. Voor vaste gegevens, niet voor invoer. */
export function Veld({ label, waarde }: { label: string; waarde: ReactNode }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: KLEUR.zacht,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, color: KLEUR.tekst, marginTop: 2 }}>{waarde}</div>
    </div>
  );
}

/** Een tekstinvoer met label. */
export function Invoer({
  label,
  waarde,
  zet,
  soort = "text",
  toelichting,
  breed = false,
}: {
  label: string;
  waarde: string;
  zet: (v: string) => void;
  soort?: "text" | "date" | "number" | "email";
  toelichting?: string;
  breed?: boolean;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12, flex: breed ? "1 1 100%" : "0 1 220px" }}>
      <span style={{ display: "block", fontSize: 12, color: KLEUR.zacht, marginBottom: 4 }}>
        {label}
      </span>
      <input
        type={soort}
        value={waarde}
        onChange={(e) => zet(e.target.value)}
        style={{
          width: "100%",
          padding: "7px 9px",
          fontSize: 14,
          color: KLEUR.tekst,
          background: KLEUR.wit,
          border: `1px solid ${KLEUR.rand}`,
          borderRadius: 6,
        }}
      />
      {toelichting ? (
        <span style={{ display: "block", fontSize: 11, color: KLEUR.zacht, marginTop: 3 }}>
          {toelichting}
        </span>
      ) : null}
    </label>
  );
}

/** Een meerregelige invoer. Voor onderbouwingen en motiveringen. */
export function Tekstvak({
  label,
  waarde,
  zet,
  regels = 3,
  toelichting,
}: {
  label: string;
  waarde: string;
  zet: (v: string) => void;
  regels?: number;
  toelichting?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12, flex: "1 1 100%" }}>
      <span style={{ display: "block", fontSize: 12, color: KLEUR.zacht, marginBottom: 4 }}>
        {label}
      </span>
      <textarea
        value={waarde}
        rows={regels}
        onChange={(e) => zet(e.target.value)}
        style={{
          width: "100%",
          padding: "7px 9px",
          fontSize: 14,
          lineHeight: 1.5,
          color: KLEUR.tekst,
          background: KLEUR.wit,
          border: `1px solid ${KLEUR.rand}`,
          borderRadius: 6,
          resize: "vertical",
        }}
      />
      {toelichting ? (
        <span style={{ display: "block", fontSize: 11, color: KLEUR.zacht, marginTop: 3 }}>
          {toelichting} — nu {waarde.trim().length} tekens.
        </span>
      ) : null}
    </label>
  );
}

/** Een keuzelijst met label. */
export function Keuze({
  label,
  waarde,
  zet,
  opties,
  toelichting,
}: {
  label: string;
  waarde: string;
  zet: (v: string) => void;
  opties: readonly { waarde: string; tekst: string }[];
  toelichting?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12, flex: "0 1 220px" }}>
      <span style={{ display: "block", fontSize: 12, color: KLEUR.zacht, marginBottom: 4 }}>
        {label}
      </span>
      <select
        value={waarde}
        onChange={(e) => zet(e.target.value)}
        style={{
          width: "100%",
          padding: "7px 9px",
          fontSize: 14,
          color: KLEUR.tekst,
          background: KLEUR.wit,
          border: `1px solid ${KLEUR.rand}`,
          borderRadius: 6,
        }}
      >
        {opties.map((o) => (
          <option key={o.waarde} value={o.waarde}>
            {o.tekst}
          </option>
        ))}
      </select>
      {toelichting ? (
        <span style={{ display: "block", fontSize: 11, color: KLEUR.zacht, marginTop: 3 }}>
          {toelichting}
        </span>
      ) : null}
    </label>
  );
}

/**
 * De melding van de server, woordelijk.
 *
 * `soort` bepaalt alleen de kleur. De tekst komt van de opslaglaag en wordt niet
 * herschreven: die tekst is voor een beheerder geschreven en zegt wat er in de
 * weg staat.
 */
export function Melding({ soort, tekst }: { soort: "fout" | "goed"; tekst: string | null }) {
  if (!tekst) return null;
  const kleur = soort === "fout" ? KLEUR.aandacht : KLEUR.goed;
  return (
    <p
      role="status"
      style={{
        margin: "8px 0 0",
        padding: "8px 10px",
        fontSize: 13,
        color: kleur,
        background: soort === "fout" ? "#fbf1f1" : "#f1f7f2",
        border: `1px solid ${kleur}33`,
        borderRadius: 6,
      }}
    >
      {tekst}
    </p>
  );
}

/** Een knop in de stijl van de beheerderskant. */
export function Knop({
  children,
  klik,
  bezig = false,
  soort = "gewoon",
  uit = false,
}: {
  children: ReactNode;
  klik: () => void;
  bezig?: boolean;
  soort?: "gewoon" | "hoofd" | "aandacht";
  uit?: boolean;
}) {
  const stijl =
    soort === "hoofd"
      ? { background: KLEUR.donker, color: KLEUR.wit, border: `1px solid ${KLEUR.donker}` }
      : soort === "aandacht"
        ? { background: KLEUR.wit, color: KLEUR.aandacht, border: `1px solid ${KLEUR.aandacht}` }
        : { background: KLEUR.wit, color: KLEUR.donker, border: `1px solid ${KLEUR.rand}` };
  return (
    <button
      type="button"
      onClick={klik}
      disabled={uit || bezig}
      style={{
        ...stijl,
        padding: "7px 14px",
        fontSize: 13,
        borderRadius: 6,
        cursor: uit || bezig ? "not-allowed" : "pointer",
        opacity: uit || bezig ? 0.5 : 1,
      }}
    >
      {bezig ? "Bezig…" : children}
    </button>
  );
}

/** Een leeg vak met de reden erin. Lijsten verdwijnen niet. */
export function Leeg({ tekst }: { tekst: string }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "12px 14px",
        fontSize: 13,
        color: KLEUR.zacht,
        background: KLEUR.achtergrond,
        border: `1px dashed ${KLEUR.rand}`,
        borderRadius: 6,
      }}
    >
      {tekst}
    </p>
  );
}

/** Een tabel met vaste koppen. */
export function Tabel({
  koppen,
  children,
}: {
  koppen: readonly string[];
  children: ReactNode;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {koppen.map((k) => (
              <th
                key={k}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderBottom: `1px solid ${KLEUR.rand}`,
                  color: KLEUR.zacht,
                  fontSize: 11,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Een cel. */
export function Cel({ children, breed = false }: { children: ReactNode; breed?: boolean }) {
  return (
    <td
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${KLEUR.rand}`,
        color: KLEUR.tekst,
        verticalAlign: "top",
        whiteSpace: breed ? "normal" : "nowrap",
      }}
    >
      {children}
    </td>
  );
}

/**
 * Een woord uit een vaste lijst, leesbaar gezet.
 *
 * De databank bewaart `bekrachtigd_met_aandachtspunt`; een mens leest
 * "bekrachtigd met aandachtspunt". Er wordt niets vertaald en niets weggelaten:
 * alleen de streepjes eruit en de eerste letter groot.
 */
export function leesbaar(woord: string | null | undefined): string {
  if (!woord) return "—";
  const zonder = woord.replaceAll("_", " ");
  return zonder.charAt(0).toUpperCase() + zonder.slice(1);
}

/** Een datum zoals de databank hem bewaart: jaar-maand-dag, of een streepje. */
export function datum(waarde: string | null | undefined): string {
  if (!waarde) return "—";
  return waarde.slice(0, 10);
}
