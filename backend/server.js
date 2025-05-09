const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const twilio = require('twilio');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Add response formatting middleware
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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
  lastCallTime: Date
});

const User = mongoose.model('User', UserSchema);

// Manual Reset Endpoint (Fixed)
app.post('/api/manual-reset', async (req, res) => {
  try {
    const result = await User.updateMany(
      {},
      [ { $set: { callsLeft: "$callLimit" } } ] // <- Aggregation pipeline update
    );

    res.json({ 
      success: true,
      message: `Reset ${result.modifiedCount} users`,
      resetAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Reset failed', 
      error: err.message 
    });
  }
});

// Add user (Fixed response format)
app.post('/api/users', async (req, res) => {
  try {
    const exists = await User.findOne({ vehicleId: req.body.vehicleId });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: 'Vehicle already exists'
      });
    }

    const newUser = await User.create({
      ...req.body,
      callsLeft: req.body.callLimit || 1,
      callLimit: req.body.callLimit || 1
    });

    res.status(201).json({
      success: true,
      message: 'User added successfully',
      data: newUser
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      error: err.message
    });
  }
});

// Get user (Fixed response format)
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
      message: 'Server error',
      error: err.message
    });
  }
});

// Delete user (Fixed response format)
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

// Call handler (Remains unchanged)
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

// Call initiation (Remains unchanged)
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });

    if (!user) return res.status(404).json({ 
      success: false, 
      message: 'User not found' 
    });

    if (user.callsLeft <= 0) {
      return res.status(429).json({
        success: false,
        message: 'Daily call limit exceeded'
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
    user.lastCallTime = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Call initiated successfully',
      callSid: call.sid,
      callsLeft: user.callsLeft
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

// Root endpoint (Fixed response format)
app.get("/", (req, res) => {
  res.json({
    status: true,
    message: "Server is activated",
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});