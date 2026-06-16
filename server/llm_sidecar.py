"""
TaPas Platform — LLM sidecar (Fase 2 chatbot met zorg-kompas).

Een kleine, op zichzelf staande Python-service die de profielgebonden chatbot
afhandelt via de Perplexity LLM-API (gRPC SDK). De Node/Express-hoofdserver
proxyt /api/dashboard/:token/chat hiernaartoe.

Waarom een aparte service?
- De LLM-credentials worden in deze omgeving via de Python-SDK opgepikt; de
  Node-runtime krijgt geen OPENAI_API_KEY. Door de chat in Python te draaien,
  werkt de echte AI-chatbot meteen in de preview/demo.
- De provider is bewust geïsoleerd achter één functie (_get_client). Later, voor
  productie met een eigen sleutel, hoeft enkel die laag te wijzigen.

Zorg-kompas (ethische beslissingslaag) — drie lagen:
  A. Profielsignalen (door Node berekend uit het contract en meegestuurd):
     drivers in energieverlies, negatief TaPas-beeld, lage herkenbaarheid/energie
     → de assistent is extra voorzichtig en stuurt warm naar een coach.
  B. Live inhoudsdetectie per vraag: kritische/persoonlijke thema's (mentaal
     welzijn, relaties, verlies, werkstress die te zwaar wordt, ...) → geen
     AI-"diagnose", maar een warme doorverwijzing naar een coach.
  C. Veiligheidsnet: acute nood/crisis → stop de gewone chat, toon coach +
     hulplijn-info.
De assistent positioneert zich als reflectiehulp bij het profiel, NOOIT als
therapeut of diagnose-instrument. "Driver" (naar Taibi Kahler) blijft in elke
taal onvertaald.

Endpoint:
  POST /chat  {
    taal: "nl"|"fr"|"en"|"es"|"ru",
    profiel_context: str,           # mensvriendelijke samenvatting v/h profiel
    risico: {                       # laag A — signalen uit het contract
        niveau: "geen"|"verhoogd"|"hoog",
        redenen: [str, ...],
    },
    messages: [{role, content}],    # gespreksgeschiedenis + nieuwe vraag
    model?: str,
  }
  -> {reply: str, veiligheid: "coach"|null}   of  {error: str}
"""
import os
import re
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from pplx.python.sdks.llm_api import client as llm
from pplx.python.sdks.llm_api import types as t

from server.llm_fallback import fallback_reply
from server.llm_prompts_recruiter import PROMPT_RECRUITER as _PROMPT_RECRUITER

app = FastAPI()

# De gRPC-client moet op dezelfde event loop leven als de request. We maken hem
# daarom lui aan binnen de actieve loop en hergebruiken hem nadien.
_client = None
_identity = t.Identity(client=t.Client.AI_API, use_case="tapas_dashboard_chat")


def _get_client():
    global _client
    if _client is None:
        _client = llm.LLMAPIClient()
    return _client


DEFAULT_MODEL = os.environ.get("TAPAS_CHAT_MODEL", "gpt_5_1")


# ---------------------------------------------------------------------------
# Zorg-kompas — laag C: detectie van acute nood (veiligheidsnet).
# Bewust breed maar conservatief: bij twijfel verwijst de assistent sowieso
# warm door (laag B), dus dit net vangt enkel de zwaarste signalen op.
# ---------------------------------------------------------------------------
_CRISIS_PATRONEN = {
    "nl": [r"\b(zelfmoord|zelfdoding|niet meer leven|er niet meer wil zijn|een eind aan|mezelf iets aandoen|suïcid)\w*",
           r"(uitzichtloos|wanhopig|kan niet meer|niet meer aankan|niet meer zie zitten|zie het niet meer zitten|zie geen uitweg|geen uitweg|wil er niet meer zijn|alles opgeven|alles op te geven|het opgeven|geef het op|er helemaal doorheen|helemaal kapot|leeg vanbinnen)"],
    "fr": [r"\b(suicide|me suicider|en finir|plus envie de vivre|me faire du mal)\w*",
           r"(désespéré|je n'?en peux plus|aucune issue|plus d'?issue|tout abandonner|tout laisser tomber|à bout|au bout du rouleau|envie de tout arrêter|je craque|je m'?effondre)"],
    "en": [r"\b(suicid|kill myself|end my life|don'?t want to live|harm myself|self.?harm)\w*",
           r"(hopeless|can'?t go on|can'?t take it anymore|no way out|give up on everything|giving up|want to give up|at breaking point|completely broken|falling apart|empty inside)"],
    "es": [r"\b(suicid|quitarme la vida|acabar con todo|no quiero vivir|hacerme daño)\w*",
           r"(desesperado|no puedo más|sin salida|ninguna salida|rendirme|darme por vencido|al límite|me derrumbo|me hundo|vacío por dentro)"],
    "ru": [r"(самоуб|покончить с собой|не хочу жить|причинить себе вред)",
           r"(безнадёжн|безнадежн|не могу больше|нет выхода|сдаюсь|опустил руки|на пределе|разваливаюсь|пустота внутри)"],
}

