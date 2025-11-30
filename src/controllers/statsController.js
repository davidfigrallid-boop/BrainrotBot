const { pool } = require('../config/database');
const { getCryptoRates } = require('../utils');

exports.getStats = async (req, res) => {
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
};

exports.getCryptoPrices = async (req, res) => {
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
};

exports.getGuilds = async (req, res) => {
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
};
