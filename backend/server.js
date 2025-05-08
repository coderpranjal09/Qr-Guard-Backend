const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

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

// Home route
app.get("/", (req, res) => {
  res.send({ status: "server is activated", status: true });
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

// Delete user
app.delete('/api/users/:vehicleId', async (req, res) => {
  try {
    await User.deleteOne({ vehicleId: req.params.vehicleId });
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
});

// ✅ Hindi TTS Call using Exotel API
app.post('/api/call-owner', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    const user = await User.findOne({ vehicleId });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const phone = user.driverNo;

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Phone number should be 10 digits' });
    }

    const message = "यह आपके वाहन के बारे में एक तात्कालिक और महत्वपूर्ण चेतावनी है। कृपया तुरंत अपने वाहन की जाँच करें। आपके वाहन के साथ कोई गंभीर समस्या हो सकती है। कृपया इसे नजरअंदाज न करें। धन्यवाद।";

    // EXOTEL API CALL
    const response = await axios.post(
      `https://api.exotel.com/v1/Accounts/${process.env.EXOTEL_SID}/Calls/connect.json`,
      new URLSearchParams({
        From: process.env.EXOTEL_FROM_NUMBER,
        To: phone,
        CallerId: process.env.EXOTEL_CALLER_ID,
        CallType: 'trans',
        Url: `${process.env.SERVER_URL}/api/exotel-say?msg=${encodeURIComponent(message)}`
      }),
      {
        auth: {
          username: process.env.EXOTEL_API_KEY,
          password: process.env.EXOTEL_API_TOKEN
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    res.json({ success: true, message: 'Call initiated via Exotel', data: response.data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Exotel call failed', error: err.message });
  }
});

// ✅ Exotel Say XML Endpoint
app.get('/api/exotel-say', (req, res) => {
  const msg = req.query.msg || "कोई संदेश नहीं मिला।";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="hin">${msg}</Say>
</Response>`;

  res.type('application/xml');
  res.send(xml);
});

// Start server
app.listen(process.env.PORT || 5000, () => {
  console.log('Server running on port', process.env.PORT || 5000);
});