# Laag B: persoonlijke/kritische thema's die te zwaar zijn voor losse AI-antwoorden.
_KRITISCH_PATRONEN = {
    "nl": [r"(depress|burn.?out|opgebrand|uitgeput|uitgeblust|overspannen|overprikkeld|angst|paniek|trauma|rouw|verlies van|scheiding|verslav|misbruik|eenzaam|huilen|niet meer slapen|slaap niet meer|overweldig|geen energie meer|leeg gevoel|het zwaar|zwaar mee|psychisch|mentaal kapot|stress mij|overstuur)\w*"],
    "fr": [r"(dépress|burn.?out|épuis|anxi|panique|trauma|deuil|divorce|addic|abus|seul|pleur|insomni|submerg|surmen|vidé|à plat|stress me|effondr|mal.?être|détresse)\w*"],
    "en": [r"(depress|burn.?out|burned out|exhaust|anxiet|panic|trauma|grief|loss of|divorce|addict|abuse|lonely|crying|can'?t sleep|overwhelm|drained|empty|stressed out|distress|mentally)\w*"],
    "es": [r"(depresi|agotad|quemad|exhaust|ansiedad|pánico|trauma|duelo|pérdida de|divorcio|adicci|abuso|solo|llorar|no puedo dormir|abrumad|vacío|estresad|angustia|malestar)\w*"],
    "ru": [r"(депресс|выгоран|истощ|тревог|паник|травм|горе|потеря|развод|зависим|злоупотреб|одинок|плач|не могу спать|перегруз|опустош|стресс|подавлен|тяжело на душе)"],
}

