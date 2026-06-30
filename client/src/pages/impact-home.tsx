import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Compass, Users, Sparkles } from "lucide-react";
import ImpactRoosSvg from "@/components/ImpactRoosSvg";

/**
 * Impact-roos — voorbeeldpagina.
 * --------------------------------------------------------------------------
 * Toont de Impact-roos als gewerkt voorbeeld binnen de instrumentensuite:
 * een collaboratief reflectie-instrument dat zelfperceptie en de perceptie
 * van anderen langs twee assen (Ruimte / Verbinding) in beeld brengt. De
 * roos zelf is een octant-radar; deze pagina toont een ingevuld specimen en
 * linkt naar het volledige rapport. Reflectief, niet diagnostisch.
 */

function UitlegKaart({
  icoon,
  titel,
  body,
}: {
  icoon: React.ReactNode;
  titel: string;
  body: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {icoon}
        </div>
        <h3 className="mt-4 text-base font-semibold text-foreground">{titel}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

export default function ImpactHome() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader
        right={
          <Link href="/">
            <Button size="sm" variant="outline" data-testid="link-home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Startpagina
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* ---------- Intro ---------- */}
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Voorbeeld · gewerkt specimen
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            De Impact-roos
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            De Impact-roos is een collaboratief reflectie-instrument. Het brengt in beeld
            hoe iemand zich in samenwerking positioneert langs twee assen — Ruimte nemen
            tegenover Ruimte laten, en Verbinding tegenover Afstand — en legt de eigen
            perceptie naast die van collega&apos;s. Het resultaat is geen oordeel, maar
            gesprekstof: waar valt herkenning samen, en waar ontstaat er ruimte voor een
            gesprek. Hieronder ziet u een volledig ingevuld voorbeeld.
          </p>
        </div>

        {/* ---------- De roos (4.3 — inline SVG octant-radar) ---------- */}
        <div className="mt-8 flex flex-col items-center rounded-xl border border-border bg-card py-8 px-4" data-testid="impact-roos-container">
          <ImpactRoosSvg
            scores={[5, 4, 6, 7, 3, 2, 3, 4]}
            congruentie={{ v: 74, h: 82 }}
            grootte={380}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Specimen · de straal per octant staat voor het aantal herkenbare stellingen (0–7).
          De twee congruentie-indicatoren tonen of zelfperceptie en de perceptie van anderen
          op elke as samenvallen.
        </p>

        {/* ---------- Hoe lezen ---------- */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <UitlegKaart
            icoon={<Compass className="h-5 w-5" />}
            titel="Twee assen, acht octanten"
            body="De verticale as loopt van Ruimte nemen naar Ruimte laten; de horizontale van Verbinding naar Afstand. Elk van de acht octanten staat voor een herkenbare houding in samenwerking."
          />
          <UitlegKaart
            icoon={<Users className="h-5 w-5" />}
            titel="Zelf én anderen"
            body="De roos legt de eigen perceptie naast die van collega's. Waar beide samenvallen spreekt het instrument van congruentie; waar ze verschillen ontstaat de rijkste gesprekstof."
          />
          <UitlegKaart
            icoon={<Sparkles className="h-5 w-5" />}
            titel="Reflectief, niet diagnostisch"
            body="De Impact-roos geeft geen etiket en geen geschiktheidsoordeel. Het is een spiegel voor een gesprek over samenwerking, energie en impact binnen een team."
          />
        </div>

        {/* ---------- Volledig rapport ---------- */}
        <div className="mt-10 flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Volledig voorbeeldrapport</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bekijk het volledige Impact-roos-rapport met interpretatie, octant-duiding en
              congruentie-analyse.
            </p>
          </div>
          <a
            href="./impact-roos-rapport-voorbeeld.pdf"
            target="_blank"
            rel="noreferrer"
            data-testid="link-impact-rapport"
          >
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Open voorbeeldrapport (PDF)
            </Button>
          </a>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          De Impact-roos maakt deel uit van de TaPas-instrumentensuite en deelt het
          onderliggende gedachtegoed: één platform, meerdere instrumenten, centrale opslag
          en server-side verwerking. Dit voorbeeld dient ter illustratie.
        </p>
      </main>
    </div>
  );
}
