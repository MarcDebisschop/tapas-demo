import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";
import { doorstuurDoel } from "./kale-paden";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // HTML zelf: nooit cachen (altijd nieuwe versie ophalen)
  app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  app.use(express.static(distPath, {
    // Vite-assets hebben content-hash in bestandsnaam → lang cachen mag
    // HTML en overige root-bestanden nooit cachen
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));

  // -------------------------------------------------------------------------
  // KALE LINKS NAAR HUN PLAATS ACHTER HET HEKJE
  // -------------------------------------------------------------------------
  // De client draait VOLLEDIG op hash-routing (<Router hook={useHashLocation}>),
  // dus elke echte route zit achter "/#/...". Wie een kale link deelt of mailt,
  // belandt anders op de startpagina en denkt dat de link kapot is. Sinds de
  // uitnodigingen zonder hekje de post ingaan, draagt deze regel al die post.
  //
  // De regel zelf staat in ./kale-paden.ts, met een test erop.
  app.get("/{*path}", (req, res, next) => {
    const zoekreeks = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const doel = doorstuurDoel(req.path, zoekreeks);
    if (!doel) return next();
    return res.redirect(302, doel);
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
