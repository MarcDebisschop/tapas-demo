#!/usr/bin/env python3
"""
server/tts.py — Sulafat TTS voor TaPas Platform
Gebruik: python3 server/tts.py "<volledige tekst inclusief Vlaamse prompt>"
Output: mp3-bytes naar stdout

Twee modi (automatisch gekozen):
  1. GEMINI_API_KEY aanwezig → Gemini generateContent REST API (Render-compatibel)
     Gebruikt alleen stdlib (urllib, json, struct, subprocess) — geen pip nodig.
     Model: gemini-2.5-flash-preview-tts  |  Stem: Sulafat (Warm, Vlaamse tongval)
  2. Geen GEMINI_API_KEY → pplx interne SDK (sandbox-only fallback)

De Vlaamse prompt-prefix wordt toegevoegd door de aanroeper (routes.ts via VLAAMSE_STEM_PROMPT).
"""

import asyncio
import base64
import json
import os
import struct
import subprocess
import sys
import urllib.request


TTS_VOICE = "Sulafat"
TTS_MODEL_REST  = "gemini-2.5-flash-preview-tts"
TTS_MODEL_PPLX  = "gemini_2_5_pro_tts"

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent?key={key}"
)


# ---------------------------------------------------------------------------
# Pad 1 — Gemini REST API via stdlib urllib (geen pip-afhankelijkheid)
# ---------------------------------------------------------------------------

def genereer_via_rest(tekst: str, api_key: str) -> bytes:
    """Genereer audio via Gemini generateContent REST API."""
    url = GEMINI_API_URL.format(model=TTS_MODEL_REST, key=api_key)

    payload = {
        "contents": [{"parts": [{"text": tekst}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": TTS_VOICE}
                }
            }
        }
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    # Audio zit in candidates[0].content.parts[0].inlineData.data (base64 PCM)
    try:
        inline = body["candidates"][0]["content"]["parts"][0]["inlineData"]
        mime   = inline.get("mimeType", "audio/L16;rate=24000")
        pcm    = base64.b64decode(inline["data"])
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Onverwacht Gemini-antwoord: {e}\n{json.dumps(body)[:400]}")

    # Haal sample rate op uit MIME-type (bv. "audio/L16;rate=24000")
    sample_rate = 24000
    for part in mime.split(";"):
        part = part.strip()
        if part.startswith("rate="):
            try:
                sample_rate = int(part[5:])
            except ValueError:
                pass

    return pcm_naar_mp3(pcm, sample_rate=sample_rate, channels=1, sample_width=2)


def pcm_naar_mp3(pcm: bytes, sample_rate: int = 24000,
                  channels: int = 1, sample_width: int = 2) -> bytes:
    """Converteer ruwe PCM-bytes naar MP3 via ffmpeg."""
    wav = pcm_naar_wav(pcm, sample_rate, channels, sample_width)
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "wav", "-i", "pipe:0",
                "-codec:a", "libmp3lame", "-qscale:a", "2",
                "-f", "mp3", "pipe:1",
            ],
            input=wav,
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg fout: {result.stderr.decode()}")
        return result.stdout
    except FileNotFoundError:
        sys.stderr.write("[tts] ffmpeg niet gevonden, retourneer WAV\n")
        return wav


def pcm_naar_wav(pcm: bytes, sample_rate: int, channels: int,
                  sample_width: int) -> bytes:
    """Omhul ruwe PCM-bytes met een geldige WAV-header."""
    data_size = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,                           # PCM
        channels,
        sample_rate,
        sample_rate * channels * sample_width,
        channels * sample_width,
        sample_width * 8,
        b"data",
        data_size,
    )
    return header + pcm


# ---------------------------------------------------------------------------
# Pad 2 — pplx interne SDK (sandbox-only, geen API-sleutel nodig)
# ---------------------------------------------------------------------------

async def genereer_via_pplx(tekst: str) -> bytes:
    from pplx.python.sdks.llm_api import (
        AudioGenParams,
        Client,
        Conversation,
        Identity,
        LLMAPIClient,
        MediaGenParams,
        SamplingParams,
    )

    client = LLMAPIClient()
    convo = Conversation()
    convo.set_single_audio_prompt(tekst)

    result = await client.messages.create(
        model=TTS_MODEL_PPLX,
        convo=convo,
        identity=Identity(client=Client.ASI, use_case="webserver_audio_gen"),
        sampling_params=SamplingParams(max_tokens=1),
        media_gen_params=MediaGenParams(
            audio=AudioGenParams(voice="sulafat", output_format="mp3_44100_128"),
        ),
    )

    if not result.audios:
        raise RuntimeError("Geen audio gegenereerd via pplx SDK")
    return base64.b64decode(result.audios[0].b64_data)


# ---------------------------------------------------------------------------
# Hoofdprogramma
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Gebruik: python3 tts.py '<tekst>'\n")
        sys.exit(1)

    tekst = sys.argv[1]
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if api_key:
        sys.stderr.write("[tts] Pad 1: Gemini REST API (Sulafat, geen pip vereist)\n")
        try:
            audio = genereer_via_rest(tekst, api_key)
            sys.stdout.buffer.write(audio)
            sys.exit(0)
        except Exception as e:
            sys.stderr.write(f"[tts] REST API mislukt: {e}\n")
            sys.exit(1)
    else:
        sys.stderr.write("[tts] Pad 2: pplx interne SDK (sandbox)\n")
        try:
            audio = asyncio.run(genereer_via_pplx(tekst))
            sys.stdout.buffer.write(audio)
            sys.exit(0)
        except Exception as e:
            sys.stderr.write(f"[tts] pplx SDK mislukt: {e}\n")
            sys.exit(1)
