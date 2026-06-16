#!/usr/bin/env python3
"""Respondent-simulator: genereert realistische, gestuurde main_responses
(A/B/C/D + energieen) per archetype, zodat de echte scoring-engine rijke,
gevarieerde contracten kan bouwen. 'First time right': we sturen alleen de
ruwe antwoorden; alle scores volgen uit de echte engine.
"""
import json, random, sys

blocks = json.load(open('/tmp/blocks_map.json'))

# Per-archetype gewichten: hoe graag kiest deze persoon een construct als
# 'most' (hoog gewicht) of vermijdt het (laag/negatief -> vaker 'least').
# En een energie-bias per construct (-2..+2), die bepaalt of het construct
# energie geeft of kost.

# Constructen per familie
DRIVERS = ['Be Perfect', 'Be Strong', 'Hurry Up', 'Please Others', 'Try Hard']
FOCI = ['Innovatie', 'Inter-relationeel', 'Operationeel', 'Strategie', 'TaPas-Beeld']
VERSN = ['Analyse', 'Coaching', 'Constructief onderscheidend', 'Faciliteren', 'Impact', 'Resultaatgericht']


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def pick_most_least(items, weights, rng):
    """Kies most = hoogste gewogen construct, least = laagste, met ruis."""
    scored = []
    for it in items:
        w = weights.get(it['construct'], 0.0) + rng.uniform(-0.6, 0.6)
        scored.append((w, it))
    scored.sort(key=lambda t: t[0], reverse=True)
    most = scored[0][1]
    least = scored[-1][1]
    return most, least


def energy_for(construct, energy_bias, rng):
    """Item/blok-energie -2..+2, gestuurd door bias + ruis, afgerond op int."""
    base = energy_bias.get(construct, 0.0)
    val = base + rng.uniform(-0.7, 0.7)
    return int(round(clamp(val, -2, 2)))


def simulate(archetype, seed):
    rng = random.Random(seed)
    weights = archetype['weights']
    ebias = archetype['energy']
    resp = {}
    for b in blocks:
        key = 'B' + str(b['idx'])
        most_it, least_it = pick_most_least(b['items'], weights, rng)
        if b['energyMode'] == 'item':
            item_e_most = energy_for(most_it['construct'], ebias, rng)
            item_e_least = energy_for(least_it['construct'], ebias, rng)
            resp[key] = {
                'most': most_it['pos'],
                'least': least_it['pos'],
                'itemEnergy': {'most': item_e_most, 'least': item_e_least},
                'blockEnergy': None,
            }
        else:
            # block-energie: gemiddelde van de getoonde constructen-bias
            cons = [it['construct'] for it in b['items']]
            avg_bias = sum(ebias.get(c, 0.0) for c in cons) / len(cons)
            be = int(round(clamp(avg_bias + rng.uniform(-0.7, 0.7), -2, 2)))
            resp[key] = {
                'most': most_it['pos'],
                'least': least_it['pos'],
                'itemEnergy': {'most': None, 'least': None},
                'blockEnergy': be,
            }
    return resp


# ---------------------------------------------------------------------------
# Archetypes. weights = neiging om als 'most' gekozen te worden.
# energy = energiebias (geeft +, kost -).
# ---------------------------------------------------------------------------

# Marc Debisschop (uit zijn echte T4P-profiel):
# Be Perfect dominant (+6, kost), Try Hard (+4, geeft), Please Others (-1, kost),
# Be Strong (-3, kost), Hurry Up (-6, neutraal).
# Foci: Inter-relationeel & Operationeel (geeft), Innovatie & Strategie (neutraal).
# Versnellers: Analyse (+5, geeft sterk), Coaching (+4, geeft), Impact (+1, geeft),
# Constructief onderscheidend (-3 maar geeft), Faciliteren (-3 maar geeft),
# Resultaatgericht (-4 maar geeft).
MARC = {
    'name': 'Marc Debisschop',
    'weights': {
        'Be Perfect': 2.6, 'Try Hard': 1.6, 'Please Others': -0.4,
        'Be Strong': -1.2, 'Hurry Up': -2.6,
        'Innovatie': 0.6, 'Inter-relationeel': 1.0, 'Operationeel': 1.0,
        'Strategie': 0.5, 'TaPas-Beeld': 0.0,
        'Analyse': 2.2, 'Coaching': 1.7, 'Impact': 0.4,
        'Constructief onderscheidend': -1.2, 'Faciliteren': -1.2, 'Resultaatgericht': -1.6,
    },
    'energy': {
        'Be Perfect': -0.83, 'Try Hard': 0.75, 'Please Others': -1.0,
        'Be Strong': -1.0, 'Hurry Up': -0.17,
        'Innovatie': 0.0, 'Inter-relationeel': 0.8, 'Operationeel': 0.7,
        'Strategie': 0.2, 'TaPas-Beeld': 0.0,
        'Analyse': 0.78, 'Coaching': 0.5, 'Impact': 0.44,
        'Constructief onderscheidend': 0.70, 'Faciliteren': 0.60, 'Resultaatgericht': 0.88,
    },
    'baseline': 2,        # beleefde startenergie 2/10
    'connection': {'q1': 9, 'q2': 1, 'q3': 10, 'q4': 0},  # psych 9, billijk 1, zelf 10, org 0
}

