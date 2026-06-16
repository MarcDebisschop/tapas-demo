"""
RECRUITER-VARIANT fallback-teksten (T4Recruitment chatbot, geen LLM).

Leeshulp bij de vergelijkende match-studie voor de recruiter/coach.
  'crisis'   = discriminatie / onrechtmatig criterium  -> duidelijke weigering;
  'kritisch' = beslis-/selectie-/rangschikkingsvraag    -> neemt oordeel niet over;
  normaal    = helpt het rapport lezen (afstemming, aandachtspunten, energie).
"Driver"/"Drivers" (naar Taibi Kahler) blijft onvertaald.
"""

FALLBACK_RECRUITER = {
    "nl": {
        "crisis": (
            "Daar kan en mag ik niet op ingaan: kenmerken zoals leeftijd, geslacht, "
            "afkomst, geloof of gezondheid mogen geen rol spelen in een selectie, en deze "
            "studie doet daar geen uitspraak over. Bespreek dit met de verantwoordelijke "
            "recruiter of een juridisch/HR-expert. [[COACH]]"
        ),
        "kritisch": (
            "Die beslissing neem ik niet — deze studie is richtinggevend, niet beslissend. "
            "Ik kan je wel helpen lezen wat het rapport toont: de afstemming op de "
            "functievereisten, de aandachtspunten en het energiebeeld. Het oordeel blijft "
            "bij de stakeholders; bespreek het samen met de begeleidende coach. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Wat de studie laat zien, is dit: {kern}. Wil je dat ik een specifiek onderdeel "
            "verder toelicht — de afstemming op de kern, de aandachtspunten of het "
            "energiebeeld?"
        ),
        "normaal_zonder_ctx": (
            "Ik help je graag het eindrapport lezen: de afstemming tussen de "
            "functievereisten en het profiel, de aandachtspunten en het energiebeeld. "
            "Welk onderdeel wil je eerst bekijken?"
        ),
        "zorg_extra": (
            " Let op: de studie bevat enkele aandachtssignalen die je het best in een "
            "persoonlijk gesprek verder uitdiept."
        ),
    },
    "fr": {
        "crisis": (
            "Je ne peux pas entrer dans cela : des critères comme l'âge, le sexe, "
            "l'origine, la religion ou la santé ne doivent jouer aucun rôle dans une "
            "sélection, et cette étude ne s'y prononce pas. Aborde ce point avec le "
            "recruteur responsable ou un expert juridique/RH. [[COACH]]"
        ),
        "kritisch": (
            "Je ne prends pas cette décision — cette étude est indicative, pas "
            "décisionnelle. Je peux t'aider à lire ce que montre le rapport : l'adéquation "
            "aux exigences du poste, les points d'attention et l'image énergétique. La "
            "décision reste aux parties prenantes ; discutes-en avec le coach. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Ce que l'étude montre, c'est ceci : {kern}. Veux-tu que je détaille un élément "
            "précis — l'adéquation au cœur, les points d'attention ou l'image énergétique ?"
        ),
        "normaal_zonder_ctx": (
            "Je t'aide volontiers à lire le rapport final : l'adéquation entre les "
            "exigences du poste et le profil, les points d'attention et l'image "
            "énergétique. Quel élément veux-tu regarder en premier ?"
        ),
        "zorg_extra": (
            " Attention : l'étude contient quelques signaux d'attention à approfondir de "
            "préférence lors d'un entretien."
        ),
    },
    "en": {
        "crisis": (
            "I can't go into that: characteristics like age, gender, origin, religion or "
            "health must play no role in a selection, and this study makes no statement "
            "about them. Please discuss this with the responsible recruiter or a legal/HR "
            "expert. [[COACH]]"
        ),
        "kritisch": (
            "I won't make that decision — this study is indicative, not decisive. I can "
            "help you read what the report shows: the fit with the role requirements, the "
            "points of attention and the energy picture. The judgement stays with the "
            "stakeholders; discuss it together with the coach. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "What the study shows is this: {kern}. Would you like me to explain a specific "
            "element further — the fit on the core, the points of attention or the energy "
            "picture?"
        ),
        "normaal_zonder_ctx": (
            "I'm happy to help you read the final report: the fit between the role "
            "requirements and the profile, the points of attention and the energy picture. "
            "Which element would you like to look at first?"
        ),
        "zorg_extra": (
            " Note: the study contains a few attention signals best deepened in a personal "
            "conversation."
        ),
    },
    "es": {
        "crisis": (
            "No puedo entrar en eso: características como la edad, el sexo, el origen, la "
            "religión o la salud no deben influir en una selección, y este estudio no se "
            "pronuncia sobre ellas. Coméntalo con el reclutador responsable o un experto "
            "jurídico/RR. HH. [[COACH]]"
        ),
        "kritisch": (
            "No tomo esa decisión — este estudio es orientativo, no decisorio. Sí puedo "
            "ayudarte a leer lo que muestra el informe: el ajuste a los requisitos del "
            "puesto, los puntos de atención y la imagen energética. El juicio queda en las "
            "partes interesadas; coméntalo junto al coach. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Lo que el estudio muestra es esto: {kern}. ¿Quieres que detalle un elemento "
            "concreto — el ajuste al núcleo, los puntos de atención o la imagen energética?"
        ),
        "normaal_zonder_ctx": (
            "Con gusto te ayudo a leer el informe final: el ajuste entre los requisitos del "
            "puesto y el perfil, los puntos de atención y la imagen energética. ¿Qué "
            "elemento quieres ver primero?"
        ),
        "zorg_extra": (
            " Atención: el estudio contiene algunas señales de atención que conviene "
            "profundizar en una conversación personal."
        ),
    },
    "ru": {
        "crisis": (
            "Я не могу это обсуждать: такие признаки, как возраст, пол, происхождение, "
            "религия или здоровье, не должны играть роль в отборе, и это исследование о "
            "них не высказывается. Обсудите это с ответственным рекрутером или "
            "юристом/HR-экспертом. [[COACH]]"
        ),
        "kritisch": (
            "Я не принимаю это решение — исследование ориентировочное, а не решающее. Я "
            "могу помочь прочитать то, что показывает отчёт: соответствие требованиям "
            "должности, точки внимания и энергетическую картину. Решение остаётся за "
            "заинтересованными сторонами; обсудите его вместе с коучем. [[COACH]]"
        ),
        "normaal_met_ctx": (
            "Вот что показывает исследование: {kern}. Хотите, чтобы я подробнее пояснил "
            "конкретный элемент — соответствие по ядру, точки внимания или энергетическую "
            "картину?"
        ),
        "normaal_zonder_ctx": (
            "С удовольствием помогу прочитать итоговый отчёт: соответствие между "
            "требованиями должности и профилем, точки внимания и энергетическую картину. "
            "С какого элемента начнём?"
        ),
        "zorg_extra": (
            " Обратите внимание: исследование содержит несколько сигналов внимания, "
            "которые лучше углубить в личной беседе."
        ),
    },
}
