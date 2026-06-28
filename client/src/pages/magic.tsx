// ---------------------------------------------------------------------------
// TaPas Platform — Magic-link inwisselaar
//
// Route: /#/magic/:token
//
// Wat doet deze pagina:
//   1. Haalt het token uit de route-param.
//   2. Roept GET /api/deelnemers/magic/:token aan.
//   3. Bij succes: redirect naar /#/dashboard/:dashboardToken.
//   4. Bij fout (verlopen, al gebruikt, onbekend): toon foutmelding met knop
//      "Terug naar de poort" zodat de deelnemer een nieuwe link kan aanvragen.
//
// De pagina gebruikt dezelfde neutrale TaPas-sfeer als de poort (sterren,
// donkere achtergrond, Playfair Display).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";

export default function Magic() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"laden" | "fout">("laden");
  const [foutTekst, setFoutTekst] = useState("");

  useEffect(() => {
    if (!token) {
      setFoutTekst("Geen token gevonden in de link.");
      setStatus("fout");
      return;
    }

    let actief = true;
    fetch(`/api/deelnemers/magic/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!actief) return;
        if (data.ok && data.dashboardToken) {
          // Redirect naar persoonlijk dashboard.
          navigate(`/dashboard/${data.dashboardToken}`);
        } else {
          setFoutTekst(data.error ?? "De link is verlopen of al gebruikt.");
          setStatus("fout");
        }
      })
      .catch(() => {
        if (!actief) return;
        setFoutTekst("Verbindingsfout. Controleer je internetverbinding en probeer opnieuw.");
        setStatus("fout");
      });

    return () => { actief = false; };
  }, [token, navigate]);

  // Laad-staat: rustige TaPas-sfeer terwijl het token wordt gevalideerd.
  if (status === "laden") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(120% 90% at 50% 0%, #14213d 0%, #0b1326 55%, #060a16 100%)",
          color: "#d8c9a3",
          fontFamily: "'Playfair Display', Georgia, serif",
          gap: "1.5rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        {/* Subtiele laadanimatie */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "2px solid rgba(216,201,163,0.15)",
            borderTopColor: "#d8c9a3",
            animation: "tapas-spin 1s linear infinite",
          }}
        />
        <style>{`
          @keyframes tapas-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ fontSize: "1rem", color: "rgba(216,201,163,0.7)", margin: 0 }}>
          Je persoonlijke link wordt geverifieerd…
        </p>
      </div>
    );
  }

  // Fout-staat: duidelijke melding + knop naar poort.
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(120% 90% at 50% 0%, #14213d 0%, #0b1326 55%, #060a16 100%)",
        color: "#d8c9a3",
        fontFamily: "'Playfair Display', Georgia, serif",
        gap: "1.5rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      {/* Fout-icoon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(180,80,80,0.15)",
          border: "1.5px solid rgba(180,80,80,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.5rem",
        }}
      >
        ⏱
      </div>

      <div style={{ maxWidth: 420 }}>
        <h1
          style={{
            fontSize: "clamp(1.1rem, 3vw, 1.4rem)",
            fontWeight: 600,
            margin: "0 0 0.75rem",
            color: "#d8c9a3",
          }}
        >
          Link verlopen of al gebruikt
        </h1>
        <p
          style={{
            fontSize: "0.9rem",
            color: "rgba(216,201,163,0.65)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {foutTekst}
        </p>
      </div>

      {/* Knop: terug naar poort voor nieuwe aanvraag */}
      <a
        href="#/poort"
        style={{
          marginTop: "0.5rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.65rem 1.6rem",
          borderRadius: "2rem",
          background: "rgba(216,201,163,0.1)",
          border: "1px solid rgba(216,201,163,0.3)",
          color: "#d8c9a3",
          fontSize: "0.875rem",
          fontFamily: "'Playfair Display', Georgia, serif",
          textDecoration: "none",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(216,201,163,0.18)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(216,201,163,0.1)";
        }}
      >
        ← Terug naar de poort
      </a>
    </div>
  );
}
