const TikTokScraper = require('tiktok-scraper');
const { pool } = require('../database');
const { EmbedBuilder } = require('discord.js');

// Check for new TikTok videos from tracked creators
async function checkTikTokUpdates(client) {
    try {
        const [trackings] = await pool.query('SELECT * FROM tiktok_tracking');

        for (const tracking of trackings) {
            try {
                // Get user's recent videos
                const userVideos = await TikTokScraper.user(tracking.tiktok_username, {
                    number: 5, // Get last 5 videos
                    sessionList: []
                });

                if (!userVideos || !userVideos.collector || userVideos.collector.length === 0) {
                    console.log(`No videos found for @${tracking.tiktok_username}`);
                    continue;
                }

                // Get the most recent video
                const latestVideo = userVideos.collector[0];
                const videoId = latestVideo.id;

                // Check if this is a new video
                if (tracking.last_video_id !== videoId) {
                    // New video detected! Post to Discord
                    const channel = await client.channels.fetch(tracking.channel_id);

                    if (channel) {
                        const embed = new EmbedBuilder()
                            .setColor(0x7C3AED)
                            .setAuthor({
                                name: `@${tracking.tiktok_username}`,
                                iconURL: latestVideo.authorMeta?.avatar || undefined
                            })
                            .setTitle('📱 Nouvelle Vidéo TikTok!')
                            .setDescription(latestVideo.text || 'Pas de description')
                            .setURL(`https://www.tiktok.com/@${tracking.tiktok_username}/video/${videoId}`)
                            .setImage(latestVideo.covers?.default || latestVideo.videoMeta?.coverUrl)
                            .addFields(
                                { name: '👁️ Vues', value: formatNumber(latestVideo.playCount || 0), inline: true },
                                { name: '❤️ Likes', value: formatNumber(latestVideo.diggCount || 0), inline: true },
                                { name: '💬 Commentaires', value: formatNumber(latestVideo.commentCount || 0), inline: true }
                            )
                            .setFooter({ text: `TikTok • ${new Date(latestVideo.createTime * 1000).toLocaleDateString('fr-FR')}` })
                            .setTimestamp();

                        await channel.send({
                            content: `Nouvelle vidéo de **@${tracking.tiktok_username}** ! 🎬`,
                            embeds: [embed]
                        });

                        console.log(`✅ Posted new TikTok video from @${tracking.tiktok_username}`);
                    }

                    // Update last video ID
                    await pool.query(
                        'UPDATE tiktok_tracking SET last_video_id = ?, last_check = NOW() WHERE id = ?',
                        [videoId, tracking.id]
                    );
                } else {
                    // No new video, just update last check time
                    await pool.query(
                        'UPDATE tiktok_tracking SET last_check = NOW() WHERE id = ?',
                        [tracking.id]
                    );
                }
            } catch (error) {
                console.error(`Error checking TikTok for @${tracking.tiktok_username}:`, error.message);
                // Continue to next tracking even if one fails
            }
        }
    } catch (error) {
        console.error('Error in TikTok check service:', error);
    }
}

// Format large numbers (e.g., 1200000 → 1.2M)
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Start the TikTok check service
function startTikTokService(client) {
    console.log('✅ TikTok auto-check service initialized');

    // Check immediately on start
    checkTikTokUpdates(client);

    // Then check every 10 minutes
    setInterval(() => {
        checkTikTokUpdates(client);
    }, 10 * 60 * 1000); // 10 minutes
}

module.exports = { startTikTokService, checkTikTokUpdates };
