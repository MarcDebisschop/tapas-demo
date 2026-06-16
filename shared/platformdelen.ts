// ---------------------------------------------------------------------------
// Platformdelen — de afzonderlijk afsluitbare onderdelen van het platform.
//
// Dit is een STATISCHE registry (geen DB): de toegangstabel verwijst per
// beheerder naar deze ids. Twee soorten:
//
//   • type "module"        → een instrument/onderdeel waartoe je wel of geen
//                            toegang hebt (zichtbaar maar gedisabled indien niet).
//   • type "accreditatie"  → een bijzondere bevoegdheid die expliciet moet
//                            worden toegekend (T4P Business-profielen aanmaken).
//
// Commercieel uitgangspunt: HDD is los verkoopbaar (zonder de rest), en het
// aanmaken van T4P Business-profielen vereist accreditatie — los van of de
// koper de kompas-module heeft.
//
// Vertaald in de vijf platformtalen (nl/fr/en/es/ru).
// ---------------------------------------------------------------------------

import type { Taal } from "./talen";

export type PlatformdeelType = "module" | "accreditatie";

export interface Platformdeel {
  id: string;
  type: PlatformdeelType;
  // Route waarop het onderdeel leeft (voor de landingspagina/menu). Voor de
  // accreditatie is dit de route waarlangs T4P-profielen worden aangemaakt.
  route: string;
  naam: Record<Taal, string>;
  omschrijving: Record<Taal, string>;
}

export const PLATFORMDELEN: Platformdeel[] = [
  {
    id: "kompas",
    type: "module",
    route: "/start",
    naam: {
      nl: "T4P Business Kompas",
      fr: "T4P Business Kompas",
      en: "T4P Business Kompas",
      es: "T4P Business Kompas",
      ru: "T4P Business Kompas",
    },
    omschrijving: {
      nl: "Individueel werkgedrag- en talentprofiel.",
      fr: "Profil individuel de comportement et de talents au travail.",
      en: "Individual work-behavior and talent profile.",
      es: "Perfil individual de comportamiento y talento laboral.",
      ru: "Индивидуальный профиль рабочего поведения и талантов.",
    },
  },
  {
    id: "t4r",
    type: "module",
    route: "/t4r",
    naam: {
      nl: "T4Recruitment",
      fr: "T4Recruitment",
      en: "T4Recruitment",
      es: "T4Recruitment",
      ru: "T4Recruitment",
    },
    omschrijving: {
      nl: "Collaboratief rolprofiel voor wervingsbeslissingen.",
      fr: "Profil de rôle collaboratif pour les décisions de recrutement.",
      en: "Collaborative role profile for hiring decisions.",
      es: "Perfil de rol colaborativo para decisiones de contratación.",
      ru: "Совместный профиль роли для решений о найме.",
    },
  },
  {
    id: "teamscan",
    type: "module",
    route: "/teamscan",
    naam: {
      nl: "TaPas Teamscan",
      fr: "TaPas Teamscan",
      en: "TaPas Teamscan",
      es: "TaPas Teamscan",
      ru: "TaPas Teamscan",
    },
    omschrijving: {
      nl: "Teamreflectie en -ontwikkeling.",
      fr: "Réflexion et développement d'équipe.",
      en: "Team reflection and development.",
      es: "Reflexión y desarrollo de equipo.",
      ru: "Командная рефлексия и развитие.",
    },
  },
  {
    id: "twominscan",
    type: "module",
    route: "/2minscan",
    naam: {
      nl: "2MINSCAN",
      fr: "2MINSCAN",
      en: "2MINSCAN",
      es: "2MINSCAN",
      ru: "2MINSCAN",
    },
    omschrijving: {
      nl: "Energetisch gedragsprofiel in professionele context.",
      fr: "Profil comportemental énergétique en contexte professionnel.",
      en: "Energetic behavioral profile in a professional context.",
      es: "Perfil conductual energético en contexto profesional.",
      ru: "Энергетический поведенческий профиль в рабочем контексте.",
    },
  },
  {
    id: "impact",
    type: "module",
    route: "/impact",
    naam: {
      nl: "Impact-roos",
      fr: "Rose d'impact",
      en: "Impact rose",
      es: "Rosa de impacto",
      ru: "Роза влияния",
    },
    omschrijving: {
      nl: "Collaboratief reflectie-instrument rond ruimte en verbinding.",
      fr: "Outil de réflexion collaboratif autour de l'espace et du lien.",
      en: "Collaborative reflection tool around space and connection.",
      es: "Herramienta de reflexión colaborativa sobre espacio y conexión.",
      ru: "Инструмент совместной рефлексии о пространстве и связи.",
    },
  },
  {
    id: "hdd",
    type: "module",
    route: "/hdd",
    naam: {
      nl: "Human Due Diligence",
      fr: "Human Due Diligence",
      en: "Human Due Diligence",
      es: "Human Due Diligence",
      ru: "Human Due Diligence",
    },
    omschrijving: {
      nl: "Gefaseerd board-traject. Los verkoopbaar als afzonderlijke applicatie.",
      fr: "Parcours d'équipe dirigeante par phases. Vendable séparément.",
      en: "Phased board journey. Sellable as a standalone application.",
      es: "Trayecto de junta por fases. Se vende como aplicación independiente.",
      ru: "Поэтапный путь для совета. Продаётся как отдельное приложение.",
    },
  },
  {
    id: "credits",
    type: "module",
    route: "/admin/credits",
    naam: {
      nl: "Credits & facturatie",
      fr: "Crédits et facturation",
      en: "Credits & billing",
      es: "Créditos y facturación",
      ru: "Кредиты и выставление счетов",
    },
    omschrijving: {
      nl: "Beheer van credits, betalingen en facturen.",
      fr: "Gestion des crédits, paiements et factures.",
      en: "Management of credits, payments and invoices.",
      es: "Gestión de créditos, pagos y facturas.",
      ru: "Управление кредитами, платежами и счетами.",
    },
  },
  {
    id: "t4p-profielen",
    type: "accreditatie",
    route: "/start",
    naam: {
      nl: "T4P Business-profielen aanmaken",
      fr: "Création de profils T4P Business",
      en: "Creating T4P Business profiles",
      es: "Creación de perfiles T4P Business",
      ru: "Создание профилей T4P Business",
    },
    omschrijving: {
      nl: "Bijzondere bevoegdheid om zelf T4P Business-profielen op te stellen. Vereist accreditatie door TaPasCity.",
      fr: "Autorisation spéciale pour établir soi-même des profils T4P Business. Nécessite une accréditation par TaPasCity.",
      en: "Special authorization to create T4P Business profiles yourself. Requires accreditation by TaPasCity.",
      es: "Autorización especial para crear perfiles T4P Business. Requiere acreditación de TaPasCity.",
      ru: "Особое разрешение на самостоятельное создание профилей T4P Business. Требует аккредитации TaPasCity.",
    },
  },
];

export const PLATFORMDEEL_IDS = PLATFORMDELEN.map((d) => d.id);

export function platformdeel(id: string): Platformdeel | undefined {
  return PLATFORMDELEN.find((d) => d.id === id);
}

// De organisatie die als enige prior beheerders mag leveren.
export const PRIOR_ORGANISATIE = "TaPasCity";
