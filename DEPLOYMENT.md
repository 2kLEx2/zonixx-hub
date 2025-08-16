# Zonixx Hub Deployment Guide

## Quick Start - Railway (Recommended)

### 1. Prepare Your Code
```bash
# Add missing dependencies to package.json
npm install puppeteer-extra puppeteer-extra-plugin-stealth --save
```

### 2. Deploy to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 3. Set Environment Variables
In Railway dashboard:
- `PANDASCORE_API_KEY`: Your PandaScore API key
- `PORT`: 7000
- `NODE_ENV`: production

## Alternative Deployments

### Render
1. Connect your GitHub repo to Render
2. Use the included `render.yaml` configuration
3. Set environment variables in Render dashboard

### Docker (Any Platform)
```bash
# Build and run locally
docker build -t zonixx-hub .
docker run -p 7000:7000 -e PANDASCORE_API_KEY=your_key zonixx-hub

# Deploy to any Docker-compatible platform
```

### VPS Manual Setup
```bash
# On Ubuntu/Debian server
sudo apt update
sudo apt install nodejs npm nginx

# Clone your repo
git clone your-repo-url
cd zonixx-hub

# Install dependencies
npm install

# Install PM2 for process management
npm install -g pm2

# Start application
pm2 start server.js --name zonixx-hub
pm2 startup
pm2 save
```

## Security Considerations

### 1. Environment Variables
- Never commit API keys to Git
- Use `.env` files locally, platform env vars in production
- Rotate API keys regularly

### 2. API Key Security
```javascript
// In server.js, replace hardcoded API key:
const PANDASCORE_API_KEY = process.env.PANDASCORE_API_KEY || 'fallback_key';
```

### 3. Rate Limiting
Consider adding rate limiting for API endpoints:
```bash
npm install express-rate-limit
```

### 4. CORS Configuration
Update CORS settings for production domain:
```javascript
app.use(cors({
  origin: ['https://yourdomain.com', 'http://localhost:7000']
}));
```

## File Storage Considerations

Your app uses JSON files for data storage. For production:

### Option 1: Keep File Storage (Simple)
- Ensure persistent disk/volume is configured
- Regular backups of JSON files
- Works well for small-scale usage

### Option 2: Database Migration (Scalable)
Consider migrating to a database for better scalability:
- **SQLite**: Simple, file-based
- **PostgreSQL**: Full-featured, many hosts offer free tiers
- **MongoDB**: Document-based, good for JSON data

## Monitoring & Maintenance

### Health Checks
Add a health endpoint:
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### Logging
Consider structured logging:
```bash
npm install winston
```

### Error Tracking
Add error monitoring:
```bash
npm install @sentry/node
```

## Cost Estimates

| Platform | Monthly Cost | Features |
|----------|-------------|----------|
| Railway | $5-20 | Auto-scaling, easy deployment |
| Render | $0-7 | Free tier available |
| Heroku | $7+ | Mature platform |
| VPS | $5-10 | Full control, more setup |

## Troubleshooting

### Puppeteer Issues
If HLTV scraper fails:
1. Check Chrome installation in container
2. Verify stealth plugin is working
3. Monitor for IP blocking

### Memory Issues
If app crashes due to memory:
1. Increase memory allocation
2. Optimize image caching
3. Consider lazy loading for large datasets

### File Permission Issues
Ensure write permissions for JSON files:
```bash
chmod 755 /app/public
```
