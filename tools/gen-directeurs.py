# -*- coding: utf-8 -*-
"""CS Pobè — liste des directeurs (cahier de contrôle DDEMP 2024, même source que l'application MEMP-CP Pobè) :
data/directeurs-pobe.js = { nom normalisé de l'école : « NOM Prénoms » }. Affichée à défaut d'un directeur saisi.
Usage : python3 -I tools/gen-directeurs.py <memp-cp-app/tools/jumelles/pobe/seed.json> data/directeurs-pobe.js"""
import json, re, sys, unicodedata

def norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().upper().replace("Œ", "OE")
    t = re.sub(r"[^A-Z0-9/]+", " ", t)
    t = re.sub(r"\b(EPP|EPM|EPV|EP|EM|ECOLE|LE|LA|LES|L|DE|DU|D|DES|ET)\b", " ", t)
    return re.sub(r"\s+", "", t)

ecoles = json.load(open(sys.argv[1]))["schools"]
m = {}
for e in ecoles:
    if e.get("directeur"):
        m[("M" if e["cycle"] == "Maternelle" else "P") + ":" + norm(e["nom"])] = e["directeur"]
open(sys.argv[2], "w").write("/* Directeurs des écoles de la CS de Pobè — cahier de contrôle DDEMP 2024 (repris de l'application MEMP-CP Pobè).\n"
    "   Affichés seulement quand la fiche de l'école n'a pas de directeur saisi. Généré par tools/gen-directeurs.py. */\n"
    "window.DIRECTEURS_POBE = " + json.dumps(m, ensure_ascii=False, indent=0, sort_keys=True) + ";\n")
print(len(m), "directeurs")
