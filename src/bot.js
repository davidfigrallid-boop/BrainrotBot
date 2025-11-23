const { REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('./database');
const { parsePrice, formatPrice, formatCryptoPrice, convertEURToAllCryptos, getSupportedCryptos, getCryptoRates } = require('./utils');

// --- Constants ---
const rarityOrder = {
    'Common': 1, 'Rare': 2, 'Epic': 3, 'Legendary': 4,
    'Mythic': 5, 'Brainrot God': 6, 'Secret': 7, 'OG': 8
};

const rarityColors = {
    'Common': '⬜', 'Rare': '🟦', 'Epic': '🟪', 'Legendary': '🟧',
    'Mythic': '🟥', 'Brainrot God': '🌈', 'Secret': '⬛', 'OG': '⭐'
};

const MUTATIONS = [
    'Default', 'Gold', 'Diamond', 'Rainbow', 'Lava',
    'Bloodrot', 'Celestial', 'Candy', 'Galaxy', 'Yin Yang'
];

const TRAITS = [
    'Bloodmoon', 'Taco', 'Galactic', 'Explosive', 'Bubblegum',
    'Zombie', 'Glitched', 'Claws', 'Fireworks', 'Nyan',
    'Fire', 'Rain', 'Snowy', 'Cometstruck', 'Disco',
    'Water', 'TenB', 'Matteo Hat', 'Brazil Flag', 'Sleep',
    'UFO', 'Mygame43', 'Spider', 'Strawberry', 'Extinct',
    'Paint', 'Sombrero', 'Tie', 'Wizard Hat', 'Indonesia Flag',
    'Meowl', 'Pumpkin', 'R.I.P.'
];

// --- Helpers ---

async function getConfig(key) {
    const [rows] = await pool.query('SELECT value FROM config WHERE key_name = ?', [key]);
    return rows.length > 0 ? rows[0].value : null;
}

async function setConfig(key, value) {
    await pool.query('INSERT INTO config (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?', [key, value, value]);
}

async function getAllBrainrots() {
    const [rows] = await pool.query('SELECT * FROM brainrots');
    return rows.map(row => ({
        ...row,
        traits: typeof row.traits === 'string' ? JSON.parse(row.traits) : row.traits,
        price_crypto: typeof row.price_crypto === 'string' ? JSON.parse(row.price_crypto) : row.price_crypto
    }));
}

function sortBrainrots(brainrotsList) {
    return [...brainrotsList].sort((a, b) => {
        const rarityA = rarityOrder[a.rarity] || 999;
        const rarityB = rarityOrder[b.rarity] || 999;
        if (rarityA !== rarityB) return rarityA - rarityB;
        return a.name.localeCompare(b.name);
    });
}

function aggregateBrainrots(brainrotsList) {
    const aggregated = [];
    for (const br of brainrotsList) {
        const existing = aggregated.find(item =>
            item.name === br.name &&
            item.rarity === br.rarity &&
            item.owner_id === br.owner_id &&
            item.mutation === br.mutation &&
            JSON.stringify(item.traits) === JSON.stringify(br.traits)
        );

        if (existing) {
            existing.quantity = (existing.quantity || 1) + (br.quantity || 1);
        } else {
            aggregated.push({ ...br, quantity: br.quantity || 1 });
        }
    }
    return aggregated;
}

function formatBrainrotLine(br, crypto, showTraits = false) {
    let cryptoPriceStr = 'N/A';
    if (br.price_crypto && br.price_crypto[crypto]) {
        cryptoPriceStr = formatCryptoPrice(br.price_crypto[crypto]);
    }

    const quantiteDisplay = br.quantity > 1 ? ` \`x${br.quantity}\`` : '';
    const mutationDisplay = br.mutation && br.mutation !== 'Default' ? ` **[${br.mutation}]**` : '';
    const traitsDisplay = showTraits && br.traits && br.traits.length > 0
        ? `\n✨ Traits: ${br.traits.join(', ')}`
        : '';

    return `> **${br.name}** ${rarityColors[br.rarity] || ''}${mutationDisplay}${quantiteDisplay}\n` +
        `\`💰 Price: €${formatPrice(parseFloat(br.price_eur))} (${cryptoPriceStr} ${crypto})\`\n` +
        `\`📈 Income: ${formatPrice(parseFloat(br.income_per_second))}/s\`${traitsDisplay}\n`;
}

async function buildEmbed(viewMode = 'rarity') {
    const brainrots = await getAllBrainrots();
    const aggregated = aggregateBrainrots(brainrots);
    const sorted = sortBrainrots(aggregated);
    const crypto = await getConfig('defaultCrypto') || 'BTC';
    const rates = await getCryptoRates();

    // Ensure crypto prices
    for (const br of sorted) {
        if (!br.price_crypto) br.price_crypto = {};
        br.price_crypto[crypto] = br.price_eur / (rates[crypto] || 1);
    }

    const embed = new EmbedBuilder()
        .setColor(0xFFE600)
        .setTimestamp()
        .setFooter({ text: `Auto-refresh: 5 min | Prix en ${crypto}` });

    if (sorted.length === 0) {
        embed.setDescription('*Aucun brainrot disponible*');
        return embed;
    }

    if (viewMode === 'rarity') {
        embed.setTitle('🎨 Trié par Rareté');
        const grouped = {};
        sorted.forEach(br => {
            if (!grouped[br.rarity]) grouped[br.rarity] = [];
            grouped[br.rarity].push(br);
        });
        Object.keys(grouped).forEach(rarity => {
            const itemsList = grouped[rarity].map(br => formatBrainrotLine(br, crypto, true)).join('\n');
            embed.addFields({ name: `${rarityColors[rarity] || '📦'} ${rarity}`, value: itemsList || '*Aucun*', inline: false });
        });
    } else if (viewMode === 'price_eur') {
        embed.setTitle('💰 Trié par Prix EUR');
        const sortedByPrice = [...sorted].sort((a, b) => b.price_eur - a.price_eur);
        embed.setDescription(sortedByPrice.map(br => formatBrainrotLine(br, crypto, true)).join('\n') || '*Aucun*');
    } else if (viewMode === 'income') {
        embed.setTitle('📈 Trié par Income');
        const sortedByIncome = [...sorted].sort((a, b) => b.income_per_second - a.income_per_second);
        embed.setDescription(sortedByIncome.map(br => formatBrainrotLine(br, crypto, true)).join('\n') || '*Aucun*');
    } else if (viewMode === 'mutations') {
        embed.setTitle('🧬 Trié par Mutation');
        const grouped = {};
        sorted.forEach(br => {
            const m = br.mutation || 'Sans mutation';
            if (!grouped[m]) grouped[m] = [];
            grouped[m].push(br);
        });
        Object.keys(grouped).sort().forEach(m => {
            embed.addFields({ name: `🧬 ${m}`, value: grouped[m].map(br => formatBrainrotLine(br, crypto, true)).join('\n') || '*Aucun*', inline: false });
        });
    } else if (viewMode === 'traits') {
        embed.setTitle('✨ Trié par Traits');
        const grouped = {};
        sorted.forEach(br => {
            const traits = br.traits || [];
            if (traits.length === 0) {
                if (!grouped['Sans trait']) grouped['Sans trait'] = [];
                grouped['Sans trait'].push(br);
            } else {
                traits.forEach(t => {
                    if (!grouped[t]) grouped[t] = [];
                    grouped[t].push(br);
                });
            }
        });
        Object.keys(grouped).sort().forEach(t => {
            embed.addFields({ name: `✨ ${t}`, value: grouped[t].map(br => formatBrainrotLine(br, crypto, true)).join('\n') || '*Aucun*', inline: false });
        });
    }

    return embed;
}

function createNavigationButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('view_rarity').setLabel('Rareté').setStyle(ButtonStyle.Primary).setEmoji('🎨'),
        new ButtonBuilder().setCustomId('view_price_eur').setLabel('Prix EUR').setStyle(ButtonStyle.Success).setEmoji('💰'),
        new ButtonBuilder().setCustomId('view_income').setLabel('Income').setStyle(ButtonStyle.Success).setEmoji('📈'),
        new ButtonBuilder().setCustomId('view_mutations').setLabel('Mutations').setStyle(ButtonStyle.Secondary).setEmoji('🧬'),
        new ButtonBuilder().setCustomId('view_traits').setLabel('Traits').setStyle(ButtonStyle.Secondary).setEmoji('✨')
    );
}

