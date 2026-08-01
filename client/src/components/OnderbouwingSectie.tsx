// ---------------------------------------------------------------------------
// OnderbouwingSectie — herbruikbaar blok "Onderbouwing & validatie"
//   Toont een vertrouwensbanner met kerncijfers uit de onafhankelijke
//   factoranalyse (Universiteit Antwerpen) + documentkaarten met preview,
//   download en toegangslogica (publiek / op aanvraag / intern).
//
//   Wordt gebruikt op:
//     - /admin/inzichten  (admin-weergave: alle 4 documenten zichtbaar)
//     - /onderbouwing      (publieke weergave: enkel publieke stukken +
//                           "op aanvraag" als aanvraagbaar; intern verborgen)
//
//   GEEN aannames over cijfers: alle getallen komen uit de gevalideerde
//   rapporten (gem. congruentie 0,93 · KMO 0,83 · 10/11 factoren · EFA UA).
//   Die cijfers zijn berekend op Tapas4Students (T4S) en op niets anders; dat
//   staat daarom bij elk cijfer en in de begeleidende noot. T4Professional
//   heeft zijn eigen, afzonderlijke passage met wat er wel en niet is.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  FileText,
  Download,
  Eye,
  Lock,
  Mail,
  CheckCircle2,
} from "lucide-react";
import type { StringSleutel } from "@shared/i18n";
import { ONDERBOUWING_T4PROFESSIONAL } from "@shared/onderbouwing-t4professional";

export type Toegangsniveau = "publiek" | "op-aanvraag" | "intern";

export interface OnderbouwingDoc {
  id: string;
  titel: string;
  omschrijving: string;
  paginas: number;
  niveau: Toegangsniveau;
  thumb: string;
  // publiek: direct pad; op-aanvraag/intern: admin-endpoint
  bestandUrl?: string;
}

// n = vertaalfunctie (maakVertaler); typering volgt maakVertaler-signatuur
type Vert = (sleutel: StringSleutel) => string;

export const ONDERBOUWING_DOCUMENTEN: OnderbouwingDoc[] = [
  {
    id: "validatie",
    titel: "Psychometrisch validatierapport",
    omschrijving:
      "Constructvaliditeit van Tapas4Students (T4S): een factoranalytische validering op basis van empirische afnamedata.",
    paginas: 9,
    niveau: "publiek",
    thumb: "/onderbouwing/thumbs/validatie.jpg",
    bestandUrl: "/onderbouwing/t4s-validatierapport.pdf",
  },
  {
    id: "duiding",
    titel: "Inhoudelijk duidingsrapport",
    omschrijving:
      "Wat de factoranalyse van T4S betekent: interpretatie van de factorstructuur per driver, talentfocus en studiegebied.",
    paginas: 9,
    niveau: "publiek",
    thumb: "/onderbouwing/thumbs/duiding.jpg",
    bestandUrl: "/onderbouwing/t4s-duidingsrapport.pdf",
  },
  {
    id: "methodevalidatie",
    titel: "Methodologisch validatierapport",
    omschrijving:
      "Reproduceerbaarheid van de analysepipeline: methode, parameters en herhaalbaarheid van de factoranalyse.",
    paginas: 8,
    niveau: "op-aanvraag",
    thumb: "/onderbouwing/thumbs/methodevalidatie.jpg",
    bestandUrl: "/api/onderbouwing/document/methodevalidatie",
  },
  {
    id: "data-exportgids",
    titel: "Data-exportgids & analyseplan",
    omschrijving:
      "Interne handleiding voor data-export en het volledige analyseplan achter de validatiestudie.",
    paginas: 8,
    niveau: "intern",
    thumb: "/onderbouwing/thumbs/data-exportgids.jpg",
    bestandUrl: "/api/onderbouwing/document/data-exportgids",
  },
];

