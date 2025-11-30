require('dotenv').config(); // Load env vars if .env exists (for local dev)

// Polyfill for Node.js versions < 18
if (!global.ReadableStream) {
    try {
        const { ReadableStream } = require('stream/web');
        global.ReadableStream = ReadableStream;
    } catch (e) {
        console.warn('ReadableStream not available in this Node.js version. Please upgrade to Node.js 18+');
    }
}

const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./config/database');
const apiRoutes = require('./routes/api');
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

// Serve static files (HTML, CSS, JS) for admin panel
app.use(express.static('public'));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './public' });
});

// --- Discord Bot Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration
    ]
});

// Initialize Bot Handlers
botHandlers.setup(client);

// Initialize Event Systems
const { setupTracking } = require('./events/tracking');
const { setupLogging } = require('./events/logging');
setupTracking(client);
setupLogging(client);

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Ready! Logged in as ${c.user.tag}`);
    await initDatabase();

    // Start TikTok auto-check service
    const { startTikTokService } = require('./services/tiktok');
    startTikTokService(c);
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
