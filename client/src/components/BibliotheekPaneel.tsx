// =============================================================================
// BibliotheekPaneel — gepersonaliseerde bibliotheek + podcasts voor DEELNEMERS.
// Nieuw component (Strikte Werkregel 2: nieuwe feature = apart bestand).
//
// - Adaptief: haalt boeken/podcasts op via /api/dashboard/:token/bibliotheek en
//   /api/dashboard/:token/podcasts. De server sorteert op het driver-/focusprofiel
//   uit het meest recente contract, dus de lijst evolueert mee met de deelnemer.
// - 18+ gating: de server geeft { beschikbaar:false } terug voor teens (< 18);
//   in dat geval toont dit paneel niets.
// - Alleen voor professionals ("business") en studenten ("students", 18+).
// =============================================================================
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Mic, Loader2 } from "lucide-react";
import { type Taal } from "@shared/i18n";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal) => m[t] ?? m.nl;

interface BibliotheekItem {
  titel: string;
  auteur: string;
  jaar: number;
  beschrijving: string;
  url: string | null;
  tags: string[];
}
interface PodcastItem {
  naam: string;
  podcast: string;
  aflevering?: string;
  beschrijving: string;
  url: string | null;
  tags: string[];
}
interface BibliotheekResponse {
  beschikbaar: boolean;
  doelgroep: "business" | "students" | "teens";
  items: BibliotheekItem[];
}
interface PodcastResponse {
  beschikbaar: boolean;
  doelgroep: "business" | "students" | "teens";
  items: PodcastItem[];
}

const STR = {
  titel: {
    nl: "Jouw bibliotheek & podcasts",
    fr: "Ta bibliothèque & podcasts",
    en: "Your library & podcasts",
    es: "Tu biblioteca y podcasts",
    ru: "Ваша библиотека и подкасты",
  } as ML,
  ondertitel: {
    nl: "Boeken en podcasts, geselecteerd op basis van jouw profiel — de selectie past zich aan naarmate je profiel evolueert.",
    fr: "Livres et podcasts sélectionnés selon ton profil — la sélection évolue avec ton profil.",
    en: "Books and podcasts selected for your profile — the selection adapts as your profile evolves.",
    es: "Libros y podcasts seleccionados según tu perfil — la selección se adapta a medida que tu perfil evoluciona.",
    ru: "Книги и подкасты, подобранные под ваш профиль — подборка меняется по мере развития профиля.",
  } as ML,
  boeken: {
    nl: "Boekenlijst",
    fr: "Liste de livres",
    en: "Reading list",
    es: "Lista de libros",
    ru: "Список книг",
  } as ML,
  boekenSub: {
    nl: "Geselecteerd op basis van jouw profiel",
    fr: "Sélectionnés selon ton profil",
    en: "Selected based on your profile",
    es: "Seleccionados según tu perfil",
    ru: "Подобрано по вашему профилю",
  } as ML,
  podcasts: {
    nl: "Podcast-aanbevelingen",
    fr: "Recommandations de podcasts",
    en: "Podcast recommendations",
    es: "Recomendaciones de podcasts",
    ru: "Рекомендации подкастов",
  } as ML,
  podcastsSub: {
    nl: "Op basis van jouw driver-profiel",
    fr: "Selon ton profil de drivers",
    en: "Based on your driver profile",
    es: "Según tu perfil de drivers",
    ru: "На основе вашего профиля драйверов",
  } as ML,
  bekijk: {
    nl: "Bekijk",
    fr: "Voir",
    en: "View",
    es: "Ver",
    ru: "Показать",
  } as ML,
  sluiten: {
    nl: "Sluiten",
    fr: "Fermer",
    en: "Close",
    es: "Cerrar",
    ru: "Скрыть",
  } as ML,
  laden: {
    nl: "Laden...",
    fr: "Chargement...",
    en: "Loading...",
    es: "Cargando...",
    ru: "Загрузка...",
  } as ML,
  meerInfo: {
    nl: "Meer info →",
    fr: "Plus d'infos →",
    en: "More info →",
    es: "Más info →",
    ru: "Подробнее →",
  } as ML,
  beluister: {
    nl: "Beluisteren →",
    fr: "Écouter →",
    en: "Listen →",
    es: "Escuchar →",
    ru: "Слушать →",
  } as ML,
};

function BibliotheekPaneel({ token, taal }: { token: string; taal: Taal }) {
  const [boekenOpen, setBoekenOpen] = useState(false);
  const [podcastsOpen, setPodcastsOpen] = useState(false);

  const { data: bib, isLoading: bibLaadt } = useQuery<BibliotheekResponse>({
    queryKey: ["/api/dashboard", token, "bibliotheek"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dashboard/${token}/bibliotheek`);
      return res.json();
    },
    enabled: !!token,
  });

  const { data: pod } = useQuery<PodcastResponse>({
    queryKey: ["/api/dashboard", token, "podcasts"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dashboard/${token}/podcasts`);
      return res.json();
    },
    enabled: !!token && podcastsOpen,
  });

  // 18+ gating: server geeft beschikbaar:false voor teens → toon niets.
  if (bibLaadt) return null;
  if (bib && bib.beschikbaar === false) return null;

  return (
    <Card data-testid="card-bibliotheek">
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Kop */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{k(STR.titel, taal)}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{k(STR.ondertitel, taal)}</p>
          </div>
        </div>

        {/* Boeken */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-accent" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">{k(STR.boeken, taal)}</h3>
                <p className="text-xs text-muted-foreground">{k(STR.boekenSub, taal)}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBoekenOpen((v) => !v)}
              data-testid="button-bibliotheek-boeken"
            >
              {boekenOpen ? k(STR.sluiten, taal) : k(STR.bekijk, taal)}
            </Button>
          </div>
          {boekenOpen && (
            <div className="mt-4 space-y-4">
              {bib ? (
                bib.items.slice(0, 6).map((b, i) => (
                  <div key={i} className="border-l-2 border-accent/60 pl-4">
                    <div className="text-sm font-semibold text-foreground">{b.titel}</div>
                    <div className="mb-1 text-xs text-muted-foreground">{b.auteur} ({b.jaar})</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{b.beschrijving}</p>
                    {b.url && (
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-accent"
                      >
                        {k(STR.meerInfo, taal)}
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {k(STR.laden, taal)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Podcasts */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mic className="h-5 w-5 text-accent" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">{k(STR.podcasts, taal)}</h3>
                <p className="text-xs text-muted-foreground">{k(STR.podcastsSub, taal)}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPodcastsOpen((v) => !v)}
              data-testid="button-bibliotheek-podcasts"
            >
              {podcastsOpen ? k(STR.sluiten, taal) : k(STR.bekijk, taal)}
            </Button>
          </div>
          {podcastsOpen && (
            <div className="mt-4 space-y-4">
              {pod ? (
                pod.items.slice(0, 6).map((p, i) => (
                  <div key={i} className="border-l-2 border-accent/40 pl-4">
                    <div className="text-sm font-semibold text-foreground">{p.naam}</div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      {p.podcast}{p.aflevering ? ` · ${p.aflevering}` : ""}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{p.beschrijving}</p>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-medium text-accent"
                      >
                        {k(STR.beluister, taal)}
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {k(STR.laden, taal)}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default BibliotheekPaneel;
