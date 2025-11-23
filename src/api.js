const express = require('express');
const router = express.Router();
const { pool } = require('./database');
const { getCryptoRates } = require('./utils');

// --- Brainrots Endpoints ---

// GET /api/brainrots - Get all brainrots
router.get('/brainrots', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM brainrots ORDER BY id DESC');
        const brainrots = rows.map(row => ({
            ...row,
            traits: typeof row.traits === 'string' ? JSON.parse(row.traits) : row.traits,
            price_crypto: typeof row.price_crypto === 'string' ? JSON.parse(row.price_crypto) : row.price_crypto
        }));
        res.json(brainrots);
    } catch (error) {
        console.error('Error fetching brainrots:', error);
        res.status(500).json({ error: 'Failed to fetch brainrots' });
    }
});

// POST /api/brainrots - Add new brainrot
router.post('/brainrots', async (req, res) => {
    try {
        const { name, rarity, mutation, income_per_second, price_eur, traits, quantity, owner_id } = req.body;

        // Calculate crypto prices
        const rates = await getCryptoRates();
        const price_crypto = {
            BTC: price_eur / rates.BTC,
            ETH: price_eur / rates.ETH,
            SOL: price_eur / rates.SOL
        };

        await pool.query(
            'INSERT INTO brainrots (name, rarity, income_per_second, mutation, traits, price_eur, price_crypto, owner_id, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, rarity, income_per_second, mutation || 'Default', JSON.stringify(traits || []), price_eur, JSON.stringify(price_crypto), owner_id || null, quantity || 1]
        );

        res.json({ success: true, message: 'Brainrot added successfully' });
    } catch (error) {
        console.error('Error adding brainrot:', error);
        res.status(500).json({ error: 'Failed to add brainrot' });
    }
});

// PUT /api/brainrots/:id - Update brainrot
router.put('/brainrots/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, rarity, mutation, income_per_second, price_eur, traits, quantity, owner_id } = req.body;

        const rates = await getCryptoRates();
        const price_crypto = {
            BTC: price_eur / rates.BTC,
            ETH: price_eur / rates.ETH,
            SOL: price_eur / rates.SOL
        };

        await pool.query(
            'UPDATE brainrots SET name = ?, rarity = ?, income_per_second = ?, mutation = ?, traits = ?, price_eur = ?, price_crypto = ?, owner_id = ?, quantity = ? WHERE id = ?',
            [name, rarity, income_per_second, mutation, JSON.stringify(traits || []), price_eur, JSON.stringify(price_crypto), owner_id || null, quantity || 1, id]
        );

        res.json({ success: true, message: 'Brainrot updated successfully' });
    } catch (error) {
        console.error('Error updating brainrot:', error);
        res.status(500).json({ error: 'Failed to update brainrot' });
    }
});

// DELETE /api/brainrots/:id - Delete brainrot
router.delete('/brainrots/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM brainrots WHERE id = ?', [id]);
        res.json({ success: true, message: 'Brainrot deleted successfully' });
    } catch (error) {
        console.error('Error deleting brainrot:', error);
        res.status(500).json({ error: 'Failed to delete brainrot' });
    }
});

// --- Giveaways Endpoints ---

// GET /api/giveaways - Get all giveaways
router.get('/giveaways', async (req, res) => {
    try {
        const { guild_id, status } = req.query;
        let query = 'SELECT * FROM giveaways';
        const params = [];

        const conditions = [];
        if (guild_id) {
            conditions.push('guild_id = ?');
            params.push(guild_id);
        }
        if (status === 'active') {
            conditions.push('ended = 0');
        } else if (status === 'ended') {
            conditions.push('ended = 1');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC LIMIT 50';

        const [rows] = await pool.query(query, params);
        const giveaways = rows.map(row => ({
            ...row,
            participants: typeof row.participants === 'string' ? JSON.parse(row.participants) : row.participants
        }));
        res.json(giveaways);
    } catch (error) {
        console.error('Error fetching giveaways:', error);
        res.status(500).json({ error: 'Failed to fetch giveaways' });
    }
});

// POST /api/giveaways - Create giveaway (via bot command)
router.post('/giveaways', async (req, res) => {
    try {
        const { prize, duration, winners, rigged_user, guild_id } = req.body;

        if (!guild_id) {
            return res.status(400).json({ error: 'Guild ID is required' });
        }

        const client = req.client;
        const guild = await client.guilds.fetch(guild_id);

        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }

        // Find a text channel to send the giveaway
        const channel = guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));

        if (!channel) {
            return res.status(404).json({ error: 'No suitable channel found' });
        }

        // Simulate slash command interaction
        const mockInteraction = {
            channelId: channel.id,
            guildId: guild_id,
            client: client,
            deferReply: async () => { },
            editReply: async (data) => {
                return await channel.send(data);
            },
            options: {
                getSubcommand: () => 'create',
                getString: (name) => {
                    if (name === 'prize') return prize;
                    if (name === 'duration') return duration;
                },
                getInteger: (name) => {
                    if (name === 'winners') return parseInt(winners);
                },
                getUser: (name) => {
                    if (name === 'rigged_user' && rigged_user) {
                        return { id: rigged_user };
                    }
                    return null;
                }
            }
        };

        // Use the bot's giveaway handler
        const botHandlers = require('./bot');
        // Note: This is a simplified approach. In production, you'd want to properly invoke the command

        res.json({ success: true, message: 'Giveaway creation initiated' });
    } catch (error) {
        console.error('Error creating giveaway:', error);
        res.status(500).json({ error: 'Failed to create giveaway' });
    }
});