# ---------------------------------------------------------------------------
# RECRUITER-VARIANT zorg-kompas (T4Recruitment).
#
# Hier is de "zorg" niet klinisch maar SELECTIE-ETHISCH. De assistent is een
# leeshulp bij het eindrapport (de vergelijkende studie). Hij weigert
# consequent geschiktheids-, aanwervings- en rangschikkingsuitspraken.
#
#  Laag B (recruiter) — een beslis-/selectie-/rangschikkingsvraag: de
#    assistent neemt het oordeel NIET over, herformuleert naar wat de studie
#    toont en verwijst naar de stakeholders/procesbegeleider.
#  Laag C (recruiter) — discriminatie/onrechtmatigheid (beoordelen op leeftijd,
#    geslacht, herkomst, geloof, gezondheid, ...): duidelijke weigering +
#    verwijzing naar de verantwoordelijke recruiter/jurist.
# ---------------------------------------------------------------------------
_RECRUITER_BESLIS_PATRONEN = {
    "nl": [r"(moet ik (hem|haar|deze|de kandidaat)|zal ik (hem|haar|deze)|aanwerven|aannemen|aanstellen|rekruteren|in dienst nemen|geschikt|niet geschikt|de juiste|de beste kandidaat|beter dan|slechter dan|rangschik|ranglijst|wie kies|welke kandidaat|afwijzen of|doorgaan of niet|score.*kandidaat|cijfer.*kandidaat|zou jij (hem|haar|deze))"],
    "fr": [r"(dois-je (l'|le|la)|vais-je (l'|le|la)|embaucher|recruter|engager|recruter|apte|inapte|le bon|la bonne|le meilleur candidat|meilleur que|moins bon que|classe|classement|qui choisir|quel candidat|rejeter ou|continuer ou|noter.*candidat|recommanderais-tu)"],
    "en": [r"(should i (hire|pick|choose|reject)|will i hire|hire (him|her|them|this)|suitable|not suitable|the right (one|candidate|fit)|the best candidate|better than|worse than|rank|ranking|who (should i|to) (pick|choose)|which candidate|reject or|score.*candidate|rate.*candidate|would you (hire|pick|recommend))"],
    "es": [r"(debo (contratar|elegir|rechazar)|voy a contratar|contratar a|apto|no apto|el adecuado|la adecuada|el mejor candidato|mejor que|peor que|clasific|ranking|a quién elijo|qué candidato|rechazar o|puntu.*candidato|recomendarías (contratar|elegir))"],
    "ru": [r"(стоит ли (нанимать|выбрать|отклонить)|нанять (его|её|их|этого)|подходит|не подходит|лучший кандидат|лучше чем|хуже чем|ранжир|рейтинг|кого выбрать|какого кандидата|отклонить или|оценить кандидата|порекомендуешь (нанять|выбрать))"],
}
_RECRUITER_DISCRIMINATIE_PATRONEN = {
    "nl": [r"(leeftijd|te oud|te jong|geslacht|man of vrouw|zwanger|kinderwens|afkomst|nationaliteit|huidskleur|religie|geloof|gehandicapt|handicap|ziekte|gezondheid|seksuele|holebi|etni)\w*"],
    "fr": [r"(âge|trop (vieux|âgé|jeune)|sexe|homme ou femme|enceinte|origine|nationalité|couleur de peau|religion|handicap|maladie|santé|orientation sexuelle|ethni)\w*"],
    "en": [r"(\bage\b|too old|too young|gender|male or female|pregnan|ethnic|nationality|skin colou?r|religion|disab|illness|health condition|sexual orientation)\w*"],
    "es": [r"(edad|demasiado (viejo|mayor|joven)|sexo|hombre o mujer|embaraz|origen|nacionalidad|color de piel|religión|discapacid|enfermedad|salud|orientación sexual|etni)\w*"],
    "ru": [r"(возраст|слишком (стар|молод)|пол\b|мужчина или женщина|беремен|происхожден|национальн|цвет кожи|религи|инвалид|болезн|здоровь|сексуальн|этнич)"],
}


def _detecteer_niveau(tekst: str, taal: str) -> str:
    """Geeft 'crisis', 'kritisch' of 'normaal' terug op basis van de inhoud."""
    laag = (tekst or "").lower()
    for pat in _CRISIS_PATRONEN.get(taal, _CRISIS_PATRONEN["en"]):
        if re.search(pat, laag, re.IGNORECASE):
            return "crisis"
    for pat in _KRITISCH_PATRONEN.get(taal, _KRITISCH_PATRONEN["en"]):
        if re.search(pat, laag, re.IGNORECASE):
            return "kritisch"
    return "normaal"


def _detecteer_niveau_recruiter(tekst: str, taal: str) -> str:
    """Recruiter-variant. Geeft 'crisis' (discriminatie/onrechtmatig),
    'kritisch' (beslis-/selectie-/rangschikkingsvraag) of 'normaal'.

    De namen 'crisis'/'kritisch' worden hergebruikt zodat de bestaande
    _bouw_systeemprompt-flow (laag_c/laag_b) en de veiligheidsmarkering
    ongewijzigd blijven; de INHOUD per laag verschilt via _PROMPT_RECRUITER."""
    laag = (tekst or "").lower()
    for pat in _RECRUITER_DISCRIMINATIE_PATRONEN.get(taal, _RECRUITER_DISCRIMINATIE_PATRONEN["en"]):
        if re.search(pat, laag, re.IGNORECASE):
            return "crisis"
    for pat in _RECRUITER_BESLIS_PATRONEN.get(taal, _RECRUITER_BESLIS_PATRONEN["en"]):
        if re.search(pat, laag, re.IGNORECASE):
            return "kritisch"
    return "normaal"


