const { Events } = require('discord.js');
const { pool } = require('../database');

// Track message counts
async function trackMessage(guildId, userId) {
    try {
        await pool.query(
            `INSERT INTO user_stats (guild_id, user_id, total_messages, last_message_at, join_date) 
             VALUES (?, ?, 1, NOW(), NOW()) 
             ON DUPLICATE KEY UPDATE 
             total_messages = total_messages + 1, 
             last_message_at = NOW()`,
            [guildId, userId]
        );
    } catch (error) {
        console.error('Error tracking message:', error);
    }
}

// Track voice sessions
async function trackVoiceJoin(guildId, userId, channelId) {
    try {
        await pool.query(
            'INSERT INTO voice_sessions (guild_id, user_id, channel_id, join_time) VALUES (?, ?, ?, NOW())',
            [guildId, userId, channelId]
        );

        // Update last voice timestamp
        await pool.query(
            `INSERT INTO user_stats (guild_id, user_id, last_voice_at, join_date) 
             VALUES (?, ?, NOW(), NOW()) 
             ON DUPLICATE KEY UPDATE last_voice_at = NOW()`,
            [guildId, userId]
        );
    } catch (error) {
        console.error('Error tracking voice join:', error);
    }
}

async function trackVoiceLeave(guildId, userId) {
    try {
        // Get the last open session
        const [sessions] = await pool.query(
            'SELECT * FROM voice_sessions WHERE guild_id = ? AND user_id = ? AND leave_time IS NULL ORDER BY join_time DESC LIMIT 1',
            [guildId, userId]
        );

        if (sessions.length > 0) {
            const session = sessions[0];
            const joinTime = new Date(session.join_time);
            const leaveTime = new Date();
            const durationSeconds = Math.floor((leaveTime - joinTime) / 1000);

            // Update session
            await pool.query(
                'UPDATE voice_sessions SET leave_time = NOW() WHERE id = ?',
                [session.id]
            );

            // Update total voice time
            await pool.query(
                `INSERT INTO user_stats (guild_id, user_id, voice_time_seconds, join_date) 
                 VALUES (?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE voice_time_seconds = voice_time_seconds + ?`,
                [guildId, userId, durationSeconds, durationSeconds]
            );
        }
    } catch (error) {
        console.error('Error tracking voice leave:', error);
    }
}

// Track invitations
async function trackInvites(guild) {
    try {
        const invites = await guild.invites.fetch();
        const inviteData = new Map();

        invites.forEach(invite => {
            inviteData.set(invite.code, {
                uses: invite.uses,
                inviter: invite.inviter?.id
            });
        });

        // Store in memory for later comparison
        if (!guild.client.inviteCache) {
            guild.client.inviteCache = new Map();
        }
        guild.client.inviteCache.set(guild.id, inviteData);
    } catch (error) {
        console.error('Error tracking invites:', error);
    }
}

async function findUsedInvite(guild, member) {
    try {
        if (!guild.client.inviteCache?.has(guild.id)) {
            return null;
        }

        const oldInvites = guild.client.inviteCache.get(guild.id);
        const newInvites = await guild.invites.fetch();

        for (const [code, newInvite] of newInvites) {
            const oldInvite = oldInvites.get(code);
            if (oldInvite && newInvite.uses > oldInvite.uses) {
                // Update cache
                oldInvites.set(code, {
                    uses: newInvite.uses,
                    inviter: newInvite.inviter?.id
                });

                // Save to database
                if (newInvite.inviter) {
                    await pool.query(
                        'INSERT INTO user_invites (guild_id, inviter_id, invited_id, invite_code) VALUES (?, ?, ?, ?)',
                        [guild.id, newInvite.inviter.id, member.id, code]
                    );

                    // Update inviter stats
                    await pool.query(
                        `INSERT INTO user_stats (guild_id, user_id, invites_total, invites_left, join_date) 
                         VALUES (?, ?, 1, 1, NOW()) 
                         ON DUPLICATE KEY UPDATE 
                         invites_total = invites_total + 1,
                         invites_left = invites_left + 1`,
                        [guild.id, newInvite.inviter.id]
                    );
                }

                return newInvite;
            }
        }

        return null;
    } catch (error) {
        console.error('Error finding used invite:', error);
        return null;
    }
}

function setupTracking(client) {
    // Track messages
    client.on(Events.MessageCreate, async (message) => {
        if (!message.guild || message.author.bot) return;
        await trackMessage(message.guild.id, message.author.id);
    });

    // Track voice
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.member?.user.bot) return;

        // User joined a voice channel
        if (!oldState.channelId && newState.channelId) {
            await trackVoiceJoin(newState.guild.id, newState.member.user.id, newState.channelId);
        }
        // User left a voice channel
        else if (oldState.channelId && !newState.channelId) {
            await trackVoiceLeave(newState.guild.id, newState.member.user.id);
        }
        // User switched voice channels
        else if (oldState.channelId !== newState.channelId) {
            await trackVoiceLeave(oldState.guild.id, oldState.member.user.id);
            await trackVoiceJoin(newState.guild.id, newState.member.user.id, newState.channelId);
        }
    });

    // Track invites
    client.on(Events.GuildMemberAdd, async (member) => {
        // Initialize user stats
        await pool.query(
            'INSERT IGNORE INTO user_stats (guild_id, user_id, join_date) VALUES (?, ?, ?)',
            [member.guild.id, member.user.id, member.joinedAt || new Date()]
        );

        // Find which invite was used
        await findUsedInvite(member.guild, member);
    });

    // Track when members leave (update invite stats)
    client.on(Events.GuildMemberRemove, async (member) => {
        try {
            // Mark as left in invites table
            await pool.query(
                'UPDATE user_invites SET left_server = TRUE WHERE guild_id = ? AND invited_id = ?',
                [member.guild.id, member.user.id]
            );

            // Get inviter and update their stats
            const [invites] = await pool.query(
                'SELECT inviter_id FROM user_invites WHERE guild_id = ? AND invited_id = ?',
                [member.guild.id, member.user.id]
            );

            if (invites.length > 0) {
                await pool.query(
                    'UPDATE user_stats SET invites_left = invites_left - 1 WHERE guild_id = ? AND user_id = ?',
                    [member.guild.id, invites[0].inviter_id]
                );
            }
        } catch (error) {
            console.error('Error updating invite stats on leave:', error);
        }
    });

    // Initialize invite cache for all guilds
    client.on(Events.ClientReady, async () => {
        for (const guild of client.guilds.cache.values()) {
            await trackInvites(guild);
        }
    });

    // Update invite cache on invite create/delete
    client.on(Events.InviteCreate, async (invite) => {
        await trackInvites(invite.guild);
    });

    client.on(Events.InviteDelete, async (invite) => {
        await trackInvites(invite.guild);
    });

    console.log('✅ User tracking system initialized');
}

module.exports = { setupTracking };
