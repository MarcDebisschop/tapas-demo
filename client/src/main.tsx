import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { BELEVING } from "./lib/features";
import { documentKlassen } from "./lib/document-klassen";
import { pasHashHerstelToe } from "./lib/hash-herstel";

// Een uitnodigingslink die op een pagina met een hash werd samengesteld, kreeg
// twee hekjes: /#/hdd#/deelnemer/abc. De router las dan een route die niet
// bestaat en de deelnemer kreeg "pagina niet gevonden", terwijl het token klopte.
// Dit herstel leest zo'n adres recht voor de router start, en repareert dus ook
// de links die al verstuurd zijn. Zie lib/hash-herstel.ts.
pasHashHerstelToe();

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Het merkteken van TaPasCity, het vliegtuigje van Amelia Earhart, hoort op elk
// eigen scherm en dus ook in de kale versie. De sfeerlaag van het volledige
// platform komt daar enkel bovenop wanneer die aan staat. Welke klassen dat
// precies zijn, staat in lib/document-klassen.ts.
document.documentElement.classList.add(...documentKlassen(BELEVING));

createRoot(document.getElementById("root")!).render(<App />);
