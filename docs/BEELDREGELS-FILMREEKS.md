# Beeldregels voor de filmreeks van Tapas CORE

Deze nota legt vast wat er in de films van Tapas CORE wel en niet in beeld
komt. Ze bestaat omdat het beeld even hard spreekt als de tekst: wie zich niet
herkent in de mensen aan de tafel, gelooft de belofte over talent, motivatie en
teamenergie niet, hoe zorgvuldig de stem ze ook formuleert.

De regels gelden voor elke nieuwe film en voor elke hermontage van een
bestaande film.

## De vier regels

1. Geen gezichten. De reeks werkt met handen, tafels, licht en typografie.
   Hoofden vallen buiten de kader. Zo blijft de film over de organisatie gaan
   en niet over een acteur, en is er geen enkel risico op een herkenbare
   persoon.
2. Geen das, geen driedelig kostuum. Formele kledij dateert het beeld sneller
   dan wat ook. Een open kraag, een gerolde mouw of een zachte trui houdt het
   beeld eigentijds en past bij een gesprek in plaats van bij een zitting.
3. Nooit één enkele hand alleen aan de tafel. Wie over teamenergie spreekt en
   één hand in beeld brengt, spreekt zichzelf tegen. Er zijn altijd twee paar
   handen, met één paar scherp op de voorgrond en één paar zachter aan de
   overzijde.
4. In elke film waar mensen voorkomen, leest minstens één paar handen
   vrouwelijk. Geen quotum, maar consistentie met wat het platform verkoopt.
   Handen zijn ook duidelijk onder de vijftig: geen sterk doorlopen huid, geen
   uitgesproken aders.

## Wat dat betekent voor de bestaande films

- De platformfilm bevat uitsluitend schermopnames van het platform. Er komt
  geen mens in beeld en de regels zijn hier niet van toepassing.
- De film over Human Due Diligence toont een lege bestuurskamer, van de eerste
  tot de laatste seconde. Die leegte is inhoudelijk: de film gaat over het
  moment voor de beslissing, wanneer de mensen nog niet aan tafel zitten. Er
  komt bewust niemand in beeld en dat blijft zo.
- Leadership & Team Energy en Recruitment & Role Fit tonen wel mensen. Beide
  films zijn op 28 augustus 2026 op deze regels gezet: het tweede gefilmde
  fragment is in elke film vervangen door een opname met twee paar handen, met
  een vrouwelijke hand op de voorgrond, zonder das en zonder oudere hand.

## Praktisch

De gefilmde fragmenten per film staan in `reeks/montage.py`, in de tabel
`BEELDEN`: openingsbeeld, tweede fragment en het rapportbeeld onder de
slotoverlay. Een fragment vervangen betekent dus één regel in die tabel
wijzigen en de montage opnieuw laten lopen per taal.

De gesproken tekst, de tijdlijn, de muziek en de ondertitels blijven daarbij
ongemoeid, zolang er geen woord verandert. Alleen het beeld wordt opnieuw
gezet. Na de montage werkt `reeks/afwerken.py` de vier bestanden per film af:
de versie met ingebrande ondertitels voor levering, de lichtere webversie voor
`client/public/film/` en het stilstaande openingsbeeld dat de speler toont voor
het spelen.

Let op het openingsbeeld: dat wordt uit het tweede fragment genomen, dus het is
precies het beeld dat een bezoeker als eerste ziet, nog voor er iets speelt.
Wie het fragment vervangt, controleert dus ook dat beeld.
