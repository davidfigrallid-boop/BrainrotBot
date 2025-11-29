const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { pool } = require('../database');

// All available event types
const EVENT_TYPES = {
    MEMBER_JOIN: 'member_join',
    MEMBER_LEAVE: 'member_leave',
    MEMBER_UPDATE: 'member_update',
    MESSAGE_DELETE: 'message_delete',
    MESSAGE_EDIT: 'message_edit',
    MESSAGE_BULK_DELETE: 'message_bulk_delete',
    VOICE_JOIN: 'voice_join',
    VOICE_LEAVE: 'voice_leave',
    VOICE_MOVE: 'voice_move',
    VOICE_MUTE: 'voice_mute',
    MEMBER_BAN: 'member_ban',
    MEMBER_UNBAN: 'member_unban',
    MEMBER_KICK: 'member_kick',
    MEMBER_TIMEOUT: 'member_timeout',
    CHANNEL_CREATE: 'channel_create',
    CHANNEL_DELETE: 'channel_delete',
    CHANNEL_UPDATE: 'channel_update',
    ROLE_CREATE: 'role_create',
    ROLE_DELETE: 'role_delete',
    ROLE_UPDATE: 'role_update',
    INVITE_CREATE: 'invite_create',
    INVITE_DELETE: 'invite_delete',
    EMOJI_CREATE: 'emoji_create',
    EMOJI_DELETE: 'emoji_delete'
};

const DEFAULT_EVENTS = Object.values(EVENT_TYPES);

async function handleLogsSetup(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    try {
        await pool.query(
            'INSERT INTO log_config (guild_id, log_channel_id, enabled_events) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE log_channel_id = ?, enabled_events = ?',
            [guildId, channel.id, JSON.stringify(DEFAULT_EVENTS), channel.id, JSON.stringify(DEFAULT_EVENTS)]
        );

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle('✅ Logs Configurés')
            .setDescription(`Le système de logs a été configuré dans ${channel}`)
            .addFields(
                { name: 'Événements activés', value: `${DEFAULT_EVENTS.length} événements`, inline: true },
                { name: 'Canal', value: `${channel}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error setting up logs:', error);
        await interaction.editReply('❌ Erreur lors de la configuration des logs.');
    }
}

async function handleLogsDisable(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId;

    try {
        await pool.query('DELETE FROM log_config WHERE guild_id = ?', [guildId]);
        await interaction.editReply('✅ Système de logs désactivé pour ce serveur.');
    } catch (error) {
        console.error('Error disabling logs:', error);
        await interaction.editReply('❌ Erreur lors de la désactivation des logs.');
    }
}

async function handleLogsView(interaction) {
    await interaction.deferReply();
    const eventType = interaction.options.getString('type');
    const limit = interaction.options.getInteger('limit') || 10;
    const guildId = interaction.guildId;

    try {
        let query = 'SELECT * FROM server_logs WHERE guild_id = ?';
        const params = [guildId];

        if (eventType) {
            query += ' AND event_type = ?';
            params.push(eventType);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);

        const [logs] = await pool.query(query, params);

        if (logs.length === 0) {
            return interaction.editReply('Aucun log trouvé.');
        }

        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle(`📋 Historique des Logs${eventType ? ` - ${eventType}` : ''}`)
            .setDescription(`Affichage des ${logs.length} derniers événements`)
            .setTimestamp();

        logs.forEach((log, index) => {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            const timestamp = new Date(log.timestamp).toLocaleString('fr-FR');

            let description = `**Type:** ${log.event_type}\n`;
            if (log.user_id) description += `**User:** <@${log.user_id}>\n`;
            if (log.channel_id) description += `**Channel:** <#${log.channel_id}>\n`;
            description += `**Time:** ${timestamp}\n`;
            if (details.message) description += `**Details:** ${details.message.substring(0, 100)}`;

            if (index < 25) { // Discord limit
                embed.addFields({ name: `Log #${log.id}`, value: description, inline: false });
            }
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error viewing logs:', error);
        await interaction.editReply('❌ Erreur lors de la récupération des logs.');
    }
}

async function handleLogsEvents(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const eventType = interaction.options.getString('event');
    const enabled = interaction.options.getBoolean('enabled');
    const guildId = interaction.guildId;

    try {
        const [rows] = await pool.query('SELECT enabled_events FROM log_config WHERE guild_id = ?', [guildId]);

        if (rows.length === 0) {
            return interaction.editReply('⚠️ Veuillez d\'abord configurer le système de logs avec `/logs setup`');
        }

        let enabledEvents = typeof rows[0].enabled_events === 'string'
            ? JSON.parse(rows[0].enabled_events)
            : rows[0].enabled_events;

        if (enabled && !enabledEvents.includes(eventType)) {
            enabledEvents.push(eventType);
        } else if (!enabled && enabledEvents.includes(eventType)) {
            enabledEvents = enabledEvents.filter(e => e !== eventType);
        }

        await pool.query('UPDATE log_config SET enabled_events = ? WHERE guild_id = ?',
            [JSON.stringify(enabledEvents), guildId]);

        await interaction.editReply(`✅ Événement **${eventType}** ${enabled ? 'activé' : 'désactivé'}.`);
    } catch (error) {
        console.error('Error updating log events:', error);
        await interaction.editReply('❌ Erreur lors de la mise à jour des événements.');
    }
}

const command = new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Gérer le système de logs du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('Configure le salon de logs')
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('Salon où envoyer les logs')
            .setRequired(true)))
    .addSubcommand(sub => sub
        .setName('disable')
        .setDescription('Désactive le système de logs'))
    .addSubcommand(sub => sub
        .setName('view')
        .setDescription('Voir l\'historique des logs')
        .addStringOption(opt => opt
            .setName('type')
            .setDescription('Type d\'événement à afficher')
            .setRequired(false))
        .addIntegerOption(opt => opt
            .setName('limit')
            .setDescription('Nombre de logs à afficher (défaut: 10)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)))
    .addSubcommand(sub => sub
        .setName('events')
        .setDescription('Active/désactive des événements spécifiques')
        .addStringOption(opt => opt
            .setName('event')
            .setDescription('Type d\'événement')
            .setRequired(true)
            .addChoices(
                { name: 'Member Join', value: EVENT_TYPES.MEMBER_JOIN },
                { name: 'Member Leave', value: EVENT_TYPES.MEMBER_LEAVE },
                { name: 'Message Delete', value: EVENT_TYPES.MESSAGE_DELETE },
                { name: 'Message Edit', value: EVENT_TYPES.MESSAGE_EDIT },
                { name: 'Voice Join', value: EVENT_TYPES.VOICE_JOIN },
                { name: 'Voice Leave', value: EVENT_TYPES.VOICE_LEAVE },
                { name: 'Member Ban', value: EVENT_TYPES.MEMBER_BAN },
                { name: 'Member Unban', value: EVENT_TYPES.MEMBER_UNBAN }
            ))
        .addBooleanOption(opt => opt
            .setName('enabled')
            .setDescription('Activer ou désactiver cet événement')
            .setRequired(true)));

async function handleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'setup':
            await handleLogsSetup(interaction);
            break;
        case 'disable':
            await handleLogsDisable(interaction);
            break;
        case 'view':
            await handleLogsView(interaction);
            break;
        case 'events':
            await handleLogsEvents(interaction);
            break;
        default:
            await interaction.reply({ content: 'Sous-commande inconnue', ephemeral: true });
    }
}

module.exports = { command, handleCommand, EVENT_TYPES };
