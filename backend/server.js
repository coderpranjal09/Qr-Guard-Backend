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

// ======================
// Database Connection
// ======================
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log(`MongoDB connected at ${DateTime.now().setZone('Asia/Kolkata').toFormat('dd LLL yyyy, HH:mm:ss')}`))
.catch(err => console.error('MongoDB connection error:', err));

// ======================
// Twilio Configuration
// ======================
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ======================
// Database Schema
// ======================
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

// ======================
// Cron Job Endpoint
// ======================
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

// ======================
// Call Initiation
// ======================
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });

    // Validation checks
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.callsLeft <= 0) {
      return res.status(429).json({
        success: false,
        message: 'Daily limit exceeded. Resets at 1:45 AM IST',
        resetTime: getNextResetTime()
      });
    }

    // IST Date handling
    const nowIST = DateTime.now().setZone('Asia/Kolkata');
    const lastCallIST = user.lastCallTime ? 
      DateTime.fromJSDate(user.lastCallTime).setZone('Asia/Kolkata') : null;

    // Daily auto-reset logic
    if (lastCallIST && !lastCallIST.hasSame(nowIST, 'day')) {
      user.callsLeft = user.callLimit;
      console.log(`Auto-reset triggered for ${user.vehicleId}`);
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

    // Update user after successful call
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

// ======================
// Helper Functions
// ======================
function getNextResetTime() {
  const nowIST = DateTime.now().setZone('Asia/Kolkata');
  let resetTime = nowIST.set({ hour: 1, minute: 45, second: 0, millisecond: 0 });
  
  if (resetTime <= nowIST) {
    resetTime = resetTime.plus({ days: 1 });
  }
  
  return {
    iso: resetTime.toISO(),
    istFormatted: resetTime.toFormat('dd LLL yyyy, HH:mm:ss'),
    timestamp: resetTime.toMillis()
  };
}

// ======================
// Additional Routes
// ======================
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
      message: 'User created successfully',
      data: newUser
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
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
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

app.delete('/api/users/:vehicleId', async (req, res) => {
  try {
    const result = await User.deleteOne({ vehicleId: req.params.vehicleId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ======================
// Utility Endpoints
// ======================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: DateTime.now().setZone('Asia/Kolkata').toISO(),
    nextReset: getNextResetTime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/call-handler', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { voice: 'Polly.Aditi', language: 'hi-IN' },
    'यह आपके वाहन के बारे में एक तात्कालिक चेतावनी है। कृपया तुरंत जाँच करें।'
  );
  res.type('text/xml').send(twiml.toString());
});

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

module.exports = app;

// Local server (optional)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}