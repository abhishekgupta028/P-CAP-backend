const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

let pineconeInstance = null;

function getPineconeClient() {
  const apiKey = process.env.PINECONE_API_KEY;

  if (!apiKey || apiKey === 'your-pinecone-api-key' || apiKey.includes('your-key')) {
    return null;
  }

  if (!pineconeInstance) {
    try {
      pineconeInstance = new Pinecone({
        apiKey: apiKey
      });
    } catch (error) {
      console.warn('⚠️  Could not initialize Pinecone client:', error.message);
      return null;
    }
  }

  return pineconeInstance;
}

function getPineconeIndex() {
  const client = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX_NAME || 'cybersecurity-knowledge';

  if (!client) {
    return null;
  }

  try {
    return client.index(indexName);
  } catch (error) {
    console.warn(`⚠️  Could not access Pinecone index "${indexName}":`, error.message);
    return null;
  }
}

module.exports = {
  getPineconeClient,
  getPineconeIndex
};
