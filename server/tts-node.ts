// =============================================================================
// server/tts-node.ts - Vlaamse Sulafat-stem, native in Node (geen python3)
//
// Aangemaakt: 2026-07-28 (R42 - Node-TTS).
// Reden (feitelijk vastgesteld): op de Render-service `tapas-demo` (runtime:
// node) is `python3` niet betrouwbaar aanwezig in de draaiende container.
// Daardoor faalde spawn("python3", [dist/tts.py]) in ~30 ms zonder ook maar
// een enkele [tts]-stderr-regel, en gaf /api/tts telkens HTTP 500 "TTS mislukt".
//
// Deze module port Pad 1 van server/tts.py (Gemini generateContent REST ->
// base64 PCM -> WAV) naar pure Node. Geen python3, geen ffmpeg, geen pip.
// De browser speelt WAV rechtstreeks af.
// =============================================================================

const TTS_VOICE = "Sulafat";

// Probeer eerst het preview-model, dan de stabiele alias (zelfde volgorde als tts.py).
const TTS_MODELS_REST = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-flash-tts",
];

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

// -----------------------------------------------------------------------------
// WAV-header rond ruwe PCM-bytes (16-bit, standaard mono).
// Produceert een geldige 44-byte RIFF/WAVE-header + data.
// -----------------------------------------------------------------------------
export function pcmNaarWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  sampleWidth = 2,
): Buffer {
  const dataSize = pcm.length;
  const byteRate = sampleRate * channels * sampleWidth;
  const blockAlign = channels * sampleWidth;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // sub-chunk grootte
  header.writeUInt16LE(1, 20); // audioformaat = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(sampleWidth * 8, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

// -----------------------------------------------------------------------------
// Eén model proberen via Gemini generateContent REST.
// -----------------------------------------------------------------------------
async function genereerViaRestModel(
  tekst: string,
  apiKey: string,
  model: string,
): Promise<Buffer> {
  const url = GEMINI_API_URL.replace("{model}", model);

  const payload = {
    contents: [{ parts: [{ text: tekst }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: TTS_VOICE },
        },
      },
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    let melding = `HTTP ${resp.status}`;
    try {
      const errJson: any = await resp.json();
      const m = errJson?.error?.message ?? "";
      const s = errJson?.error?.status ?? "";
      melding = `HTTP ${resp.status} ${s}: ${m}`.trim();
    } catch {
      try {
        melding = `HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`;
      } catch {
        /* laat melding op statuscode staan */
      }
    }
    throw new Error(melding);
  }

  const body: any = await resp.json();

  let inline: any;
  try {
    inline = body.candidates[0].content.parts[0].inlineData;
  } catch {
    throw new Error(
      `Onverwacht Gemini-antwoord: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }

  const mime: string = inline?.mimeType ?? "audio/L16;rate=24000";
  const pcm = Buffer.from(inline.data, "base64");

  // Samplerate uit MIME halen (bv "audio/L16;codec=pcm;rate=24000").
  let sampleRate = 24000;
  for (const deel of mime.split(";")) {
    const d = deel.trim();
    if (d.startsWith("rate=")) {
      const n = parseInt(d.slice(5), 10);
      if (!Number.isNaN(n)) sampleRate = n;
    }
  }

  console.error(
    `[tts] PCM ontvangen: ${pcm.length} bytes, samplerate=${sampleRate}`,
  );
  return pcmNaarWav(pcm, sampleRate, 1, 2);
}

// -----------------------------------------------------------------------------
// Hoofdfunctie: probeer de modellen in volgorde. Gooit een Error als alles faalt.
// Retourneert WAV-bytes (Content-Type audio/wav).
// -----------------------------------------------------------------------------
export async function genereerSpraak(tekst: string): Promise<Buffer> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  console.error(`[tts] Tekstlengte: ${tekst.length} tekens`);

  if (!apiKey) {
    console.error(
      "[tts] WAARSCHUWING: GEMINI_API_KEY ontbreekt of is leeg - de Vlaamse " +
        "Sulafat-stem werkt niet. Zet GEMINI_API_KEY (AIza...) in het " +
        "Render-dashboard op de service tapas-demo (tabblad Environment).",
    );
    throw new Error("GEMINI_API_KEY ontbreekt of is leeg");
  }

  console.error(`[tts] API key aanwezig: ${apiKey.slice(0, 8)}...`);

  let laatsteFout: Error | null = null;
  for (const model of TTS_MODELS_REST) {
    console.error(`[tts] Probeer model: ${model}`);
    try {
      return await genereerViaRestModel(tekst, apiKey, model);
    } catch (e: any) {
      console.error(`[tts] Model ${model} mislukt: ${e?.message ?? e}`);
      laatsteFout = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw laatsteFout ?? new Error("TTS mislukt: geen model beschikbaar");
}
