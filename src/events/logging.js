const { Events, AuditLogEvent } = require('discord.js');
const { pool } = require('../database');

// Helper function to log events
async function logEvent(guildId, eventType, userId, channelId, details) {
    try {
        await pool.query(
            'INSERT INTO server_logs (guild_id, event_type, user_id, channel_id, details) VALUES (?, ?, ?, ?, ?)',
            [guildId, eventType, userId, channelId, JSON.stringify(details)]
        );
    } catch (error) {
        console.error('Error logging event:', error);
    }
}

// Helper function to check if event is enabled
async function isEventEnabled(guildId, eventType) {
    try {
        const [rows] = await pool.query(
            'SELECT enabled_events FROM log_config WHERE guild_id = ?',
            [guildId]
        );

        if (rows.length === 0) return false;

        const enabledEvents = typeof rows[0].enabled_events === 'string'
            ? JSON.parse(rows[0].enabled_events)
            : rows[0].enabled_events;

        return enabledEvents.includes(eventType);
    } catch (error) {
        console.error('Error checking event enabled:', error);
        return false;
    }
}

// Helper to send log embed
async function sendLogEmbed(client, guildId, embed) {
    try {
        const [rows] = await pool.query(
            'SELECT log_channel_id FROM log_config WHERE guild_id = ?',
            [guildId]
        );

        if (rows.length === 0) return;

        const channel = await client.channels.fetch(rows[0].log_channel_id);
        if (channel) {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error sending log embed:', error);
    }
}

function setupLogging(client) {
    const { EmbedBuilder } = require('discord.js');

    // Message Delete
    client.on(Events.MessageDelete, async (message) => {
        if (!message.guild || message.author?.bot) return;
        const eventType = 'message_delete';
        if (!await isEventEnabled(message.guild.id, eventType)) return;

        const details = {
            author: message.author?.tag,
            content: message.content?.substring(0, 500),
            channel: message.channel.name
        };

        await logEvent(message.guild.id, eventType, message.author?.id, message.channel.id, details);

        const embed = new EmbedBuilder()
            .setColor(0xFF006E)
            .setTitle('🗑️ Message Supprimé')
            .addFields(
                { name: 'Auteur', value: message.author ? `<@${message.author.id}>` : 'Inconnu', inline: true },
                { name: 'Salon', value: `<#${message.channel.id}>`, inline: true }
            )
            .setTimestamp();

        if (message.content) {
            embed.addFields({ name: 'Contenu', value: message.content.substring(0, 1000) || 'Aucun contenu', inline: false });
        }

        await sendLogEmbed(client, message.guild.id, embed);
    });

    // Message Edit
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const eventType = 'message_edit';
        if (!await isEventEnabled(newMessage.guild.id, eventType)) return;

        const details = {
            author: newMessage.author?.tag,
            old_content: oldMessage.content?.substring(0, 500),
            new_content: newMessage.content?.substring(0, 500),
            channel: newMessage.channel.name
        };

        await logEvent(newMessage.guild.id, eventType, newMessage.author?.id, newMessage.channel.id, details);

        const embed = new EmbedBuilder()
            .setColor(0xFFB800)
            .setTitle('✏️ Message Modifié')
            .addFields(
                { name: 'Auteur', value: `<@${newMessage.author.id}>`, inline: true },
                { name: 'Salon', value: `<#${newMessage.channel.id}>`, inline: true }
            )
            .setTimestamp();

        if (oldMessage.content) {
            embed.addFields({ name: 'Avant', value: oldMessage.content.substring(0, 500) || 'Aucun', inline: false });
        }
        if (newMessage.content) {
            embed.addFields({ name: 'Après', value: newMessage.content.substring(0, 500) || 'Aucun', inline: false });
        }

        await sendLogEmbed(client, newMessage.guild.id, embed);
    });

    // Member Join
    client.on(Events.GuildMemberAdd, async (member) => {
        const eventType = 'member_join';
        if (!await isEventEnabled(member.guild.id, eventType)) return;

        const details = {
            user_tag: member.user.tag,
            account_created: member.user.createdAt
        };

        await logEvent(member.guild.id, eventType, member.user.id, null, details);

        const embed = new EmbedBuilder()
            .setColor(0x06FFA5)
            .setTitle('👋 Nouveau Membre')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Utilisateur', value: `<@${member.user.id}>`, inline: true },
                { name: 'Tag', value: member.user.tag, inline: true },
                { name: 'Compte créé', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: false },
                { name: 'Total members', value: `${member.guild.memberCount}`, inline: true }
            )
            .setFooter({ text: `ID: ${member.user.id}` })
            .setTimestamp();

        await sendLogEmbed(client, member.guild.id, embed);
    });

    // Member Leave
    client.on(Events.GuildMemberRemove, async (member) => {
        const eventType = 'member_leave';
        if (!await isEventEnabled(member.guild.id, eventType)) return;

        const details = {
            user_tag: member.user.tag,
            roles: member.roles.cache.map(r => r.name)
        };

        await logEvent(member.guild.id, eventType, member.user.id, null, details);

        const embed = new EmbedBuilder()
            .setColor(0xFF006E)
            .setTitle('👋 Membre Parti')
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'Utilisateur', value: `${member.user.tag}`, inline: true },
                { name: 'Total members', value: `${member.guild.memberCount}`, inline: true }
            )
            .setFooter({ text: `ID: ${member.user.id}` })
            .setTimestamp();

        if (member.roles.cache.size > 1) {
            const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ');
            embed.addFields({ name: 'Rôles', value: roles.substring(0, 1000), inline: false });
        }

        await sendLogEmbed(client, member.guild.id, embed);
    });

    // Voice State Update
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (oldState.member?.user.bot) return;

        let eventType = null;
        let title = '';
        let color = 0x7C3AED;

        if (!oldState.channelId && newState.channelId) {
            eventType = 'voice_join';
            title = '🔊 Rejoint un salon vocal';
            color = 0x06FFA5;
        } else if (oldState.channelId && !newState.channelId) {
            eventType = 'voice_leave';
            title = '🔇 Quitté un salon vocal';
            color = 0xFF006E;
        } else if (oldState.channelId !== newState.channelId) {
            eventType = 'voice_move';
            title = '🔄 Changé de salon vocal';
        }

        if (!eventType || !await isEventEnabled(newState.guild.id, eventType)) return;

        const details = {
            user_tag: newState.member?.user.tag,
            old_channel: oldState.channel?.name,
            new_channel: newState.channel?.name
        };

        await logEvent(newState.guild.id, eventType, newState.member?.user.id, newState.channelId || oldState.channelId, details);

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .addFields(
                { name: 'Utilisateur', value: `<@${newState.member.user.id}>`, inline: true }
            )
            .setTimestamp();

        if (oldState.channelId) {
            embed.addFields({ name: 'Ancien salon', value: `<#${oldState.channelId}>`, inline: true });
        }
        if (newState.channelId) {
            embed.addFields({ name: 'Nouveau salon', value: `<#${newState.channelId}>`, inline: true });
        }

        await sendLogEmbed(client, newState.guild.id, embed);
    });

    // Member Ban
    client.on(Events.GuildBanAdd, async (ban) => {
        const eventType = 'member_ban';
        if (!await isEventEnabled(ban.guild.id, eventType)) return;

        const details = {
            user_tag: ban.user.tag,
            reason: ban.reason || 'Aucune raison'
        };

        await logEvent(ban.guild.id, eventType, ban.user.id, null, details);

        const embed = new EmbedBuilder()
            .setColor(0xFF006E)
            .setTitle('🔨 Membre Banni')
            .addFields(
                { name: 'Utilisateur', value: `${ban.user.tag}`, inline: true },
                { name: 'Raison', value: ban.reason || 'Aucune raison fournie', inline: false }
            )
            .setFooter({ text: `ID: ${ban.user.id}` })
            .setTimestamp();

        await sendLogEmbed(client, ban.guild.id, embed);
    });

    // Member Unban
    client.on(Events.GuildBanRemove, async (ban) => {
        const eventType = 'member_unban';
        if (!await isEventEnabled(ban.guild.id, eventType)) return;

        const details = {
            user_tag: ban.user.tag
        };

        await logEvent(ban.guild.id, eventType, ban.user.id, null, details);

        const embed = new EmbedBuilder()
            .setColor(0x06FFA5)
            .setTitle('✅ Membre Débanni')
            .addFields(
                { name: 'Utilisateur', value: `${ban.user.tag}`, inline: true }
            )
            .setFooter({ text: `ID: ${ban.user.id}` })
            .setTimestamp();

        await sendLogEmbed(client, ban.guild.id, embed);
    });

    // Channel Create
    client.on(Events.ChannelCreate, async (channel) => {
        if (!channel.guild) return;
        const eventType = 'channel_create';
        if (!await isEventEnabled(channel.guild.id, eventType)) return;

        const details = {
            channel_name: channel.name,
            channel_type: channel.type
        };

        await logEvent(channel.guild.id, eventType, null, channel.id, details);

        const embed = new EmbedBuilder()
            .setColor(0x06FFA5)
            .setTitle('📝 Salon Créé')
            .addFields(
                { name: 'Nom', value: channel.name, inline: true },
                { name: 'Type', value: `${channel.type}`, inline: true }
            )
            .setTimestamp();

        await sendLogEmbed(client, channel.guild.id, embed);
    });

    // Channel Delete
    client.on(Events.ChannelDelete, async (channel) => {
        if (!channel.guild) return;
        const eventType = 'channel_delete';
        if (!await isEventEnabled(channel.guild.id, eventType)) return;

        const details = {
            channel_name: channel.name,
            channel_type: channel.type
        };

        await logEvent(channel.guild.id, eventType, null, channel.id, details);

        const embed = new EmbedBuilder()
            .setColor(0xFF006E)
            .setTitle('🗑️ Salon Supprimé')
            .addFields(
                { name: 'Nom', value: channel.name, inline: true },
                { name: 'Type', value: `${channel.type}`, inline: true }
            )
            .setTimestamp();

        await sendLogEmbed(client, channel.guild.id, embed);
    });

    console.log('✅ Event logging system initialized');
}

module.exports = { setupLogging };
