import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

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
  // HASH-ROUTE REDIRECT (gedeelde links robuust maken)
  // -------------------------------------------------------------------------
  // De client draait VOLLEDIG op hash-routing (<Router hook={useHashLocation}>),
  // dus elke echte route zit achter "/#/...". Wie een "kale" link deelt of mailt
  // (bv. /2minscan) belandt anders op index.html, waar main.tsx de hash op
  // "#/" zet → homepagina. Daardoor lijkt de link "kapot".
  //
  // Omdat de app volledig hash-routed is, is ELK kaal pad (geen bestand met
  // extensie, geen /api, geen /assets) per definitie een client-route die
  // achter de hash hoort. We sturen zulke GET-verzoeken door naar de hash-
  // variant. Zo werkt /2minscan én elke andere gedeelde diepe link automatisch,
  // zonder een handmatige routelijst te moeten onderhouden.
  app.get("/{*path}", (req, res, next) => {
    const p = req.path;
    // Laat API, assets en echte bestanden (met extensie) ongemoeid.
    if (p.startsWith("/api") || p.startsWith("/assets") || path.extname(p)) {
      return next();
    }
    // Root zelf niet redirecten (main.tsx zet daar zelf "#/").
    if (p === "/") return next();
    // Elk overig kaal pad -> hash-variant.
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    return res.redirect(302, `/#${p}${query}`);
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
