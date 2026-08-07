require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const estimateRoutes = require('./routes/estimate.routes');

const app = express();
const PORT = process.env.PORT || 5050;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/estimate_db';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static web application serving
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/estimates', estimateRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server immediately
app.listen(PORT, () => {
  console.log(`🚀 Estimate App Server listening on http://localhost:${PORT}`);
});

// Connect to MongoDB asynchronously with 5s server selection timeout
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
  })
  .catch((err) => {
    console.error('⚠️ MongoDB Connection Failed:', err.message);
    console.log('💡 Note: Ensure MongoDB service is running or set valid MONGODB_URI in .env');
  });
