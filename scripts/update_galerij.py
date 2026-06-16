# -*- coding: utf-8 -*-
# Werkt de 'loopbaan-kompas'-tegel om naar 'out-of-the-box':
#  - id -> out-of-the-box (matcht de nieuwe module)
#  - beschikbaar -> true (geen 'Binnenkort'-badge meer)
#  - titel/ondertitel/beschrijving/preview vervangen (geen 'binnenkort/coming soon')
import io
PATH = "server/galerij.ts"
s = io.open(PATH, encoding="utf-8").read()

OUD = '''  {
    id: "loopbaan-kompas",
    thema: "loopbaan",
    duurMin: 15,
    beschikbaar: false,
    titel: {
      nl: "Loopbaan-kompas",
      fr: "Boussole de carri\u00e8re",
      en: "Career compass",
      es: "Br\u00fajula de carrera",
      ru: "\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u0439 \u043a\u043e\u043c\u043f\u0430\u0441",
    },
    ondertitel: {
      nl: "Verbind je talenten met een richting voor de komende jaren",
      fr: "Relie tes talents \u00e0 une direction pour les ann\u00e9es \u00e0 venir",
      en: "Connect your talents to a direction for the years ahead",
      es: "Conecta tus talentos con una direcci\u00f3n para los pr\u00f3ximos a\u00f1os",
      ru: "\u0421\u0432\u044f\u0436\u0438\u0442\u0435 \u0441\u0432\u043e\u0438 \u0442\u0430\u043b\u0430\u043d\u0442\u044b \u0441 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435\u043c \u043d\u0430 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0433\u043e\u0434\u044b",
    },
    beschrijving: {
      nl: "Een breder instrument dat je profiel verbindt met loopbaankeuzes. Binnenkort beschikbaar.",
      fr: "Un instrument plus large reliant ton profil \u00e0 tes choix de carri\u00e8re. Bient\u00f4t disponible.",
      en: "A broader instrument linking your profile to career choices. Coming soon.",
      es: "Un instrumento m\u00e1s amplio que conecta tu perfil con decisiones de carrera. Pr\u00f3ximamente.",
      ru: "\u0411\u043e\u043b\u0435\u0435 \u0448\u0438\u0440\u043e\u043a\u0438\u0439 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442, \u0441\u0432\u044f\u0437\u044b\u0432\u0430\u044e\u0449\u0438\u0439 \u0432\u0430\u0448 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u0441 \u043a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u043c\u0438 \u0440\u0435\u0448\u0435\u043d\u0438\u044f\u043c\u0438. \u0421\u043a\u043e\u0440\u043e.",
    },
    preview: {
      nl: ["Welke rol zou je energie geven over drie jaar?", "Wat wil je zeker behouden in je werk?"],
      fr: ["Quel r\u00f4le te donnerait de l'\u00e9nergie dans trois ans ?", "Que veux-tu absolument garder dans ton travail ?"],
      en: ["Which role would energise you three years from now?", "What do you definitely want to keep in your work?"],
      es: ["\u00bfQu\u00e9 rol te dar\u00eda energ\u00eda dentro de tres a\u00f1os?", "\u00bfQu\u00e9 quieres conservar s\u00ed o s\u00ed en tu trabajo?"],
      ru: ["\u041a\u0430\u043a\u0430\u044f \u0440\u043e\u043b\u044c \u0437\u0430\u0440\u044f\u0434\u0438\u043b\u0430 \u0431\u044b \u0432\u0430\u0441 \u0447\u0435\u0440\u0435\u0437 \u0442\u0440\u0438 \u0433\u043e\u0434\u0430?", "\u0427\u0442\u043e \u0432\u044b \u0442\u043e\u0447\u043d\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0432 \u0441\u0432\u043e\u0435\u0439 \u0440\u0430\u0431\u043e\u0442\u0435?"],
    },
  },'''

