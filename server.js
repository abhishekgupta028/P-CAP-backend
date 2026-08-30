const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;  // FIX: Changed from 5001 to 5000 to avoid conflict with Fraud ML
const FLASK_ML_PORT = process.env.FLASK_ML_PORT || 5001;
const SPAM_PORT = process.env.SPAM_PORT || 5002;
const DB_API_PORT = process.env.DB_API_PORT || 5003;
const PRISMA_API_PORT = process.env.PRISMA_API_PORT || 5004;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://p-cap-frontend.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'CyberShield API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// System status
app.get('/api/system/status', (req, res) => {
  res.json({
    status: 'operational',
    uptime: '99.9%',
    responseTime: '45ms',
    activeUsers: 15247,
    threatsBlocked: 1423,
    lastCheck: new Date().toISOString()
  });
});

// Fraud Detection API - Proxy to Flask ML Service
app.post('/api/fraud/detect', async (req, res) => {
  try {
    const transactionData = req.body;
    
    // Validate input
    if (!transactionData || Object.keys(transactionData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Transaction data is required'
      });
    }

    // Forward to Flask ML service
    const mlResponse = await axios.post(
      `http://localhost:${FLASK_ML_PORT}/api/ml/predict`,
      transactionData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    res.json({
      success: true,
      data: mlResponse.data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Fraud detection error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Fraud detection service unavailable',
      details: error.message
    });
  }
});

// Get fraud statistics
app.get('/api/fraud/statistics', async (req, res) => {
  try {
    const response = await axios.get(`http://localhost:${FLASK_ML_PORT}/api/ml/statistics`);
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Unable to fetch statistics'
    });
  }
});

// Spam Detection API - Proxy to Flask Spam Service
app.post('/api/spam/detect', async (req, res) => {
  try {
    const messageData = req.body;
    
    // Validate input
    if (!messageData || !messageData.message) {
      return res.status(400).json({
        success: false,
        error: 'Message text is required'
      });
    }

    // Forward to Flask Spam service
    const spamResponse = await axios.post(
      `http://localhost:${SPAM_PORT}/api/spam/detect`,
      messageData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    // Return Flask response directly (it already has success and data fields)
    res.json(spamResponse.data);

  } catch (error) {
    console.error('Spam detection error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Spam detection service unavailable',
      details: error.message
    });
  }
});

// Get spam statistics
app.get('/api/spam/statistics', async (req, res) => {
  try {
    const response = await axios.get(`http://localhost:${SPAM_PORT}/api/spam/statistics`);
    // Return Flask response directly
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Unable to fetch spam statistics'
    });
  }
});

// Batch spam detection
app.post('/api/spam/batch-detect', async (req, res) => {
  try {
    const messagesData = req.body;
    
    const response = await axios.post(
      `http://localhost:${SPAM_PORT}/api/spam/batch-detect`,
      messagesData,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    // Return Flask response directly
    res.json(response.data);

  } catch (error) {
    console.error('Batch spam detection error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Batch spam detection failed',
      details: error.message
    });
  }
});

// ============================================
// DATABASE API PROXY ROUTES (Port 5003)
// ============================================

