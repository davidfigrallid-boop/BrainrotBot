const express = require('express');
const router = express.Router();
const { pool } = require('./database');
const { getCryptoRates, parseDuration, formatDuration } = require('./utils');

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

        const rates = await getCryptoRates();
        const price_crypto = {
            BTC: price_eur / rates.BTC,
            ETH: price_eur / rates.ETH,
            LTC: price_eur / rates.LTC,
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
            LTC: price_eur / rates.LTC,
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

// PATCH /api/brainrots/:id/sold - Toggle sold status
router.patch('/brainrots/:id/sold', async (req, res) => {
    try {
        const { id } = req.params;
        const { sold, sold_price } = req.body;

        const sold_date = sold ? new Date() : null;
        const price = sold ? sold_price : null;

        await pool.query(
            'UPDATE brainrots SET sold = ?, sold_price = ?, sold_date = ? WHERE id = ?',
            [sold, price, sold_date, id]
        );

        res.json({ success: true, message: 'Brainrot sold status updated' });
    } catch (error) {
        console.error('Error updating sold status:', error);
        res.status(500).json({ error: 'Failed to update sold status' });
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

// POST /api/giveaways - Create giveaway
router.post('/giveaways', async (req, res) => {
    try {
        const { prize, duration, winners, rigged_user, guild_id, channel_id } = req.body;

        if (!guild_id) {
            return res.status(400).json({ error: 'Guild ID is required' });
        }

        if (!channel_id) {
            return res.status(400).json({ error: 'Channel ID is required' });
        }

        const client = req.client;
        const targetChannel = await client.channels.fetch(channel_id);

        if (!targetChannel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Parse duration
        const durationMs = parseDuration(duration);

        if (durationMs < 60000) {
            return res.status(400).json({ error: 'Minimum duration is 1 minute' });
        }

        const endTime = new Date(Date.now() + durationMs);
        const formattedDuration = formatDuration(durationMs);
        const winnersCount = parseInt(winners) || 1;

        // Create embed
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const fs = require('fs').promises;
        const path = require('path');

        const embed = new EmbedBuilder()
            .setTitle(`🎉 Nouveau Giveaway: ${prize} 🎉`)
            .setDescription(`Gagnants: ${winnersCount}  |  Durée: ${formattedDuration}  |  Participants: 0`)
            .setColor(0x7B2CBF)
            .addFields(
                { name: 'Fin du giveaway', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: false }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_giveaway').setLabel('🎉 Participer').setStyle(ButtonStyle.Primary)
        );

        const files = [];
        try {
            const imagePath = path.join(__dirname, '../giveway_banner.jpg');
            await fs.access(imagePath);
            files.push(imagePath);
        } catch (e) {
            // Image not found, continue without it
        }

        const message = await targetChannel.send({ embeds: [embed], components: [row], files: files });

        // Save to database
        await pool.query(
            'INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winners_count, end_time, rigged_winner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [message.id, channel_id, guild_id, prize, winnersCount, endTime, rigged_user || null]
        );

        // Set up automatic end timer
        setTimeout(async () => {
            try {
                const { endGiveaway } = require('./bot');
                if (endGiveaway) {
                    await endGiveaway(message.id, client);
                }
            } catch (e) {
                console.error('Error auto-ending giveaway:', e);
            }
        }, durationMs);

        res.json({ success: true, message: 'Giveaway created successfully', message_id: message.id });
    } catch (error) {
        console.error('Error creating giveaway:', error);
        res.status(500).json({ error: 'Failed to create giveaway: ' + error.message });
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

        // Mark as ended and trigger endGiveaway
        const client = req.client;
        const { endGiveaway } = require('./bot');

        if (endGiveaway && client) {
            await endGiveaway(giveaway.message_id, client);
        }

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
        const { channel_id } = req.body;

        const [rows] = await pool.query('SELECT * FROM giveaways WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Giveaway not found' });
        }

        const giveaway = rows[0];

        if (!giveaway.ended) {
            return res.status(400).json({ error: 'Giveaway is still active' });
        }

        let participants = giveaway.participants ? (typeof giveaway.participants === 'string' ? JSON.parse(giveaway.participants) : giveaway.participants) : [];

        if (participants.length === 0) {
            return res.status(400).json({ error: 'No participants to reroll' });
        }

        const winners = [];
        const potentialWinners = [...participants];

        for (let i = 0; i < giveaway.winners_count; i++) {
            if (potentialWinners.length === 0) break;
            const randomIndex = Math.floor(Math.random() * potentialWinners.length);
            winners.push(potentialWinners.splice(randomIndex, 1)[0]);
        }

        try {
            const client = req.client;
            const rerollChannel = await client.channels.fetch(channel_id || giveaway.channel_id);
            const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

            await rerollChannel.send(`🔄 Reroll pour **${giveaway.prize}**! Félicitations à ${winnerMentions}!`);
        } catch (e) {
            console.error('Error sending reroll message:', e);
        }

        res.json({ success: true, message: 'Giveaway rerolled successfully', winners });
    } catch (error) {
        console.error('Error rerolling giveaway:', error);
        res.status(500).json({ error: 'Failed to reroll giveaway' });
    }
});

// DELETE /api/giveaways/:id - Delete giveaway
router.delete('/giveaways/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM giveaways WHERE id = ?', [id]);
        res.json({ success: true, message: 'Giveaway deleted successfully' });
    } catch (error) {
        console.error('Error deleting giveaway:', error);
        res.status(500).json({ error: 'Failed to delete giveaway' });
    }
});

// --- Stats Endpoints ---

// GET /api/stats - Get bot statistics
router.get('/stats', async (req, res) => {
    try {
        const { guild_id } = req.query;

        const [brainrots] = await pool.query('SELECT COUNT(*) as count FROM brainrots');
        const [sold] = await pool.query('SELECT COUNT(*) as count, SUM(sold_price) as total FROM brainrots WHERE sold = TRUE');

        let giveawaysQuery = 'SELECT COUNT(*) as count FROM giveaways WHERE ended = 0';
        const params = [];

        if (guild_id) {
            giveawaysQuery += ' AND guild_id = ?';
            params.push(guild_id);
        }

        const [giveaways] = await pool.query(giveawaysQuery, params);

        res.json({
            brainrots_count: brainrots[0].count,
            giveaways_count: giveaways[0].count,
            sold_count: sold[0].count || 0,
            money_made: sold[0].total || 0
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
            ltc: rates.LTC.toFixed(2),
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

// POST /api/bot/refresh-list - Refresh Discord brainrot list
router.post('/bot/refresh-list', async (req, res) => {
    try {
        const client = req.client;
        const { refreshBrainrotList } = require('./bot');

        if (!client) {
            return res.status(503).json({ error: 'Bot not ready' });
        }

        await refreshBrainrotList(client);
        res.json({ success: true, message: 'Discord list refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing Discord list:', error);
        res.status(500).json({ error: 'Failed to refresh list: ' + error.message });
    }
});

module.exports = router;
