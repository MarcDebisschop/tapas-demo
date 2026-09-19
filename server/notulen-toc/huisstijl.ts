// ---------------------------------------------------------------------------
// server/notulen-toc/huisstijl.ts  -  NIEUW BESTAND
//
// De TaPasCity-huisstijl voor Word-documenten van het Team of Captains, als
// bouwstenen boven de docx-bibliotheek. Eén plaats voor kleur, letter, marge en
// tabelvorm, zodat het vaste verslagmodel en een omgezet verslag er identiek
// uitzien. Wie hier een kleur wijzigt, wijzigt beide documenten tegelijk.
//
// De maten staan in de eenheden die Word zelf gebruikt: tabelbreedtes en marges
// in twintigsten van een punt (dxa), lettergroottes in halve punten. Een A4 is
// 11906 bij 16838 dxa; met een marge van 1134 (twee centimeter) blijft er 9638
// aan tekstbreedte over. Die 9638 is de som waar elke kolombreedte op uitkomt.
// ---------------------------------------------------------------------------
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
} from "docx";
import { TAPASCITY_LOCKUP_PNG_BASE64 } from "./logo";

// ---------------------------------------------------------------------------
// Kleuren en letters van de huisstijl.
// ---------------------------------------------------------------------------
export const INK = "111418";
export const TERRA = "C25A34";
export const BONE = "F2EDE4";
export const GREY = "6E6A66";
export const LIGHT = "D8D2C8";
export const STREEP = "FAF7F2";

export const HEAD_FONT = "Trebuchet MS";
export const BODY_FONT = "Calibri";

const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1134;
export const CONTENT_W = PAGE_W - 2 * MARGIN; // 9638

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const hair = { style: BorderStyle.SINGLE, size: 2, color: LIGHT } as const;
const hairBorders = { top: hair, bottom: hair, left: hair, right: hair } as const;

// ---------------------------------------------------------------------------
// Bouwstenen voor lopende tekst.
// ---------------------------------------------------------------------------
export interface TekstOpties {
  after?: number;
  size?: number;
  color?: string;
  bold?: boolean;
  italics?: boolean;
}

export function body(text: string, opts: TekstOpties = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 130, line: 276 },
    children: [
      new TextRun({
        text,
        font: BODY_FONT,
        size: opts.size ?? 21,
        color: opts.color ?? INK,
        bold: !!opts.bold,
        italics: !!opts.italics,
      }),
    ],
  });
}

export interface RijkeLoop {
  t: string;
  b?: boolean;
  i?: boolean;
  color?: string;
  size?: number;
  font?: string;
}

export function rich(runs: RijkeLoop[], opts: TekstOpties = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 130, line: 276 },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.t,
          font: r.font ?? BODY_FONT,
          size: r.size ?? 21,
          color: r.color ?? INK,
          bold: !!r.b,
          italics: !!r.i,
        }),
    ),
  });
}

/** Grijze cursieve invulhulp. Staat in het model, niet in een afgewerkt verslag. */
export function hint(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 160, line: 264 },
    children: [new TextRun({ text, font: BODY_FONT, size: 18, color: GREY, italics: true })],
  });
}

export function bullet(text: string, opts: TekstOpties = {}): Paragraph {
  return new Paragraph({
    numbering: { reference: "toc-bullets", level: 0 },
    spacing: { after: 70, line: 276 },
    children: [
      new TextRun({
        text,
        font: BODY_FONT,
        size: 21,
        color: opts.color ?? INK,
        italics: !!opts.italics,
      }),
    ],
  });
}

export function h1(nummer: string, text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 380, after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: TERRA, space: 6 } },
    children: [
      new TextRun({ text: `${nummer}  `, font: HEAD_FONT, size: 26, bold: true, color: TERRA }),
      new TextRun({ text, font: HEAD_FONT, size: 26, bold: true, color: INK }),
    ],
  });
}

export function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 90 },
    children: [new TextRun({ text, font: HEAD_FONT, size: 22, bold: true, color: INK })],
  });
}

/** Klein terracotta kapitaaltje boven een blok: STAND VAN ZAKEN, BESPREKING. */
export function label(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: HEAD_FONT,
        size: 16,
        bold: true,
        color: TERRA,
        characterSpacing: 24,
      }),
    ],
  });
}

