const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const dealsApi = require('./api/deals');
const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
// Static files live in /public
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/deals', async (req, res) => {
  try {
    const result = await dealsApi(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error', deals: [] });
  }
});

app.listen(PORT, () => {
  console.log(`SteamScout-ITAD server running at http://localhost:${PORT}`);
});
