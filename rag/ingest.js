const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function ingestKnowledgeBase() {
  console.log('\n========================================');
  console.log('  CYBERSHIELD RAG: PINECONE INGESTION');
  console.log('========================================\n');

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME || 'cybersecurity-knowledge';

  if (!pineconeApiKey || pineconeApiKey === 'your-pinecone-api-key' || pineconeApiKey.includes('your-key')) {
    console.error('❌ Error: PINECONE_API_KEY is not configured in backend/.env');
    console.log('   Please provide your Pinecone API key in backend/.env and re-run:');
    console.log('   node backend/rag/ingest.js\n');
    process.exit(1);
  }

  if (!geminiApiKey || geminiApiKey === 'your-gemini-api-key' || geminiApiKey.includes('your-key')) {
    console.error('❌ Error: GEMINI_API_KEY is not configured in backend/.env');
    console.log('   Please provide your Gemini API key in backend/.env and re-run:');
    console.log('   node backend/rag/ingest.js\n');
    process.exit(1);
  }

  // Read knowledge base
  const kbPath = path.join(__dirname, 'knowledge', 'cybersecurity_kb.json');
  if (!fs.existsSync(kbPath)) {
    console.error(`❌ Error: Knowledge base file not found at ${kbPath}`);
    process.exit(1);
  }

  const documents = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
  console.log(`📚 Loaded ${documents.length} cybersecurity knowledge articles from kb.json`);

  // Initialize Pinecone
  console.log('🌲 Connecting to Pinecone...');
  const pinecone = new Pinecone({ apiKey: pineconeApiKey });

  // Check or create index
  const existingIndexes = await pinecone.listIndexes();
  const indexList = existingIndexes.indexes ? existingIndexes.indexes.map(i => i.name) : [];

  if (!indexList.includes(indexName)) {
    console.log(`📦 Index "${indexName}" not found. Creating serverless index (dim: 768, metric: cosine)...`);
    try {
      await pinecone.createIndex({
        name: indexName,
        dimension: 768,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log(`✅ Index "${indexName}" created successfully! Waiting 10s for initialization...`);
      await new Promise(r => setTimeout(r, 10000));
    } catch (createErr) {
      console.warn(`⚠️  Could not auto-create index: ${createErr.message}`);
    }
  } else {
    console.log(`✅ Index "${indexName}" exists.`);
  }

  const index = pinecone.index(indexName);

  // Initialize Gemini Embeddings
  console.log('🧠 Initializing Google Gemini Embeddings (models/gemini-embedding-001, dim: 1024)...');
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: geminiApiKey,
    modelName: 'models/gemini-embedding-001',
    outputDimensionality: 1024
  });

  const vectors = [];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const textToEmbed = `Title: ${doc.title}\nCategory: ${doc.category}\nSummary: ${doc.summary}\nContent: ${doc.content}\nThreat Indicators: ${(doc.threatIndicators || []).join(', ')}`;
    
    console.log(`🔄 [${i + 1}/${documents.length}] Embedding: ${doc.title}...`);
    try {
      const embedding = await embeddings.embedQuery(textToEmbed);

      vectors.push({
        id: doc.id,
        values: embedding,
        metadata: {
          title: doc.title,
          category: doc.category,
          summary: doc.summary,
          text: doc.content,
          threatIndicators: JSON.stringify(doc.threatIndicators || []),
          actionRecommendations: JSON.stringify(doc.actionRecommendations || []),
          tags: JSON.stringify(doc.tags || [])
        }
      });
    } catch (embedErr) {
      console.error(`❌ Failed to embed "${doc.title}": ${embedErr.message}`);
    }
  }

  if (vectors.length > 0) {
    console.log(`\n🚀 Upserting ${vectors.length} vectors to Pinecone index "${indexName}"...`);
    await index.upsert({ records: vectors });
    console.log('🎉 Successfully ingested cybersecurity knowledge into Pinecone!\n');
  } else {
    console.error('❌ No vectors were generated.');
  }
}

if (require.main === module) {
  ingestKnowledgeBase().catch(err => {
    console.error('❌ Ingestion script failed:', err);
    process.exit(1);
  });
}

module.exports = { ingestKnowledgeBase };
