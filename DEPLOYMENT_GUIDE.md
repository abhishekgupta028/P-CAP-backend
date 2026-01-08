# Backend Deployment Guide for P-CAP

## 🎯 Overview
Your backend is now configured to work with your deployed frontend at **https://p-cap-frontend.vercel.app**

## 🔧 What Was Updated

### 1. Environment Configuration (`.env`)
- Changed `NODE_ENV` to `production`
- Updated `FRONTEND_URL` to your Vercel deployment
- Updated `CORS_ORIGIN` to allow your frontend domain

### 2. CORS Configuration
Updated CORS settings in all services to allow requests from:
- `http://localhost:3000` (development)
- `https://p-cap-frontend.vercel.app` (production)

Files updated:
- ✅ `server.js` (Main Express server)
- ✅ `app.py` (Flask ML Fraud Detection service)
- ✅ `spam_app.py` (Flask Spam Detection service)
- ✅ `db_api.py` (Database API service)
- ✅ `prismaApi.js` (Prisma Database service)

## 🚀 Deployment Options

### Option 1: Deploy to Render, Railway, or Heroku

#### For Render.com (Recommended):
1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: pcap-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: See below for multi-service setup
   - **Instance Type**: Free or Starter

#### Multi-Service Setup:
Since you have multiple services (Node.js + Flask), you need to:

**Option A: Use Render Blueprint (Recommended)**
Create a `render.yaml` file in your backend directory:

```yaml
services:
  - type: web
    name: pcap-main-server
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: PORT
        value: 5000
      - key: NODE_ENV
        value: production
      - key: FRONTEND_URL
        value: https://p-cap-frontend.vercel.app
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_DATABASE_URL
        sync: false

  - type: web
    name: pcap-ml-fraud
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn -w 4 -b 0.0.0.0:5001 app:app
    envVars:
      - key: PORT
        value: 5001

  - type: web
    name: pcap-spam-detection
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn -w 4 -b 0.0.0.0:5002 spam_app:app
    envVars:
      - key: PORT
        value: 5002
```

**Option B: Deploy Separately**
Deploy each service as a separate Render service and update the internal URLs.

### Option 2: Deploy to Vercel (Limited Support)
Vercel is primarily for frontend and serverless functions. For your multi-service architecture, Render or Railway is better.

### Option 3: Deploy to AWS/Azure/GCP
Use services like:
- AWS Elastic Beanstalk / EC2
- Azure App Service
- Google Cloud Run

## 📝 Environment Variables to Set on Your Hosting Platform

### Required Variables:
```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://p-cap-frontend.vercel.app
CORS_ORIGIN=https://p-cap-frontend.vercel.app
DATABASE_URL=<your-prisma-database-url>
DIRECT_DATABASE_URL=<your-direct-database-url>
```

### Internal Service URLs (if deployed separately):
```env
FLASK_ML_PORT=5001
SPAM_PORT=5002
DB_API_PORT=5003
PRISMA_API_PORT=5004
```

## 🔄 Update Frontend Configuration

In your frontend code, update the API base URL to point to your deployed backend:

```javascript
// Example: Create a config file in your frontend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-backend-url.onrender.com';

// Or in your API calls:
const response = await fetch('https://your-backend-url.onrender.com/api/fraud/detect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(transactionData),
  credentials: 'include'
});
```

## 🧪 Testing the Connection

### 1. Test Health Endpoint
```bash
curl https://your-backend-url.onrender.com/api/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "CyberShield API is running",
  "timestamp": "2026-01-08T...",
  "uptime": 123.45,
  "environment": "production"
}
```

### 2. Test CORS
Open your frontend and check the browser console for CORS errors. If properly configured, API requests should work without errors.

### 3. Test Fraud Detection
```bash
curl -X POST https://your-backend-url.onrender.com/api/fraud/detect \
  -H "Content-Type: application/json" \
  -H "Origin: https://p-cap-frontend.vercel.app" \
  -d '{"amount": 100, "type": "PAYMENT"}'
```

## 📊 API Endpoints Available

### Main Server (port 5000)
- `GET /api/health` - Health check
- `GET /api/system/status` - System status
- `POST /api/fraud/detect` - Fraud detection
- `GET /api/fraud/statistics` - Fraud statistics
- `POST /api/spam/detect` - Spam detection
- `GET /api/spam/statistics` - Spam statistics

### ML Fraud Service (port 5001)
- `POST /api/ml/predict` - ML prediction
- `GET /api/ml/statistics` - ML statistics

### Spam Service (port 5002)
- `POST /api/spam/detect` - Spam detection
- `GET /api/spam/statistics` - Spam statistics

### Database API (port 5003)
- `GET /api/db/health` - Database health
- Various CRUD endpoints

### Prisma API (port 5004)
- `GET /api/prisma/health` - Prisma health
- Database operations

## ⚠️ Important Notes

1. **SSL/HTTPS**: Make sure your backend is deployed with HTTPS enabled (most platforms do this automatically)

2. **Environment Variables**: Never commit `.env` file to Git. Set environment variables in your hosting platform's dashboard

3. **Database**: Ensure your database (Prisma Postgres) is accessible from your hosting platform

4. **Python Dependencies**: Make sure `requirements.txt` includes all necessary packages:
   ```txt
   Flask==2.3.2
   flask-cors==4.0.0
   gunicorn==20.1.0
   pandas
   numpy
   scikit-learn
   nltk
   psycopg2-binary
   python-dotenv
   ```

5. **Model Files**: Ensure ML model files are included in your deployment:
   - `fraud_detection_best_model.pkl`
   - `scaler.pkl`
   - `label_encoders.pkl`
   - `spam_detection_model.pkl`
   - `spam_tfidf_vectorizer.pkl`

## 🐛 Troubleshooting

### CORS Errors
- Check browser console for specific CORS error messages
- Verify backend is returning proper CORS headers
- Ensure frontend URL matches exactly (no trailing slashes)

### 500 Internal Server Errors
- Check backend logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure ML model files are present

### Connection Timeout
- Check if backend is running and accessible
- Verify firewall rules allow incoming connections
- Check if internal services (Flask) can communicate

## 📚 Next Steps

1. Deploy your backend to a hosting platform
2. Get the deployed backend URL
3. Update frontend environment variables with the backend URL
4. Test all API endpoints from your frontend
5. Monitor logs for any errors

## 🔗 Useful Links

- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Flask Deployment Guide](https://flask.palletsprojects.com/en/2.3.x/deploying/)
- [Express Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
