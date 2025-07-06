from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import google.generativeai as genai
import feedparser
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import os
import time
from collections import OrderedDict
from collections import Counter
from opensearchpy import OpenSearch
import re
import hashlib
from urllib.parse import urlparse
from datetime import datetime, timezone

load_dotenv()

API_KEY = os.getenv("GOOGLE_API_KEY")

app = Flask(__name__)
CORS(app)

RSS_FEEDS = OrderedDict([
    ("General", "https://feeds.bbci.co.uk/news/rss.xml"),
    ("World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("Politics", "https://feeds.bbci.co.uk/news/politics/rss.xml"),
    ("Health", "https://feeds.bbci.co.uk/news/health/rss.xml"),
    ("Science & Environment", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
    ("Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"),
    ("Entertainment & Arts", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"),
    ("Education", "https://feeds.bbci.co.uk/news/education/rss.xml"),
    ("Sport", "https://feeds.bbci.co.uk/sport/rss.xml"),
    ("Football", "https://feeds.bbci.co.uk/sport/football/rss.xml"),
    ("F1", "https://feeds.bbci.co.uk/sport/formula1/rss.xml"),
    ("Tennis", "https://feeds.bbci.co.uk/sport/tennis/rss.xml"),
    ("Golf", "https://feeds.bbci.co.uk/sport/golf/rss.xml"),
    ("Rugby", "https://feeds.bbci.co.uk/sport/rugby-union/rss.xml")
])

STOP_WORDS = set([
    "a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "and", "in", "on", "for", "with", "at", "by", "from",
    "it", "this", "that", "these", "those", "as", "i", "you", "he", "she", "they", "we", "me", "him", "her", "them", "my",
    "your", "his", "its", "our", "their", "or", "but", "not", "so", "if", "because", "when", "while", "do", "does", "did",
    "have", "has", "had", "will", "would", "can", "could", "shall", "should", "may", "might", "must"
])

genai.configure(api_key=API_KEY)
model= genai.GenerativeModel("gemini-1.5-pro")

# OpenSeach Client
env = os.environ.get("ENV", "local")

if env == "production":
    parsed = urlparse(os.environ["OPENSEARCH_URL"])
    host = parsed.hostname
    port = parsed.port or 443
    use_ssl = parsed.scheme == "https"
    os_client = OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_auth=("admin", os.environ["OPENSEARCH_PASSWORD"]),
        use_ssl=use_ssl,
        verify_certs=False
    )
else:
    # local development settings
    password = os.environ["OPENSEARCH_PASSWORD"]
    os_client = OpenSearch(
        hosts=[{"host": "localhost", "port": 9200}],
        http_auth=("admin", password),
        use_ssl=False,
        verify_certs=False
    )

# CEFR Dictionary Preloaded
import json
dict_path = os.path.join(os.path.dirname(__file__), "cefr_dict.json")
with open(dict_path, "r", encoding="utf-8") as f:
    CEFR_WORDS = json.load(f)

def extract_cefr_words(text, levels=["A1", "A2", "B1", "B2", "C1"]):
    text = text.lower()
    words = re.findall(r"\b[a-z]+\b", text)
    word_counts = Counter(words)

    cefr_counts = {}
    for level in levels:
        vocab = set(CEFR_WORDS[level])
        cefr_counts[level] = {
            w: c for w, c in word_counts.items() if w in vocab and w not in STOP_WORDS
        }
    return cefr_counts

# index articles into OpenSearch
def index_to_opensearch(article_id, url, summary, cefr_words):
    doc = {
        "article_id": article_id,
        "url": url,
        "summary": summary,
        "cefr_words": cefr_words,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    os_client.index(index="qlf_articles", id=article_id, body=doc)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/categories", methods=["GET"])
def get_categories():
    return jsonify(list(RSS_FEEDS.keys()))

@app.route("/api/news/<category>", methods=["GET"])
def get_news_by_category(category):
    if category not in RSS_FEEDS:
        return jsonify({"Error: Category not found"}),404

    feed = feedparser.parse(RSS_FEEDS[category])

    if not feed.entries:
        return jsonify({"Error": "RSS feed is empty or cannot be loaded"}), 500
    
    filtered_news = []
    for entry in feed.entries:
        news = {
            "title": entry.title,
            "thumbnail": entry.media_thumbnail[0]["url"] if "media_thumbnail" in entry else None,
            "published": entry.published,
            "category": category,
            "link":entry.link
        }
        filtered_news.append(news)

    # print(filtered_news)
    return jsonify(filtered_news)

cached_summaries = {}
server_start_time = time.time()

@app.route("/api/scrape", methods=["GET"])
def scrape():
    global server_start_time, cached_summaries

    if time.time() - server_start_time > 86400:
        cached_summaries = {}
        server_start_time = time.time()
        try:
            os_client.indices.delete(index="qlf_articles")
        except Exception as e:
            print(f"Failed to delete OpenSearch index: {e}")

    url = request.args.get("url")
    if not url:
        return jsonify({"Error": "URL parameter is required"}), 400
    
    try:
        maxlen = int(request.args.get("maxlen", "200"))
    except ValueError:
        maxlen = 200

    if url in cached_summaries:
        return jsonify(cached_summaries[url])

    try:
        # Article fetch request
        print(url)
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        #Get text-block with BeautifulSoup
        soup = BeautifulSoup(response.text, "html.parser")

        article = soup.find("article")
        if not article:
            return jsonify({"Error": "Article not found"}), 404
        paragraphs = [div.get_text() for div in article.find_all("div", {"data-component": "text-block"})]
        text_content = " ".join(paragraphs)

        if len(text_content) > 1024:
            text_content = text_content[:1024] + "..."

        article_id = hashlib.sha256(url.encode()).hexdigest()

        summary = get_summary_from_llama("English", maxlen, text_content)
        if summary.startswith("Error:"):
            return jsonify({"summary": "Summary is unavailable now",
                            "cefr_words": "Words are unavailable now"})
        
        cefr_words = extract_cefr_words(text_content)
        index_to_opensearch(article_id, url, summary, cefr_words)

        cached_summaries[url] = {
            "summary": summary,
            "cefr_words": cefr_words
        }
        print ("URL:",url)
        print ("summary:",summary)
        return jsonify(cached_summaries[url])

    except requests.exceptions.RequestException as e:
        return jsonify({"Error": str(e)}), 500


def get_summary_from_llama(lang, maxlen, text):
    try:
        tunnel_url = os.getenv("TUNNEL_URL")
        if not tunnel_url:
            return "Error: TUNNEL_URL environment variable is not set"
        
        payload = {
            "text": text,
            "lang": lang,
            "maxlen": maxlen
        }
        headers = {
            "Content-Type": "application/json"
        }
        response = requests.post(tunnel_url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        return response.json().get("summary", "summary is unavailable now")
    except Exception as e:
        return f"Error: {str(e)}"
    
def get_summary_from_gemini(lang, maxlen, text):
    try:
        # Call the Gemini API to request a summary
        prompt = f"以下のテキストの要点を{lang}で{maxlen}文字にまとめてください:\n\n{text}"
        response = model.generate_content(prompt)
        print("Absturuct:",response.text)
        return response.text
    
    except Exception as e:
        return f"Error: {str(e)}"
    
@app.route("/api/news", methods=["GET"])
def get_news():
    all_news = []
    for category, url in RSS_FEEDS.items():
        feed = feedparser.parse(url)
        if feed.entries:
            news = {
                "title": entry.title,
                "thumbnail": entry.media_thumbnail[0]["url"] if "media_thumbnail" in entry else None,
                "published": entry.published,
                "category": category,
                "link":entry.link
            }
            all_news.append(news)
    # print(all_news)
    return jsonify(all_news)

def main():
    app.run('0.0.0.0', 8000)
    
if __name__ == '__main__':
    app.run('0.0.0.0', 8000, debug=False)
