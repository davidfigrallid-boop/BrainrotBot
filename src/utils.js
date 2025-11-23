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
const SUPPORTED_CRYPTOS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'TRX', 'LTC', 'DOT'];

async function getCryptoRates() {
    try {
        // Simple mock for now to avoid rate limits or API keys, but structure allows for real API
        // In production, you'd fetch from CoinGecko or Binance
        return {
            'BTC': 35000,
            'ETH': 2000,
            'SOL': 60,
            'BNB': 250,
            'XRP': 0.6,
            'ADA': 0.35,
            'DOGE': 0.07,
            'TRX': 0.1,
            'LTC': 70,
            'DOT': 5
        };
    } catch (error) {
        console.error('Error fetching crypto rates:', error);
        return {};
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

module.exports = {
    parsePrice,
    formatPrice,
    formatCryptoPrice,
    convertEURToAllCryptos,
    getSupportedCryptos,
    getCryptoRates
};
