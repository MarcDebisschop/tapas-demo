// Validatie-runner: leest een JSON met {responses, baselineEnergy} van stdin/argv
// en print buildMainScores als JSON. Gebruikt door het Python-validatiescript om
// de TS-engine te vergelijken met de originele JS-engine.
import { buildMainScores } from "./scoring";
import { readFileSync } from "node:fs";

const inp = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = buildMainScores(inp.responses, inp.baselineEnergy);
process.stdout.write(JSON.stringify(out));
