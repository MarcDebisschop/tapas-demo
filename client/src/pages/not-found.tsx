import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { maakVertaler, STANDAARD_TAAL } from "@shared/i18n";

export default function NotFound() {
  const t = maakVertaler(STANDAARD_TAAL);
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-7 w-7 text-destructive" />
            <h1 className="text-xl font-semibold text-foreground">404 — {t("nf_titel")}</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("nf_tekst")}</p>
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
