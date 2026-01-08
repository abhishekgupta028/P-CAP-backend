# Frontend-Backend Connection Summary

## 🎯 Connection Status: CONFIGURED ✅

Your backend is now properly configured to accept requests from your deployed frontend.

### Frontend URL
```
https://p-cap-frontend.vercel.app
```

### Backend Services (Local Development)
- Main Server: `http://localhost:5000`
- ML Fraud Detection: `http://localhost:5001`
- Spam Detection: `http://localhost:5002`
- Database API: `http://localhost:5003`
- Prisma API: `http://localhost:5004`

### Backend Services (After Deployment)
- Main Server: `https://pcap-main-server.onrender.com`
- ML Fraud Detection: `https://pcap-ml-fraud.onrender.com`
- Spam Detection: `https://pcap-spam-detection.onrender.com`
- Database API: `https://pcap-db-api.onrender.com`
- Prisma API: `https://pcap-prisma-api.onrender.com`

## 🔄 Changes Made

### 1. Environment Configuration
- ✅ Updated `.env` with production frontend URL
- ✅ Changed NODE_ENV to production
- ✅ Configured CORS origins

### 2. CORS Configuration
Updated CORS in all services:
- ✅ `server.js` (Express)
- ✅ `app.py` (Flask ML)
- ✅ `spam_app.py` (Flask Spam)
- ✅ `db_api.py` (Database API)
- ✅ `prismaApi.js` (Prisma API)

### 3. Deployment Files Created
- ✅ `render.yaml` - Multi-service deployment configuration
- ✅ `DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
- ✅ `README.md` - Quick start guide

### 4. Dependencies Updated
- ✅ `requirements.txt` - Added missing Python packages

## 📡 API Request Format

### From Frontend (JavaScript/TypeScript)
```javascript
// Example: Fraud Detection
const detectFraud = async (transactionData) => {
  try {
    const response = await fetch('https://pcap-main-server.onrender.com/api/fraud/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for CORS
      body: JSON.stringify(transactionData)
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
};

// Example: Spam Detection
const detectSpam = async (messageData) => {
  try {
    const response = await fetch('https://pcap-main-server.onrender.com/api/spam/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(messageData)
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### From Frontend (Axios)
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://pcap-main-server.onrender.com',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Fraud detection
const detectFraud = async (data) => {
  const response = await api.post('/api/fraud/detect', data);
  return response.data;
};

// Spam detection
const detectSpam = async (data) => {
  const response = await api.post('/api/spam/detect', data);
  return response.data;
};
```

## 🧪 Testing Checklist

### Local Testing
- [ ] Start all backend services locally
- [ ] Test health endpoints
- [ ] Test fraud detection endpoint
- [ ] Test spam detection endpoint
- [ ] Check browser console for CORS errors

### Production Testing (After Deployment)
- [ ] Deploy backend to Render/Railway
- [ ] Get deployed URLs
- [ ] Update frontend environment variables
- [ ] Test health endpoint from browser
- [ ] Test API calls from frontend
- [ ] Check for CORS errors in browser console
- [ ] Monitor backend logs for errors

## 🔧 Frontend Environment Variables

Update your frontend `.env` or Vercel environment variables:

```env
# Development
NEXT_PUBLIC_API_URL=http://localhost:5000

# Production (Update after backend deployment)
NEXT_PUBLIC_API_URL=https://pcap-main-server.onrender.com
```

## 📊 Expected API Responses

### Health Check
```json
{
  "status": "OK",
  "message": "CyberShield API is running",
  "timestamp": "2026-01-08T10:30:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

### Fraud Detection Success
```json
{
  "success": true,
  "data": {
    "prediction": "LEGITIMATE",
    "confidence": 0.95,
    "risk_score": 0.05
  },
  "timestamp": "2026-01-08T10:30:00.000Z"
}
```

### Spam Detection Success
```json
{
  "success": true,
  "data": {
    "prediction": "NOT_SPAM",
    "confidence": 0.92,
    "message": "Message is safe"
  }
}
```

## ⚠️ Common Issues & Solutions

### Issue: CORS Error
**Error**: "Access to fetch at ... has been blocked by CORS policy"
**Solution**: 
- Verify backend CORS configuration includes your frontend URL
- Check that frontend URL in backend matches exactly (no trailing slash)
- Ensure `credentials: 'include'` is set in frontend requests

### Issue: 500 Internal Server Error
**Solution**:
- Check backend logs in Render dashboard
- Verify all environment variables are set
- Ensure ML model files are uploaded
- Check database connection

### Issue: Timeout
**Solution**:
- Increase timeout in frontend requests
- Check backend is running and accessible
- Verify Render service is not sleeping (free tier)

### Issue: 404 Not Found
**Solution**:
- Verify API endpoint URL is correct
- Check backend is deployed and running
- Ensure route exists in backend code

## 🚀 Next Steps

1. **Deploy Backend**: Follow instructions in `DEPLOYMENT_GUIDE.md`
2. **Get Backend URL**: Copy the main server URL from Render
3. **Update Frontend**: Add backend URL to frontend environment variables
4. **Test Connection**: Make test API calls from frontend
5. **Monitor**: Check logs for any errors

## 📞 Support

For deployment issues:
- Check Render/Railway documentation
- Review backend logs in deployment dashboard
- Test endpoints with curl or Postman
- Check browser network tab for detailed error messages