// --- Brainrot Handlers ---

async function handleList(interaction) {
    const embed = await buildEmbed('rarity');
    const buttons = createNavigationButtons();
    const message = await interaction.reply({ embeds: [embed], components: [buttons], fetchReply: true });
    await setConfig('listMessageId', message.id);
    await setConfig('listChannelId', message.channelId);
}

async function handleAddBrainrot(interaction) {
    const name = interaction.options.getString('name');
    const rarity = interaction.options.getString('rarity');
    const incomeRate = parsePrice(interaction.options.getString('income_rate'));
    const mutation = interaction.options.getString('mutation');
    const traitsStr = interaction.options.getString('traits');
    const priceEUR = parsePrice(interaction.options.getString('price_eur'));
    const owner = interaction.options.getString('compte');
    const quantity = interaction.options.getInteger('quantite') || 1;

    let traits = [];
    if (traitsStr) traits = traitsStr.split(',').map(t => t.trim());

    const priceCrypto = await convertEURToAllCryptos(priceEUR);

    await pool.query(
        'INSERT INTO brainrots (name, rarity, income_per_second, mutation, traits, price_eur, price_crypto, owner_id, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [name, rarity, incomeRate, mutation, JSON.stringify(traits), priceEUR, JSON.stringify(priceCrypto), owner, quantity]
    );

    await interaction.reply(`✅ **${name}** ajouté !`);
}

