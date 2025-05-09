const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const twilio = require('twilio');
const cron = require('node-cron');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

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

// Automatic reset at 1:05 AM IST daily
cron.schedule(
  '5 1 * * *', // 1:05 AM IST
  async () => {
    try {
      await User.updateMany({}, 
        [ { $set: { callsLeft: "$callLimit" } } ]
      );
      console.log('Automatic call limits reset at 1:05 AM IST:', new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata'
      }));
    } catch (err) {
      console.error('Reset error:', err);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata"
  }
);

// Add user endpoint
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

// Get user endpoint
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

// Delete user endpoint
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

// Twilio call handler
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

// Initiate call endpoint
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

    if (!/^\+[1-9]\d{1,14}$/.test(user.driverNo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Automatic daily reset check
    if (user.lastCallTime) {
      const lastCallDate = new Date(user.lastCallTime);
      const isSameDay = lastCallDate.toDateString() === now.toDateString();
      if (!isSameDay) {
        user.callsLeft = user.callLimit;
      }
    }

    if (user.callsLeft <= 0) {
      return res.status(429).json({
        success: false,
        message: 'Daily call limit exceeded. Automatic reset at 1:05 AM IST.',
        resetTime: getNextResetTime()
      });
    }

    const call = await client.calls.create({
      twiml: `<Response>
        <Say voice="Polly.Aditi" language="hi-IN">
          यह आपके वाहन के बारे में एक तात्कालिक और महत्वपूर्ण चेतावनी है। कृपया तुरंत अपने वाहन की जाँच करें। आपके वाहन के साथ कोई गंभीर समस्या हो सकती है। कृपया इसे नजरअंदाज न करें। धन्यवाद।
        </Say>
      </Response>`,
      to: user.driverNo,
      from: process.env.TWILIO_PHONE_NUMBER
    });

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

// Reset time calculator
function getNextResetTime() {
  const now = new Date();
  const nextReset = new Date(now);
  
  // Set to next 1:05 AM IST
  nextReset.setHours(1, 5, 0, 0);
  if (nextReset <= now) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  
  return nextReset.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Server health check
app.get('/health', (req, res) => {
  res.json({
    status: 'active',
    serverTimeIST: new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      hour12: true 
    }),
    nextAutoReset: getNextResetTime()
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Current IST time: ${new Date().toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    hour12: true 
  })}`);
  console.log(`Next automatic reset at: ${getNextResetTime()}`);
});