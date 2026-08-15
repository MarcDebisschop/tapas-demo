# Bekwaamheidsmodule — documenten en simulatie

Deze map bevat geen code die meedraait. De module zelf staat in
`server/bekwaamheid/` en `client/src/pages/admin-bekwaamheid*.tsx`.

## De documenten

| Bestand | Wat het is |
| --- | --- |
| `RELEASE-BEKWAAMHEIDSMODULE.md` | Wat er is opgeleverd, per blok |
| `HANDLEIDING-BEKWAAMHEID-BEHEERDERS.md` | Hoe een Admin Beheerder de module gebruikt |
| `BOUWRAPPORT-BEKWAAMHEID-AFWERKING.md` | Het afwerkingstraject: opslaglaag, eindpunten, schermen, coachlaag |
| `BOUWRAPPORT-9.7.md` | De drie schermen van §9.7 |
| `BOUWRAPPORT-REGIEKAMER-9.6.md` | Scherm 9.6, de regiekamer |
| `VERVOLGPLAN-BEKWAAMHEID.md` | Het plan waarmee de afwerking is aangevat |

## De simulatie

`simulatie/` bevat een lesmiddel: een statische pagina die de regels van de
module naspeelt, zodat een nieuwe beheerder ze kan leren zonder een echte
ronde te openen. De drempels, beslisregels, fasentabel, poortconstanten en
weigeringsteksten zijn overgenomen uit de broncode. De casusgegevens
— een kandidaatnaam, twee bekrachtigers, datums, scores — zijn verzonnen.

Er is geen bouwstap en er zijn geen afhankelijkheden.

- `index.html` + `styles.css` + `app.js` — de drie bestanden moeten naast
  elkaar staan; open `index.html` via een webserver of via de gepubliceerde
  link
- `bekwaamheid-simulatie.html` — dezelfde pagina met de opmaak en de logica
  ingebouwd. Dit ene bestand werkt ook rechtstreeks vanaf de schijf

**De simulatie is een lesmiddel, geen tweede bron van waarheid.** Verandert
een drempel of een beslisregel in `server/bekwaamheid/`, dan moet de
simulatie worden nagetrokken. De cijfers in het paneel *Naslag* noemen elk
hun bronregel, zodat dat na te lopen is.

## Bekende openstaande punten

Het paneel *Grenzen* in de simulatie somt zeven bevindingen over de module
op, waaronder twee blokkerende:

1. `licenties.naBekrachtiging` (`storage.ts`) wordt nergens aangeroepen, dus
   blijft een licentie na bekrachtiging op `overgangsperiode` staan en blijft
   `geldig_tot` leeg
2. Een herbeslissing na een gegrond bezwaar loopt vast op de unieke sleutel
   per ronde

Deze staan ook in `BOUWRAPPORT-BEKWAAMHEID-AFWERKING.md`.
