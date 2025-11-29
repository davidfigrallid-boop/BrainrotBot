const { REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('./database');
const { parsePrice, formatPrice, formatCryptoPrice, convertEURToAllCryptos, getSupportedCryptos, getCryptoRates, parseDuration, formatDuration } = require('./utils');

// Import new commands
const logsCmd = require('./commands/logs');
const tiktokCmd = require('./commands/tiktok');
const userinfoCmd = require('./commands/userinfo');
const announceCmd = require('./commands/announce');

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
    const [rows] = await pool.query('SELECT * FROM brainrots WHERE sold = FALSE');
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

    const quantiteDisplay = br.quantity > 1 ? ` x${br.quantity}` : '';
    const mutationDisplay = br.mutation && br.mutation !== 'Default' ? `[${br.mutation}]` : '';
    const traitsDisplay = showTraits && br.traits && br.traits.length > 0
        ? ` {${br.traits.join(', ')}}`
        : '';

    return `${br.name}${quantiteDisplay} ${mutationDisplay}${traitsDisplay}\n` +
        `├ Income: **${formatPrice(parseFloat(br.income_per_second))}/s**\n` +
        `├ Prix: **€${formatPrice(parseFloat(br.price_eur))} (${cryptoPriceStr} ${crypto})**\n\n`;
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
            const itemsList = grouped[rarity].map(br => formatBrainrotLine(br, crypto, true)).join('');
            embed.addFields({ name: `${rarityColors[rarity] || '📦'} ${rarity}:`, value: itemsList || '*Aucun*', inline: false });
        });
    } else if (viewMode === 'price_eur') {
        embed.setTitle('💰 Trié par Prix EUR');
        const sortedByPrice = [...sorted].sort((a, b) => b.price_eur - a.price_eur);
        embed.setDescription(sortedByPrice.map(br => formatBrainrotLine(br, crypto, true)).join('') || '*Aucun*');
    } else if (viewMode === 'income') {
        embed.setTitle('📈 Trié par Income');
        const sortedByIncome = [...sorted].sort((a, b) => b.income_per_second - a.income_per_second);
        embed.setDescription(sortedByIncome.map(br => formatBrainrotLine(br, crypto, true)).join('') || '*Aucun*');
    } else if (viewMode === 'mutations') {
        embed.setTitle('🧬 Trié par Mutation');
        const grouped = {};
        sorted.forEach(br => {
            const m = br.mutation || 'Sans mutation';
            if (!grouped[m]) grouped[m] = [];
            grouped[m].push(br);
        });
        Object.keys(grouped).sort().forEach(m => {
            embed.addFields({ name: `🧬 ${m}:`, value: grouped[m].map(br => formatBrainrotLine(br, crypto, true)).join('') || '*Aucun*', inline: false });
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
            embed.addFields({ name: `✨ ${t}:`, value: grouped[t].map(br => formatBrainrotLine(br, crypto, true)).join('') || '*Aucun*', inline: false });
        });
    }

    return embed;
}

function createNavigationMenu() {
    const select = new StringSelectMenuBuilder()
        .setCustomId('view_select')
        .setPlaceholder('Choisir une catégorie de tri')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Rareté').setValue('rarity').setEmoji('🎨'),
            new StringSelectMenuOptionBuilder().setLabel('Prix EUR').setValue('price_eur').setEmoji('💰'),
            new StringSelectMenuOptionBuilder().setLabel('Income').setValue('income').setEmoji('📈'),
            new StringSelectMenuOptionBuilder().setLabel('Mutations').setValue('mutations').setEmoji('🧬'),
            new StringSelectMenuOptionBuilder().setLabel('Traits').setValue('traits').setEmoji('✨')
        );

    return new ActionRowBuilder().addComponents(select);
}

// --- Brainrot Handlers ---

async function handleList(interaction) {
    await interaction.deferReply();
    const embed = await buildEmbed('rarity');
    const menu = createNavigationMenu();

    const files = [];
    try {
        files.push('./brainrot_market.png');
    } catch (e) { console.error('Image not found:', e); }

    const message = await interaction.editReply({ embeds: [embed], components: [menu], files: files });
    await setConfig('listMessageId', message.id);
    await setConfig('listChannelId', message.channelId);
}

async function refreshBrainrotList(client) {
    const channelId = await getConfig('listChannelId');
    const messageId = await getConfig('listMessageId');

    if (!channelId || !messageId) {
        throw new Error('Aucune liste active trouvée.');
    }

    const channel = await client.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    const embed = await buildEmbed('rarity');
    const menu = createNavigationMenu();

    const existingFiles = Array.from(message.attachments.values());

    await message.edit({ embeds: [embed], components: [menu], files: existingFiles });
    return true;
}

