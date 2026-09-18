const express = require('express');
const router = express.Router();
const axios = require('axios');
const prisma = require('../prismaClient');
const { retrieveCyberContext } = require('../rag/retriever');
const { generateRAGAnalysis } = require('../rag/chain');

const SPAM_PORT = process.env.SPAM_PORT || 5002;

/**
 * Helper to get ML classification from Python spam service or fallback
 */
async function getMLClassification(message) {
  try {
    const response = await axios.post(
      `http://localhost:${SPAM_PORT}/api/spam/detect`,
      { message },
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    if (response.data && response.data.data) {
      return response.data.data;
    }
    return response.data;
  } catch (error) {
    console.warn('⚠️  Spam ML service unreachable, using heuristic classifier:', error.message);
    const lower = (message || '').toLowerCase();
    const isThreat = /otp|kyc|block|urgent|bank|winner|lottery|apk|refund|upi|pin|click|http/i.test(lower);
    return {
      is_spam: isThreat,
      spam_label: isThreat ? 'SPAM' : 'LEGITIMATE (HAM)',
      category: isThreat ? 'Suspicious Threat' : 'General Query',
      confidence: 0.85,
      risk_level: isThreat ? 'HIGH' : 'LOW'
    };
  }
}

/**
 * POST /api/chat/analyze
 * Full Pipeline:
 * User Query -> ML Classification -> RAG Vector Retrieval -> Gemini LLM -> Prisma DB -> Client
 */
router.post('/analyze', async (req, res) => {
  try {
    const { message, clerkUserId, queryType = 'suspicious_message' } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message or query text is required'
      });
    }

    const trimmedMessage = message.trim();

    // 1. Run Python ML Classification (TF-IDF + LinearSVC)
    const mlClassification = await getMLClassification(trimmedMessage);

    // 2. Retrieve relevant Cybersecurity Knowledge Chunks (Pinecone + Gemini Embeddings / KB)
    const retrievedDocs = await retrieveCyberContext(trimmedMessage, 3);

    // 3. Generate context-grounded LLM analysis (LangChain + Gemini)
    const ragResult = await generateRAGAnalysis({
      userMessage: trimmedMessage,
      mlClassification,
      retrievedDocs
    });

    // 4. Persist to PostgreSQL via Prisma
    let savedInteraction = null;
    try {
      // Find matching user if clerkUserId is provided
      let dbUserId = null;
      if (clerkUserId) {
        const userRecord = await prisma.user.findUnique({
          where: { clerkUserId: clerkUserId }
        });
        if (userRecord) {
          dbUserId = userRecord.id;
        }
      }

      savedInteraction = await prisma.chatInteraction.create({
        data: {
          userId: dbUserId,
          clerkUserId: clerkUserId || null,
          message: trimmedMessage,
          queryType: queryType,
          classification: mlClassification,
          riskLevel: ragResult.riskLevel || mlClassification.risk_level || 'LOW',
          answer: ragResult,
          sources: ragResult.sources || []
        }
      });
    } catch (dbError) {
      console.warn('⚠️  Could not persist chat interaction to PostgreSQL:', dbError.message);
    }

    // 5. Send Response
    return res.json({
      success: true,
      data: {
        id: savedInteraction?.id || Date.now(),
        query: trimmedMessage,
        queryType,
        classification: {
          isSpam: mlClassification.is_spam,
          label: mlClassification.spam_label,
          category: ragResult.threatCategory || mlClassification.category,
          confidence: ragResult.confidenceScore || mlClassification.confidence,
          riskLevel: ragResult.riskLevel || mlClassification.risk_level
        },
        analysis: ragResult,
        sources: ragResult.sources || [],
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Chat / RAG analysis endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process cybersecurity analysis',
      details: error.message
    });
  }
});

/**
 * GET /api/chat/history/:clerkUserId
 * Fetch previous interactions for user
 */
router.get('/history/:clerkUserId', async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    if (!clerkUserId) {
      return res.status(400).json({ success: false, error: 'clerkUserId is required' });
    }

    const history = await prisma.chatInteraction.findMany({
      where: { clerkUserId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('❌ Fetch chat history error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch interaction history'
    });
  }
});

/**
 * GET /api/chat/suggestions
 * Returns suggested prompt templates & common scam scenarios
 */
router.get('/suggestions', (req, res) => {
  res.json({
    success: true,
    suggestions: [
      {
        title: 'Electricity Disconnection Scam',
        category: 'OTP fraud',
        prompt: 'Dear consumer, your electricity power will be disconnected tonight at 9.30 pm from electricity office because your previous month bill was not updated. Please immediately contact our officer at 9876543210.'
      },
      {
        title: 'UPI Collect Request Trap',
        category: 'UPI scam',
        prompt: 'Someone from OLX sent me a QR code and asked me to scan it in Google Pay and enter my PIN to receive Rs. 15,000 for my used sofa. Is this safe?'
      },
      {
        title: 'Bank KYC Expiry Warning',
        category: 'Phishing',
        prompt: 'Dear SBI User, your YONO account has been suspended due to pending KYC update. Click http://sbi-kyc-verify.xyz/login to avoid permanent block.'
      },
      {
        title: 'Part-time Telegram Review Job',
        category: 'Phishing',
        prompt: 'Earn Rs 5000 daily by liking YouTube videos and rating hotels on Google Maps. Join Telegram @VIP_Merchant_Tasks to start with initial bonus.'
      },
      {
        title: 'Reporting Indian Cyber Fraud',
        category: 'Incident response',
        prompt: 'I was scammed of money 30 minutes ago via UPI. What is the exact procedure to report and freeze the funds in India?'
      }
    ]
  });
});

module.exports = router;
