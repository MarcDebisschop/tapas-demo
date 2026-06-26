// ---------------------------------------------------------------------------
// AcademyJester — gereconstrueerd uit originele bundle (index-CxFhBwUz.js)
// Functienaam in bundle: n8e()
// Toont de Jester galerij als iframe van /jester-galerij/index.html
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Link } from "wouter";
import { AppHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TALEN,
  TAAL_NAMEN,
  TAAL_CODES,
  STANDAARD_TAAL,
  maakVertaler,
  normaliseerTaal,
  type Taal,
} from "@shared/i18n";
import { ChevronLeft } from "lucide-react";

export default function AcademyJester() {
  const [taal, setTaal] = useState<Taal>(STANDAARD_TAAL);
  const n = maakVertaler(taal);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[hsl(222_47%_5%)]">
      <AppHeader
        right={
          <div className="flex items-center gap-2">
            <Select value={taal} onValueChange={(v) => setTaal(normaliseerTaal(v))}>
              <SelectTrigger
                className="h-9 w-auto gap-1.5 px-2.5"
                data-testid="select-ui-taal"
                aria-label={n("taal_kiezer_label")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TALEN.map((l) => (
                  <SelectItem key={l} value={l} data-testid={`option-taal-${l}`}>
                    {TAAL_CODES[l]} · {TAAL_NAMEN[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/academy">
              <Button variant="ghost" size="sm" data-testid="link-terug-academy">
                <ChevronLeft className="mr-1.5 h-4 w-4" />
                {n("jester_terug_academy")}
              </Button>
            </Link>
          </div>
        }
      />
      <iframe
        src="/jester-galerij/index.html"
        title={n("jester_galerij_titel")}
        className="w-full flex-1 border-0"
        style={{ minHeight: "calc(100dvh - 56px)" }}
        data-testid="frame-jester-galerij"
      />
    </div>
  );
}
