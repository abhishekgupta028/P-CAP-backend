// Prisma Client for Node.js backend (CommonJS)
const { PrismaClient } = require('@prisma/client');
const { withAccelerate } = require('@prisma/extension-accelerate');
require('dotenv').config();

// Initialize Prisma Client with Accelerate extension
const prisma = new PrismaClient().$extends(withAccelerate());

module.exports = prisma;
