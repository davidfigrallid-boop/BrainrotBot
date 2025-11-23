require('dotenv').config(); // Load env vars if .env exists (for local dev)
const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database');
const apiRoutes = require('./api');
const botHandlers = require('./bot');

// --- Configuration ---
const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// --- Express App Setup ---
const app = express();
app.use(cors()); // Allow all CORS for now as requested
app.use(bodyParser.json());

// Middleware to inject client
app.use((req, res, next) => {
    req.client = client;
    next();
});

// Register API Routes
app.use('/api', apiRoutes);

// Basic health check
app.get('/', (req, res) => {
    res.send('BrainrotsMarket Backend is Running');
});

// --- Discord Bot Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize Bot Handlers
botHandlers.setup(client);

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Ready! Logged in as ${c.user.tag}`);
    await initDatabase();
});

// --- Start Server & Bot ---
async function start() {
    // Start Web Server
    app.listen(PORT, () => {
        console.log(`🌐 API Server running on port ${PORT}`);
    });

    // Start Bot
    if (DISCORD_TOKEN) {
        try {
            await client.login(DISCORD_TOKEN);
        } catch (error) {
            console.error('❌ Discord Login Failed:', error.message);
        }
    } else {
        console.warn('⚠️ No DISCORD_TOKEN provided. Bot will not start.');
    }
}

start();
