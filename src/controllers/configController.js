const { pool } = require('../config/database');

exports.updateConfig = async (req, res) => {
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
};
