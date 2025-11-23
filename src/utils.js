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

async function getCryptoRates() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,solana&vs_currencies=eur');
        const data = response.data;

        return {
            'BTC': data.bitcoin?.eur || 35000,
            'ETH': data.ethereum?.eur || 2000,
            'LTC': data.litecoin?.eur || 70,
            'SOL': data.solana?.eur || 60
        };
    } catch (error) {
        console.error('Error fetching crypto rates:', error.message);
        // Fallback to defaults if API fails
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

module.exports = {
    parsePrice,
    formatPrice,
    formatCryptoPrice,
    convertEURToAllCryptos,
    getSupportedCryptos,
    getCryptoRates
};
