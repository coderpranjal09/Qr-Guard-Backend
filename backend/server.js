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
  vehicleId: String,
  driverName: String,
  vehicleNo: String,
  model: String,
  email: String,
  driverNo: String,
  callLimit: { type: Number, default: 3 },
  callsLeft: { type: Number, default: 3 },
  lastCallTime: Date
});

const User = mongoose.model('User', UserSchema);

// Daily call limit reset job
cron.schedule('0 0 * * *', {
  scheduled: true,
  timezone: "Asia/Kolkata"
}, async () => {
  try {
    await User.updateMany({}, { $set: { callsLeft: "$callLimit" } });
    console.log('Call limits reset at', new Date().toLocaleString());
  } catch (err) {
    console.error('Error resetting call limits:', err);
  }
});

// Add user
app.post('/api/users', async (req, res) => {
  try {
    const exists = await User.findOne({ vehicleId: req.body.vehicleId });
    if (exists) return res.json({ success: false, message: 'Vehicle already exists' });

    const newUser = {
      ...req.body,
      callsLeft: req.body.callLimit || 3,
      callLimit: req.body.callLimit || 3
    };

    await new User(newUser).save();
    res.json({ success: true, message: 'User added successfully' });
  } catch (err) {
    res.json({ success: false, message: 'Error adding user', error: err.message });
  }
});

// Get user
app.get('/api/users/:vehicleId', async (req, res) => {
  try {
    const user = await User.findOne({ vehicleId: req.params.vehicleId });
    res.json(user || {});
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving user', error: err.message });
  }
});

// Delete user
app.delete('/api/users/:vehicleId', async (req, res) => {
  try {
    await User.deleteOne({ vehicleId: req.params.vehicleId });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

// Call handler
app.get('/api/call-handler', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say(
    { voice: 'Polly.Aditi', language: 'hi-IN' },
    'यह आपके वाहन के बारे में एक तात्कालिक और महत्वपूर्ण चेतावनी है...'
  );
  res.type('text/xml').send(twiml.toString());
});

// Initiate call
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });
    const now = new Date();

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // Check if new day
    if (user.lastCallTime) {
      const lastCallDate = new Date(user.lastCallTime);
      if (lastCallDate.toDateString() !== now.toDateString()) {
        user.callsLeft = user.callLimit;
      }
    }

    if (user.callsLeft <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Daily call limit exceeded. Try after 12 AM.'
      });
    }

    // Deduct call
    user.callsLeft -= 1;
    user.lastCallTime = now;
    await user.save();

    // Initiate call
    const call = await client.calls.create({
      twiml: `<Response>
        <Say voice="Polly.Aditi" language="hi-IN">
          यह आपके वाहन के बारे में एक तात्कालिक और महत्वपूर्ण चेतावनी है...
        </Say>
      </Response>`,
      to: user.driverNo,
      from: process.env.TWILIO_PHONE_NUMBER
    });

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

app.get("/", (req, res) => {
  res.send({ status: "server is activated", status: true });
});

app.listen(process.env.PORT || 5000, () => {
  console.log('Server started on port', process.env.PORT || 5000);
});