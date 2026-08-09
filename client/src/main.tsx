import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { BELEVING } from "./lib/features";
import { documentKlassen } from "./lib/document-klassen";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Het merkteken van TaPasCity, het vliegtuigje van Amelia Earhart, hoort op elk
// eigen scherm en dus ook in de kale versie. De sfeerlaag van het volledige
// platform komt daar enkel bovenop wanneer die aan staat. Welke klassen dat
// precies zijn, staat in lib/document-klassen.ts.
document.documentElement.classList.add(...documentKlassen(BELEVING));

createRoot(document.getElementById("root")!).render(<App />);
