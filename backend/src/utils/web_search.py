import random
import sys
from pathlib import Path
from ddgs import DDGS

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import requests
import re
from bs4 import BeautifulSoup
from nltk.stem import PorterStemmer

try:
    from src.utils.llm_client import llmClient
except ModuleNotFoundError:  # pragma: no cover
    from src.utils.llm_client import llmClient

class webSearch:
    def __init__(self):
        self.llm_client = llmClient()

    def get_random_headers(self):
        USER_AGENTS = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
        ]
        return {"User-Agent": random.choice(USER_AGENTS)}

    def fetch_page(self, url: str):
        """Fetch page with proper error handling"""
        try:
            response = requests.get(
                url, 
                headers=self.get_random_headers(),
                timeout=8  # Prevent hanging
            )
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            return soup
        except requests.exceptions.ConnectionError as e:
            print(f"⚠️ Connection failed for {url}: {e}")
            return None
        except requests.exceptions.Timeout:
            print(f"⚠️ Timeout for {url}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Request error for {url}: {e}")
            return None
        except Exception as e:
            print(f"⚠️ Unexpected error fetching {url}: {e}")
            return None

    def index_words(self, soup):
        index = {}
        words = re.findall(r'\w+', soup.get_text())
        for word in words:
            word = word.lower()
            if word in index:
                index[word] += 1
            else:
                index[word] = 1
        return index

    def remove_stop_words(self, index):
        stop_words = {'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at'}
        for stop_word in stop_words:
            if stop_word in index:
                del index[stop_word]
        return index

    def apply_stemming(self, index):
        stemmer = PorterStemmer()
        stemmed_index = {}
        for word, count in index.items():
            stemmed_word = stemmer.stem(word)
            if stemmed_word in stemmed_index:
                stemmed_index[stemmed_word] += count
            else:
                stemmed_index[stemmed_word] = count
        return stemmed_index

    def search(self, query, index):
        query_words = re.findall(r'\w+', query.lower())
        results = {}
        for word in query_words:
            if word in index:
                results[word] = index[word]
        return results

    def search_engine(self, url: str, query: str) -> dict:
        """Search page with graceful error handling"""
        try:
            soup = self.fetch_page(url)
            
            if soup is None:
                return {
                    "status": "failed",
                    "error": f"Could not fetch {url}",
                    "matches": {}
                }
            
            index = self.index_words(soup)
            index = self.remove_stop_words(index)
            index = self.apply_stemming(index)
            results = self.search(query, index)
            
            return {
                "status": "success",
                "url": url,
                "matches": results,
                "total_matches": sum(results.values())
            }
            
        except Exception as e:
            print(f"❌ search_engine error: {e}")
            return {
                "status": "error",
                "error": str(e),
                "matches": {}
            }

    def _is_mostly_non_latin(self, text, threshold=0.3):
        if not text:
            return False
        letters = [c for c in text if c.isalpha()]
        if not letters:
            return False
        non_latin = sum(1 for c in letters if ord(c) > 0x24F)
        return (non_latin / len(letters)) > threshold

    def duckduckgo_search(self, query, max_results=10):
        try:
            with DDGS() as ddgs:
                results = []
                for r in ddgs.text(query, max_results=max_results):
                    title, snippet = r["title"], r["body"]
                    if self._is_mostly_non_latin(title) or self._is_mostly_non_latin(snippet):
                        snippet = "[snippet omitted: non-English/irrelevant content, skip this result]"
                    results.append({"title": title, "link": r["href"], "snippet": snippet})
                return results
        except Exception as e:
            print(f"⚠️ DuckDuckGo search failed: {e}")
            return []