# Diverse andere archetypes voor een levendige galerij/dashboards.
ARCHETYPES = {
    'verbinder': {   # mensgericht, coachend, hoge energie
        'weights': {'Please Others': 2.0, 'Try Hard': 1.4, 'Be Perfect': 0.2,
                    'Be Strong': -0.8, 'Hurry Up': -1.4,
                    'Inter-relationeel': 2.2, 'Innovatie': 0.6, 'Strategie': 0.3,
                    'Operationeel': 0.4, 'TaPas-Beeld': 0.0,
                    'Coaching': 2.2, 'Faciliteren': 1.8, 'Impact': 0.8,
                    'Analyse': -0.6, 'Resultaatgericht': -0.4, 'Constructief onderscheidend': -0.6},
        'energy': {'Please Others': 0.6, 'Try Hard': 0.9, 'Be Perfect': -0.4,
                   'Be Strong': -0.6, 'Hurry Up': -0.8,
                   'Inter-relationeel': 1.4, 'Coaching': 1.4, 'Faciliteren': 1.2,
                   'Impact': 0.8, 'Innovatie': 0.4, 'Strategie': 0.3,
                   'Operationeel': 0.3, 'Analyse': 0.0, 'Resultaatgericht': 0.2,
                   'Constructief onderscheidend': 0.2, 'TaPas-Beeld': 0.0},
        'baseline': 8, 'connection': {'q1': 8, 'q2': 7, 'q3': 8, 'q4': 7},
    },
    'strateeg': {  # analytisch, strategisch, beheerste energie
        'weights': {'Be Perfect': 1.8, 'Be Strong': 1.2, 'Try Hard': 0.6,
                    'Hurry Up': -0.8, 'Please Others': -1.2,
                    'Strategie': 2.2, 'Innovatie': 1.6, 'Analyse': 2.4,
                    'Inter-relationeel': -0.4, 'Operationeel': 0.2, 'TaPas-Beeld': 0.0,
                    'Impact': 1.0, 'Constructief onderscheidend': 1.2,
                    'Coaching': -0.4, 'Faciliteren': -0.6, 'Resultaatgericht': 1.0},
        'energy': {'Be Perfect': -0.2, 'Be Strong': 0.2, 'Strategie': 1.2,
                   'Analyse': 1.3, 'Innovatie': 1.0, 'Impact': 0.8,
                   'Constructief onderscheidend': 0.7, 'Resultaatgericht': 0.6,
                   'Try Hard': 0.3, 'Hurry Up': -0.5, 'Please Others': -0.6,
                   'Inter-relationeel': 0.0, 'Operationeel': 0.2, 'Coaching': 0.0,
                   'Faciliteren': -0.2, 'TaPas-Beeld': 0.0},
        'baseline': 7, 'connection': {'q1': 7, 'q2': 6, 'q3': 8, 'q4': 6},
    },
    'doener': {  # operationeel, resultaatgericht, tempo
        'weights': {'Hurry Up': 1.8, 'Try Hard': 1.4, 'Be Strong': 1.0,
                    'Be Perfect': 0.4, 'Please Others': -0.6,
                    'Operationeel': 2.2, 'Resultaatgericht': 2.4, 'Impact': 1.4,
                    'Innovatie': 0.2, 'Strategie': -0.4, 'Inter-relationeel': 0.4,
                    'TaPas-Beeld': 0.0, 'Analyse': -0.2, 'Coaching': -0.4,
                    'Constructief onderscheidend': 0.4, 'Faciliteren': 0.2},
        'energy': {'Hurry Up': 0.6, 'Try Hard': 0.8, 'Operationeel': 1.2,
                   'Resultaatgericht': 1.3, 'Impact': 1.0, 'Be Strong': 0.4,
                   'Be Perfect': -0.3, 'Please Others': -0.4, 'Innovatie': 0.3,
                   'Strategie': -0.2, 'Inter-relationeel': 0.3, 'Analyse': -0.2,
                   'Coaching': -0.2, 'Constructief onderscheidend': 0.2,
                   'Faciliteren': 0.2, 'TaPas-Beeld': 0.0},
        'baseline': 8, 'connection': {'q1': 6, 'q2': 6, 'q3': 7, 'q4': 5},
    },
    'vernieuwer': {  # innovatie, impact, energiek-creatief
        'weights': {'Try Hard': 1.6, 'Hurry Up': 0.8, 'Be Perfect': 0.2,
                    'Be Strong': 0.2, 'Please Others': -0.4,
                    'Innovatie': 2.4, 'Impact': 2.0, 'Strategie': 1.2,
                    'Inter-relationeel': 0.6, 'Operationeel': -0.6, 'TaPas-Beeld': 0.0,
                    'Constructief onderscheidend': 1.8, 'Analyse': 0.8,
                    'Coaching': 0.4, 'Resultaatgericht': 0.6, 'Faciliteren': -0.2},
        'energy': {'Innovatie': 1.4, 'Impact': 1.3, 'Strategie': 0.9,
                   'Constructief onderscheidend': 1.0, 'Try Hard': 0.7,
                   'Analyse': 0.5, 'Hurry Up': 0.2, 'Be Perfect': -0.2,
                   'Be Strong': 0.0, 'Please Others': -0.4, 'Inter-relationeel': 0.4,
                   'Operationeel': -0.3, 'Coaching': 0.2, 'Resultaatgericht': 0.3,
                   'Faciliteren': 0.0, 'TaPas-Beeld': 0.0},
        'baseline': 8, 'connection': {'q1': 8, 'q2': 7, 'q3': 9, 'q4': 7},
    },
    'belast': {  # hoge driverbelasting, lage energie, discrepantie -> 'kost'
        'weights': {'Be Perfect': 2.4, 'Hurry Up': 1.8, 'Try Hard': 1.6,
                    'Please Others': 1.2, 'Be Strong': 0.6,
                    'Operationeel': 1.4, 'Resultaatgericht': 1.6, 'Analyse': 0.8,
                    'Innovatie': -0.4, 'Strategie': 0.2, 'Inter-relationeel': 0.2,
                    'TaPas-Beeld': 0.0, 'Impact': 0.2, 'Coaching': -0.2,
                    'Faciliteren': 0.2, 'Constructief onderscheidend': 0.2},
        'energy': {'Be Perfect': -1.2, 'Hurry Up': -1.0, 'Try Hard': -0.6,
                   'Please Others': -1.0, 'Be Strong': -0.8,
                   'Operationeel': -0.6, 'Resultaatgericht': -0.4, 'Analyse': 0.2,
                   'Innovatie': 0.0, 'Strategie': 0.0, 'Inter-relationeel': -0.2,
                   'Impact': 0.0, 'Coaching': 0.0, 'Faciliteren': -0.2,
                   'Constructief onderscheidend': 0.0, 'TaPas-Beeld': 0.0},
        'baseline': 7, 'connection': {'q1': 4, 'q2': 2, 'q3': 6, 'q4': 2},
    },
}


def main():
    # Bouw een plan: welke afname krijgt welk archetype. We lezen het van stdin
    # als JSON {afnameId: archetypeName}. archetypeName 'marc' -> MARC.
    plan = json.load(sys.stdin)
    out = {}
    for afid, arch in plan.items():
        seed = int(afid) * 7919
        if arch == 'marc':
            a = MARC
        else:
            a = ARCHETYPES[arch]
        resp = simulate(a, seed)
        out[afid] = {
            'main_responses': resp,
            'baseline': a['baseline'],
            'connection': a['connection'],
        }
    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == '__main__':
    main()
