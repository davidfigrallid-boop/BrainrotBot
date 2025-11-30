const express = require('express');
const router = express.Router();

const brainrotController = require('../controllers/brainrotController');
const giveawayController = require('../controllers/giveawayController');
const statsController = require('../controllers/statsController');
const configController = require('../controllers/configController');
const botController = require('../controllers/botController');

// --- Brainrots ---
router.get('/brainrots', brainrotController.getAllBrainrots);
router.post('/brainrots', brainrotController.createBrainrot);
router.put('/brainrots/:id', brainrotController.updateBrainrot);
router.patch('/brainrots/:id/sold', brainrotController.updateSoldStatus);
router.delete('/brainrots/:id', brainrotController.deleteBrainrot);

// --- Giveaways ---
router.get('/giveaways', giveawayController.getAllGiveaways);
router.post('/giveaways', giveawayController.createGiveaway);
router.post('/giveaways/:id/end', giveawayController.endGiveaway);
router.post('/giveaways/:id/reroll', giveawayController.rerollGiveaway);
router.delete('/giveaways/:id', giveawayController.deleteGiveaway);

// --- Stats ---
router.get('/stats', statsController.getStats);
router.get('/crypto', statsController.getCryptoPrices);
router.get('/guilds', statsController.getGuilds);

// --- Config ---
router.post('/config', configController.updateConfig);

// --- Bot ---
router.post('/bot/refresh-list', botController.refreshDiscordList);

module.exports = router;
