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
});

// Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// MongoDB schema
const User = mongoose.model('User', {
  name: String,
  mobileNo: String,
  vehicleId: String,
  driverName: String,
  vehicleNo: String,
  model: String,
  email: String,
  driverNo: String
});

// Add user
app.post('/api/users', async (req, res) => {
  try {
    const exists = await User.findOne({ vehicleId: req.body.vehicleId });
    if (exists) return res.json({ success: false, message: 'Vehicle already exists' });

    await new User(req.body).save();
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

app.get("/", (req, res) => {
  res.send({
    status: "server is activated",
    status: true
  })
})

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
    {
      voice: 'Polly.Aditi',
      language: 'hi-IN'
    },
    'यह आपके वाहन के बारे में एक तात्कालिक और महत्वपूर्ण चेतावनी है। कृपया तुरंत अपने वाहन की जाँच करें। आपके वाहन के साथ कोई गंभीर समस्या हो सकती है। कृपया इसे नजरअंदाज न करें। धन्यवाद।'
  );

  res.type('text/xml');
  res.send(twiml.toString());
});

// Initiate call
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!/^\+[1-9]\d{1,14}$/.test(user.driverNo)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format' });
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

    res.json({
      success: true,
      message: 'Call initiated successfully',
      callSid: call.sid
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

// Send SMS
app.post('/api/send-sms', async (req, res) => {
  try {
    const { vehicleId, issue, additionalInfo } = req.body;
    const user = await User.findOne({ vehicleId });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!/^\+[1-9]\d{1,14}$/.test(user.driverNo)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format' });
    }

    const message = `🚨 Vehicle Alert!\nVehicle ID: ${vehicleId}\nIssue: ${issue}\nAdditional Info: ${additionalInfo}`;
    
    await client.messages.create({
      body: message,
      to: user.driverNo,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    res.json({ 
      success: true, 
      message: 'SMS sent successfully' 
    });
  } catch (error) {
    console.error('SMS error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error: error.message
    });
  }
});

// Start server
app.listen(process.env.PORT || 5000, () => {
  console.log('Server started on port', process.env.PORT || 5000);
});