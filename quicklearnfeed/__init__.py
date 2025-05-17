from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import google.generativeai as genai
import feedparser
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import os, subprocess
from llama_cpp import Llama
import time
from collections import OrderedDict

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

genai.configure(api_key=API_KEY)
model= genai.GenerativeModel("gemini-1.5-pro")

@app.route("/")
def home():
    model_path = "models/mistral.gguf"

    if not os.path.exists(model_path):
        try:
            subprocess.run(["sh", "download_model.sh"], check=True)
        except subprocess.CalledProcessError as e:
            return f"Model download failed: {e}", 500

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

    url = request.args.get("url")
    if not url:
        return jsonify({"Error": "URL parameter is required"}), 400
    
    try:
        maxlen = int(request.args.get("maxlen", "200"))
    except ValueError:
        maxlen = 200

    if url in cached_summaries:
        return jsonify({"summary": cached_summaries[url]})

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

        summary = get_summary_from_llama("英語", maxlen, text_content)

        cached_summaries[url] = summary
        print ("summary:",summary)
        return jsonify({"summary":summary})

    except requests.exceptions.RequestException as e:
        return jsonify({"Error": str(e)}), 500



def get_summary_from_llama(lang, maxlen, text):
    try:
        llm = Llama(model_path="./models/mistral.gguf", n_ctx=1024)
        if len(text) > 1024:
            text = text[:1024] + "..."
        prompt = f"""### Instruction:
Please summarize the following article in 2-3 concise sentences in {lang}, no more than {maxlen} characters.

### Input:
{text}

### Response:"""
        output = llm(prompt, max_tokens=300)
        summary =  output["choices"][0]["text"]
        del llm
        return summary
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
