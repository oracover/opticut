# ✂️ OptiCut — Optimiseur de découpe Tôle & Barre

> **Outil open-source, gratuit et sans installation** pour calculer des plans de découpe optimisés de tôles (2D) et de barres (1D).  
> Fonctionne entièrement dans le navigateur — aucune donnée envoyée sur Internet.

![License](https://img.shields.io/badge/licence-MIT-brightgreen)
![Status](https://img.shields.io/badge/status-stable-blue)
![Made with](https://img.shields.io/badge/made%20with-HTML%20%2F%20CSS%20%2F%20JS%20pur-orange)

---

## 📐 À propos du projet

OptiCut est né d'un **besoin concret de métier** dans le domaine de la métallurgie et de la menuiserie métallique. Calculer un plan de découpe à la main, sur papier ou dans un tableur, c'est long, sujet aux erreurs et souvent frustrant.

L'objectif d'OptiCut est simple : proposer un outil **vraiment utile sur le terrain**, que l'on lance en deux secondes, sur PC comme sur tablette en atelier, sans compte, sans abonnement, sans rien à installer.

La philosophie du projet :
- 🆓 **Toujours gratuit** — toutes les fonctionnalités, sans paywall
- 🔓 **Open source** — code auditable, réutilisable, améliorable par tous
- 🔒 **Respect de la vie privée** — vos données ne quittent jamais votre appareil
- ♻️ **Anti-gaspillage** — chaque optimisation économise de la matière et de l'argent

---

## 🚀 Fonctionnalités

### ▦ Module Tôle 2D
- Algorithme **Guillotine récursif Best-Area-Fit** (maximise la surface utile)
- Mode **Min-Coupes** : remplissage par bandes horizontales
- **Jeu de trait** configurable par tôle mère
- Groupement automatique par **matière + épaisseur**
- Rotation 90° optionnelle par panneau
- Cotes visuelles sur chaque pièce du plan

### ═ Module Barre 1D
- Algorithme **First Fit Decreasing (FFD)**
- Prise en compte des **biseaux** (angle gauche / angle droit) via la hauteur profilé
- Longueur calculée en **hors-tout** (pointe à pointe)
- **Chute minimale** configurable pour réutilisation
- Ouverture de la barre la plus courte possible

### 📤 Import / Export
- Export **PDF A4** haute résolution (jsPDF)
- Export **JPEG / PNG** 2480×1754 px (≈ A4 @ 300 dpi)
- Export **CSV UTF-8** (compatible Excel, LibreOffice)
- Import **CSV** généré par OptiCut
- Collage direct depuis un **tableur Excel / LibreOffice**
- Sauvegarde automatique via **localStorage**

---

## 🗂️ Structure du projet

```
opticutsite/
├── index.html                  # Page d'accueil
├── robots.txt                  # Indexation moteurs de recherche
├── sitemap.xml                 # Plan du site
├── assets/
│   ├── css/
│   │   ├── style.css           # Feuille de styles partagée (thème dark)
│   │   └── cookie-consent.css  # Styles du bandeau RGPD
│   └── js/
│       ├── app.js              # Logique des algorithmes de découpe
│       └── cookie-consent.js   # Gestionnaire de consentement cookies
└── pages/
    ├── tole.html               # Application Tôle 2D
    ├── barre.html              # Application Barre 1D
    ├── a-propos.html           # À propos du projet
    ├── confidentialite.html    # Politique de confidentialité (RGPD)
    └── mentions-legales.html   # Mentions légales (LCEN)
```

---

## ⚡ Utilisation

### En local
Clonez le dépôt et ouvrez `index.html` directement dans votre navigateur :

```bash
git clone https://github.com/oracover/opticut.git
cd opticutapp
# Ouvrir index.html dans votre navigateur
```

> ⚠️ Certains navigateurs bloquent le localStorage en mode `file://`. Pour un test local complet, utilisez un petit serveur HTTP :
> ```bash
> # Python 3
> python -m http.server 8080
> # puis ouvrir http://localhost:8080
> ```

### En production (serveur web)
Déposez le contenu du dossier à la racine de votre serveur web (Apache, Nginx, hébergement mutualisé...). Aucune configuration serveur particulière n'est requise — le site est 100 % statique.

---

## 🛠️ Technologies utilisées

| Technologie | Usage |
|---|---|
| HTML5 / CSS3 / JavaScript ES6 | Intégralité du site — aucun framework |
| [jsPDF](https://github.com/parallax/jsPDF) | Export PDF (chargé via CDN) |
| Google Fonts (Barlow Condensed + JetBrains Mono) | Typographie |
| localStorage | Sauvegarde automatique des sessions |
| Google AdSense | Publicités (financement de l'hébergement) |

---

## 🗺️ Feuille de route

| Statut | Fonctionnalité |
|---|---|
| ✅ Disponible | Calepinage Tôle 2D — Guillotine Best-Area-Fit |
| ✅ Disponible | Débit de Barre 1D — FFD avec biseaux |
| ✅ Disponible | Exports PDF / JPEG / PNG / CSV |
| ✅ Disponible | Bandeau RGPD + Politique de confidentialité |
| ⟳ Prévu | Amélioration algorithme Tôle (heuristiques avancées) |
| ⟳ Prévu | Export DXF (intégration CAO / FAO) |
| ◈ À étudier | Pièces non-rectangulaires (formes en L, U, polygones) |
| ◈ À étudier | Application mobile PWA installable |

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Si vous avez une idée, un bug à signaler ou une amélioration à proposer :

1. **Forkez** le dépôt
2. Créez une branche : `git checkout -b feature/ma-fonctionnalite`
3. Committez vos modifications : `git commit -m "feat: description"`
4. Poussez la branche : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une **Pull Request**

Pour les bugs ou suggestions, ouvrez directement une [Issue](https://github.com/oracover/opticut/issues).

---

## 📄 Licence

Ce projet est distribué sous licence **MIT**. Vous êtes libre de l'utiliser, le modifier et le redistribuer, y compris à des fins commerciales, sous réserve de conserver la mention de l'auteur original.

Voir le fichier [LICENSE](./LICENSE) pour le texte complet.

---

## 📬 Contact

**Thibaut Brunon** — tbrunon@free.fr  
Projet hébergé sur [free.fr](https://www.free.fr)

---

<p align="center">
  Fait avec ❤️ par un professionnel du terrain, pour les professionnels du terrain.
</p>
