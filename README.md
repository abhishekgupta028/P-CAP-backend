# P-CAP Backend - Quick Setup

## ✅ Backend Configuration Complete!

Your backend is now configured to work with your frontend at: **https://p-cap-frontend.vercel.app**

## 🚀 Quick Deployment to Render

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Configure backend for production deployment"
   git push origin main
   ```

2. **Deploy on Render**:
   - Go to [render.com](https://render.com) and sign in
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Select the `backend` folder
   - Click "Apply" - Render will automatically deploy all services from `render.yaml`

3. **Get Your Backend URLs**:
   After deployment, you'll get URLs like:
   - Main Server: `https://pcap-main-server.onrender.com`
   - ML Fraud: `https://pcap-ml-fraud.onrender.com`
   - Spam Detection: `https://pcap-spam-detection.onrender.com`

4. **Update Frontend**:
   In your frontend, update the API base URL to:
   ```javascript
   const API_URL = 'https://pcap-main-server.onrender.com';
   ```

## 🧪 Test Your Backend

Once deployed, test the health endpoint:
```bash
curl https://pcap-main-server.onrender.com/api/health
```

## 📝 What Was Configured

✅ CORS enabled for your Vercel frontend
✅ All services configured for production
✅ Environment variables updated
✅ Deployment files created (render.yaml)
✅ All dependencies updated

## 🔗 API Endpoints

Your frontend can now call:
- `POST /api/fraud/detect` - Fraud detection
- `POST /api/spam/detect` - Spam detection
- `GET /api/health` - Health check
- `GET /api/system/status` - System status
- And all other endpoints...

## ⚡ Local Testing

Before deploying, test locally:
```bash
# Terminal 1 - Start main server
node server.js

# Terminal 2 - Start ML fraud service
python app.py

# Terminal 3 - Start spam service
python spam_app.py
```

Then test from your frontend locally or use curl:
```bash
curl -X POST http://localhost:5000/api/fraud/detect \
  -H "Content-Type: application/json" \
  -H "Origin: https://p-cap-frontend.vercel.app" \
  -d '{"amount": 100, "merchant": "Test"}'
```

## 📚 Full Documentation

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed deployment instructions and troubleshooting.

## 🆘 Need Help?

- Check backend logs in Render dashboard
- Verify environment variables are set
- Check browser console for CORS errors
- Ensure all ML model files are uploaded
