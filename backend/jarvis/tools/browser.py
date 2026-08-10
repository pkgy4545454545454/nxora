"""Browser / internet navigation tools."""
import webbrowser
from urllib.parse import quote_plus

SITES = {
    "youtube": "https://www.youtube.com", "google": "https://www.google.com",
    "instagram": "https://www.instagram.com", "github": "https://github.com",
    "gmail": "https://mail.google.com", "twitter": "https://twitter.com",
    "x": "https://x.com", "chatgpt": "https://chat.openai.com",
    "linkedin": "https://www.linkedin.com", "facebook": "https://www.facebook.com",
    "whatsapp": "https://web.whatsapp.com", "maps": "https://maps.google.com",
}


def _open(url: str):
    try:
        webbrowser.open(url)
    except Exception:
        pass
    return url


def open_url(url: str):
    if not url.startswith("http"):
        url = "https://" + url
    _open(url)
    return {"ok": True, "url": url, "open_in_browser": url}


def open_website(name: str):
    key = name.strip().lower()
    url = SITES.get(key)
    if not url:
        url = f"https://{key}" if "." in key else f"https://www.{key}.com"
    _open(url)
    return {"ok": True, "site": name, "url": url, "open_in_browser": url}


def web_search(query: str):
    url = f"https://www.google.com/search?q={quote_plus(query)}"
    _open(url)
    return {"ok": True, "query": query, "url": url, "open_in_browser": url}


REGISTRY = [
    {"name": "open_website", "category": "normal", "func": open_website,
     "description": "Ouvrir un site web par son nom (ex: YouTube, Instagram, GitHub) dans le navigateur.",
     "input_schema": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}},
    {"name": "open_url", "category": "normal", "func": open_url,
     "description": "Ouvrir une URL précise dans le navigateur.",
     "input_schema": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}},
    {"name": "web_search", "category": "normal", "func": web_search,
     "description": "Effectuer une recherche Google et ouvrir les résultats dans le navigateur.",
     "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}},
]
