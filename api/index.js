const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();

// Use CORS to allow our frontend to call this backend
app.use(cors());

app.get('/api', async (req, res) => {
  try {
    const FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/";
    const FPL_TEAMS_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";

    const [fixturesRes, teamsRes] = await Promise.all([
      fetch(FPL_FIXTURES_URL),
      fetch(FPL_TEAMS_URL),
    ]);

    const fixturesData = await fixturesRes.json();
    const teamsData = await teamsRes.json();

    res.status(200).json({
      fixturesData,
      teamsData,
    });
  } catch (error) {
    console.error("Error fetching FPL data:", error);
    res.status(500).json({ error: "Something went wrong fetching FPL data." });
  }
});

// This is the entry point for Vercel
module.exports = app;

