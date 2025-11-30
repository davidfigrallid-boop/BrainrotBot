const { pool } = require('../config/database');
const { parseDuration, formatDuration } = require('../utils');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

exports.getAllGiveaways = async (req, res) => {
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
};

exports.createGiveaway = async (req, res) => {
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
            // Adjust path to point to project root from src/controllers
            const imagePath = path.join(__dirname, '../../giveway_banner.jpg');
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
                // We need to require bot.js dynamically or move endGiveaway to a service to avoid circular deps
                // For now, let's assume we can require it from ../bot
                const { endGiveaway } = require('../bot');
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
};

exports.endGiveaway = async (req, res) => {
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
        const { endGiveaway } = require('../bot');

        if (endGiveaway && client) {
            await endGiveaway(giveaway.message_id, client);
        }

        res.json({ success: true, message: 'Giveaway ended successfully' });
    } catch (error) {
        console.error('Error ending giveaway:', error);
        res.status(500).json({ error: 'Failed to end giveaway' });
    }
};

exports.rerollGiveaway = async (req, res) => {
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
};

exports.deleteGiveaway = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM giveaways WHERE id = ?', [id]);
        res.json({ success: true, message: 'Giveaway deleted successfully' });
    } catch (error) {
        console.error('Error deleting giveaway:', error);
        res.status(500).json({ error: 'Failed to delete giveaway' });
    }
};
