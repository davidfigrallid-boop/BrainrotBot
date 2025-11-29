const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { pool } = require('../database');

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

async function handleInfo(interaction) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    try {
        // Get or create user stats
        let [userStats] = await pool.query(
            'SELECT * FROM user_stats WHERE guild_id = ? AND user_id = ?',
            [guildId, targetUser.id]
        );

        if (userStats.length === 0) {
            // Create entry if doesn't exist
            const member = await interaction.guild.members.fetch(targetUser.id);
            await pool.query(
                'INSERT INTO user_stats (guild_id, user_id, join_date) VALUES (?, ?, ?)',
                [guildId, targetUser.id, member.joinedAt]
            );

            [userStats] = await pool.query(
                'SELECT * FROM user_stats WHERE guild_id = ? AND user_id = ?',
                [guildId, targetUser.id]
            );
        }

        const stats = userStats[0];

        // Get invitation stats
        const [inviteStats] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN left_server = FALSE THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN left_server = TRUE THEN 1 ELSE 0 END) as left_count
            FROM user_invites 
            WHERE guild_id = ? AND inviter_id = ?`,
            [guildId, targetUser.id]
        );

        const invites = inviteStats[0];

        // Get member info
        const member = await interaction.guild.members.fetch(targetUser.id);
        const joinedAt = member.joinedAt || stats.join_date;
        const memberSince = Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24)); // days

        // Create detailed embed
        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL() })
            .setTitle(`📊 Statistiques de ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: '📩 Invitations',
                    value: `Total: **${invites.total || 0}**\nActifs: **${invites.active || 0}**\nPartis: **${invites.left_count || 0}**`,
                    inline: true
                },
                {
                    name: '💬 Messages',
                    value: `Total: **${stats.total_messages || 0}**${stats.last_message_at ? `\nDernier: <t:${Math.floor(new Date(stats.last_message_at).getTime() / 1000)}:R>` : ''}`,
                    inline: true
                },
                {
                    name: '🔊 Temps Vocal',
                    value: `Total: **${formatDuration(stats.voice_time_seconds || 0)}**${stats.last_voice_at ? `\nDernier: <t:${Math.floor(new Date(stats.last_voice_at).getTime() / 1000)}:R>` : ''}`,
                    inline: true
                },
                {
                    name: '📅 Membre depuis',
                    value: `<t:${Math.floor(new Date(joinedAt).getTime() / 1000)}:F>\n*Il y a ${memberSince} jour(s)*`,
                    inline: false
                },
                {
                    name: '👥 Rôles',
                    value: member.roles.cache.size > 1
                        ? member.roles.cache.filter(r => r.id !== interaction.guildId).map(r => r).slice(0, 10).join(', ')
                        : 'Aucun rôle',
                    inline: false
                }
            )
            .setFooter({ text: `ID: ${targetUser.id}` })
            .setTimestamp();

        if (member.premiumSince) {
            embed.addFields({
                name: '💎 Server Booster',
                value: `Depuis <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`,
                inline: true
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error fetching user info:', error);
        await interaction.editReply('❌ Erreur lors de la récupération des statistiques.');
    }
}

const command = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Affiche les statistiques détaillées d\'un utilisateur')
    .addUserOption(opt => opt
        .setName('user')
        .setDescription('L\'utilisateur à analyser (par défaut: vous)')
        .setRequired(false));

async function handleCommand(interaction) {
    await handleInfo(interaction);
}

module.exports = { command, handleCommand };