async function handleRemoveBrainrot(interaction) {
    const name = interaction.options.getString('name');
    // Simple delete by name for now, ideally should filter more
    await pool.query('DELETE FROM brainrots WHERE name = ?', [name]);
    await interaction.reply(`✅ Brainrot **${name}** supprimé (si existant).`);
}

async function handleUpdateBrainrot(interaction) {
    // Simplified update logic
    const name = interaction.options.getString('name');
    const priceEUR = interaction.options.getString('price_eur');

    if (priceEUR) {
        const parsed = parsePrice(priceEUR);
        await pool.query('UPDATE brainrots SET price_eur = ? WHERE name = ?', [parsed, name]);
        await interaction.reply(`✅ Prix de **${name}** mis à jour.`);
    } else {
        await interaction.reply('⚠️ Rien à mettre à jour.');
    }
}

async function handleShowCompte(interaction) {
    const brainrots = await getAllBrainrots();
    const aggregated = aggregateBrainrots(brainrots);
    const withCompte = aggregated.filter(br => br.owner_id);

    if (withCompte.length === 0) return interaction.reply('Aucun compte assigné.');

    const embed = new EmbedBuilder().setTitle('📊 Brainrots par Compte').setColor(0xFFD700);
    const grouped = {};
    withCompte.forEach(br => {
        if (!grouped[br.owner_id]) grouped[br.owner_id] = [];
        grouped[br.owner_id].push(br);
    });

    Object.keys(grouped).forEach(owner => {
        const items = grouped[owner].map(br => `• ${br.name} (${br.rarity})`).join('\n');
        embed.addFields({ name: `👤 ${owner}`, value: items, inline: false });
    });

    await interaction.reply({ embeds: [embed] });
}

// --- Giveaway Handlers ---

async function handleGiveawayCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
        const prize = interaction.options.getString('prize');
        const durationStr = interaction.options.getString('duration');
        const winnersCount = interaction.options.getInteger('winners');
        const riggedUser = interaction.options.getUser('rigged_user');

        let durationMs = 0;
        if (durationStr.endsWith('m')) durationMs = parseInt(durationStr) * 60 * 1000;
        else if (durationStr.endsWith('h')) durationMs = parseInt(durationStr) * 60 * 60 * 1000;
        else durationMs = 60 * 1000;

        const endTime = new Date(Date.now() + durationMs);
        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`Prize: **${prize}**\nWinners: ${winnersCount}\nEnds: <t:${Math.floor(endTime.getTime() / 1000)}:R>`)
            .setColor(0xFF0000);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_giveaway').setLabel('Participate').setStyle(ButtonStyle.Primary)
        );

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        await pool.query(
            'INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winners_count, end_time, rigged_winner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [message.id, interaction.channelId, interaction.guildId, prize, winnersCount, endTime, riggedUser ? riggedUser.id : null]
        );

        setTimeout(() => endGiveaway(message.id, interaction.client), durationMs);
    }
}

async function endGiveaway(messageId, client) {
    const [rows] = await pool.query('SELECT * FROM giveaways WHERE message_id = ? AND ended = FALSE', [messageId]);
    if (rows.length === 0) return;

    const giveaway = rows[0];
    await pool.query('UPDATE giveaways SET ended = TRUE WHERE id = ?', [giveaway.id]);

    let participants = [];
    if (giveaway.participants) {
        participants = typeof giveaway.participants === 'string' ? JSON.parse(giveaway.participants) : giveaway.participants;
    }

    let winners = [];
    if (giveaway.rigged_winner_id && participants.includes(giveaway.rigged_winner_id)) {
        winners.push(giveaway.rigged_winner_id);
    }

    const remainingSpots = giveaway.winners_count - winners.length;
    const potentialWinners = participants.filter(p => !winners.includes(p));

    for (let i = 0; i < remainingSpots; i++) {
        if (potentialWinners.length === 0) break;
        const randomIndex = Math.floor(Math.random() * potentialWinners.length);
        winners.push(potentialWinners.splice(randomIndex, 1)[0]);
    }

    try {
        const channel = await client.channels.fetch(giveaway.channel_id);
        const message = await channel.messages.fetch(giveaway.message_id);
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        const endEmbed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY ENDED 🎉')
            .setDescription(`Prize: **${giveaway.prize}**\nWinners: ${winnerMentions || 'No one'}`)
            .setColor(0x000000);

        await message.edit({ embeds: [endEmbed], components: [] });
        if (winners.length > 0) await channel.send(`Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`);
    } catch (e) { console.error('Error ending giveaway:', e); }
}

