from flask import Flask, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup

app = Flask(__name__)

# ✅ Your SerpApi Key
SERP_API_KEY = "d92b1b77c470ee3b6ea36a86e0ca0d1f39d39c62a783aac8fe5c8769cc88e2b4"
BASE_URL = "https://serpapi.com/search.json"


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/generate', methods=['POST'])
def generate():
    data = request.json
    keyword = data.get('keyword', 'news')
    country = data.get('country', 'IN')
    category = data.get('category', '0')
    timeframe = data.get('timeframe', 'now 1-d')

    try:
        params = {
            "engine": "google_trends",
            "q": keyword,
            "data_type": "RELATED_QUERIES",
            "geo": country,
            "cat": category,
            "time": timeframe,
            "api_key": SERP_API_KEY
        }
        response = requests.get(BASE_URL, params=params)
        result = response.json()

        related_queries = result.get("related_queries", [])
        results = []

        for rq in related_queries:
            if "query" in rq:
                title = rq["query"]
                link = f"https://www.google.com/search?q={title.replace(' ', '+')}"
                results.append({"title": title, "link": link})

        if not results:
            results.append({"title": "No data found", "link": "#"})

        return jsonify({"status": "ok", "results": results})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


@app.route('/fetch_article', methods=['POST'])
def fetch_article():
    url = request.json.get('url')
    try:
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
        soup = BeautifulSoup(res.text, 'html.parser')
        paragraphs = [p.text for p in soup.find_all('p') if p.text.strip()]
        english_text = ' '.join(paragraphs)
        return jsonify({"status": "ok", "content": english_text[:2000]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


if __name__ == '__main__':
    app.run(debug=True)