NIEUW = '''  {
    id: "out-of-the-box",
    thema: "loopbaan",
    duurMin: 14,
    beschikbaar: true,
    titel: {
      nl: "Out-of-the-box: je onbenutte ruimte",
      fr: "Out-of-the-box\u00a0: ton espace inexploit\u00e9",
      en: "Out-of-the-box: your untapped room",
      es: "Out-of-the-box: tu espacio sin explotar",
      ru: "Out-of-the-box: \u0432\u0430\u0448 \u043d\u0435\u0440\u0430\u0441\u043a\u0440\u044b\u0442\u044b\u0439 \u043f\u043e\u0442\u0435\u043d\u0446\u0438\u0430\u043b",
    },
    ondertitel: {
      nl: "Waar je talent ruimer reikt dan je huidige context",
      fr: "L\u00e0 o\u00f9 ton talent va plus loin que ton contexte actuel",
      en: "Where your talent reaches beyond your current context",
      es: "Donde tu talento llega m\u00e1s lejos que tu contexto actual",
      ru: "\u0413\u0434\u0435 \u0432\u0430\u0448 \u0442\u0430\u043b\u0430\u043d\u0442 \u0432\u044b\u0445\u043e\u0434\u0438\u0442 \u0437\u0430 \u0440\u0430\u043c\u043a\u0438 \u043d\u044b\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430",
    },
    beschrijving: {
      nl: "Je profiel laat zien dat je talent ruimer reikt dan de context waarin je nu actief bent. Dit deel schetst drie out-of-the-box-richtingen \u2014 puur als uitnodiging om te onderzoeken, geen voorspelling.",
      fr: "Ton profil montre que ton talent va plus loin que ton contexte actuel. Cette partie esquisse trois directions out-of-the-box \u2014 une invitation \u00e0 explorer, pas une pr\u00e9diction.",
      en: "Your profile shows your talent reaches beyond your current context. This part sketches three out-of-the-box directions \u2014 an invitation to explore, not a prediction.",
      es: "Tu perfil muestra que tu talento llega m\u00e1s lejos que tu contexto actual. Esta parte esboza tres direcciones out-of-the-box \u2014 una invitaci\u00f3n a explorar, no una predicci\u00f3n.",
      ru: "\u0412\u0430\u0448 \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442, \u0447\u0442\u043e \u0432\u0430\u0448 \u0442\u0430\u043b\u0430\u043d\u0442 \u0432\u044b\u0445\u043e\u0434\u0438\u0442 \u0437\u0430 \u0440\u0430\u043c\u043a\u0438 \u043d\u044b\u043d\u0435\u0448\u043d\u0435\u0433\u043e \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u0430. \u0417\u0434\u0435\u0441\u044c \u2014 \u0442\u0440\u0438 out-of-the-box-\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f, \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435 \u0438\u0441\u0441\u043b\u0435\u0434\u043e\u0432\u0430\u0442\u044c, \u0430 \u043d\u0435 \u043f\u0440\u043e\u0433\u043d\u043e\u0437.",
    },
    preview: {
      nl: ["Drie richtingen waarin je talent n\u00f3g meer kan renderen", "Waarover zou je je stem laten horen als je niet elk detail moest bewaken?"],
      fr: ["Trois directions o\u00f9 ton talent peut rendre encore plus", "Sur quoi ferais-tu entendre ta voix sans veiller \u00e0 chaque d\u00e9tail ?"],
      en: ["Three directions where your talent can render even more", "What would you speak up about if you didn't guard every detail?"],
      es: ["Tres direcciones donde tu talento puede rendir a\u00fan m\u00e1s", "\u00bfSobre qu\u00e9 alzar\u00edas la voz si no vigilaras cada detalle?"],
      ru: ["\u0422\u0440\u0438 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f, \u0433\u0434\u0435 \u0432\u0430\u0448 \u0442\u0430\u043b\u0430\u043d\u0442 \u0440\u0430\u0441\u043a\u0440\u043e\u0435\u0442\u0441\u044f \u0441\u0438\u043b\u044c\u043d\u0435\u0435", "\u041e \u0447\u0451\u043c \u0431\u044b \u0432\u044b \u0437\u0430\u0433\u043e\u0432\u043e\u0440\u0438\u043b\u0438, \u043d\u0435 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u0438\u0440\u0443\u044f \u043a\u0430\u0436\u0434\u0443\u044e \u0434\u0435\u0442\u0430\u043b\u044c?"],
    },
  },'''

assert s.count(OUD) == 1, "loopbaan-kompas tegelblok niet exact/uniek gevonden"
s = s.replace(OUD, NIEUW, 1)
io.open(PATH, "w", encoding="utf-8").write(s)
print("OK galerij.ts bijgewerkt")
