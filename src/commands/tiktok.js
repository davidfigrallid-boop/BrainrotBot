const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { pool } = require('../database');

async function handleTikTokAdd(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString('username').toLowerCase().replace('@', '');
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    try {
        await pool.query(
            'INSERT INTO tiktok_tracking (guild_id, tiktok_username, channel_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE channel_id = ?',
            [guildId, username, channel.id, channel.id]
        );

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle('✅ Créateur TikTok Ajouté')
            .setDescription(`Le bot va maintenant auto-poster les vidéos de **@${username}** dans ${channel}`)
            .addFields(
                { name: 'Username', value: `@${username}`, inline: true },
                { name: 'Channel', value: `${channel}`, inline: true },
                { name: 'Fréquence', value: 'Toutes les 10 minutes', inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error adding TikTok tracking:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            await interaction.editReply('⚠️ Ce créateur est déjà tracké sur ce serveur.');
        } else {
            await interaction.editReply('❌ Erreur lors de l\'ajout du tracking TikTok.');
        }
    }
}

async function handleTikTokRemove(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString('username').toLowerCase().replace('@', '');
    const guildId = interaction.guildId;

    try {
        const [result] = await pool.query(
            'DELETE FROM tiktok_tracking WHERE guild_id = ? AND tiktok_username = ?',
            [guildId, username]
        );

        if (result.affectedRows > 0) {
            await interaction.editReply(`✅ Le tracking de **@${username}** a été supprimé.`);
        } else {
            await interaction.editReply(`⚠️ Aucun tracking trouvé pour **@${username}**.`);
        }
    } catch (error) {
        console.error('Error removing TikTok tracking:', error);
        await interaction.editReply('❌ Erreur lors de la suppression du tracking.');
    }
}

async function handleTikTokList(interaction) {
    await interaction.deferReply();
    const guildId = interaction.guildId;

    try {
        const [trackings] = await pool.query(
            'SELECT * FROM tiktok_tracking WHERE guild_id = ? ORDER BY created_at DESC',
            [guildId]
        );

        if (trackings.length === 0) {
            return interaction.editReply('Aucun créateur TikTok n\'est tracké sur ce serveur.');
        }

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle('📱 Créateurs TikTok Trackés')
            .setDescription(`${trackings.length} créateur(s) tracké(s)`)
            .setTimestamp();

        trackings.forEach(track => {
            const lastCheck = track.last_check ? new Date(track.last_check).toLocaleString('fr-FR') : 'Jamais';
            const lastVideo = track.last_video_id || 'Aucune';

            embed.addFields({
                name: `@${track.tiktok_username}`,
                value: `**Channel:** <#${track.channel_id}>\n**Dernière vérif:** ${lastCheck}\n**Dernière vidéo:** ${lastVideo.substring(0, 20)}...`,
                inline: true
            });
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error listing TikTok trackings:', error);
        await interaction.editReply('❌ Erreur lors de la récupération de la liste.');
    }
}

async function handleTikTokCheck(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const username = interaction.options.getString('username').toLowerCase().replace('@', '');

    try {
        await interaction.editReply(`🔄 Vérification des nouvelles vidéos de **@${username}**...\n\n⚠️ Cette fonctionnalité sera disponible une fois le service TikTok configuré.`);
    } catch (error) {
        console.error('Error checking TikTok:', error);
        await interaction.editReply('❌ Erreur lors de la vérification.');
    }
}

const command = new SlashCommandBuilder()
    .setName('tiktok')
    .setDescription('Gérer l\'auto-posting des vidéos TikTok')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
        .setName('add')
        .setDescription('Ajouter un créateur TikTok à tracker')
        .addStringOption(opt => opt
            .setName('username')
            .setDescription('Nom d\'utilisateur TikTok (sans @)')
            .setRequired(true))
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('Salon où poster les vidéos')
            .setRequired(true)))
    .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('Arrêter de tracker un créateur')
        .addStringOption(opt => opt
            .setName('username')
            .setDescription('Nom d\'utilisateur TikTok')
            .setRequired(true)))
    .addSubcommand(sub => sub
        .setName('list')
        .setDescription('Voir tous les créateurs trackés'))
    .addSubcommand(sub => sub
        .setName('check')
        .setDescription('Vérifier manuellement les nouvelles vidéos')
        .addStringOption(opt => opt
            .setName('username')
            .setDescription('Nom d\'utilisateur TikTok')
            .setRequired(true)));

async function handleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'add':
            await handleTikTokAdd(interaction);
            break;
        case 'remove':
            await handleTikTokRemove(interaction);
            break;
        case 'list':
            await handleTikTokList(interaction);
            break;
        case 'check':
            await handleTikTokCheck(interaction);
            break;
        default:
            await interaction.reply({ content: 'Sous-commande inconnue', ephemeral: true });
    }
}

module.exports = { command, handleCommand };
