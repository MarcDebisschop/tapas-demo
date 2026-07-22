import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { BELEVING } from "./lib/features";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Belevingslaag (o.a. het driftende Earhart-vliegtuigmerkteken/de 'vlucht'-sfeer)
// enkel in het volledige platform. In TaPas Core blijft de class achterwege,
// waardoor de vlucht-animatie in index.css onzichtbaar is.
if (BELEVING) {
  document.documentElement.classList.add("belevings-modus");
}

createRoot(document.getElementById("root")!).render(<App />);
