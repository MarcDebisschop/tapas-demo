// =============================================================================
// server/t4p/kompas-teksten.ts - De beheerbare vaste teksten van het T4P Kompas
//
// Waarom dit bestand bestaat:
//   De kernwoorden, de korte woorden en de E/H-duidingen per construct zijn
//   instrumentkennis, geen persoonsgegeven en geen rekenresultaat. Ze stonden
//   als constanten middenin kompas-contract.ts, waardoor een verfijning van een
//   formulering een codewijziging en een nieuwe uitrol vroeg.
//
//   Door ze hier los te zetten kunnen twee partijen ze lezen zonder
//   kringverwijzing:
//     1. kompas-contract.ts, dat het rapport opbouwt;
//     2. duidingstekst-register.ts, dat de beheerbare velden aanbiedt.
//
//   Dit bestand importeert met opzet NIETS. Het is een zuivere tekstbron en
//   blijft de terugval: staat er geen beheerde overschrijving in de databank,
//   dan geldt de tekst hier.
// =============================================================================

/** Kernwoord per construct. Instrumentkennis, geen persoonsgegeven. */
export const KERN_STANDAARD: Record<string, string> = {
  "Be Perfect": "kwaliteit en correctheid",
  "Try Hard": "mobiliserende ambitie",
  "Please Others": "relationele aanpassing",
  "Be Strong": "emotionele afstand en zelfdragen",
  "Hurry Up": "snelheid en gejaagdheid",
  Innovatie: "vernieuwing en nieuwe wegen",
  "Inter-relationeel": "mensgevoeligheid en afstemming",
  Operationeel: "processen bruikbaar maken",
  Strategie: "klassiek strategisch positioneren",
  "TaPas-Beeld": "identiteit, waarden en betekenis",
  Analyse: "doorgronden en ontwarren",
  Coaching: "mensen begeleiden en ontsluiten",
  Impact: "mensen in beweging brengen",
  "Constructief onderscheidend": "het verschilmakende beeld vormen",
  Faciliteren: "groepsafstemming ondersteunen",
  Resultaatgericht: "een concreet resultaatbeeld vormen",
};

/** Eén woord per construct, voor opsommingen in doorlopende tekst. */
export const KORT_STANDAARD: Record<string, string> = {
  "Be Perfect": "kwaliteit",
  "Try Hard": "ambitie",
  "Please Others": "aanpassing",
  "Be Strong": "zelfdragen",
  "Hurry Up": "snelheid",
  Innovatie: "vernieuwing",
  "Inter-relationeel": "afstemming",
  Operationeel: "uitvoering",
  Strategie: "positionering",
  "TaPas-Beeld": "betekenis",
  Analyse: "analyse",
  Coaching: "coaching",
  Impact: "invloed",
  "Constructief onderscheidend": "onderscheid",
  Faciliteren: "facilitering",
  Resultaatgericht: "resultaat",
};

/**
 * E/H-oriëntatie per construct, met de duiding uit de vormspecificatie.
 * De code (E, H, E+H) is instrumentstructuur en blijft in de code staan; enkel
 * de duidingszin is beheerbaar.
 */
export const EH_STANDAARD: Record<string, { code: string; duiding: string }> = {
  Innovatie: {
    code: "E+H",
    duiding:
      "Vernieuwt zowel inhoudelijk als verbindend: ideeën waar anderen door geïnspireerd raken.",
  },
  "Inter-relationeel": {
    code: "H",
    duiding: "Volledig mensgericht: aanvoelen wanneer iemand zich niet goed voelt.",
  },
  Operationeel: {
    code: "E",
    duiding: "Vooral functioneel: complexe processen vertalen naar bruikbare hulpmiddelen.",
  },
  Strategie: { code: "E", duiding: "Het klassiek-functionele wordt niet spontaan gekozen." },
  Analyse: { code: "E+H", duiding: "Doorgrondt zowel inhoud als mensen." },
  Coaching: { code: "H", duiding: "Mensgericht: aanvoelen en begeleiden." },
  Impact: { code: "H", duiding: "Verbindend: mensen in beweging krijgen." },
  "Constructief onderscheidend": { code: "E", duiding: "Functioneel; niet als kernpad." },
  Faciliteren: { code: "E", duiding: "Eerder functioneel dan mensgericht." },
  Resultaatgericht: { code: "E", duiding: "Functioneel-resultaatmatig." },
};
