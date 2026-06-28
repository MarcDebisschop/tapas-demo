#!/usr/bin/env python3
"""
server/tts.py — Sulafat TTS voor TaPas Platform
Gebruik: python3 server/tts.py "<volledige tekst inclusief Vlaamse prompt>"
Output: mp3-bytes naar stdout

Twee modi (automatisch gekozen):
  1. GEMINI_API_KEY aanwezig → google-genai REST API (Render-compatibel)
     Model: gemini-2.5-flash-preview-tts  |  Stem: Sulafat (Warm, Vlaamse tongval)
  2. Geen GEMINI_API_KEY → pplx interne SDK (sandbox-only fallback)

De Vlaamse prompt-prefix wordt toegevoegd door de aanroeper (routes.ts via VLAAMSE_STEM_PROMPT).
"""

import asyncio
import base64
import os
import struct
import subprocess
import sys


TTS_VOICE = "Sulafat"
# gemini-2.5-flash-preview-tts is goedkoper en snel genoeg voor profieluitleg
TTS_MODEL_GENAI = "gemini-2.5-flash-preview-tts"
TTS_MODEL_PPLX  = "gemini_2_5_pro_tts"


# ---------------------------------------------------------------------------
# Pad 1 — google-genai REST API (werkt op Render met GEMINI_API_KEY)
# ---------------------------------------------------------------------------

def genereer_via_genai(tekst: str) -> bytes:
    """Genereer audio via google-genai library (GEMINI_API_KEY vereist)."""
    from google import genai
    from google.genai import types

    api_key = os.environ["GEMINI_API_KEY"]
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=TTS_MODEL_GENAI,
        contents=tekst,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=TTS_VOICE,
                    )
                )
            ),
        ),
    )

    # De respons bevat ruwe PCM-audio (24 kHz, 16-bit mono)
    audio_data = response.candidates[0].content.parts[0].inline_data.data

    # Converteer PCM naar WAV, dan naar MP3 via ffmpeg
    return pcm_naar_mp3(audio_data, sample_rate=24000, channels=1, sample_width=2)


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
        # ffmpeg niet beschikbaar → retourneer WAV (browser speelt dat ook af)
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
        16,                          # chunk-grootte
        1,                           # PCM
        channels,
        sample_rate,
        sample_rate * channels * sample_width,  # byte rate
        channels * sample_width,     # block align
        sample_width * 8,            # bits per sample
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

    if os.environ.get("GEMINI_API_KEY"):
        sys.stderr.write("[tts] Pad 1: google-genai REST API (Sulafat)\n")
        try:
            audio = genereer_via_genai(tekst)
            sys.stdout.buffer.write(audio)
            sys.exit(0)
        except Exception as e:
            sys.stderr.write(f"[tts] google-genai mislukt: {e}\n")
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
