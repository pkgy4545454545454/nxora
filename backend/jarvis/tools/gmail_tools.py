"""Gmail tools exposed to the Claude agent."""
from jarvis import gmail_service


async def gmail_recent(max_results: int = 8):
    return await gmail_service.recent(max_results)


async def gmail_search(query: str, max_results: int = 5):
    """query uses Gmail syntax, e.g. 'from:pierre', 'subject:facture', 'is:unread'."""
    return await gmail_service.search(query, max_results)


async def gmail_read(message_id: str):
    return await gmail_service.get_message(message_id)


async def gmail_draft(to: str, subject: str, body: str, confirm: bool = False):
    if not confirm:
        return {"ok": False, "needs_confirmation": True,
                "message": f"Créer un brouillon pour {to} — objet: '{subject}'. Confirmer ?"}
    return await gmail_service.create_draft(to, subject, body)


async def gmail_send(to: str, subject: str, body: str, confirm: bool = False):
    if not confirm:
        return {"ok": False, "needs_confirmation": True,
                "message": f"Voici le message pour {to} (objet: '{subject}'):\n\n{body}\n\nVeux-tu confirmer l'envoi ?"}
    return await gmail_service.send_message(to, subject, body)


REGISTRY = [
    {"name": "gmail_recent", "category": "read", "func": gmail_recent,
     "description": "Lire les emails récents de la boîte de réception (objet, expéditeur, extrait, id).",
     "input_schema": {"type": "object", "properties": {
         "max_results": {"type": "integer"}}, "required": []}},
    {"name": "gmail_search", "category": "read", "func": gmail_search,
     "description": "Rechercher des emails (syntaxe Gmail: 'from:pierre', 'subject:facture', 'is:unread'...). Retourne le corps pour résumé.",
     "input_schema": {"type": "object", "properties": {
         "query": {"type": "string"}, "max_results": {"type": "integer"}}, "required": ["query"]}},
    {"name": "gmail_read", "category": "read", "func": gmail_read,
     "description": "Lire le contenu complet d'un email par son id.",
     "input_schema": {"type": "object", "properties": {
         "message_id": {"type": "string"}}, "required": ["message_id"]}},
    {"name": "gmail_draft", "category": "sensitive", "func": gmail_draft,
     "description": "Créer un brouillon d'email. confirm=true après confirmation utilisateur.",
     "input_schema": {"type": "object", "properties": {
         "to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"},
         "confirm": {"type": "boolean"}}, "required": ["to", "subject", "body"]}},
    {"name": "gmail_send", "category": "sensitive", "func": gmail_send,
     "description": "Envoyer un email. TOUJOURS montrer le message et demander confirmation avant. confirm=true uniquement après un 'oui' explicite.",
     "input_schema": {"type": "object", "properties": {
         "to": {"type": "string"}, "subject": {"type": "string"}, "body": {"type": "string"},
         "confirm": {"type": "boolean"}}, "required": ["to", "subject", "body"]}},
]
