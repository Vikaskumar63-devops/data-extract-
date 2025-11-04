// server.js - Node.js Backend for Google Trends Portal
const express = require('express');
const googleTrends = require('google-trends-api');
const NewsAPI = require('newsapi');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize NewsAPI
const newsapi = new NewsAPI(process.env.NEWS_API_KEY || 'demo_key');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/', (req, res) => {
    res.send('Google Trends Portal API is running! Access the portal at /index.html');
});

// Comprehensive Search - Combines Trends + News
app.get('/api/search', async (req, res) => {
    try {
        const { keyword, geo = 'US', timeFrame = 'now 7-d', category = 0 } = req.query;

        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        console.log(`Searching for: ${keyword}, geo: ${geo}, timeFrame: ${timeFrame}`);

        // Fetch data from multiple sources
        const [trendsData, relatedData, newsData] = await Promise.allSettled([
            googleTrends.interestOverTime({
                keyword: keyword,
                geo: geo,
                category: parseInt(category),
                startTime: getStartTime(timeFrame)
            }).then(r => JSON.parse(r)).catch(e => null),
            
            googleTrends.relatedQueries({
                keyword: keyword,
                geo: geo,
                category: parseInt(category)
            }).then(r => JSON.parse(r)).catch(e => null),
            
            newsapi.v2.everything({
                q: keyword,
                language: 'en',
                sortBy: 'publishedAt',
                pageSize: 20
            }).catch(e => null)
        ]);

        const response = {
            success: true,
            keyword: keyword,
            trends: trendsData.status === 'fulfilled' ? trendsData.value : null,
            relatedQueries: relatedData.status === 'fulfilled' ? relatedData.value : null,
            news: newsData.status === 'fulfilled' ? newsData.value : null,
            processedData: processSearchResults(
                trendsData.status === 'fulfilled' ? trendsData.value : null,
                newsData.status === 'fulfilled' ? newsData.value : null,
                keyword
            )
        };

        res.json(response);

    } catch (error) {
        console.error('Error in search:', error);
        res.status(500).json({ 
            error: 'Failed to fetch search data',
            message: error.message 
        });
    }
});

// Daily Trending Searches
app.get('/api/trends/daily', async (req, res) => {
    try {
        const { geo = 'US' } = req.query;
        const results = await googleTrends.dailyTrends({ geo: geo });
        const data = JSON.parse(results);
        res.json({ success: true, data: data });
    } catch (error) {
        console.error('Error fetching daily trends:', error);
        res.status(500).json({ error: 'Failed to fetch daily trends', message: error.message });
    }
});

// Helper Functions
function getStartTime(timeFrame) {
    const now = new Date();
    const timeMap = {
        'now 1-H': new Date(now.getTime() - 1 * 60 * 60 * 1000),
        'now 4-H': new Date(now.getTime() - 4 * 60 * 60 * 1000),
        'now 1-d': new Date(now.getTime() - 24 * 60 * 60 * 1000),
        'now 7-d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        'today 1-m': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        'today 3-m': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    };
    return timeMap[timeFrame] || timeMap['now 7-d'];
}

function processSearchResults(trendsData, newsData, keyword) {
    const results = [];
    
    // Process trends data
    if (trendsData && trendsData.default && trendsData.default.timelineData) {
        const timelineData = trendsData.default.timelineData;
        const latestData = timelineData[timelineData.length - 1];
        
        if (latestData && latestData.value && latestData.value[0]) {
            const value = latestData.value[0];
            const previousValue = timelineData.length > 1 ? 
                timelineData[timelineData.length - 2].value[0] : value;
            
            const change = previousValue > 0 ? 
                (((value - previousValue) / previousValue) * 100).toFixed(1) : 0;
            
            results.push({
                keyword: keyword,
                source: 'Google Trends',
                traffic: categorizeTraffic(value),
                volume: value.toLocaleString(),
                change: (change >= 0 ? '+' : '') + change + '%',
                articles: []
            });
        }
    }

    // Process news data
    if (newsData && newsData.articles) {
        const groupedArticles = {};
        
        newsData.articles.forEach(article => {
            const source = article.source.name;
            if (!groupedArticles[source]) {
                groupedArticles[source] = {
                    keyword: keyword,
                    source: source,
                    traffic: 'medium',
                    volume: (Math.floor(Math.random() * 50000) + 10000).toLocaleString(),
                    change: (Math.random() * 100 - 20).toFixed(1) + '%',
                    articles: []
                };
            }
            
            groupedArticles[source].articles.push({
                title: article.title,
                url: article.url,
                source: article.source.name,
                snippet: article.description || article.content || '',
                date: new Date(article.publishedAt).toLocaleString(),
                image: article.urlToImage
            });
        });

        results.push(...Object.values(groupedArticles));
    }

    return results;
}

function categorizeTraffic(value) {
    if (value > 75) return 'high';
    if (value > 40) return 'medium';
    return 'low';
}

// Start Server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   Google Trends Portal - Backend      ║
║   Server running on port ${PORT}         ║
╚════════════════════════════════════════╝

Frontend: http://localhost:${PORT}
API: http://localhost:${PORT}/api/search
    `);
});