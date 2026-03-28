import requests
from urllib.parse import urljoin

try:
	from bs4 import BeautifulSoup
except Exception:
	BeautifulSoup = None


COMMON_PATHS = [
	"/terms",
	"/terms-of-service",
	"/terms-of-use",
	"/tos",
	"/legal/terms",
	"/terms.html",
]


def _fetch_text(url: str, timeout: int = 8) -> str:
	resp = requests.get(url, timeout=timeout, headers={"User-Agent": "clear-terms-bot/1.0"})
	resp.raise_for_status()
	content_type = resp.headers.get("Content-Type", "")
	# If HTML, try to extract readable text; otherwise return raw text
	if "html" in content_type.lower() and BeautifulSoup:
		soup = BeautifulSoup(resp.text, "html.parser")
		# Very simple text extraction: join paragraphs
		paragraphs = [p.get_text(separator=" ").strip() for p in soup.find_all("p")]
		text = "\n\n".join([p for p in paragraphs if p])
		return text if text else resp.text
	return resp.text


def find_tos_on_homepage(domain: str) -> str | None:
	base = domain
	if not base.startswith("http://") and not base.startswith("https://"):
		base = f"https://{domain}"
	try:
		resp = requests.get(base, timeout=8, headers={"User-Agent": "clear-terms-bot/1.0"})
		resp.raise_for_status()
	except Exception:
		return None

	if BeautifulSoup:
		soup = BeautifulSoup(resp.text, "html.parser")
		# look for links that likely point to terms
		for a in soup.find_all("a", href=True):
			href = a["href"].lower()
			if any(k in href for k in ["terms", "tos", "terms-of-service", "terms-of-use", "legal"]):
				full = urljoin(base, a["href"])
				return full
	else:
		# fallback: try common paths
		for p in COMMON_PATHS:
			candidate = urljoin(base, p)
			try:
				r = requests.head(candidate, timeout=5, headers={"User-Agent": "clear-terms-bot/1.0"})
				if r.status_code == 200:
					return candidate
			except Exception:
				continue
	return None


def fetch_site_tos(domain_or_url: str) -> dict:
	"""Attempt to get ToS text for a domain or URL. Returns dict with status and text or error."""
	# If it's a full URL pointing at a likely ToS page, try fetching it directly
	try:
		if domain_or_url.startswith("http://") or domain_or_url.startswith("https://"):
			text = _fetch_text(domain_or_url)
			return {"status": "ok", "url": domain_or_url, "text": text}
	except Exception as e:
		# continue to try other strategies
		pass

	# treat input as domain
	domain = domain_or_url
	# Try common paths first
	for p in COMMON_PATHS:
		candidate = f"https://{domain.rstrip('/')}{p}"
		try:
			text = _fetch_text(candidate)
			return {"status": "ok", "url": candidate, "text": text}
		except Exception:
			continue

	# Try to find a link on homepage
	found = find_tos_on_homepage(domain)
	if found:
		try:
			text = _fetch_text(found)
			return {"status": "ok", "url": found, "text": text}
		except Exception as e:
			return {"status": "error", "message": str(e)}

	return {"status": "error", "message": "ToS not found"}

