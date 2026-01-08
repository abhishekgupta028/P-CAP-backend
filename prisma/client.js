// Prisma Client with Accelerate for edge runtime
import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'

// Initialize Prisma Client with Accelerate extension
const prisma = new PrismaClient().$extends(withAccelerate())

export default prisma
