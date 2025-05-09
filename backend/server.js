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

// Serverless error handling
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000
})
.then(() => console.log(`MongoDB connected at ${DateTime.now().setZone('Asia/Kolkata').toFormat('dd LLL yyyy, HH:mm:ss')}`))
.catch(err => console.error('MongoDB connection failed:', err));

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
      validator: v => v <= Date.now(),
      message: 'Last call time cannot be in the future!'
    }
  }
});

const User = mongoose.model('User', UserSchema);

// ======================
// Routes
// ======================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'Server is running',
    resetTime: getNextResetTime().istFormatted,
    documentation: {
      endpoints: {
        createUser: 'POST /api/users',
        getUser: 'GET /api/users/:vehicleId',
        callOwner: 'POST /api/call-owner'
      }
    }
  });
});

// Cron reset endpoint (1:44 AM IST)
app.get('/api/reset-call-limits', async (req, res) => {
  try {
    const result = await User.updateMany(
      {}, 
      { $set: { callsLeft: "$callLimit" } }
    );
    
    console.log(`[CRON] Reset ${result.modifiedCount} users at ${DateTime.now().setZone('Asia/Kolkata').toFormat('dd LLL yyyy, HH:mm:ss')}`);
    res.json({ 
      success: true, 
      message: `Reset ${result.modifiedCount} users`,
      nextReset: getNextResetTime()
    });
  } catch (err) {
    console.error('[CRON ERROR]', err);
    res.status(500).json({ 
      success: false, 
      message: 'Reset failed', 
      error: process.env.NODE_ENV === 'production' ? null : err.message 
    });
  }
});

// Call initiation
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });

    // Validate user
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // IST time handling
    const nowIST = DateTime.now().setZone('Asia/Kolkata');
    const lastCallIST = user.lastCallTime ? 
      DateTime.fromJSDate(user.lastCallTime).setZone('Asia/Kolkata') : null;

    // Daily reset check
    if (lastCallIST && !lastCallIST.hasSame(nowIST, 'day')) {
      user.callsLeft = user.callLimit;
      console.log(`Auto-reset for ${user.vehicleId}`);
    }

    // Check call limit
    if (user.callsLeft <= 0) {
      return res.status(429).json({
        success: false,
        message: 'Daily limit exceeded. Resets at 1:44 AM IST',
        resetTime: getNextResetTime()
      });
    }

    // Make Twilio call
    const call = await client.calls.create({
      twiml: `<Response>
        <Say voice="Polly.Aditi" language="hi-IN">
          यह आपके वाहन के बारे में एक तात्कालिक चेतावनी है। कृपया तुरंत जाँच करें।
        </Say>
      </Response>`,
      to: user.driverNo,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    // Update user
    user.callsLeft -= 1;
    user.lastCallTime = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Call initiated',
      callsLeft: user.callsLeft,
      nextReset: getNextResetTime()
    });

  } catch (error) {
    console.error('[CALL ERROR]', error);
    res.status(500).json({
      success: false,
      message: 'Call failed',
      error: process.env.NODE_ENV === 'production' ? null : error.message
    });
  }
});

// Additional routes (users, health, etc.)
app.post('/api/users', async (req, res) => {
  try {
    const existingUser = await User.findOne({
      $or: [
        { vehicleId: req.body.vehicleId },
        { mobileNo: req.body.mobileNo },
        { driverNo: req.body.driverNo }
      ]
    });

    if (existingUser) {
      const conflictField = existingUser.vehicleId === req.body.vehicleId ? 'Vehicle ID' :
        existingUser.mobileNo === req.body.mobileNo ? 'Mobile Number' : 'Driver Number';
      return res.status(409).json({ 
        success: false, 
        message: `${conflictField} already exists` 
      });
    }

    const newUser = await User.create({
      ...req.body,
      callsLeft: req.body.callLimit || 1,
      callLimit: req.body.callLimit || 1
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      error: err.message
    });
  }
});

app.get('/api/users/:vehicleId', async (req, res) => {
  try {
    const user = await User.findOne({ vehicleId: req.params.vehicleId })
      .select('-__v -_id');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timeIST: DateTime.now().setZone('Asia/Kolkata').toFormat('dd LLL yyyy, HH:mm:ss'),
    nextReset: getNextResetTime().istFormatted
  });
});

// ======================
// Helper Functions
// ======================
function getNextResetTime() {
  const nowIST = DateTime.now().setZone('Asia/Kolkata');
  let resetTime = nowIST.set({ 
    hour: 1, 
    minute: 44,  // 1:44 AM
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

// Error handling
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

module.exports = app;