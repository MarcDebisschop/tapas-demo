"""
TaPas Platform — demo-reflectiemotor (fallback voor de LLM-sidecar).

Wanneer het taalmodel onbereikbaar is (bv. ontbrekende credentials in de
sandbox of een netwerkstoring) mag de chatbot NIET stilvallen tijdens een demo.
Deze motor geeft dan een veilige, profiel-gebonden reflectie terug die:
  - de zorg-kompas-logica respecteert (laag B/C -> warme coach-verwijzing met [[COACH]]);
  - put uit de meegestuurde profielcontext;
  - "Driver"/"Drivers" (naar Taibi Kahler) onvertaald laat;
  - in alle vijf de talen werkt.
Zodra de echte LLM weer bereikbaar is, wordt deze motor automatisch overgeslagen.
"""
import re
from typing import Dict, Any

from server.llm_fallback_recruiter import FALLBACK_RECRUITER as _FALLBACK_RECRUITER


_FALLBACK = {
    "nl": {
        "crisis": (
            "Dank je dat je dit deelt — dit klinkt zwaar, en ik wil je hier niet mee "
            "alleen laten. Ik ben maar een hulpmiddel en kan je hier niet de juiste "
            "zorg geven; een mens wel. Neem alsjeblieft contact op met een coach in je "
            "buurt, en bij acute nood met een professionele hulplijn. Je verdient een "
            "echt gesprek. [[COACH]]"
        ),
        "kritisch": (
            "Dank je dat je dit aanraakt — dit zijn echte, persoonlijke signalen die "
            "een echt gesprek verdienen, meer dan ik via deze weg kan bieden. Ik raad "
            "je aan om hierover rustig met een coach in je buurt te praten. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Op basis van je profiel zie ik dit terugkomen: {kern}. Een goede manier om "
            "hierop te reflecteren is om één concrete situatie van afgelopen week te "
            "nemen en te kijken waar je energie kreeg en waar ze wegliep. Welke situatie "
            "komt als eerste bij je op?"
        ),
        "normaal_zonder_ctx": (
            "Goede vraag. Een fijne manier om je profiel te lezen is om te kijken naar "
            "wat je energie geeft en wat ze kost, en daar je sterke talentfoci en je "
            "Drivers naast te leggen. Over welk deel van je profiel wil je het eerst "
            "hebben?"
        ),
        "zorg_extra": (
            " Ik merk in je profiel ook een paar aandachtspunten; als het ergens "
            "persoonlijk of zwaar wordt, weet dan dat een coach in je buurt daar rustig "
            "met je naar kan kijken."
        ),
    },
    "fr": {
        "crisis": (
            "Merci de partager cela — cela semble lourd, et je ne veux pas te laisser "
            "seul·e avec ça. Je ne suis qu'un outil et je ne peux pas t'offrir l'aide "
            "adaptée ; un humain le peut. Contacte s'il te plaît un coach près de chez "
            "toi, et en cas de détresse aiguë une ligne d'écoute professionnelle. Tu "
            "mérites une vraie conversation. [[COACH]]"
        ),
        "kritisch": (
            "Merci d'aborder cela — ce sont de vrais signaux personnels qui méritent une "
            "vraie conversation, plus que ce que je peux offrir par ce biais. Je te "
            "conseille d'en parler calmement avec un coach près de chez toi. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "D'après ton profil, je vois revenir ceci : {kern}. Une bonne façon d'y "
            "réfléchir est de prendre une situation concrète de la semaine passée et de "
            "repérer où tu as gagné de l'énergie et où elle s'est dissipée. Quelle "
            "situation te vient en premier ?"
        ),
        "normaal_zonder_ctx": (
            "Bonne question. Une belle façon de lire ton profil est de regarder ce qui te "
            "donne de l'énergie et ce qui t'en coûte, puis de mettre cela en regard de "
            "tes points forts et de tes Drivers. De quelle partie de ton profil veux-tu "
            "parler d'abord ?"
        ),
        "zorg_extra": (
            " Je remarque aussi quelques points d'attention dans ton profil ; si cela "
            "devient personnel ou lourd, sache qu'un coach près de chez toi peut "
            "l'examiner calmement avec toi."
        ),
    },
    "en": {
        "crisis": (
            "Thank you for sharing this — it sounds heavy, and I don't want to leave you "
            "alone with it. I'm only a tool and can't give you the right care here; a "
            "human can. Please reach out to a coach near you, and in acute distress to a "
            "professional helpline. You deserve a real conversation. [[COACH]]"
        ),
        "kritisch": (
            "Thank you for raising this — these are real, personal signals that deserve a "
            "real conversation, more than I can offer this way. I'd encourage you to talk "
            "it through calmly with a coach near you. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Based on your profile I see this coming up: {kern}. A good way to reflect on "
            "it is to take one concrete situation from the past week and notice where you "
            "gained energy and where it drained away. Which situation comes to mind first?"
        ),
        "normaal_zonder_ctx": (
            "Good question. A nice way to read your profile is to look at what gives you "
            "energy and what costs you energy, and set that next to your strongest talent "
            "foci and your Drivers. Which part of your profile would you like to start "
            "with?"
        ),
        "zorg_extra": (
            " I also notice a few points of attention in your profile; if anything turns "
            "personal or heavy, know that a coach near you can look at it calmly with you."
        ),
    },
    "es": {
        "crisis": (
            "Gracias por compartir esto — suena pesado, y no quiero dejarte solo·a con "
            "ello. Solo soy una herramienta y no puedo darte el cuidado adecuado aquí; "
            "una persona sí. Por favor contacta con un coach cerca de ti, y en caso de "
            "angustia aguda con una línea de ayuda profesional. Mereces una conversación "
            "de verdad. [[COACH]]"
        ),
        "kritisch": (
            "Gracias por plantear esto — son señales reales y personales que merecen una "
            "conversación de verdad, más de lo que puedo ofrecer por esta vía. Te animo a "
            "hablarlo con calma con un coach cerca de ti. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Según tu perfil veo que esto vuelve a aparecer: {kern}. Una buena forma de "
            "reflexionar es tomar una situación concreta de la semana pasada y observar "
            "dónde ganaste energía y dónde se fue. ¿Qué situación te viene primero?"
        ),
        "normaal_zonder_ctx": (
            "Buena pregunta. Una forma agradable de leer tu perfil es mirar qué te da "
            "energía y qué te la cuesta, y ponerlo junto a tus puntos fuertes y tus "
            "Drivers. ¿De qué parte de tu perfil quieres hablar primero?"
        ),
        "zorg_extra": (
            " También noto algunos puntos de atención en tu perfil; si algo se vuelve "
            "personal o pesado, un coach cerca de ti puede mirarlo con calma contigo."
        ),
    },
    "ru": {
        "crisis": (
            "Спасибо, что поделились этим — звучит тяжело, и я не хочу оставлять вас с "
            "этим наедине. Я всего лишь инструмент и не могу оказать здесь нужную "
            "помощь; человек может. Пожалуйста, обратитесь к коучу рядом с вами, а при "
            "острой необходимости — на профессиональную линию помощи. Вы заслуживаете "
            "настоящего разговора. [[COACH]]"
        ),
        "kritisch": (
            "Спасибо, что подняли это — это настоящие, личные сигналы, которые "
            "заслуживают настоящего разговора, больше, чем я могу дать таким образом. "
            "Советую спокойно обсудить это с коучем рядом с вами. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Судя по вашему профилю, я вижу, что повторяется вот это: {kern}. Хороший "
            "способ поразмышлять — взять одну конкретную ситуацию прошлой недели и "
            "заметить, где вы получали энергию, а где она уходила. Какая ситуация "
            "приходит в голову первой?"
        ),
        "normaal_zonder_ctx": (
            "Хороший вопрос. Удобный способ читать ваш профиль — посмотреть, что даёт вам "
            "энергию, а что её отнимает, и сопоставить это с вашими сильными сторонами и "
            "вашими Drivers. С какой части профиля хотите начать?"
        ),
        "zorg_extra": (
            " Я также замечаю в вашем профиле несколько моментов, требующих внимания; "
            "если что-то станет личным или тяжёлым, знайте, что коуч рядом с вами может "
            "спокойно посмотреть на это вместе с вами."
        ),
    },
}