/** Besluitkader: bone vlak met een terracotta accentbalk links. */
export function callout(lines: string[], opts: { kop?: string; fill?: string; accent?: string } = {}): Table {
  const kop = opts.kop ?? "Besluit";
  const kids: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: kop.toUpperCase(),
          font: HEAD_FONT,
          size: 15,
          bold: true,
          color: TERRA,
          characterSpacing: 24,
        }),
      ],
    }),
    ...lines.map(
      (l, i) =>
        new Paragraph({
          spacing: { after: i === lines.length - 1 ? 0 : 60, line: 264 },
          children: [new TextRun({ text: l, font: BODY_FONT, size: 20, color: INK })],
        }),
    ),
  ];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: opts.fill ?? BONE, type: ShadingType.CLEAR },
            borders: {
              top: noBorder,
              bottom: noBorder,
              right: noBorder,
              left: { style: BorderStyle.SINGLE, size: 18, color: opts.accent ?? TERRA },
            },
            margins: { top: 150, bottom: 150, left: 220, right: 200 },
            children: kids,
          }),
        ],
      }),
    ],
  });
}

/** Discrete stippellijn om met de hand op papier in te vullen. */
export function fillLine(n = 2): Paragraph[] {
  const out: Paragraph[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      new Paragraph({
        spacing: { after: 90, line: 276 },
        border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: LIGHT, space: 3 } },
        children: [new TextRun({ text: "", font: BODY_FONT, size: 21 })],
      }),
    );
  }
  return out;
}

export function spacer(h = 160): Paragraph {
  return new Paragraph({ spacing: { after: h }, children: [new TextRun({ text: "" })] });
}

// ---------------------------------------------------------------------------
// Tabellen.
// ---------------------------------------------------------------------------
export interface TabelOpties {
  size?: number;
  placeholder?: boolean;
  boldFirst?: boolean;
}

/** Tabel met kopregel in ink en licht gestreepte rijen. */
export function table(
  headers: string[],
  rows: string[][],
  widths: number[],
  opts: TabelOpties = {},
): Table {
  const total = widths.reduce((a, b) => a + b, 0);
  const headRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (hTxt, i) =>
        new TableCell({
          width: { size: widths[i], type: WidthType.DXA },
          shading: { fill: INK, type: ShadingType.CLEAR },
          borders: hairBorders,
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { after: 0 },
              children: [new TextRun({ text: hTxt, font: HEAD_FONT, size: 17, bold: true, color: "FFFFFF" })],
            }),
          ],
        }),
    ),
  });
  const bodyRows = rows.map(
    (r, ri) =>
      new TableRow({
        children: r.map(
          (cell, i) =>
            new TableCell({
              width: { size: widths[i], type: WidthType.DXA },
              shading: { fill: ri % 2 === 1 ? STREEP : "FFFFFF", type: ShadingType.CLEAR },
              borders: hairBorders,
              margins: { top: 90, bottom: 90, left: 120, right: 120 },
              verticalAlign: VerticalAlign.TOP,
              children: String(cell ?? "").split("\n").map(
                (line, li, arr) =>
                  new Paragraph({
                    spacing: { after: li === arr.length - 1 ? 0 : 50, line: 264 },
                    children: [
                      new TextRun({
                        text: line,
                        font: BODY_FONT,
                        size: opts.size ?? 19,
                        color: opts.placeholder ? GREY : INK,
                        italics: !!opts.placeholder,
                        bold: i === 0 && !!opts.boldFirst,
                      }),
                    ],
                  }),
              ),
            }),
        ),
      }),
  );
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headRow, ...bodyRows],
  });
}

export interface MetaWaarde {
  text: string;
  placeholder?: boolean;
}

/** Kerngegevens: tweekolomsblok zonder kopregel. */
export function metaTable(pairs: Array<[string, string | MetaWaarde]>): Table {
  const w = [2750, CONTENT_W - 2750];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: w,
    rows: pairs.map(([k, v]) => {
      const waarde: MetaWaarde = typeof v === "string" ? { text: v } : v;
      return new TableRow({
        children: [
          new TableCell({
            width: { size: w[0], type: WidthType.DXA },
            shading: { fill: BONE, type: ShadingType.CLEAR },
            borders: { top: hair, bottom: hair, left: noBorder, right: hair },
            margins: { top: 80, bottom: 80, left: 140, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: k, font: HEAD_FONT, size: 17, bold: true, color: INK })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w[1], type: WidthType.DXA },
            shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
            borders: { top: hair, bottom: hair, left: hair, right: noBorder },
            margins: { top: 80, bottom: 80, left: 140, right: 120 },
            children: waarde.text.split("\n").map(
              (line, li, arr) =>
                new Paragraph({
                  spacing: { after: li === arr.length - 1 ? 0 : 40, line: 264 },
                  children: [
                    new TextRun({
                      text: line,
                      font: BODY_FONT,
                      size: 19,
                      color: waarde.placeholder ? GREY : INK,
                      italics: !!waarde.placeholder,
                    }),
                  ],
                }),
            ),
          }),
        ],
      });
    }),
  });
}