# ---------------------------------------------------------------------------
# Meertalige systeemprompt. Eén basistekst per taal; profielcontext, risico-
# signalen en de zorg-instructies worden ingevoegd. "Driver" blijft onvertaald.
# ---------------------------------------------------------------------------
_PROMPT = {
    "nl": {
        "rol": (
            "Je bent de persoonlijke profielassistent van het TaPas-platform. Je helpt "
            "deze persoon zijn eigen professionele profiel beter te begrijpen en erover te "
            "reflecteren. Je spreekt warm, rustig, concreet en in de tweede persoon (je/jij). "
            "Je geeft korte, behapbare antwoorden (max ~5 zinnen) en stelt soms één "
            "verdiepende reflectievraag terug."
        ),
        "grenzen": (
            "Belangrijke grenzen: je bent een reflectiehulp, GEEN therapeut, arts of "
            "diagnose-instrument. Je stelt nooit een psychologische of medische diagnose en "
            "doet geen uitspraken over geschiktheid, selectie of potentieel. Je blijft bij wat "
            "in het profiel staat en bij algemene, ondersteunende reflectie."
        ),
        "driver": (
            "De term 'Driver' (naar Taibi Kahler) is een vaste vakterm en wordt NOOIT vertaald "
            "of omschreven met een ander woord. Schrijf altijd 'Driver' / 'Drivers'."
        ),
        "geen_intern": (
            "Gebruik geen interne systeem- of modelbenamingen. Spreek in gewone, menselijke taal "
            "over het profiel."
        ),
        "profiel_kop": "Dit is het profiel van de persoon met wie je praat:",
        "risico_kop": "Aandachtssignalen uit het profiel (intern, niet letterlijk benoemen):",
        "zorg_verhoogd": (
            "Dit profiel toont aandachtspunten (bv. Drivers die in energieverlies staan of een "
            "minder positief zelfbeeld). Wees extra zorgzaam en mild. Als het gesprek richting "
            "iets persoonlijks of zwaars gaat, normaliseer het, en verwijs warm naar een "
            "professionele coach voor een echt gesprek."
        ),
        "laag_b": (
            "De persoon raakt aan een persoonlijk of gevoelig thema. Geef GEEN analyse of "
            "diagnose. Erken kort en warm wat je hoort, benadruk dat dit te belangrijk is om "
            "alleen met een chatbot te bespreken, en verwijs naar de dichtstbijzijnde coach. "
            "Zet [[COACH]] aan het einde van je antwoord."
        ),
        "laag_c": (
            "Dit klinkt als acute nood. Reageer kort, warm en zonder oordeel. Zeg duidelijk dat "
            "je een AI bent en hier niet de juiste hulp voor kunt geven, en dat een mens dat wel "
            "kan. Verwijs naadloos naar een coach én naar professionele hulp/een hulplijn. Geef "
            "geen reflectie-oefeningen. Zet [[COACH]] aan het einde van je antwoord."
        ),
    },
    "fr": {
        "rol": (
            "Tu es l'assistant de profil personnel de la plateforme TaPas. Tu aides cette "
            "personne à mieux comprendre son propre profil professionnel et à y réfléchir. Tu "
            "parles avec chaleur, calme et concrétude, à la deuxième personne (tu). Tes réponses "
            "sont courtes (max ~5 phrases) et tu poses parfois une question de réflexion."
        ),
        "grenzen": (
            "Limites importantes : tu es une aide à la réflexion, PAS un thérapeute, un médecin "
            "ni un outil de diagnostic. Tu ne poses jamais de diagnostic et ne te prononces pas "
            "sur l'aptitude, la sélection ou le potentiel. Tu restes sur le contenu du profil et "
            "une réflexion générale et bienveillante."
        ),
        "driver": (
            "Le terme « Driver » (d'après Taibi Kahler) est un terme technique fixe et n'est "
            "JAMAIS traduit. Écris toujours « Driver » / « Drivers »."
        ),
        "geen_intern": (
            "N'utilise aucune dénomination interne de système ou de modèle. Parle du profil dans "
            "un langage simple et humain."
        ),
        "profiel_kop": "Voici le profil de la personne avec qui tu parles :",
        "risico_kop": "Signaux d'attention issus du profil (internes, à ne pas citer mot à mot) :",
        "zorg_verhoogd": (
            "Ce profil montre des points d'attention (p. ex. des Drivers en perte d'énergie ou "
            "une image de soi moins positive). Sois particulièrement attentionné et doux. Si la "
            "conversation devient personnelle ou lourde, dédramatise et oriente chaleureusement "
            "vers un coach professionnel."
        ),
        "laag_b": (
            "La personne aborde un thème personnel ou sensible. Ne donne AUCUNE analyse ni "
            "diagnostic. Reconnais brièvement et chaleureusement, souligne que c'est trop "
            "important pour en parler seulement avec un chatbot, et oriente vers le coach le plus "
            "proche. Termine ta réponse par [[COACH]]."
        ),
        "laag_c": (
            "Cela ressemble à une détresse aiguë. Réponds brièvement, avec chaleur et sans juger. "
            "Dis clairement que tu es une IA et que tu ne peux pas offrir l'aide appropriée, mais "
            "qu'un humain le peut. Oriente vers un coach ET vers une aide professionnelle / une "
            "ligne d'écoute. Pas d'exercices de réflexion. Termine par [[COACH]]."
        ),
    },
    "en": {
        "rol": (
            "You are the personal profile assistant of the TaPas platform. You help this person "
            "better understand and reflect on their own professional profile. You speak warmly, "
            "calmly and concretely, in the second person (you). You give short, digestible "
            "answers (max ~5 sentences) and sometimes ask one deepening reflection question back."
        ),
        "grenzen": (
            "Important boundaries: you are a reflection aid, NOT a therapist, doctor or "
            "diagnostic tool. You never give a psychological or medical diagnosis and make no "
            "claims about suitability, selection or potential. You stay with what is in the "
            "profile and with general, supportive reflection."
        ),
        "driver": (
            "The term 'Driver' (after Taibi Kahler) is a fixed technical term and is NEVER "
            "translated or paraphrased. Always write 'Driver' / 'Drivers'."
        ),
        "geen_intern": (
            "Do not use any internal system or model names. Speak about the profile in plain, "
            "human language."
        ),
        "profiel_kop": "This is the profile of the person you are talking to:",
        "risico_kop": "Attention signals from the profile (internal, do not quote verbatim):",
        "zorg_verhoogd": (
            "This profile shows points of attention (e.g. Drivers in energy loss or a less "
            "positive self-image). Be extra caring and gentle. If the conversation turns personal "
            "or heavy, normalise it and warmly refer to a professional coach for a real conversation."
        ),
        "laag_b": (
            "The person is touching a personal or sensitive theme. Give NO analysis or diagnosis. "
            "Briefly and warmly acknowledge what you hear, stress that this is too important to "
            "discuss only with a chatbot, and refer to the nearest coach. Put [[COACH]] at the "
            "end of your answer."
        ),
        "laag_c": (
            "This sounds like acute distress. Respond briefly, warmly and without judgement. Make "
            "clear you are an AI and cannot provide the right help here, but a human can. Refer "
            "seamlessly to a coach AND to professional help / a helpline. Give no reflection "
            "exercises. Put [[COACH]] at the end of your answer."
        ),
    },
    "es": {
        "rol": (
            "Eres el asistente de perfil personal de la plataforma TaPas. Ayudas a esta persona a "
            "comprender y reflexionar mejor sobre su propio perfil profesional. Hablas con "
            "calidez, calma y concreción, en segunda persona (tú). Das respuestas cortas (máx. "
            "~5 frases) y a veces devuelves una pregunta de reflexión."
        ),
        "grenzen": (
            "Límites importantes: eres una ayuda para la reflexión, NO un terapeuta, médico ni "
            "herramienta de diagnóstico. Nunca das un diagnóstico ni te pronuncias sobre "
            "idoneidad, selección o potencial. Te ciñes a lo que dice el perfil y a una reflexión "
            "general y de apoyo."
        ),
        "driver": (
            "El término «Driver» (según Taibi Kahler) es un término técnico fijo y NUNCA se "
            "traduce ni se parafrasea. Escribe siempre «Driver» / «Drivers»."
        ),
        "geen_intern": (
            "No uses denominaciones internas de sistema o de modelo. Habla del perfil en un "
            "lenguaje sencillo y humano."
        ),
        "profiel_kop": "Este es el perfil de la persona con la que hablas:",
        "risico_kop": "Señales de atención del perfil (internas, no citar literalmente):",
        "zorg_verhoogd": (
            "Este perfil muestra puntos de atención (p. ej. Drivers en pérdida de energía o una "
            "imagen de sí mismo menos positiva). Sé especialmente cuidadoso y suave. Si la "
            "conversación se vuelve personal o pesada, normalízalo y deriva con calidez a un "
            "coach profesional."
        ),
        "laag_b": (
            "La persona toca un tema personal o sensible. NO des análisis ni diagnóstico. "
            "Reconoce breve y cálidamente lo que escuchas, subraya que esto es demasiado "
            "importante para hablarlo solo con un chatbot y deriva al coach más cercano. Pon "
            "[[COACH]] al final de tu respuesta."
        ),
        "laag_c": (
            "Esto suena a angustia aguda. Responde breve, cálido y sin juzgar. Deja claro que "
            "eres una IA y no puedes dar la ayuda adecuada aquí, pero una persona sí. Deriva sin "
            "fisuras a un coach Y a ayuda profesional / una línea de ayuda. Sin ejercicios de "
            "reflexión. Pon [[COACH]] al final."
        ),
    },
    "ru": {
        "rol": (
            "Ты — персональный ассистент профиля платформы TaPas. Ты помогаешь человеку лучше "
            "понять свой профессиональный профиль и поразмышлять над ним. Ты говоришь тепло, "
            "спокойно и конкретно, на «ты». Ответы короткие (макс. ~5 предложений), иногда ты "
            "задаёшь один уточняющий вопрос для размышления."
        ),
        "grenzen": (
            "Важные границы: ты — помощник для размышления, а НЕ терапевт, врач или "
            "диагностический инструмент. Ты никогда не ставишь диагноз и не делаешь выводов о "
            "пригодности, отборе или потенциале. Ты опираешься на содержание профиля и на общую, "
            "поддерживающую рефлексию."
        ),
        "driver": (
            "Термин «Driver» (по Taibi Kahler) — это устойчивый профессиональный термин, который "
            "НИКОГДА не переводится и не заменяется. Всегда пиши «Driver» / «Drivers»."
        ),
        "geen_intern": (
            "Не используй внутренние системные или модельные названия. Говори о профиле простым, "
            "человеческим языком."
        ),
        "profiel_kop": "Это профиль человека, с которым ты разговариваешь:",
        "risico_kop": "Сигналы внимания из профиля (внутренние, не цитировать дословно):",
        "zorg_verhoogd": (
            "Этот профиль показывает моменты, требующие внимания (например, Drivers в потере "
            "энергии или менее позитивный образ себя). Будь особенно заботливым и мягким. Если "
            "разговор становится личным или тяжёлым, нормализуй это и тепло направь к "
            "профессиональному коучу."
        ),
        "laag_b": (
            "Человек затрагивает личную или чувствительную тему. НЕ давай анализа или диагноза. "
            "Коротко и тепло признай услышанное, подчеркни, что это слишком важно, чтобы обсуждать "
            "только с чат-ботом, и направь к ближайшему коучу. Поставь [[COACH]] в конце ответа."
        ),
        "laag_c": (
            "Это похоже на острое бедствие. Ответь кратко, тепло и без осуждения. Ясно скажи, что "
            "ты ИИ и не можешь оказать здесь нужную помощь, а человек может. Направь к коучу И к "
            "профессиональной помощи / на линию доверия. Без упражнений на рефлексию. Поставь "
            "[[COACH]] в конце."
        ),
    },
}


