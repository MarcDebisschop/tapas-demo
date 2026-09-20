import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { maakVertaler, STANDAARD_TAAL } from "@shared/i18n";

/**
 * De routes waarachter een persoonlijk kenmerk hoort te staan.
 *
 * AANLEIDING. Een deelnemer klikte op de uitnodiging en kreeg de melding "pagina
 * niet gevonden". Dat adres eindigde op de route "/deelnemer/" en daar stopte
 * het. Het mailprogramma had de link geknipt en het token eraf gehaald. Die
 * deelnemer krijgt dus beter niet te lezen dat de pagina niet bestaat, want zijn
 * vragenlijst staat klaar. Hij moet lezen wat er ontbreekt en wat hij eraan kan
 * doen.
 */
const UITNODIGINGSROUTES = ["/deelnemer", "/teamscan/r", "/dashboard", "/t4o/r", "/kringlid"];

export function isOnvolledigeUitnodiging(pad: string): boolean {
  const schoon = (pad ?? "").split("?")[0].replace(/\/+$/, "");
  return UITNODIGINGSROUTES.includes(schoon);
}

export default function NotFound() {
  const t = maakVertaler(STANDAARD_TAAL);
  const [pad] = useLocation();
  const onvolledig = isOnvolledigeUitnodiging(pad);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-7 w-7 text-destructive" />
            <h1
              className="text-xl font-semibold text-foreground"
              data-testid={onvolledig ? "titel-link-onvolledig" : "titel-404"}
            >
              {onvolledig ? t("nf_link_titel") : `404. ${t("nf_titel")}`}
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {onvolledig ? t("nf_link_tekst") : t("nf_tekst")}
          </p>
          <Link href="/">
            <Button variant="outline" size="sm" className="mt-5" data-testid="link-home-404">
              {t("nf_terug")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
