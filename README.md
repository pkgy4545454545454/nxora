# JARVIS AI — Assistant vocal personnel

Assistant vocal futuriste (React + Three.js + FastAPI + MongoDB) : voix → Claude → outils → exécution → réponse vocale.

## Prérequis (Windows / macOS / Linux)
- Python 3.11+
- Node.js 18+ et Yarn (`npm i -g yarn`)
- MongoDB en local (ou une URI MongoDB)
- Une clé API Anthropic (Claude)

## Configuration
Éditez `backend/.env` :
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="jarvis"
CORS_ORIGINS="*"
ANTHROPIC_API_KEY="sk-ant-..."          # votre clé Claude
# Optionnel (Gmail) :
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GMAIL_REDIRECT_URI="http://localhost:8001/api/oauth/gmail/callback"
JARVIS_PUBLIC_URL="http://localhost:3000"
```
Éditez `frontend/.env` :
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Lancement
### Backend
```
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows
# (macOS/Linux : source .venv/bin/activate)
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
### Frontend
```
cd frontend
yarn
yarn start
```
Ouvrez http://localhost:3000 (utilisez Chrome/Edge pour la reconnaissance vocale).

## Utilisation
- Cliquez le micro (bas-droite) pour le **mode mains-libres** : dites « **JARVIS** » puis votre commande.
- Ou tapez dans la barre. Exemples : « ouvre le dossier Images », « lance Visual Studio Code »,
  « crée-moi un site restaurant noir et doré », « résume-moi mon dernier email », « scanne 127.0.0.1 avec nmap ».
- Les actions sensibles (suppression, envoi d'email, scan, commandes dangereuses) demandent confirmation.

## Notes
- Le **contrôle réel du PC** (fichiers, lancement d'applications, terminal, nmap, USB) fonctionne quand le backend tourne **en local** sur votre machine.
- Cybersécurité : n'analysez que des cibles **autorisées** (laboratoire / systèmes que vous possédez).
- Outils cyber requis en local : `nmap`, `dirb`, `sqlmap`, `whatweb` (installez-les selon vos besoins).
- WhatsApp : données de démonstration (pas d'API officielle de lecture des messages personnels).

## Architecture
```
backend/
  server.py              # app FastAPI
  jarvis/
    agent.py             # boucle Claude + outils (tool use)
    prompts.py           # prompt système
    store.py             # Mongo, config, logs
    gmail_service.py     # OAuth Gmail
    api.py               # routes /api
    tools/               # filesystem, applications, browser, terminal,
                         # development, cybersecurity, system_info, gmail_tools
frontend/
  src/
    App.js               # HUD + navigation + console vocale
    components/Avatar3D.jsx   # avatar 3D (Three.js) + synchro labiale
    hooks/useAssistant.js     # état, voix, mot d'activation
    lib/speech.js             # STT/TTS navigateur
    sections/                 # Dashboard, Settings, Views (Projets, Sécurité...)
```