def _bouw_systeemprompt(taal: str, profiel_context: str, risico: Dict[str, Any], live_niveau: str, variant: str = "deelnemer") -> str:
    promptset = _PROMPT_RECRUITER if variant == "recruiter" else _PROMPT
    p = promptset.get(taal, promptset["en"])
    delen = [p["rol"], p["grenzen"], p["driver"], p["geen_intern"]]

    ctx = (profiel_context or "").strip()
    if ctx:
        delen.append(f"{p['profiel_kop']}\n{ctx}")

    redenen = (risico or {}).get("redenen") or []
    niveau = (risico or {}).get("niveau") or "geen"
    if redenen:
        delen.append(f"{p['risico_kop']} " + "; ".join(redenen))
    if niveau in ("verhoogd", "hoog"):
        delen.append(p["zorg_verhoogd"])

    # Live laag B/C op basis van de inhoud van de huidige vraag.
    if live_niveau == "crisis":
        delen.append(p["laag_c"])
    elif live_niveau == "kritisch":
        delen.append(p["laag_b"])

    return "\n\n".join(delen)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    taal: str = "nl"
    profiel_context: str = ""
    risico: Optional[Dict[str, Any]] = None
    model: Optional[str] = None
    variant: str = "deelnemer"  # "deelnemer" (Kompas) of "recruiter" (T4Recruitment)


