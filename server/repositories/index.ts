/**
 * server/repositories/index.ts
 * 
 * Centrale export van alle domein-repositories.
 * Geëxtraheerd uit storage.ts (item NP-3/1.2, Fase 5).
 * 
 * GEBRUIK: Alleen via server/storage.ts (DatabaseStorage). Nooit rechtstreeks
 * importeren vanuit routes of andere modules — gebruik altijd `storage`.
 */

export * from "./afnames";
export * from "./billers";
export * from "./organisaties";
export * from "./credits";
export * from "./rapporten";
export * from "./deelnemers";
export * from "./sessies";
export * from "./toegang";