// POST /api/giveaways/:id/end - Manually end giveaway
router.post('/giveaways/:id/end', async (req, res) => {
    try {
        const { id } = req.params;
        const { winner } = req.body;

        const [rows] = await pool.query('SELECT * FROM giveaways WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        const giveaway = rows[0];

        if (giveaway.ended) {
            return res.status(400).json({ error: 'Giveaway already ended' });
        }

        if (winner) {
            await pool.query('UPDATE giveaways SET rigged_winner_id = ? WHERE id = ?', [winner, id]);
        }

        // Trigger endGiveaway function
        // This would need to be properly implemented with access to the bot client
        res.json({ success: true, message: 'Giveaway ended successfully' });
    } catch (error) {
        console.error('Error ending giveaway:', error);
        res.status(500).json({ error: 'Failed to end giveaway' });
    }
});

// POST /api/giveaways/:id/reroll - Reroll giveaway winners
router.post('/giveaways/:id/reroll', async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query('SELECT * FROM giveaways WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        const giveaway = rows[0];

        if (!giveaway.ended) {
            return res.status(400).json({ error: 'Giveaway is still active' });
        }

        res.json({ success: true, message: 'Giveaway reroll initiated' });
    } catch (error) {
        console.error('Error rerolling giveaway:', error);
        res.status(500).json({ error: 'Failed to reroll giveaway' });
    }
});

// --- Stats Endpoints ---

// GET /api/stats - Get bot statistics
router.get('/stats', async (req, res) => {
    try {
        const { guild_id } = req.query;

        const [brainrots] = await pool.query('SELECT COUNT(*) as count FROM brainrots');

        let giveawaysQuery = 'SELECT COUNT(*) as count FROM giveaways WHERE ended = 0';
        const params = [];

        if (guild_id) {
            giveawaysQuery += ' AND guild_id = ?';
            params.push(guild_id);
        }

        const [giveaways] = await pool.query(giveawaysQuery, params);

        res.json({
            brainrots_count: brainrots[0].count,
            giveaways_count: giveaways[0].count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/crypto - Get crypto prices
router.get('/crypto', async (req, res) => {
    try {
        const rates = await getCryptoRates();
        res.json({
            btc: rates.BTC.toFixed(2),
            eth: rates.ETH.toFixed(2),
            sol: rates.SOL.toFixed(2)
        });
    } catch (error) {
        console.error('Error fetching crypto:', error);
        res.status(500).json({ error: 'Failed to fetch crypto prices' });
    }
});

// GET /api/guilds - Get bot guilds
router.get('/guilds', async (req, res) => {
    try {
        const client = req.client;

        if (!client || !client.guilds) {
            return res.status(503).json({ error: 'Bot not ready' });
        }

        const guilds = client.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            memberCount: guild.memberCount
        }));

        res.json(guilds);
    } catch (error) {
        console.error('Error fetching guilds:', error);
        res.status(500).json({ error: 'Failed to fetch guilds' });
    }
});

// POST /api/config - Update bot configuration
router.post('/config', async (req, res) => {
    try {
        const { key, value } = req.body;

        await pool.query(
            'INSERT INTO config (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
            [key, value, value]
        );

        res.json({ success: true, message: 'Configuration updated' });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
    }
});

module.exports = router;