// --- Setup ---

const commands = [
    new SlashCommandBuilder().setName('list').setDescription('List brainrots'),
    new SlashCommandBuilder().setName('addbrainrot').setDescription('Add brainrot')
        .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true))
        .addStringOption(o => o.setName('rarity').setDescription('Rarity').setRequired(true).addChoices(...Object.keys(rarityOrder).map(k => ({ name: k, value: k }))))
        .addStringOption(o => o.setName('mutation').setDescription('Mutation').setRequired(true).addChoices(...MUTATIONS.map(m => ({ name: m, value: m }))))
        .addStringOption(o => o.setName('income_rate').setDescription('Income').setRequired(true))
        .addStringOption(o => o.setName('price_eur').setDescription('Price EUR').setRequired(true))
        .addStringOption(o => o.setName('compte').setDescription('Account'))
        .addStringOption(o => o.setName('traits').setDescription('Traits'))
        .addIntegerOption(o => o.setName('quantite').setDescription('Quantity')),
    new SlashCommandBuilder().setName('removebrainrot').setDescription('Remove brainrot')
        .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)),
    new SlashCommandBuilder().setName('updatebrainrot').setDescription('Update brainrot')
        .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true))
        .addStringOption(o => o.setName('price_eur').setDescription('New Price EUR')),
    new SlashCommandBuilder().setName('setcrypto').setDescription('Set default crypto')
        .addStringOption(o => o.setName('crypto').setDescription('Crypto').setRequired(true).addChoices(...getSupportedCryptos().map(c => ({ name: c, value: c })))),
    new SlashCommandBuilder().setName('showcompte').setDescription('Show by account'),
    new SlashCommandBuilder().setName('giveaway').setDescription('Manage Giveaways')
        .addSubcommand(sub => sub.setName('create').setDescription('Create giveaway')
            .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
            .addStringOption(o => o.setName('duration').setDescription('Duration').setRequired(true))
            .addIntegerOption(o => o.setName('winners').setDescription('Winners').setRequired(true))
            .addUserOption(o => o.setName('rigged_user').setDescription('Rigged User')))
];

async function registerCommands(client) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');

        // Clear potential guild-based duplicates
        const guilds = client.guilds.cache.map(g => g.id);
        for (const guildId of guilds) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
        }

        // Register Global Commands
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

        console.log('Successfully reloaded application (/) commands.');
    } catch (e) { console.error(e); }
}

function setup(client) {
    client.once('ready', () => {
        registerCommands(client);

        // Persistent Giveaway Checker
        setInterval(async () => {
            try {
                const [rows] = await pool.query('SELECT * FROM giveaways WHERE ended = FALSE AND end_time <= NOW()');
                for (const giveaway of rows) {
                    await endGiveaway(giveaway.message_id, client);
                }
            } catch (e) { console.error('Error in giveaway loop:', e); }
        }, 10 * 1000); // Check every 10 seconds
    });
    client.on('interactionCreate', async interaction => {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('view_')) {
                const viewMode = interaction.customId.replace('view_', '');
                const embed = await buildEmbed(viewMode);
                const buttons = createNavigationButtons();
                await interaction.update({ embeds: [embed], components: [buttons] });
            } else if (interaction.customId === 'join_giveaway') {
                const [rows] = await pool.query('SELECT * FROM giveaways WHERE message_id = ?', [interaction.message.id]);
                if (rows.length > 0) {
                    const giveaway = rows[0];
                    let participants = giveaway.participants ? (typeof giveaway.participants === 'string' ? JSON.parse(giveaway.participants) : giveaway.participants) : [];
                    if (!participants.includes(interaction.user.id)) {
                        participants.push(interaction.user.id);
                        await pool.query('UPDATE giveaways SET participants = ? WHERE id = ?', [JSON.stringify(participants), giveaway.id]);
                        await interaction.reply({ content: 'You joined the giveaway!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'You are already participating.', ephemeral: true });
                    }
                }
            }
        } else if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            if (commandName === 'list') await handleList(interaction);
            else if (commandName === 'addbrainrot') await handleAddBrainrot(interaction);
            else if (commandName === 'removebrainrot') await handleRemoveBrainrot(interaction);
            else if (commandName === 'updatebrainrot') await handleUpdateBrainrot(interaction);
            else if (commandName === 'showcompte') await handleShowCompte(interaction);
            else if (commandName === 'setcrypto') {
                const crypto = interaction.options.getString('crypto');
                await setConfig('defaultCrypto', crypto);
                await interaction.reply(`Default crypto set to ${crypto}`);
            } else if (commandName === 'giveaway') await handleGiveawayCommand(interaction);
        }
    });
}

module.exports = { setup };
