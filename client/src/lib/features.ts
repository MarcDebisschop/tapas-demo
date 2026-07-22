/**
 * Feature-flags — TaPas Core (kale instrumenten-versie) vs. volledig platform
 * ───────────────────────────────────────────────────────────────────────────
 * Het volledige TaPas-platform bevat een belevingslaag: poorten-intro,
 * TaPasAcademy, TaPas Lounge, magic-schermen, impact-etalage, webinars en de
 * verhalende Jester-chat. De investeerdersvisie ("TaPas Core") wil enkel de
 * zakelijke kern: instrumenten uitsturen, afname opvolgen van link tot PDF,
 * credits/facturatie en het deelnemersdashboard.
 *
 * BELEVING bepaalt of de belevingslaag zichtbaar is:
 *   VITE_BELEVING="true"  → volledig platform (poort, Academy, Lounge, ...).
 *   niet gezet of "false" → TaPas Core (default): kale instrumenten-versie.
 *
 * DEFAULT = KALE VERSIE. Op Render hoeft niets gezet te worden om Core te
 * tonen; enkel VITE_BELEVING="true" zet de volledige beleving terug aan.
 * Niets wordt verwijderd — de belevingscode blijft volledig in de repo.
 *
 * Analoog aan client/src/lib/demoMode.ts (bestaand flag-patroon).
 */

export const BELEVING: boolean =
  import.meta.env.VITE_BELEVING === "true";

/** True wanneer de app in de kale "TaPas Core"-modus draait (beleving uit). */
export const CORE_MODE: boolean = !BELEVING;

/**
 * Zichtbare productnaam. In Core-modus tonen we "TaPas Core" zodat er geen
 * verwarring is met het volledige belevingsplatform, met behoud van de
 * TaPas-look & feel en het gedachtegoed als endorsement.
 */
export const PRODUCT_NAAM: string = CORE_MODE ? "TaPas Core" : "TaPas";

/**
 * Gebruik in een component:
 *
 *   import { BELEVING, CORE_MODE, PRODUCT_NAAM } from "@/lib/features";
 *
 *   {BELEVING && <Route path="/academy" component={Academy} />}
 *   {BELEVING && <JesterSectie />}
 *   <span>{PRODUCT_NAAM}</span>
 */
