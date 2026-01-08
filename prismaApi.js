// Prisma-based Database API
const express = require('express');
const cors = require('cors');
const prisma = require('./prismaClient');
require('dotenv').config();

const app = express();
const PORT = process.env.PRISMA_API_PORT || 5004;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/prisma/health', async (req, res) => {
  try {
    await prisma.$connect();
    res.json({
      success: true,
      status: 'connected',
      message: 'Prisma database connection is healthy',
      database: 'Prisma Postgres'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message
    });
  }
});

// Create or get user
app.post('/api/prisma/user/upsert', async (req, res) => {
  try {
    const { clerkUserId, email, name } = req.body;

    if (!clerkUserId || !email) {
      return res.status(400).json({
        success: false,
        error: 'clerkUserId and email are required'
      });
    }

    const user = await prisma.user.upsert({
      where: { clerkUserId },
      update: { name, email },
      create: { clerkUserId, email, name }
    });

    res.json({
      success: true,
      message: user.createdAt.getTime() === user.updatedAt.getTime() 
        ? 'User created successfully' 
        : 'User updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user by Clerk ID
app.get('/api/prisma/user/:clerkUserId', async (req, res) => {
  try {
    const { clerkUserId } = req.params;

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        _count: {
          select: {
            fraudLogs: true,
            spamLogs: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Log fraud detection
app.post('/api/prisma/fraud/log', async (req, res) => {
  try {
    const { 
      clerkUserId, 
      transactionAmount, 
      transactionType, 
      isFraud, 
      confidence, 
      riskLevel, 
      transactionData 
    } = req.body;

    // Get or create user
    let userId = null;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkUserId }
      });
      userId = user ? user.id : null;
    }

    const fraudLog = await prisma.fraudLog.create({
      data: {
        userId,
        transactionAmount,
        transactionType,
        isFraud,
        confidence,
        riskLevel,
        transactionData
      }
    });

    res.json({
      success: true,
      message: 'Fraud detection logged successfully',
      log: fraudLog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Log spam detection
app.post('/api/prisma/spam/log', async (req, res) => {
  try {
    const {
      clerkUserId,
      message,
      isSpam,
      confidence,
      spamProbability,
      hamProbability,
      riskLevel
    } = req.body;

    // Get or create user
    let userId = null;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { clerkUserId }
      });
      userId = user ? user.id : null;
    }

    const spamLog = await prisma.spamLog.create({
      data: {
        userId,
        message,
        isSpam,
        confidence,
        spamProbability,
        hamProbability,
        riskLevel
      }
    });

    res.json({
      success: true,
      message: 'Spam detection logged successfully',
      log: spamLog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get fraud history
app.get('/api/prisma/fraud/history/:clerkUserId', async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const user = await prisma.user.findUnique({
      where: { clerkUserId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const history = await prisma.fraudLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get spam history
app.get('/api/prisma/spam/history/:clerkUserId', async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const user = await prisma.user.findUnique({
      where: { clerkUserId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const history = await prisma.spamLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user statistics
app.get('/api/prisma/stats/:clerkUserId', async (req, res) => {
  try {
    const { clerkUserId } = req.params;

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      include: {
        _count: {
          select: {
            fraudLogs: true,
            spamLogs: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get fraud stats
    const fraudStats = await prisma.fraudLog.aggregate({
      where: { userId: user.id },
      _count: true,
      _avg: { confidence: true }
    });

    const fraudDetected = await prisma.fraudLog.count({
      where: { userId: user.id, isFraud: true }
    });

    // Get spam stats
    const spamStats = await prisma.spamLog.aggregate({
      where: { userId: user.id },
      _count: true,
      _avg: { confidence: true }
    });

    const spamDetected = await prisma.spamLog.count({
      where: { userId: user.id, isSpam: true }
    });

    res.json({
      success: true,
      stats: {
        fraud: {
          totalChecks: fraudStats._count,
          fraudDetected: fraudDetected,
          avgConfidence: fraudStats._avg.confidence
        },
        spam: {
          totalChecks: spamStats._count,
          spamDetected: spamDetected,
          avgConfidence: spamStats._avg.confidence
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all users (admin)
app.get('/api/prisma/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            fraudLogs: true,
            spamLogs: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🗄️  Prisma API Server running on port ${PORT}`);
  console.log(`📊 Database: Prisma Postgres with Accelerate`);
  console.log(`🌐 Endpoints: http://localhost:${PORT}/api/prisma/`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
