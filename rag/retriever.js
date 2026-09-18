const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { getPineconeIndex } = require('./pineconeClient');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Load local KB as reference and fallback
const KB_PATH = path.join(__dirname, 'knowledge', 'cybersecurity_kb.json');
let localKnowledgeBase = [];
try {
  if (fs.existsSync(KB_PATH)) {
    localKnowledgeBase = JSON.parse(fs.readFileSync(KB_PATH, 'utf-8'));
  }
} catch (err) {
  console.warn('⚠️  Could not read local cybersecurity KB:', err.message);
}

/**
 * Fallback local keyword & semantic scoring retriever
 */
function localKeywordSearch(query, topK = 3) {
  if (!localKnowledgeBase || localKnowledgeBase.length === 0) return [];
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 2);

  const scored = localKnowledgeBase.map(doc => {
    let score = 0;
    const docText = `${doc.title} ${doc.category} ${doc.summary} ${doc.content} ${(doc.tags || []).join(' ')}`.toLowerCase();

    // Check exact category matches
    if (q.includes('upi') && doc.category.toLowerCase().includes('upi')) score += 5;
    if (q.includes('otp') && doc.category.toLowerCase().includes('otp')) score += 5;
    if ((q.includes('phish') || q.includes('link') || q.includes('job')) && doc.category.toLowerCase().includes('phishing')) score += 5;
    if ((q.includes('aadhaar') || q.includes('pan') || q.includes('identity')) && doc.category.toLowerCase().includes('identity')) score += 5;
    if ((q.includes('apk') || q.includes('malware') || q.includes('app')) && doc.category.toLowerCase().includes('malware')) score += 5;
    if ((q.includes('report') || q.includes('1930') || q.includes('helpline') || q.includes('rbi')) && doc.category.toLowerCase().includes('incident')) score += 5;

    // Match individual terms
    for (const term of terms) {
      if (docText.includes(term)) {
        score += 1;
      }
    }

    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      content: doc.content,
      summary: doc.summary,
      threatIndicators: doc.threatIndicators || [],
      actionRecommendations: doc.actionRecommendations || [],
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Retrieve relevant cybersecurity context using Pinecone + Gemini Embeddings,
 * falling back to local KB search if credentials are not configured.
 */
async function retrieveCyberContext(query, topK = 3) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const pineconeIndex = getPineconeIndex();

  if (!geminiApiKey || geminiApiKey === 'your-gemini-api-key' || !pineconeIndex) {
    // Graceful fallback to local scored search
    return localKeywordSearch(query, topK);
  }

  try {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: geminiApiKey,
      modelName: 'models/gemini-embedding-001',
      outputDimensionality: 1024
    });

    const queryEmbedding = await embeddings.embedQuery(query);

    const queryResponse = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true
    });

    if (queryResponse && queryResponse.matches && queryResponse.matches.length > 0) {
      return queryResponse.matches.map(match => ({
        id: match.id,
        score: match.score,
        title: match.metadata?.title || 'Cybersecurity Advisory',
        category: match.metadata?.category || 'General Security',
        content: match.metadata?.text || match.metadata?.content || '',
        summary: match.metadata?.summary || '',
        threatIndicators: match.metadata?.threatIndicators ? JSON.parse(match.metadata.threatIndicators) : [],
        actionRecommendations: match.metadata?.actionRecommendations ? JSON.parse(match.metadata.actionRecommendations) : []
      }));
    }

    // Fallback if index is empty
    return localKeywordSearch(query, topK);
  } catch (error) {
    console.warn('⚠️  Pinecone/Gemini vector retrieval error, using local KB fallback:', error.message);
    return localKeywordSearch(query, topK);
  }
}

module.exports = {
  retrieveCyberContext,
  localKeywordSearch
};