async function handleRefreshList(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        await refreshBrainrotList(interaction.client);
        await interaction.editReply({ content: 'Liste mise à jour !' });
    } catch (error) {
        console.error('Error refreshing list:', error);
        await interaction.editReply({ content: 'Impossible de mettre à jour la liste (message peut-être supprimé ou introuvable).' });
    }
}

async function handleAddBrainrot(interaction) {
    await interaction.deferReply();
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

    await interaction.editReply(`✅ **${name}** ajouté !`);
}

async function handleRemoveBrainrot(interaction) {
    await interaction.deferReply();
    const name = interaction.options.getString('name');
    await pool.query('DELETE FROM brainrots WHERE name = ?', [name]);
    await interaction.editReply(`✅ Brainrot **${name}** supprimé (si existant).`);
}

async function handleUpdateBrainrot(interaction) {
    await interaction.deferReply();
    const name = interaction.options.getString('name');
    const priceEUR = interaction.options.getString('price_eur');

    if (priceEUR) {
        const parsed = parsePrice(priceEUR);
        await pool.query('UPDATE brainrots SET price_eur = ? WHERE name = ?', [parsed, name]);
        await interaction.editReply(`✅ Prix de **${name}** mis à jour.`);
    } else {
        await interaction.editReply('⚠️ Rien à mettre à jour.');
    }
}

async function handleShowCompte(interaction) {
    await interaction.deferReply();
    const brainrots = await getAllBrainrots();
    const aggregated = aggregateBrainrots(brainrots);
    const withCompte = aggregated.filter(br => br.owner_id);

    if (withCompte.length === 0) return interaction.editReply('Aucun compte assigné.');

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

    await interaction.editReply({ embeds: [embed] });
}

// --- Giveaway Handlers ---

async function handleGiveawayCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
        await interaction.deferReply();
        const prize = interaction.options.getString('prize');
        const durationStr = interaction.options.getString('duration');
        const winnersCount = interaction.options.getInteger('winners');
        const riggedUser = interaction.options.getUser('rigged_user');

        const durationMs = parseDuration(durationStr);
        if (durationMs < 60000) {
            return interaction.editReply('❌ La durée minimale est 1 minute (ex: 1m, 1h).');
        }

        const endTime = new Date(Date.now() + durationMs);
        const formattedDuration = formatDuration(durationMs);

        const embed = new EmbedBuilder()
            .setTitle(`🎉 Nouveau Giveaway: ${prize} 🎉`)
            .setDescription(`Gagnants: ${winnersCount}  |  Durée: ${formattedDuration}  |  Participants: 0`)
            .setColor(0x7B2CBF)
            .addFields(
                { name: 'Fin du giveaway', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: false }
            )
            .setImage('attachment://giveway_banner.jpg')

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('join_giveaway').setLabel('🎉 Participer').setStyle(ButtonStyle.Primary)
        );

        const files = [];
        try {
            files.push('./giveway_banner.jpg');
        } catch (e) { console.error('Image not found:', e); }

        const message = await interaction.editReply({ embeds: [embed], components: [row], files: files });

        await pool.query(
            'INSERT INTO giveaways (message_id, channel_id, guild_id, prize, winners_count, end_time, rigged_winner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [message.id, interaction.channelId, interaction.guildId, prize, winnersCount, endTime, riggedUser ? riggedUser.id : null]
        );

        const [rows] = await pool.query('SELECT id FROM giveaways WHERE message_id = ?', [message.id]);
        const giveawayId = rows[0].id;
        embed.setFooter({ text: `ID: ${giveawayId}` });

        const newRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`giveaway_join_${giveawayId}`).setLabel('🎉 Participer').setStyle(ButtonStyle.Primary)
        );

        await message.edit({ embeds: [embed], components: [newRow] });

        setTimeout(() => endGiveaway(message.id, interaction.client), durationMs);
    }
}

async function handleGend(interaction) {
    await interaction.deferReply();
    const id = interaction.options.getInteger('id');
    const winner = interaction.options.getUser('winner');

    const [rows] = await pool.query('SELECT * FROM giveaways WHERE id = ?', [id]);
    if (rows.length === 0) return interaction.editReply('❌ Giveaway introuvable.');

    const giveaway = rows[0];
    if (giveaway.ended) return interaction.editReply('❌ Ce giveaway est déjà terminé.');

    if (winner) {
        await pool.query('UPDATE giveaways SET rigged_winner_id = ? WHERE id = ?', [winner.id, id]);
    }

    await endGiveaway(giveaway.message_id, interaction.client);
    await interaction.editReply(`✅ Giveaway #${id} terminé manuellement.`);
}

