#!/usr/bin/env python3
"""
server/tts.py — Sulafat TTS voor TaPas Platform
Gebruik: python3 server/tts.py "<volledige tekst inclusief Vlaamse prompt>"
Output: mp3-bytes naar stdout
Stem: sulafat (Gemini 2.5 Pro TTS)
De Vlaamse prompt-prefix wordt toegevoegd door de aanroeper (routes.ts via VLAAMSE_STEM_PROMPT).
"""

import asyncio
import base64
import sys

from pplx.python.sdks.llm_api import (
    AudioGenParams,
    Client,
    Conversation,
    Identity,
    LLMAPIClient,
    MediaGenParams,
    SamplingParams,
)

TTS_VOICE = "sulafat"
TTS_MODEL = "gemini_2_5_pro_tts"
TTS_FORMAT = "mp3_44100_128"


async def genereer(tekst: str) -> bytes:
    client = LLMAPIClient()
    convo = Conversation()
    convo.set_single_audio_prompt(tekst)

    result = await client.messages.create(
        model=TTS_MODEL,
        convo=convo,
        identity=Identity(client=Client.ASI, use_case="webserver_audio_gen"),
        sampling_params=SamplingParams(max_tokens=1),
        media_gen_params=MediaGenParams(
            audio=AudioGenParams(voice=TTS_VOICE, output_format=TTS_FORMAT),
        ),
    )

    if not result.audios:
        raise RuntimeError("Geen audio gegenereerd")
    return base64.b64decode(result.audios[0].b64_data)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Gebruik: python3 tts.py '<tekst>'\n")
        sys.exit(1)

    tekst = sys.argv[1]
    audio = asyncio.run(genereer(tekst))
    sys.stdout.buffer.write(audio)
