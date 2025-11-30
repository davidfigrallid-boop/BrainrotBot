const { pool } = require('../config/database');
const { getCryptoRates } = require('../utils');

exports.getAllBrainrots = async (req, res) => {
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
};

exports.createBrainrot = async (req, res) => {
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
};

exports.updateBrainrot = async (req, res) => {
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
};

exports.updateSoldStatus = async (req, res) => {
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
};

exports.deleteBrainrot = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM brainrots WHERE id = ?', [id]);
        res.json({ success: true, message: 'Brainrot deleted successfully' });
    } catch (error) {
        console.error('Error deleting brainrot:', error);
        res.status(500).json({ error: 'Failed to delete brainrot' });
    }
};
