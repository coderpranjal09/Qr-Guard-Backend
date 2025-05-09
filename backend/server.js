const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const twilio = require('twilio');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// MongoDB schema
const UserSchema = new mongoose.Schema({
  name: String,
  mobileNo: String,
  vehicleId: { type: String, unique: true },
  driverName: String,
  vehicleNo: String,
  model: String,
  email: String,
  driverNo: String,
  callLimit: { type: Number, default: 1 },
  callsLeft: { type: Number, default: 1 },
  lastCallTime: Date
});

const User = mongoose.model('User', UserSchema);

// Vercel cron endpoint (Trigger at 1:35 AM IST)
app.get('/api/reset-call-limits', async (req, res) => {
  try {
    await User.updateMany({}, { $set: { callsLeft: "$callLimit" } });
    console.log('Call limits reset at', new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    }));
    res.status(200).json({ success: true, message: 'Call limits reset successfully' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ success: false, message: 'Reset failed', error: err.message });
  }
});

// Add user
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

    const newUser = new User({
      ...req.body,
      callsLeft: req.body.callLimit || 1,
      callLimit: req.body.callLimit || 1
    });

    await newUser.save();
    res.status(201).json({ 
      success: true, 
      message: 'User added successfully',
      data: {
        vehicleId: newUser.vehicleId,
        callsLeft: newUser.callsLeft
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Error adding user', 
      error: err.message 
    });
  }
});

// Get user
app.get('/api/users/:vehicleId', async (req, res) => {
  try {
    const user = await User.findOne({ vehicleId: req.params.vehicleId })
      .select('-__v -_id');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: 'Error retrieving user',
      error: err.message 
    });
  }
});

// Delete user
app.delete('/api/users/:vehicleId', async (req, res) => {
  try {
    const result = await User.deleteOne({ vehicleId: req.params.vehicleId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: err.message
    });
  }
});

// Call handler
app.get('/api/call-handler', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { 
      voice: 'Polly.Aditi', 
      language: 'hi-IN' 
    },
    'यह आपके वाहन के बारे में एक तात्कालिक और महत्वपूर्ण चेतावनी है। कृपया तुरंत अपने वाहन की जाँच करें। आपके वाहन के साथ कोई गंभीर समस्या हो सकती है। कृपया इसे नजरअंदाज न करें। धन्यवाद।'
  );
  res.type('text/xml').send(twiml.toString());
});

// Initiate call
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });
    const now = new Date();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate phone number format
    if (!/^\+[1-9]\d{1,14}$/.test(user.driverNo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // IST time check
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    const istLastCall = user.lastCallTime ? 
      new Date(user.lastCallTime.getTime() + istOffset) : null;

    // Check if new day in IST
    if (istLastCall) {
      const isSameDay = istLastCall.getDate() === istNow.getDate() && 
                       istLastCall.getMonth() === istNow.getMonth() && 
                       istLastCall.getFullYear() === istNow.getFullYear();
      if (!isSameDay) {
        user.callsLeft = user.callLimit;
      }
    }

    // Check call limit
    if (user.callsLeft <= 0) {
      return res.status(429).json({
        success: false,
        message: 'Daily call limit exceeded. Try after 1:35 AM IST.',
        resetTime: getNextResetTime()
      });
    }

    // Initiate call
    const call = await client.calls.create({
      twiml: `<Response>
        <Say voice="Polly.Aditi" language="hi-IN">
          यह आपके वाहन के बारे में एक तात्कालिक और महत्वपूर्ण चेतावनी है। कृपया तुरंत अपने वाहन की जाँच करें। आपके वाहन के साथ कोई गंभीर समस्या हो सकती है। कृपया इसे नजरअंदाज न करें। धन्यवाद।
        </Say>
      </Response>`,
      to: user.driverNo,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    // Update user after successful call
    user.callsLeft -= 1;
    user.lastCallTime = now;
    await user.save();

    res.json({
      success: true,
      message: 'Call initiated successfully',
      callSid: call.sid,
      callsLeft: user.callsLeft,
      nextReset: getNextResetTime()
    });

  } catch (error) {
    console.error('Call error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate call',
      error: error.message
    });
  }
});

// Reset time calculation for IST
function getNextResetTime() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  
  let nextReset = new Date(istNow);
  nextReset.setHours(1, 35, 0, 0); // 1:35 AM IST
  
  if (nextReset <= istNow) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  
  // Convert back to UTC for ISO string
  const utcReset = new Date(nextReset.getTime() - istOffset);
  return utcReset.toISOString();
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'Server is running',
    version: '1.0',
    resetTime: getNextResetTime()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

module.exports = app;