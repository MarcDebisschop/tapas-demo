/**
 * T4Recruitment-library — vertaallaag (fr/en/es/ru), met fallback naar NL.
 * ------------------------------------------------------------------------
 * De NL-library (library.ts) blijft de bron van waarheid voor structuur,
 * id's, cluster/sourceRefs en logica. Deze module levert vertaalde KOPIEËN
 * van de zichtbare tekstvelden o.b.v. een gekozen taal.
 *
 * Vaktermregels (geborgd in de vertaalbron, NIET hier afgedwongen):
 *   • "Drivers"/"driver" blijft onvertaald in alle talen.
 *   • "Need to have"/"Nice to have"/"Not needed" blijven Engels.
 *   • cluster + sourceRefs zijn NOOIT zichtbaar → niet vertaald (item-blinding).
 *
 * Sleutelconventie (zie library-vertalingen.json):
 *   mod.<nr>.title / mod.<nr>.intro
 *   <itemId>                         → item.text
 *   <itemId>.help                    → item.help
 *   <itemId>.poleLeft / .poleRight   → bipolaire polen
 *   <itemId>.opt.<value>             → choice-optie label
 *   <wcId>.name / <wcId>.desc        → werkcontext
 *   zone.<zone>                      → ZONE_LABEL
 *   status.<key>                     → STATUS_FLOW label
 *   scale.<1..5>                     → SCALE_OPTIONS label
 */
import type { Taal } from "@shared/i18n";
import {
  MODULES,
  ZONE_LABEL,
  STATUS_FLOW,
  SCALE_OPTIONS,
  classificationItems,
  type ModuleDef,
  type LibraryItem,
  type WorkContext,
  type Zone,
} from "./library";
import vertalingenJson from "./library-vertalingen.json";

const DOELTALEN = ["fr", "en", "es", "ru"] as const;
type VertaalMap = Record<string, string>;
const VERTALINGEN: Record<string, VertaalMap> = vertalingenJson as any;

function isDoeltaal(taal: string): boolean {
  return (DOELTALEN as readonly string[]).includes(taal);
}

/** Vertaalde string of NL-fallback. */
function v(taal: Taal, key: string, fallback: string): string {
  if (taal === "nl" || !isDoeltaal(taal)) return fallback;
  const map = VERTALINGEN[taal];
  if (!map) return fallback;
  const val = map[key];
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

/** Vertaal één library-item (text, help, scale-polen, choice-opties). */
export function vertaalItem(item: LibraryItem, taal: Taal): LibraryItem {
  if (taal === "nl" || !isDoeltaal(taal)) return item;
  const out: LibraryItem = { ...item };
  out.text = v(taal, item.id, item.text);
  if (item.help) out.help = v(taal, `${item.id}.help`, item.help);
  if (item.scale) {
    const sc = { ...item.scale };
    if (sc.poleLeft) sc.poleLeft = v(taal, `${item.id}.poleLeft`, sc.poleLeft);
    if (sc.poleRight) sc.poleRight = v(taal, `${item.id}.poleRight`, sc.poleRight);
    if (sc.options) {
      sc.options = sc.options.map((o) => ({
        ...o,
        label: v(taal, `${item.id}.opt.${o.value}`, o.label),
      }));
    }
    out.scale = sc;
  }
  return out;
}

/** Vertaal één werkcontext (name + desc). */
export function vertaalWorkContext(wc: WorkContext, taal: Taal): WorkContext {
  if (taal === "nl" || !isDoeltaal(taal)) return wc;
  return {
    ...wc,
    name: v(taal, `${wc.id}.name`, wc.name),
    desc: v(taal, `${wc.id}.desc`, wc.desc),
  };
}

/** Vertaal één module (title, intro, items, workContexts). */
export function vertaalModule(m: ModuleDef, taal: Taal): ModuleDef {
  if (taal === "nl" || !isDoeltaal(taal)) return m;
  return {
    ...m,
    title: v(taal, `mod.${m.nr}.title`, m.title),
    intro: v(taal, `mod.${m.nr}.intro`, m.intro),
    items: m.items.map((it) => vertaalItem(it, taal)),
    workContexts: m.workContexts?.map((wc) => vertaalWorkContext(wc, taal)),
  };
}

/** Vertaalde kopie van de volledige MODULES-lijst. */
export function vertaalModules(taal: Taal): ModuleDef[] {
  if (taal === "nl" || !isDoeltaal(taal)) return MODULES;
  return MODULES.map((m) => vertaalModule(m, taal));
}

/** Vind + vertaal één module op key. */
export function vertaalModuleByKey(key: string, taal: Taal): ModuleDef | undefined {
  const m = MODULES.find((x) => x.key === key);
  return m ? vertaalModule(m, taal) : undefined;
}

/** Zone-label. */
export function zoneLabel(zone: Zone, taal: Taal): string {
  return v(taal, `zone.${zone}`, ZONE_LABEL[zone]);
}

/** Status-flow label op key. */
export function statusLabel(key: string, taal: Taal): string {
  const fallback = STATUS_FLOW.find((s) => s.key === key)?.label ?? key;
  return v(taal, `status.${key}`, fallback);
}

/** Vertaalde STATUS_FLOW-lijst. */
export function vertaalStatusFlow(taal: Taal): { key: string; label: string }[] {
  return STATUS_FLOW.map((s) => ({ key: s.key, label: v(taal, `status.${s.key}`, s.label) }));
}

/** Vertaalde classificatie-items (voor consolidatie/rapport). */
export function vertaalClassificationItems(taal: Taal): LibraryItem[] {
  const items = classificationItems();
  if (taal === "nl" || !isDoeltaal(taal)) return items;
  return items.map((it) => vertaalItem(it, taal));
}

/** Vertaal de tekst van één item op id (fallback NL). Handig voor lookups. */
export function itemTekst(id: string, fallback: string, taal: Taal): string {
  return v(taal, id, fallback);
}

/** Vertaalde 5-punts SCALE_OPTIONS. */
export function vertaalScaleOptions(taal: Taal): { value: string; label: string }[] {
  if (taal === "nl" || !isDoeltaal(taal)) return SCALE_OPTIONS;
  return SCALE_OPTIONS.map((o) => ({ value: o.value, label: v(taal, `scale.${o.value}`, o.label) }));
}
