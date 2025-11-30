exports.refreshDiscordList = async (req, res) => {
    try {
        const client = req.client;
        const { refreshBrainrotList } = require('../bot');

        if (!client) {
            return res.status(503).json({ error: 'Bot not ready' });
        }

        await refreshBrainrotList(client);
        res.json({ success: true, message: 'Discord list refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing Discord list:', error);
        res.status(500).json({ error: 'Failed to refresh list: ' + error.message });
    }
};
