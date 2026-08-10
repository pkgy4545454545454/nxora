# JARVIS AI — Assistant vocal personnel (PRD)

## Problème / Objectif
Assistant vocal personnel type Iron Man : "Je parle → Claude comprend → l'agent choisit un outil → Python exécute → l'interface affiche → JARVIS répond vocalement." Interface HUD futuriste reproduisant l'image de référence fournie, avatar 3D central.

## Choix utilisateur (validés)
- Version fonctionnelle destinée à être exécutée localement sur son PC Windows (contrôle réel du PC).
- IA : clé Anthropic Claude personnelle (dans backend/.env). Modèle par défaut `claude-sonnet-4-5-20250929`.
- Voix : Web Speech API du navigateur (STT + TTS), voix française sélectionnable.
- Emails : Gmail (OAuth). Identifiants Google fournis.
- Sections dashboard : Stats système, Stats IA, Dernières commandes, Emails récents, WhatsApp, Cybersécurité 1-clic, Code/Pense-bête, Heure/Date.

## Architecture
- Backend FastAPI (`/app/backend`), package `jarvis/` : `agent.py` (boucle tool-use Claude native SDK), `tools/` (filesystem, applications, browser, terminal, development, cybersecurity, system_info), `store.py` (Mongo + config + logs), `permissions`, `prompts.py`, `gmail_service.py`, `api.py`.
- Frontend React + Three.js (`@react-three/fiber`) : avatar 3D (`Avatar3D.jsx`) réactif aux états, HUD (`Hud.jsx`), sections (`Dashboard.jsx`, `Settings.jsx`, `Views.jsx`), voix (`lib/speech.js`), hook `useAssistant.js`.
- MongoDB : conversations (mémoire), config, logs (journal des actions), notes, gmail_tokens.

## Implémenté (2026-08-10)
- Interface HUD futuriste fidèle à l'image + avatar 3D holographique bleu/rouge avec états (veille/écoute/réflexion/exécution/réponse/erreur).
- Agent Claude + Tools : filesystem (rechercher/ouvrir/lire/renommer/déplacer/copier/supprimer avec confirmation), applications (détecter/lancer/fermer), navigateur (sites/URL/recherche), terminal contrôlé (garde-fous), development (créer projets/écrire fichiers/serveur dev), cybersécurité (nmap/dirb/... sur cibles autorisées + rapports), system_info (stats réelles psutil + USB).
- Système de permissions par catégorie (read/normal/sensitive/terminal/cybersecurity) + journal des actions.
- Conversation vocale (STT continu + TTS FR) avec mot d'activation configurable.
- Dashboard : stats système temps réel, stats IA, réseau, dernières commandes (1-clic), emails Gmail, WhatsApp (démo), cybersécurité 1-clic, notes/code, horloge.
- Gmail OAuth configuré (lecture des emails récents après connexion).
- Paramètres : clé API, modèle, mot d'activation, voix (test), permissions.
- Tests E2E : backend 15/15, frontend 100% des flux couverts.

## Itération 2 (2026-08-10)
- Synchro labiale : la bouche de l'avatar 3D s'anime avec l'amplitude de la voix (`speech.js` expose `mouth.level`, lu par `Avatar3D.jsx`).
- Emails intelligents : outils agent `gmail_recent`, `gmail_search`, `gmail_read`, `gmail_draft`, `gmail_send` (envoi avec confirmation obligatoire). Scopes gmail.compose + gmail.send ajoutés.
- Générateur de sites : `create_project` + `open_in_editor` (VS Code) + `start_dev_server` + `open_url`; le prompt enchaîne automatiquement création → éditeur → serveur → navigateur; modifications ciblées via `write_file`.
- Agent : support des outils asynchrones.
- 31 outils enregistrés. Testés au niveau fonction (create_project, open_in_editor fallback, gmail confirmation) + compilation OK. Vérification E2E des flux agent en attente des crédits Anthropic.

## Limites connues
- Réponses Claude bloquées : le compte Anthropic du user a un **solde de crédits insuffisant** (clé valide). Ajouter des crédits sur console.anthropic.com.
- WhatsApp : données de démonstration (MOCKED) — pas d'API officielle de lecture des messages perso.
- Contrôle réel du PC (ouvrir dossiers, lancer VS Code/Ubuntu, nmap, USB) : pleinement effectif quand le backend tourne en LOCAL sur Windows ; dans l'aperçu cloud, s'exécute sur le conteneur Linux.

## Backlog (prochaines étapes)
- P1 : Streaming des réponses + WebSocket état temps réel ; synchronisation labiale audio→avatar (analyse d'amplitude).
- P1 : Emails — résumer / rédiger / envoyer (avec confirmation) via Claude.
- P2 : Génération de projets avancée (React/Vite) + ouverture auto dans VS Code + navigateur.
- P2 : Réseaux sociaux (YouTube API) ; périphériques avancés ; mémoire persistante à long terme.
- P2 : Packaging exécutable local Windows (guide de lancement `python main.py`).