async function handleGreroll(interaction) {
    await interaction.deferReply();
    const id = interaction.options.getInteger('id');

    const [rows] = await pool.query('SELECT * FROM giveaways WHERE id = ?', [id]);
    if (rows.length === 0) return interaction.editReply('❌ Giveaway introuvable.');

    const giveaway = rows[0];
    if (!giveaway.ended) return interaction.editReply('❌ Ce giveaway n\'est pas encore terminé.');

    let participants = giveaway.participants ? (typeof giveaway.participants === 'string' ? JSON.parse(giveaway.participants) : giveaway.participants) : [];
    if (participants.length === 0) return interaction.editReply('❌ Aucun participant.');

    const winners = [];
    const potentialWinners = [...participants];

    for (let i = 0; i < giveaway.winners_count; i++) {
        if (potentialWinners.length === 0) break;
        const randomIndex = Math.floor(Math.random() * potentialWinners.length);
        winners.push(potentialWinners.splice(randomIndex, 1)[0]);
    }

    const winnerMentions = winners.map(id => `<@${id}>`).join(', ');

    const embed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('🔄 Gagnants Resélectionnés!')
        .addFields(
            { name: 'Prix', value: giveaway.prize, inline: true },
            { name: 'Gagnants', value: String(winners.length), inline: true },
            { name: '🏆 Nouveaux Gagnants', value: winnerMentions || 'Aucun', inline: false }
        )

    await interaction.editReply({ embeds: [embed] });

    try {
        const channel = await interaction.client.channels.fetch(giveaway.channel_id);
        await channel.send(`🔄 Reroll pour **${giveaway.prize}**! Félicitations à ${winnerMentions}!`);
    } catch (e) { console.error('Error announcing reroll:', e); }
}

async function handleGlist(interaction) {
    await interaction.deferReply();
    const status = interaction.options.getString('status');

    let query = 'SELECT * FROM giveaways';
    const params = [];

    if (status === 'active') {
        query += ' WHERE ended = 0';
    } else if (status === 'ended') {
        query += ' WHERE ended = 1';
    }

    query += ' ORDER BY created_at DESC LIMIT 10';

    const [rows] = await pool.query(query, params);

    if (rows.length === 0) return interaction.editReply('❌ Aucun giveaway trouvé.');

    const embed = new EmbedBuilder()
        .setColor(0x7B2CBF)
        .setTitle(`🎉 Giveaways (${status || 'Tous'})`)
        .setTimestamp();

    rows.forEach(g => {
        const state = g.ended ? '✅ Terminé' : '🔄 Actif';
        const time = g.ended ? 'Terminé' : `<t:${Math.floor(new Date(g.end_time).getTime() / 1000)}:R>`;
        const partCount = g.participants ? (typeof g.participants === 'string' ? JSON.parse(g.participants).length : g.participants.length) : 0;

        embed.addFields({
            name: `${g.prize} (ID: ${g.id})`,
            value: `**Statut:** ${state}\n**Gagnants:** ${g.winners_count}\n**Participants:** ${partCount}\n**Fin:** ${time}`,
            inline: false
        });
    });

    await interaction.editReply({ embeds: [embed] });
}

async function endGiveaway(messageId, client) {
    try {
        const [result] = await pool.query('UPDATE giveaways SET ended = 1 WHERE message_id = ? AND ended = 0', [messageId]);
        if (result.affectedRows === 0) return;

        const [rows] = await pool.query('SELECT * FROM giveaways WHERE message_id = ?', [messageId]);
        const giveaway = rows[0];

        let participants = [];
        if (giveaway.participants) {
            participants = typeof giveaway.participants === 'string' ? JSON.parse(giveaway.participants) : giveaway.participants;
        }

        // Auto-add rigged winner to participants if not present
        if (giveaway.rigged_winner_id && !participants.includes(giveaway.rigged_winner_id)) {
            participants.push(giveaway.rigged_winner_id);
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

            const winnerMentions = winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'No one';

            const endEmbed = new EmbedBuilder()
                .setTitle('✅ Giveaway Terminé!')
                .setColor(0x00FF00)
                .addFields(
                    { name: 'Prix', value: giveaway.prize, inline: true },
                    { name: 'Gagnants', value: String(winners.length), inline: true },
                    { name: 'Participants', value: String(participants.length), inline: true },
                    { name: '🏆 Gagnants', value: winnerMentions, inline: false }
                )
                .setImage('attachment://giveway_banner.jpg')

            const files = [];
            try {
                files.push('./giveway_banner.jpg');
            } catch (e) { console.error('Image not found:', e); }

            await message.edit({ embeds: [endEmbed], components: [], files: files });

            if (winners.length > 0) {
                await channel.send(`Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`);
            } else {
                await channel.send(`Giveaway ended for **${giveaway.prize}**. No winners.`);
            }
        } catch (e) {
            if (e.code === 10008) {
                console.log(`Giveaway message ${messageId} not found, marking as ended.`);
            } else {
                console.error('Error ending giveaway:', e);
            }
        }
    } catch (err) {
        console.error('Critical error in endGiveaway:', err);
    }
}

