const axios = require('axios');

// Price Abbreviations
const PRICE_ABBREVIATIONS = {
    k: 1e3, M: 1e6, B: 1e9, T: 1e12, Qa: 1e15
};

function parsePrice(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const match = /^([\d.]+)\s*([a-zA-Z]+)?$/.exec(str.toString().trim());
    if (!match) return NaN;
    const [, num, suf] = match;
    return parseFloat(num) * (PRICE_ABBREVIATIONS[suf] || 1);
}

function formatPrice(num) {
    if (isNaN(num) || num === null) return 'N/A';
    if (num >= 1e15) return (num / 1e15).toFixed(2) + "Qa";
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "k";
    return num.toFixed(2);
}

function formatCryptoPrice(price) {
    if (!price || price === null) return 'N/A';
    if (price < 0.000001) return price.toExponential(4);
    if (price < 0.01) return price.toFixed(8);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
}

// Crypto Logic
const SUPPORTED_CRYPTOS = ['BTC', 'ETH', 'LTC', 'SOL'];

let cachedRates = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCryptoRates() {
    const now = Date.now();
    if (cachedRates && (now - lastFetchTime < CACHE_DURATION)) {
        return cachedRates;
    }

    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,solana&vs_currencies=eur');
        const data = response.data;

        cachedRates = {
            'BTC': data.bitcoin?.eur || 35000,
            'ETH': data.ethereum?.eur || 2000,
            'LTC': data.litecoin?.eur || 70,
            'SOL': data.solana?.eur || 60
        };
        lastFetchTime = now;
        return cachedRates;
    } catch (error) {
        console.error('Error fetching crypto rates:', error.message);
        // Return cached if available even if expired, otherwise defaults
        if (cachedRates) return cachedRates;
        return {
            'BTC': 35000, 'ETH': 2000, 'LTC': 70, 'SOL': 60
        };
    }
}

async function convertEURToAllCryptos(eurAmount) {
    const rates = await getCryptoRates();
    const prices = {};
    for (const [crypto, rate] of Object.entries(rates)) {
        prices[crypto] = eurAmount / rate;
    }
    return prices;
}

function getSupportedCryptos() {
    return SUPPORTED_CRYPTOS;
}

// --- Time Parser ---

function parseDuration(str) {
    if (!str) return 0;
    const match = /^(\d+)\s*([a-zA-Z]+)$/.exec(str.toString().trim());
    if (!match) return 0;
    const [, num, unit] = match;
    const n = parseInt(num);

    switch (unit.toLowerCase()) {
        case 's': case 'sec': case 'seconds': return n * 1000;
        case 'm': case 'min': case 'minutes': return n * 60 * 1000;
        case 'h': case 'hour': case 'hours': return n * 60 * 60 * 1000;
        case 'd': case 'j': case 'day': case 'days': return n * 24 * 60 * 60 * 1000;
        case 'w': case 'sem': case 'week': case 'weeks': return n * 7 * 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
}

module.exports = {
    parsePrice,
    formatPrice,
    formatCryptoPrice,
    convertEURToAllCryptos,
    getSupportedCryptos,
    getCryptoRates,
    parseDuration,
    formatDuration
};
