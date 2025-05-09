const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const twilio = require('twilio');
const { DateTime } = require('luxon');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Error handling for serverless environments
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => console.log(`MongoDB connected at ${DateTime.now().setZone('Asia/Kolkata').toFormat('dd LLL yyyy, HH:mm:ss')}`))
.catch(err => console.error('MongoDB connection error:', err));

// Twilio Client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  mobileNo: String,
  vehicleId: { type: String, unique: true },
  driverName: String,
  vehicleNo: String,
  model: String,
  email: String,
  driverNo: {
    type: String,
    validate: {
      validator: v => /^\+[1-9]\d{1,14}$/.test(v),
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  callLimit: { type: Number, default: 1, min: 1 },
  callsLeft: { type: Number, default: 1, min: 0 },
  lastCallTime: {
    type: Date,
    validate: {
      validator: v => v <= new Date(),
      message: 'Last call time cannot be in the future!'
    }
  }
});

const User = mongoose.model('User', UserSchema);

// Cron Job Endpoint (1:50 AM IST)
app.get('/api/reset-call-limits', async (req, res) => {
  try {
    const result = await User.updateMany(
      {}, 
      { $set: { callsLeft: "$callLimit" } }
    );
    
    console.log(`[CRON] Reset ${result.modifiedCount} users at ${DateTime.now().setZone('Asia/Kolkata').toFormat('dd LLL yyyy, HH:mm:ss')}`);
    res.json({ 
      success: true, 
      message: `Reset ${result.modifiedCount} users successfully`,
      nextReset: getNextResetTime()
    });
  } catch (err) {
    console.error('[CRON ERROR]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Reset failed', 
      error: err.message 
    });
  }
});

// Call Initiation Endpoint
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // IST Time Handling
    const nowIST = DateTime.now().setZone('Asia/Kolkata');
    const lastCallIST = user.lastCallTime ? 
      DateTime.fromJSDate(user.lastCallTime).setZone('Asia/Kolkata') : null;

    // Daily Auto-Reset Check
    if (lastCallIST && !lastCallIST.hasSame(nowIST, 'day')) {
      user.callsLeft = user.callLimit;
      console.log(`Auto-reset triggered for ${user.vehicleId}`);
    }

    if (user.callsLeft <= 0) {
      return res.status(429).json({
        success: false,
        message: 'Daily limit exceeded. Resets at 1:50 AM IST',
        resetTime: getNextResetTime()
      });
    }

    // Twilio Call
    const call = await client.calls.create({
      twiml: `<Response>
        <Say voice="Polly.Aditi" language="hi-IN">
          यह आपके वाहन के बारे में एक तात्कालिक चेतावनी है। कृपया तुरंत जाँच करें।
        </Say>
      </Response>`,
      to: user.driverNo,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    // Update User
    user.callsLeft -= 1;
    user.lastCallTime = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Call initiated successfully',
      callsLeft: user.callsLeft,
      nextReset: getNextResetTime()
    });

  } catch (error) {
    console.error('[CALL ERROR]', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate call',
      error: error.message
    });
  }
});

// Helper Function for Reset Time
function getNextResetTime() {
  const nowIST = DateTime.now().setZone('Asia/Kolkata');
  let resetTime = nowIST.set({ 
    hour: 1, 
    minute: 50,  // Changed to 1:50 AM
    second: 0, 
    millisecond: 0 
  });
  
  if (resetTime <= nowIST) {
    resetTime = resetTime.plus({ days: 1 });
  }
  
  return {
    iso: resetTime.toISO(),
    istFormatted: resetTime.toFormat('dd LLL yyyy, HH:mm:ss'),
    timestamp: resetTime.toMillis()
  };
}

// Additional Routes (Users, Health, etc.)
// [Include all other routes from previous code here]

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    istTime: DateTime.now().setZone('Asia/Kolkata').toISO(),
    nextReset: getNextResetTime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

module.exports = app;