def _to_message(m: ChatMessage) -> t.Message:
    role = t.Role.USER if m.role == "user" else t.Role.ASSISTANT
    return t.Message(role=role, content=[t.TextBlock(type="text", text=m.content)])


def _extract_text(event) -> str:
    parts = []
    for block in (event.content or []):
        txt = getattr(block, "text", None)
        if txt:
            parts.append(txt)
    return "".join(parts).strip()


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        taal = req.taal if req.taal in _PROMPT else "nl"

        # Laatste gebruikersvraag bepalen voor live zorg-detectie (laag B/C).
        laatste_vraag = ""
        for m in reversed(req.messages):
            if m.role == "user":
                laatste_vraag = m.content
                break
        variant = "recruiter" if req.variant == "recruiter" else "deelnemer"
        if variant == "recruiter":
            live_niveau = _detecteer_niveau_recruiter(laatste_vraag, taal)
        else:
            live_niveau = _detecteer_niveau(laatste_vraag, taal)

        systeem = _bouw_systeemprompt(taal, req.profiel_context, req.risico or {}, live_niveau, variant)

        bron = "model"
        reply = ""
        try:
            convo = t.Conversation(
                messages=[_to_message(m) for m in req.messages],
                system=[t.TextBlock(type="text", text=systeem)],
            )
            event = await _get_client().messages.create(
                model=req.model or DEFAULT_MODEL,
                convo=convo,
                identity=_identity,
                sampling_params=t.SamplingParams(max_tokens=700, temperature=0.7),
            )
            reply = _extract_text(event)
        except Exception as llm_err:  # noqa: BLE001
            # Het taalmodel is onbereikbaar (bv. ontbrekende credentials / netwerk).
            # We laten de demo niet stilvallen: de profiel-gebonden reflectiemotor
            # neemt het over, met behoud van de zorg-kompas-logica en "Drivers".
            print(f"[sidecar] LLM onbereikbaar, fallback actief: {type(llm_err).__name__}: {str(llm_err)[:160]}")
            reply = ""
            bron = "fallback"

        if not reply:
            reply = fallback_reply(taal, req.profiel_context, req.risico or {}, live_niveau, variant)
            if bron == "model":
                bron = "fallback"

        # Zorg-markering: het model/fallback zet [[COACH]] of het risiconiveau is verhoogd.
        veiligheid = None
        if "[[COACH]]" in reply or live_niveau in ("crisis", "kritisch"):
            veiligheid = "coach"
        reply = reply.replace("[[COACH]]", "").strip()

        return {"reply": reply, "veiligheid": veiligheid, "bron": bron}
    except Exception as e:  # noqa: BLE001 - laatste vangnet: nog steeds een nette reflectie
        try:
            taal2 = req.taal if req.taal in _PROMPT else "nl"
            reply = fallback_reply(taal2, req.profiel_context, req.risico or {}, "normaal")
            return {"reply": reply, "veiligheid": None, "bron": "fallback"}
        except Exception:
            return JSONResponse({"error": f"{type(e).__name__}: {str(e)[:300]}"}, status_code=502)
