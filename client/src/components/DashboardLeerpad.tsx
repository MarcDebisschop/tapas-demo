// ---------------------------------------------------------------------------
// DashboardLeerpad — Fase 4 (item 2.2)
// Stapsgewijze begeleidingswidget voor het deelnemersdashboard.
//
// Toont de vier aanbevolen stappen in het leerpad als interactieve
// tijdlijn: welke stap is doorlopen, welke is actief en welke nog open.
// De widget is puur visueel/informatief en vereist geen extra API-calls:
// de actieve stap wordt afgeleid uit props die de ouder (dashboard.tsx)
// meegeeft op basis van de dashboarddata die al opgehaald is.
//
// Stappen (altijd in volgorde):
//   1. Profiel begrijpen    → inzichtkaarten gelezen
//   2. Uitleg beluisteren   → UitlegPaneel geopend
//   3. Verdiepen            → galerij-module gestart
//   4. Gesprek aangaan      → chatbot gebruikt
//
// De actieve stap is de eerste onvoltooide stap. Als alle stappen
// voltooid zijn, toont de widget een felicitatieboodschap.
// ---------------------------------------------------------------------------

import type { Taal } from "@shared/i18n";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

type ML = Record<Taal, string>;
const k = (m: ML, t: Taal): string => m[t] ?? m.nl;

interface LeerpadStap {
  id: number;
  label: ML;
  omschrijving: ML;
}

const STAPPEN: LeerpadStap[] = [
  {
    id: 1,
    label: {
      nl: "Profiel begrijpen",
      fr: "Comprendre le profil",
      en: "Understand the profile",
      es: "Comprender el perfil",
      ru: "Понять профиль",
    },
    omschrijving: {
      nl: "Bekijk je inzichtkaarten en lees wat ze over je vertellen.",
      fr: "Consultez vos cartes d'insight et lisez ce qu'elles disent de vous.",
      en: "Browse your insight cards and read what they reveal about you.",
      es: "Revisa tus tarjetas de comprensión y lee lo que dicen sobre ti.",
      ru: "Просмотрите карточки инсайтов и прочитайте, что они о вас говорят.",
    },
  },
  {
    id: 2,
    label: {
      nl: "Uitleg beluisteren",
      fr: "Écouter l'explication",
      en: "Listen to the explanation",
      es: "Escuchar la explicación",
      ru: "Послушать объяснение",
    },
    omschrijving: {
      nl: "Beluister de gesproken toelichting bij elk profielblok.",
      fr: "Écoutez l'explication vocale de chaque bloc de profil.",
      en: "Listen to the spoken explanation for each profile block.",
      es: "Escucha la explicación hablada de cada bloque del perfil.",
      ru: "Прослушайте голосовое пояснение к каждому блоку профиля.",
    },
  },
  {
    id: 3,
    label: {
      nl: "Verdiepen",
      fr: "Approfondir",
      en: "Deepen the insight",
      es: "Profundizar",
      ru: "Углубиться",
    },
    omschrijving: {
      nl: "Open een galerij-module en ontdek de achtergrond van je talent.",
      fr: "Ouvrez un module de galerie et découvrez le fond de votre talent.",
      en: "Open a gallery module and explore the background of your talent.",
      es: "Abre un módulo de galería y descubre el trasfondo de tu talento.",
      ru: "Откройте модуль галереи и изучите основу своего таланта.",
    },
  },
  {
    id: 4,
    label: {
      nl: "Gesprek aangaan",
      fr: "Engager la conversation",
      en: "Start the conversation",
      es: "Iniciar la conversación",
      ru: "Начать разговор",
    },
    omschrijving: {
      nl: "Stel je vragen aan de profielassistent en verken je profiel in dialoog.",
      fr: "Posez vos questions à l'assistant de profil et explorez votre profiel en dialogue.",
      en: "Ask the profile assistant your questions and explore your profile through dialogue.",
      es: "Haz tus preguntas al asistente de perfil y explora tu perfil en diálogo.",
      ru: "Задайте вопросы ассистенту профиля и исследуйте свой профиль в диалоге.",
    },
  },
];

const STR = {
  titel: {
    nl: "Jouw leerpad",
    fr: "Ton parcours d'apprentissage",
    en: "Your learning path",
    es: "Tu ruta de aprendizaje",
    ru: "Твой учебный путь",
  } as ML,
  voltooid: {
    nl: "Je hebt alle stappen doorlopen. Goed bezig!",
    fr: "Tu as parcouru toutes les étapes. Bravo !",
    en: "You've completed all steps. Well done!",
    es: "Has completado todos los pasos. ¡Bien hecho!",
    ru: "Ты прошёл все шаги. Отлично!",
  } as ML,
  stap: {
    nl: "Stap",
    fr: "Étape",
    en: "Step",
    es: "Paso",
    ru: "Шаг",
  } as ML,
};

interface Props {
  /** De eerste onvoltooide stap (1–4). 5 = alles voltooid. */
  actieveStap: 1 | 2 | 3 | 4 | 5;
  taal: Taal;
}

export default function DashboardLeerpad({ actieveStap, taal }: Props) {
  const allesVoltooid = actieveStap > 4;

  return (
    <section className="mt-8" data-testid="sectie-leerpad">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <ChevronRight className="h-4 w-4" aria-hidden />
        {k(STR.titel, taal)}
      </h2>

      {allesVoltooid ? (
        <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          {k(STR.voltooid, taal)}
        </div>
      ) : (
        <ol className="relative border-l border-border pl-6 space-y-5" role="list">
          {STAPPEN.map((stap) => {
            const voltooid = stap.id < actieveStap;
            const actief = stap.id === actieveStap;
            const open = stap.id > actieveStap;

            return (
              <li
                key={stap.id}
                className="relative"
                data-testid={`leerpad-stap-${stap.id}`}
                aria-current={actief ? "step" : undefined}
              >
                {/* Tijdlijnpunt */}
                <span
                  className={`absolute -left-[1.65rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    voltooid
                      ? "border-primary bg-primary text-primary-foreground"
                      : actief
                        ? "border-primary bg-background"
                        : "border-muted-foreground/30 bg-background"
                  }`}
                  aria-hidden
                >
                  {voltooid ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : actief ? (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/30" />
                  )}
                </span>

                {/* Stapinhoud */}
                <div
                  className={`transition-opacity ${open ? "opacity-40" : "opacity-100"}`}
                >
                  <p
                    className={`text-sm font-semibold leading-snug ${
                      voltooid
                        ? "text-muted-foreground line-through"
                        : actief
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    <span className="mr-1 text-xs">{k(STR.stap, taal)} {stap.id}.</span>
                    {k(stap.label, taal)}
                  </p>
                  {actief && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {k(stap.omschrijving, taal)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
