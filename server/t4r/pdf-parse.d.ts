// Minimale type-declaratie voor de directe submodule-import van pdf-parse
// (we importeren "pdf-parse/lib/pdf-parse.js" om de debug-modus te vermijden die
// het package-indexbestand activeert wanneer module.parent ontbreekt).
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFInfo {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFInfo>;
  export default pdfParse;
}
