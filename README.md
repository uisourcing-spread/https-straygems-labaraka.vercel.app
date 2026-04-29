# Straygems — La Baraka
## Setup & Déploiement

---

### ÉTAPE 1 — Renseigner ton token Airtable

Ouvre le fichier `src/airtable.js` et remplace :
```
const AIRTABLE_TOKEN = "TON_TOKEN_ICI";
```
par ton nouveau Personal Access Token Airtable.

Le Base ID est déjà configuré : `appM6plliloPsrQg4`

---

### ÉTAPE 2 — Déployer sur Vercel

**Option A — Via GitHub (recommandé)**

1. Crée un repo GitHub : github.com → "New repository" → nomme-le `straygems-labaraka`
2. Upload tous les fichiers de ce dossier dans le repo
3. Va sur vercel.com → "Add New Project" → sélectionne ton repo GitHub
4. Vercel détecte automatiquement que c'est un projet React
5. Clique "Deploy" → attends 2 minutes
6. Tu reçois deux URLs :
   - `https://straygems-labaraka.vercel.app` → ton Dashboard
   - `https://straygems-labaraka.vercel.app/vendeur` → interface La Baraka

**Option B — Via Vercel CLI**

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

### ÉTAPE 3 — Partager l'accès aux vendeurs

Envoie simplement ce lien aux vendeurs de La Baraka :
```
https://TON-PROJET.vercel.app/vendeur
```

Ils peuvent l'ajouter en favori ou en raccourci sur l'écran d'accueil de leur téléphone.

---

### URLs finales

| Interface | URL | Accès |
|---|---|---|
| Dashboard El Jefe | `https://TON-PROJET.vercel.app/` | Toi uniquement |
| Interface vendeurs | `https://TON-PROJET.vercel.app/vendeur` | Vendeurs La Baraka |

---

### Structure du projet

```
straygems-vercel/
├── public/
│   └── index.html
├── src/
│   ├── index.js          ← routing
│   ├── airtable.js       ← connexion API Airtable (mets ton token ici)
│   ├── Dashboard.jsx     ← ton CRM complet
│   └── Vendeur.jsx       ← interface vendeurs La Baraka
└── package.json
```

---

### Synchronisation temps réel

Les deux interfaces lisent et écrivent directement dans ta base Airtable.
- Un vendeur enregistre une vente → visible immédiatement dans ton Dashboard
- Tu ajoutes une pièce → visible immédiatement sur l'interface vendeurs
- Bouton "⟳ sync" disponible sur les deux interfaces pour forcer le rechargement