def _kern_uit_context(profiel_context: str) -> str:
    """Haalt een korte, mensvriendelijke kern uit de profielcontext.
    Behoudt 'Drivers' en vermijdt interne termen (Node levert al een nette,
    door zinnen/puntkomma's gescheiden samenvatting aan)."""
    ctx = (profiel_context or "").strip()
    if not ctx:
        return ""
    stukken = re.split(r"[\n;.]+", ctx)
    stukken = [s.strip() for s in stukken if len(s.strip()) > 8]
    return "; ".join(stukken[:2]) if stukken else ctx[:160]


def fallback_reply(taal: str, profiel_context: str, risico: Dict[str, Any], live_niveau: str, variant: str = "deelnemer") -> str:
    """Genereert een veilig, contextgebonden antwoord zonder LLM.
    variant="recruiter" gebruikt de leeshulp-teksten bij de match-studie."""
    bron = _FALLBACK_RECRUITER if variant == "recruiter" else _FALLBACK
    f = bron.get(taal, bron["en"])
    if live_niveau == "crisis":
        return f["crisis"]
    if live_niveau == "kritisch":
        return f["kritisch"]
    kern = _kern_uit_context(profiel_context)
    if kern:
        antwoord = f["normaal_met_ctx"].format(kern=kern)
    else:
        antwoord = f["normaal_zonder_ctx"]
    niveau = (risico or {}).get("niveau") or "geen"
    if niveau in ("verhoogd", "hoog"):
        antwoord = antwoord + f["zorg_extra"]
    return antwoord
