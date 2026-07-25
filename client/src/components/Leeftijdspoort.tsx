// ---------------------------------------------------------------------------
// client/src/components/Leeftijdspoort.tsx
//
// Leeftijdspoort en ouderlijke toestemming voor instrumenten met een
// minderjarige doelgroep (T4Teens, T4Kids). AVG art. 8 + EDPB-richtsnoeren
// kinderen: eenvoudige taal, expliciete keuze, geen geboortedatum.
//
// De component is puur presentatie plus lokale invoerstaat. De beslissingsregels
// zitten in shared/leeftijd.ts zodat client en server exact dezelfde poort
// gebruiken; de server blijft de plek waar de poort echt wordt afgedwongen.
// ---------------------------------------------------------------------------
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CalendarClock, ShieldCheck } from "lucide-react";
import {
  toegestaneBandenVoor,
  vereistOuderlijkeToestemming,
  type Leeftijdsband,
} from "@shared/leeftijd";
import { maakVertaler } from "@shared/i18n";

// Waarden die de gastheer-pagina bijhoudt en meestuurt naar de server.
export interface LeeftijdspoortStaat {
  leeftijdsband: Leeftijdsband | null;
  ouderlijkeToestemming: boolean;
  ouderNaam: string;
  ouderEmail: string;
}

export const LEEG_POORT_STAAT: LeeftijdspoortStaat = {
  leeftijdsband: null,
  ouderlijkeToestemming: false,
  ouderNaam: "",
  ouderEmail: "",
};

const BAND_SLEUTEL: Record<Leeftijdsband, string> = {
  "10-12": "leeftijd_band_10_12",
  "13-15": "leeftijd_band_13_15",
  "16-17": "leeftijd_band_16_17",
  "18+": "leeftijd_band_18plus",
};

interface Props {
  instrumentId: string | null | undefined;
  taal: string;
  staat: LeeftijdspoortStaat;
  onWijzig: (staat: LeeftijdspoortStaat) => void;
}

export function Leeftijdspoort({ instrumentId, taal, staat, onWijzig }: Props) {
  const banden = toegestaneBandenVoor(instrumentId);
  // Geen minderjarig instrument: de poort bestaat niet en de bestaande flow
  // blijft volledig ongewijzigd.
  if (!banden) return null;

  const t = maakVertaler(taal as any);
  const ouderVereist = vereistOuderlijkeToestemming(instrumentId, staat.leeftijdsband);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 flex-shrink-0 text-primary" />
          <p className="text-sm font-medium text-foreground">{t("leeftijd_titel")}</p>
        </div>
        <p className="text-sm text-muted-foreground">{t("leeftijd_uitleg")}</p>
        <Label>{t("leeftijd_label")}</Label>
        <div className="flex flex-wrap gap-2">
          {banden.map((band) => (
            <Button
              key={band}
              type="button"
              variant={staat.leeftijdsband === band ? "default" : "outline"}
              size="sm"
              onClick={() =>
                onWijzig({
                  ...staat,
                  leeftijdsband: band,
                  // Bij een nieuwe band vervalt een eerder gegeven ouderlijke
                  // toestemming: die hoort bij een specifieke leeftijd.
                  ouderlijkeToestemming: false,
                })
              }
              data-testid={`button-leeftijdsband-${band}`}
            >
              {t(BAND_SLEUTEL[band] as any)}
            </Button>
          ))}
        </div>
      </div>

      {ouderVereist && (
        <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-accent" />
            <p className="text-sm font-medium text-foreground">{t("ouder_titel")}</p>
          </div>
          <p className="text-sm text-muted-foreground">{t("ouder_uitleg")}</p>
          <div className="space-y-2">
            <Label htmlFor="ouder-naam">{t("ouder_naam_label")}</Label>
            <Input
              id="ouder-naam"
              value={staat.ouderNaam}
              onChange={(e) => onWijzig({ ...staat, ouderNaam: e.target.value })}
              data-testid="input-ouder-naam"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ouder-email">{t("ouder_email_label")}</Label>
            <Input
              id="ouder-email"
              type="email"
              value={staat.ouderEmail}
              onChange={(e) => onWijzig({ ...staat, ouderEmail: e.target.value })}
              data-testid="input-ouder-email"
            />
          </div>
          <label className="flex items-center gap-2 pt-1 text-sm text-foreground">
            <Checkbox
              checked={staat.ouderlijkeToestemming}
              onCheckedChange={(c) => onWijzig({ ...staat, ouderlijkeToestemming: Boolean(c) })}
              data-testid="checkbox-ouder-toestemming"
            />
            {t("ouder_checkbox")}
          </label>
        </div>
      )}
    </div>
  );
}