// --- Setup ---

const commands = [
    new SlashCommandBuilder().setName('list').setDescription('List brainrots'),
    new SlashCommandBuilder().setName('refreshlist').setDescription('Refresh the existing brainrot list'),
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
    userinfoCmd.command,
    announceCmd.command
];

async function registerCommands(client) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');

        const guilds = client.guilds.cache.map(g => g.id);
        for (const guildId of guilds) {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
        }

        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

        console.log('Successfully reloaded application (/) commands.');
    } catch (e) { console.error(e); }
}

function setup(client) {
    client.once('ready', () => {
        registerCommands(client);

        setInterval(async () => {
            try {
                const [rows] = await pool.query('SELECT * FROM giveaways WHERE ended = 0 AND end_time <= NOW()');
                for (const giveaway of rows) {
                    await endGiveaway(giveaway.message_id, client);
                }
            } catch (e) { console.error('Error in giveaway loop:', e); }
        }, 10 * 1000);
    });

    client.on('interactionCreate', async interaction => {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'view_select') {
                await interaction.deferUpdate();
                const viewMode = interaction.values[0];
                const embed = await buildEmbed(viewMode);
                await interaction.editReply({ embeds: [embed] });
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('giveaway_join_') || interaction.customId === 'join_giveaway') {
                const [rows] = await pool.query('SELECT * FROM giveaways WHERE message_id = ?', [interaction.message.id]);
                if (rows.length > 0) {
                    const giveaway = rows[0];
                    if (giveaway.ended) return interaction.reply({ content: '❌ Ce giveaway est terminé.', ephemeral: true });

                    let participants = giveaway.participants ? (typeof giveaway.participants === 'string' ? JSON.parse(giveaway.participants) : giveaway.participants) : [];
                    if (!participants.includes(interaction.user.id)) {
                        participants.push(interaction.user.id);
                        await pool.query('UPDATE giveaways SET participants = ? WHERE id = ?', [JSON.stringify(participants), giveaway.id]);

                        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
                        const oldDesc = embed.data.description;
                        if (oldDesc) {
                            const newDesc = oldDesc.replace(/Participants: \d+/, `Participants: ${participants.length}`);
                            embed.setDescription(newDesc);
                        }

                        await interaction.message.edit({ embeds: [embed] });
                        await interaction.reply({ content: '🎉 Participation enregistrée !', ephemeral: true });
                    } else {
                        await interaction.reply({ content: '⚠️ Vous participez déjà.', ephemeral: true });
                    }
                }
            }
        } else if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;
            if (commandName === 'list') await handleList(interaction);
            else if (commandName === 'refreshlist') await handleRefreshList(interaction);
            else if (commandName === 'addbrainrot') await handleAddBrainrot(interaction);
            else if (commandName === 'removebrainrot') await handleRemoveBrainrot(interaction);
            else if (commandName === 'updatebrainrot') await handleUpdateBrainrot(interaction);
            else if (commandName === 'showcompte') await handleShowCompte(interaction);
            else if (commandName === 'setcrypto') {
                const crypto = interaction.options.getString('crypto');
                await setConfig('defaultCrypto', crypto);
                await interaction.reply(`Default crypto set to ${crypto}`);
            } else if (commandName === 'giveaway') await handleGiveawayCommand(interaction);
            else if (commandName === 'gend') await handleGend(interaction);
            else if (commandName === 'greroll') await handleGreroll(interaction);
            else if (commandName === 'glist') await handleGlist(interaction);
            // New commands
            else if (commandName === 'logs') await logsCmd.handleCommand(interaction);
            else if (commandName === 'tiktok') await tiktokCmd.handleCommand(interaction);
            else if (commandName === 'info') await userinfoCmd.handleCommand(interaction);
            else if (commandName === 'announce') await announceCmd.handleCommand(interaction);
        }
    });
}

module.exports = { setup, refreshBrainrotList, endGiveaway, setupGiveawayTimer: (messageId, duration, client) => setTimeout(() => endGiveaway(messageId, client), duration) };