// User management endpoints
app.post('/api/db/user/create', async (req, res) => {
  try {
    const response = await axios.post(
      `http://localhost:${DB_API_PORT}/api/db/user/create`,
      req.body,
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

app.get('/api/db/user/get/:clerk_user_id', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/user/get/${req.params.clerk_user_id}`,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

app.get('/api/db/user/:user_id', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/user/${req.params.user_id}`,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Fraud logging endpoint
app.post('/api/db/fraud/log', async (req, res) => {
  try {
    const response = await axios.post(
      `http://localhost:${DB_API_PORT}/api/db/fraud/log`,
      req.body,
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Spam logging endpoint
app.post('/api/db/spam/log', async (req, res) => {
  try {
    console.log('📡 Proxying spam log to database API:', req.body);
    const response = await axios.post(
      `http://localhost:${DB_API_PORT}/api/db/spam/log`,
      req.body,
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    console.log('✅ Database API response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('❌ Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get fraud logs
app.get('/api/db/fraud/logs', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/fraud/logs`,
      { params: req.query, timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get spam logs
app.get('/api/db/spam/logs', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/spam/logs`,
      { params: req.query, timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get all spam logs (for dashboard)
app.get('/api/db/spam/all', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/spam/all`,
      { params: req.query, timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get all fraud logs (for dashboard)
app.get('/api/db/fraud/all', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/fraud/all`,
      { params: req.query, timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get spam history for user
app.get('/api/db/spam/history/:user_id', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/spam/history/${req.params.user_id}`,
      { params: req.query, timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get fraud history for user
app.get('/api/db/fraud/history/:user_id', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/fraud/history/${req.params.user_id}`,
      { params: req.query, timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get overall statistics
app.get('/api/db/stats/overall', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/stats/overall`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Get user statistics
app.get('/api/db/stats/user/:user_id', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/stats/user/${req.params.user_id}`,
      { timeout: 10000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Database API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Database service unavailable' }
    );
  }
});

// Database health check
app.get('/api/db/health', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${DB_API_PORT}/api/db/health`,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database service unavailable' });
  }
});

// ============================================
// PRISMA API PROXY ROUTES (Port 5004)
// ============================================

// Prisma user upsert
app.post('/api/prisma/user/upsert', async (req, res) => {
  try {
    const response = await axios.post(
      `http://localhost:${PRISMA_API_PORT}/api/prisma/user/upsert`,
      req.body,
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Prisma API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Prisma service unavailable' }
    );
  }
});

// Prisma fraud log
app.post('/api/prisma/fraud/log', async (req, res) => {
  try {
    const response = await axios.post(
      `http://localhost:${PRISMA_API_PORT}/api/prisma/fraud/log`,
      req.body,
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Prisma API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Prisma service unavailable' }
    );
  }
});

// Prisma spam log
app.post('/api/prisma/spam/log', async (req, res) => {
  try {
    const response = await axios.post(
      `http://localhost:${PRISMA_API_PORT}/api/prisma/spam/log`,
      req.body,
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Prisma API error:', error.message);
    res.status(error.response?.status || 500).json(
      error.response?.data || { success: false, error: 'Prisma service unavailable' }
    );
  }
});

// Prisma health check
app.get('/api/prisma/health', async (req, res) => {
  try {
    const response = await axios.get(
      `http://localhost:${PRISMA_API_PORT}/api/prisma/health`,
      { timeout: 5000 }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: 'Prisma service unavailable' });
  }
});

// Real-time alerts
app.get('/api/alerts/realtime', (req, res) => {
  const mockAlerts = [
    {
      id: 1,
      type: 'high',
      title: 'Phishing Attempt Detected',
      description: 'Suspicious email from unknown sender',
      timestamp: new Date().toISOString(),
      location: 'Email System'
    },
    {
      id: 2,
      type: 'medium',
      title: 'Unusual Login Location',
      description: 'Login attempt from new location',
      timestamp: new Date().toISOString(),
      location: 'Authentication Service'
    }
  ];

  res.json({
    success: true,
    alerts: mockAlerts,
    count: mockAlerts.length
  });
});

// Threat map data
app.get('/api/threats/map', (req, res) => {
  const mockThreats = [
    { country: 'United States', threats: 245, type: 'Phishing' },
    { country: 'China', threats: 198, type: 'Malware' },
    { country: 'Russia', threats: 167, type: 'Ransomware' },
    { country: 'India', threats: 134, type: 'Identity Theft' },
    { country: 'Brazil', threats: 112, type: 'Credit Card Fraud' }
  ];

  res.json({
    success: true,
    threats: mockThreats,
    totalThreats: mockThreats.reduce((sum, t) => sum + t.threats, 0)
  });
});

// Analytics endpoint
app.get('/api/analytics/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalTransactions: 16813,
      fraudDetected: 10088,
      legitTransactions: 6725,
      fraudRate: 60.0,
      avgResponseTime: '45ms',
      modelAccuracy: 75.0,
      lastUpdated: new Date().toISOString()
    }
  });
});

// Resources endpoint
app.get('/api/resources', (req, res) => {
  const { userType, category } = req.query;
  
  const resources = [
    {
      id: 1,
      title: 'Understanding Phishing Attacks',
      category: 'Phishing',
      userType: 'all',
      description: 'Learn how to identify and avoid phishing scams',
      url: '/resources/phishing-guide',
      type: 'guide'
    },
    {
      id: 2,
      title: 'Secure Online Banking',
      category: 'Banking Security',
      userType: 'individual',
      description: 'Best practices for safe online banking',
      url: '/resources/banking-security',
      type: 'article'
    },
    {
      id: 3,
      title: 'Enterprise Security Framework',
      category: 'Enterprise',
      userType: 'business',
      description: 'Comprehensive security for businesses',
      url: '/resources/enterprise-security',
      type: 'whitepaper'
    }
  ];

  let filteredResources = resources;
  
  if (userType && userType !== 'all') {
    filteredResources = filteredResources.filter(
      r => r.userType === userType || r.userType === 'all'
    );
  }
  
  if (category) {
    filteredResources = filteredResources.filter(r => r.category === category);
  }

  res.json({
    success: true,
    resources: filteredResources,
    count: filteredResources.length
  });
});

// Quiz endpoints
app.get('/api/quiz/questions', (req, res) => {
  const { userType, difficulty } = req.query;
  
  const questions = [
    {
      id: 1,
      question: 'What is phishing?',
      options: [
        'A type of fishing sport',
        'A cyber attack that tricks users into revealing sensitive information',
        'A network protocol',
        'A programming language'
      ],
      correctAnswer: 1,
      difficulty: 'easy',
      userType: 'all'
    },
    {
      id: 2,
      question: 'Which of these is a strong password?',
      options: [
        'password123',
        'P@ssw0rd!2024#Secure',
        'myname',
        '12345678'
      ],
      correctAnswer: 1,
      difficulty: 'easy',
      userType: 'all'
    },
    {
      id: 3,
      question: 'What does HTTPS stand for?',
      options: [
        'HyperText Transfer Protocol Secure',
        'High Transfer Protocol System',
        'Hyper Transfer Programming Security',
        'None of the above'
      ],
      correctAnswer: 0,
      difficulty: 'medium',
      userType: 'all'
    }
  ];

  res.json({
    success: true,
    questions: questions,
    count: questions.length
  });
});

app.post('/api/quiz/submit', (req, res) => {
  const { answers, userType } = req.body;
  
  // Calculate score (mock implementation)
  const totalQuestions = answers.length;
  const correctAnswers = Math.floor(totalQuestions * 0.75); // Mock 75% score
  
  res.json({
    success: true,
    result: {
      totalQuestions,
      correctAnswers,
      score: Math.round((correctAnswers / totalQuestions) * 100),
      passed: correctAnswers >= totalQuestions * 0.7,
      certificate: correctAnswers >= totalQuestions * 0.7
    }
  });
});

// User preferences
app.post('/api/user/preferences', (req, res) => {
  const preferences = req.body;
  
  // In a real app, save to database
  res.json({
    success: true,
    message: 'Preferences saved successfully',
    preferences
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CyberShield API Server running on port ${PORT}`);
  console.log(`📡 Flask ML Service expected on port ${FLASK_ML_PORT}`);
  console.log(`📧 Spam ML Service expected on port ${SPAM_PORT}`);
  console.log(`💾 Database API expected on port ${DB_API_PORT}`);
  console.log(`🗄️  Prisma API expected on port ${PRISMA_API_PORT}`);
  console.log(`🌐 Frontend expected at ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