// Eigen onderbouwing van T4Professional: wat er aan onderzoek is, wat er nog
// ontbreekt en waar de claimgrens ligt. Staat los van de T4S-cijfers hierboven,
// juist om te vermijden dat een lezer die cijfers op T4Professional betrekt.
function T4ProfessionalOnderbouwing({ n }: { n: Vert }) {
  const ob = ONDERBOUWING_T4PROFESSIONAL;
  return (
    <Card className="mt-4" data-testid="onderbouwing-t4professional">
      <CardContent className="p-5">
        <h3 className="text-base font-semibold text-foreground">{n("ob_t4p_titel")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{ob.instrument}</p>

        {ob.blokken.map((blok) => (
          <div key={blok.kop} className="mt-4">
            <h4 className="text-sm font-semibold text-foreground">{blok.kop}</h4>
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {blok.punten.map((punt) => (
                <li key={punt}>{punt}</li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <h4 className="text-sm font-semibold text-foreground">{n("ob_t4p_claimgrens_kop")}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{ob.claimgrens}</p>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{n("ob_t4p_taalnoot")}</p>
      </CardContent>
    </Card>
  );
}

function NiveauBadge({ niveau, n }: { niveau: Toegangsniveau; n: Vert }) {
  if (niveau === "publiek") {
    return (
      <Badge className="bg-teal-600 text-white hover:bg-teal-600" data-testid={`badge-niveau-publiek`}>
        {n("ob_badge_publiek")}
      </Badge>
    );
  }
  if (niveau === "op-aanvraag") {
    return (
      <Badge variant="secondary" data-testid={`badge-niveau-op-aanvraag`}>
        {n("ob_badge_op_aanvraag")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-slate-300 text-slate-600" data-testid={`badge-niveau-intern`}>
      {n("ob_badge_intern")}
    </Badge>
  );
}

// Aanvraagformulier voor "op aanvraag"-documenten
function AanvraagFormulier({ doc, n }: { doc: OnderbouwingDoc; n: Vert }) {
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [motivatie, setMotivatie] = useState("");
  const [status, setStatus] = useState<"idle" | "bezig" | "ok" | "fout">("idle");
  const [bericht, setBericht] = useState("");

  async function verstuur(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("bezig");
    try {
      const r = await fetch("/api/onderbouwing/aanvraag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: doc.id, naam, email, motivatie }),
      });
      const j = await r.json();
      if (r.ok) {
        setStatus("ok");
        setBericht(j.bericht ?? n("ob_aanvraag_ok"));
      } else {
        setStatus("fout");
        setBericht(j.error ?? n("ob_aanvraag_fout"));
      }
    } catch {
      setStatus("fout");
      setBericht(n("ob_aanvraag_fout"));
    }
  }

  if (status === "ok") {
    return (
      <div className="flex items-start gap-2 rounded-md bg-teal-50 p-3 text-sm text-teal-800" data-testid={`aanvraag-ok-${doc.id}`}>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{bericht}</span>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        data-testid={`knop-toegang-aanvragen-${doc.id}`}
      >
        <Mail className="mr-1.5 h-4 w-4" aria-hidden />
        {n("ob_knop_toegang_aanvragen")}
      </Button>
    );
  }

  return (
    <form onSubmit={verstuur} className="space-y-2" data-testid={`aanvraag-form-${doc.id}`}>
      <input
        type="text"
        placeholder={n("ob_aanvraag_naam")}
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        data-testid={`aanvraag-naam-${doc.id}`}
      />
      <input
        type="email"
        required
        placeholder={n("ob_aanvraag_email")}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        data-testid={`aanvraag-email-${doc.id}`}
      />
      <textarea
        placeholder={n("ob_aanvraag_motivatie")}
        value={motivatie}
        onChange={(e) => setMotivatie(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        data-testid={`aanvraag-motivatie-${doc.id}`}
      />
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={status === "bezig"} data-testid={`aanvraag-verstuur-${doc.id}`}>
          {status === "bezig" ? n("ob_aanvraag_bezig") : n("ob_aanvraag_verstuur")}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>
          {n("ob_aanvraag_annuleer")}
        </Button>
      </div>
      {status === "fout" && (
        <p className="text-xs text-red-600" data-testid={`aanvraag-fout-${doc.id}`}>{bericht}</p>
      )}
    </form>
  );
}

function DocumentKaart({ doc, isAdmin, n }: { doc: OnderbouwingDoc; isAdmin: boolean; n: Vert }) {
  const kanBekijken = doc.niveau === "publiek" || isAdmin;

  return (
    <Card className="overflow-hidden" data-testid={`onderbouwing-kaart-${doc.id}`}>
      <div className="relative aspect-[1.22/1] w-full overflow-hidden bg-slate-100">
        <img
          src={doc.thumb}
          alt={doc.titel}
          className={`h-full w-full object-cover object-top ${kanBekijken ? "" : "blur-[2px] brightness-95"}`}
          loading="lazy"
        />
        <div className="absolute left-2 top-2">
          <NiveauBadge niveau={doc.niveau} n={n} />
        </div>
        {!kanBekijken && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10">
            <Lock className="h-8 w-8 text-slate-500" aria-hidden />
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold leading-snug text-foreground">{doc.titel}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PDF · {doc.paginas} {n("ob_paginas")}
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{doc.omschrijving}</p>

        <div className="mt-3">
          {doc.niveau === "publiek" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild data-testid={`knop-preview-${doc.id}`}>
                <a href={doc.bestandUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                  {n("ob_knop_preview")}
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild data-testid={`knop-download-${doc.id}`}>
                <a href={doc.bestandUrl} download>
                  <Download className="mr-1.5 h-4 w-4" aria-hidden />
                  {n("ob_knop_download")}
                </a>
              </Button>
            </div>
          )}

          {doc.niveau === "op-aanvraag" && !isAdmin && (
            <AanvraagFormulier doc={doc} n={n} />
          )}

          {doc.niveau === "op-aanvraag" && isAdmin && (
            <Button size="sm" asChild data-testid={`knop-preview-${doc.id}`}>
              <a href={doc.bestandUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                {n("ob_knop_preview")}
              </a>
            </Button>
          )}

          {doc.niveau === "intern" && isAdmin && (
            <Button size="sm" variant="outline" asChild data-testid={`knop-preview-${doc.id}`}>
              <a href={doc.bestandUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                {n("ob_knop_intern_bekijken")}
              </a>
            </Button>
          )}

          {doc.niveau === "intern" && !isAdmin && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid={`intern-noot-${doc.id}`}>
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {n("ob_intern_noot")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function OnderbouwingSectie({
  isAdmin,
  n,
  compact = false,
}: {
  isAdmin: boolean;
  n: Vert;
  compact?: boolean;
}) {
  // Publieke weergave verbergt "intern"; admin ziet alles.
  const zichtbaar = isAdmin
    ? ONDERBOUWING_DOCUMENTEN
    : ONDERBOUWING_DOCUMENTEN.filter((d) => d.niveau !== "intern");

  const kerncijfers = [
    { waarde: "0,93", label: n("ob_cijfer_congruentie") },
    { waarde: "0,83", label: n("ob_cijfer_kmo") },
    { waarde: "10/11", label: n("ob_cijfer_factoren") },
    { waarde: "UA", label: n("ob_cijfer_ua") },
  ];

  return (
    <section className={compact ? "" : "mt-10"} data-testid="sectie-onderbouwing">
      {!compact && (
        <h2 className="text-sm font-semibold text-foreground" data-testid="kop-onderbouwing">
          {n("ob_titel")}
        </h2>
      )}

      {/* Vertrouwensbanner */}
      <Card className="mt-3 border-teal-200 bg-teal-50/60" data-testid="onderbouwing-banner">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-teal-600" aria-hidden />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground">{n("ob_banner_titel")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{n("ob_banner_tekst")}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {kerncijfers.map((k) => (
                  <div key={k.label} className="rounded-lg bg-white/70 p-3 text-center">
                    <div className="text-xl font-bold tabular-nums text-teal-700">{k.waarde}</div>
                    <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{k.label}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground" data-testid="onderbouwing-cijfers-bron">
                {n("ob_cijfers_bron")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eigen onderbouwing van T4Professional (los van de T4S-cijfers) */}
      <T4ProfessionalOnderbouwing n={n} />

      {/* Documentkaarten */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {zichtbaar.map((doc) => (
          <DocumentKaart key={doc.id} doc={doc} isAdmin={isAdmin} n={n} />
        ))}
      </div>

      {/* Toegangslogica-noot */}
      <p className="mt-3 text-xs text-muted-foreground" data-testid="onderbouwing-toegangsnoot">
        {n("ob_toegang_noot")}
      </p>
    </section>
  );
}