/** Titelblok bovenaan pagina één. */
export function titleBlock(opts: { kicker: string; title: string; subtitle: string }): Table {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: BONE, type: ShadingType.CLEAR },
            borders: {
              top: noBorder,
              left: noBorder,
              right: noBorder,
              bottom: { style: BorderStyle.SINGLE, size: 18, color: TERRA },
            },
            margins: { top: 280, bottom: 280, left: 260, right: 260 },
            children: [
              new Paragraph({
                spacing: { after: 100 },
                children: [
                  new TextRun({
                    text: opts.kicker.toUpperCase(),
                    font: HEAD_FONT,
                    size: 16,
                    bold: true,
                    color: TERRA,
                    characterSpacing: 40,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 90 },
                children: [new TextRun({ text: opts.title, font: HEAD_FONT, size: 40, bold: true, color: INK })],
              }),
              new Paragraph({
                spacing: { after: 0 },
                children: [new TextRun({ text: opts.subtitle, font: BODY_FONT, size: 23, color: "3A3733" })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Het merk bovenaan pagina één, op plaatsingsmaat 188 bij 48 punten. */
export function logoParagraph(): Paragraph {
  return new Paragraph({
    spacing: { after: 240 },
    children: [
      new ImageRun({
        type: "png",
        data: Buffer.from(TAPASCITY_LOCKUP_PNG_BASE64, "base64"),
        transformation: { width: 188, height: 48 },
        altText: {
          title: "TaPasCity",
          description: "TaPasCity logo met baseline Talent runs on Passion",
          name: "tapascity-logo",
        },
      }),
    ],
  });
}

/** De baseline als slotregel van het document. */
export function baseline(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: "Talent runs on Passion", font: HEAD_FONT, size: 20, bold: true, color: TERRA }),
    ],
  });
}

export type Blok = Paragraph | Table;

/**
 * Zet de bouwstenen om in een volledig Word-document en levert het als buffer.
 * De opbouw van pagina, hoofding en voetregel staat hier en nergens anders.
 */
export async function buildDoc(opts: {
  docTitle: string;
  headerRight: string;
  footerLeft: string;
  children: Blok[];
}): Promise<Buffer> {
  const doc = new Document({
    creator: "TaPasCity",
    title: opts.docTitle,
    description: opts.headerRight,
    styles: {
      default: { document: { run: { font: BODY_FONT, size: 21, color: INK } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: HEAD_FONT, color: INK },
          paragraph: { spacing: { before: 380, after: 40 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 22, bold: true, font: HEAD_FONT, color: INK },
          paragraph: { spacing: { before: 280, after: 90 }, outlineLevel: 1 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "toc-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 340, hanging: 200 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: 1000, right: MARGIN, bottom: 900, left: MARGIN, header: 560, footer: 480 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
                spacing: { after: 60 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT, space: 4 } },
                children: [
                  new TextRun({ text: "TaPasCity", font: HEAD_FONT, size: 16, bold: true, color: INK }),
                  new TextRun({
                    text: "\u2009\u2022\u2009Team of Captains",
                    font: HEAD_FONT,
                    size: 16,
                    color: GREY,
                  }),
                  new TextRun({ text: "\t" }),
                  new TextRun({ text: opts.headerRight, font: HEAD_FONT, size: 16, color: GREY }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: LIGHT, space: 6 } },
                spacing: { before: 60 },
                children: [
                  new TextRun({ text: opts.footerLeft, font: BODY_FONT, size: 15, color: GREY }),
                  new TextRun({ text: "\t" }),
                  new TextRun({ text: "Pagina ", font: BODY_FONT, size: 15, color: GREY }),
                  new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 15, color: GREY }),
                  new TextRun({ text: " van ", font: BODY_FONT, size: 15, color: GREY }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: BODY_FONT, size: 15, color: GREY }),
                ],
              }),
            ],
          }),
        },
        children: opts.children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** Paginaovergang, als los blok bruikbaar in een lijst met kinderen. */
export function pageBreak(): Paragraph {
  const opties: IParagraphOptions = { children: [], pageBreakBefore: true };
  return new Paragraph(opties);
}
