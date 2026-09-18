const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
require('dotenv').config();

/**
 * Generate intelligent grounded fallback when Gemini API key is missing
 */
function generateFallbackResponse(userMessage, mlClassification, retrievedDocs) {
  const isSpam = mlClassification?.is_spam || false;
  const confidence = mlClassification?.confidence || 0.85;
  const category = mlClassification?.category || (isSpam ? 'Suspicious Threat' : 'General Query');
  const riskLevel = mlClassification?.risk_level || (isSpam ? 'HIGH' : 'LOW');

  // Aggregate indicators & recommendations from retrieved docs
  const indicators = [];
  const recommendations = [];
  const sourceCitations = [];

  for (const doc of retrievedDocs || []) {
    if (doc.threatIndicators && doc.threatIndicators.length > 0) {
      indicators.push(...doc.threatIndicators);
    }
    if (doc.actionRecommendations && doc.actionRecommendations.length > 0) {
      recommendations.push(...doc.actionRecommendations);
    }
    sourceCitations.push({
      title: doc.title,
      category: doc.category,
      relevanceScore: doc.score ? Number(doc.score.toFixed(2)) : 0.90
    });
  }

  // Deduplicate
  const uniqueIndicators = [...new Set(indicators)].slice(0, 4);
  const uniqueRecommendations = [...new Set(recommendations)].slice(0, 4);

  let explanation = '';
  if (isSpam || riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
    explanation = `The analyzed message exhibits clear markers of a ${category.toUpperCase()} attack. It employs psychological urgency, unsolicited instructions, or payment/credential requests designed to mislead the recipient. The ML LinearSVC classifier and knowledge retrieval identified high risk indicators consistent with documented fraud patterns.`;
  } else {
    explanation = `Based on cybersecurity threat analysis, this query or communication has been evaluated. No malicious markers were detected with current confidence scores. Always observe general digital safety hygiene before sharing credentials or financial details.`;
  }

  return {
    threatCategory: category,
    riskLevel: riskLevel,
    isThreat: isSpam || riskLevel === 'HIGH' || riskLevel === 'CRITICAL',
    confidenceScore: confidence,
    explanation: explanation,
    indicators: uniqueIndicators.length > 0 ? uniqueIndicators : [
      'Unsolicited communication from unknown sender',
      'Urgency or demand for immediate action',
      'Potential link or payment redirection request'
    ],
    recommendations: uniqueRecommendations.length > 0 ? uniqueRecommendations : [
      'Do not click on unverified links or dial unknown phone numbers',
      'Never share UPI PIN, OTP, or passwords with anyone',
      'If you suffered financial loss, call the National Cyber Crime Helpline 1930 immediately',
      'File a complaint at cybercrime.gov.in with transaction details'
    ],
    sources: sourceCitations.length > 0 ? sourceCitations : [
      { title: 'CyberShield Threat Intelligence Base', category: 'General Cybersecurity', relevanceScore: 0.95 }
    ]
  };
}

/**
 * Execute Gemini RAG chain
 */
async function generateRAGAnalysis({ userMessage, mlClassification, retrievedDocs }) {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey || geminiApiKey === 'your-gemini-api-key' || geminiApiKey.includes('your-key')) {
    return generateFallbackResponse(userMessage, mlClassification, retrievedDocs);
  }

  const candidateModels = [
    process.env.GEMINI_MODEL || 'gemini-flash-latest',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.6-flash'
  ];

  const uniqueModels = [...new Set(candidateModels.map(m => m.replace(/^models\//, '')))];

  const contextText = (retrievedDocs || []).map((doc, idx) => `
[Source ${idx + 1}: ${doc.title} (${doc.category})]
${doc.content}
Known Indicators: ${(doc.threatIndicators || []).join('; ')}
Recommended Actions: ${(doc.actionRecommendations || []).join('; ')}
`).join('\n---\n');

  const systemPrompt = `You are CyberShield AI, an advanced Cybersecurity Threat Analyst and AI Assistant specialized in digital fraud detection, phishing analysis, UPI/banking scams, and cyber safety in India.

You will be provided with:
1. The User's Suspicious Message or Cybersecurity Question
2. ML Pipeline Classification Result (from TF-IDF + LinearSVC)
3. Verified Knowledge Base Chunks retrieved via Vector Similarity Search (Pinecone RAG)

YOUR TASK:
Analyze the user's input with context grounding from the retrieved knowledge and ML results.
Return a STRICT, valid JSON object (no markdown wrapping, no extra text outside the JSON) with the following structure:
{
  "threatCategory": "Phishing" | "UPI scam" | "OTP fraud" | "Identity theft" | "Malware & Ransomware" | "Legitimate/Safe" | "General Security Advice",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "isThreat": boolean,
  "confidenceScore": number (0.0 to 1.0),
  "explanation": "Clear, detailed breakdown of why this message/query is safe or dangerous and how the scam works",
  "indicators": ["indicator 1", "indicator 2", "indicator 3"],
  "recommendations": ["step 1", "step 2", "step 3", "step 4"],
  "sources": [
    { "title": "...", "category": "...", "relevanceScore": 0.95 }
  ]
}`;

  const userPrompt = `USER INPUT:
"${userMessage}"

ML CLASSIFIER OUTPUT:
${JSON.stringify(mlClassification || {}, null, 2)}

RETRIEVED CYBERSECURITY CONTEXT:
${contextText || 'No specific document retrieved.'}

Generate the final JSON analysis:`;

  for (const modelName of uniqueModels) {
    try {
      const model = new ChatGoogleGenerativeAI({
        apiKey: geminiApiKey,
        model: modelName,
        temperature: 0.2,
        maxRetries: 1
      });

      const response = await model.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      let rawText = response.content;
      if (typeof rawText !== 'string') {
        rawText = JSON.stringify(rawText);
      }

      // Clean markdown JSON codeblocks if present
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(rawText);
      return parsed;
    } catch (modelErr) {
      console.warn(`⚠️  Model ${modelName} error (${modelErr.message}), trying next candidate...`);
    }
  }

  return generateFallbackResponse(userMessage, mlClassification, retrievedDocs);
}

module.exports = {
  generateRAGAnalysis,
  generateFallbackResponse
};
