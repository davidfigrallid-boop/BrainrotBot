const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { pool } = require('../database');

const EMOJI_OPTIONS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

async function handleAnnounce(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const mention = interaction.options.getBoolean('mention_everyone') || false;

    try {
        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle(`📢 ${title}`)
            .setDescription(message)
            .setFooter({ text: `Annonce par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const content = mention ? '@everyone' : undefined;
        await channel.send({ content, embeds: [embed] });

        await interaction.editReply(`✅ Annonce postée dans ${channel}`);
    } catch (error) {
        console.error('Error creating announcement:', error);
        await interaction.editReply('❌ Erreur lors de la création de l\'annonce.');
    }
}

async function handlePollCreate(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const question = interaction.options.getString('question');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const guildId = interaction.guildId;

    // Get options
    const options = [];
    for (let i = 1; i <= 10; i++) {
        const option = interaction.options.getString(`option${i}`);
        if (option) {
            options.push({
                emoji: EMOJI_OPTIONS[options.length],
                text: option
            });
        }
    }

    if (options.length < 2) {
        return interaction.editReply('⚠️ Vous devez fournir au moins 2 options.');
    }

    try {
        const embed = new EmbedBuilder()
            .setColor(0x7C3AED)
            .setTitle(`📊 ${question}`)
            .setDescription(options.map(opt => `${opt.emoji} ${opt.text}`).join('\n\n'))
            .setFooter({ text: `Sondage créé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const pollMessage = await channel.send({ embeds: [embed] });

        // Add reactions
        for (const option of options) {
            await pollMessage.react(option.emoji);
        }

        // Save to database
        await pool.query(
            'INSERT INTO polls (guild_id, message_id, channel_id, question, options) VALUES (?, ?, ?, ?, ?)',
            [guildId, pollMessage.id, channel.id, question, JSON.stringify(options)]
        );

        await interaction.editReply(`✅ Sondage créé dans ${channel}!`);
    } catch (error) {
        console.error('Error creating poll:', error);
        await interaction.editReply('❌ Erreur lors de la création du sondage.');
    }
}

async function handlePollEnd(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.options.getString('message_id');
    const guildId = interaction.guildId;

    try {
        const [polls] = await pool.query(
            'SELECT * FROM polls WHERE guild_id = ? AND message_id = ? AND ended = FALSE',
            [guildId, messageId]
        );

        if (polls.length === 0) {
            return interaction.editReply('⚠️ Sondage introuvable ou déjà terminé.');
        }

        const poll = polls[0];
        const options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;

        // Fetch message to get reactions
        const channel = await interaction.client.channels.fetch(poll.channel_id);
        const message = await channel.messages.fetch(messageId);

        // Count votes
        const results = [];
        for (const option of options) {
            const reaction = message.reactions.cache.get(option.emoji);
            const count = reaction ? reaction.count - 1 : 0; // -1 to exclude bot's reaction
            results.push({
                text: option.text,
                emoji: option.emoji,
                votes: count
            });
        }

        // Sort by votes
        results.sort((a, b) => b.votes - a.votes);
        const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

        // Create results embed
        const resultEmbed = new EmbedBuilder()
            .setColor(0x06FFA5)
            .setTitle(`📊 Résultats: ${poll.question}`)
            .setDescription(
                results.map((r, i) => {
                    const percentage = totalVotes > 0 ? ((r.votes / totalVotes) * 100).toFixed(1) : 0;
                    const bar = '█'.repeat(Math.floor(percentage / 5));
                    return `${i === 0 ? '🏆' : r.emoji} **${r.text}**\n${bar} ${r.votes} vote(s) (${percentage}%)`;
                }).join('\n\n')
            )
            .addFields({ name: 'Total des votes', value: `${totalVotes}`, inline: true })
            .setFooter({ text: 'Sondage terminé' })
            .setTimestamp();

        await message.edit({ embeds: [resultEmbed] });

        // Mark as ended
        await pool.query('UPDATE polls SET ended = TRUE WHERE id = ?', [poll.id]);

        await interaction.editReply(`✅ Sondage terminé! Gagnant: **${results[0].text}** avec ${results[0].votes} vote(s).`);
    } catch (error) {
        console.error('Error ending poll:', error);
        await interaction.editReply('❌ Erreur lors de la clôture du sondage.');
    }
}

const command = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Système d\'annonces et de sondages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub => sub
        .setName('create')
        .setDescription('Créer une annonce')
        .addChannelOption(opt => opt
            .setName('channel')
            .setDescription('Salon où poster l\'annonce')
            .setRequired(true))
        .addStringOption(opt => opt
            .setName('title')
            .setDescription('Titre de l\'annonce')
            .setRequired(true))
        .addStringOption(opt => opt
            .setName('message')
            .setDescription('Message de l\'annonce')
            .setRequired(true))
        .addBooleanOption(opt => opt
            .setName('mention_everyone')
            .setDescription('Mentionner @everyone')
            .setRequired(false)))
    .addSubcommand(sub => sub
        .setName('poll')
        .setDescription('Créer un sondage')
        .addStringOption(opt => opt.setName('question').setDescription('Question du sondage').setRequired(true))
        .addStringOption(opt => opt.setName('option1').setDescription('Option 1').setRequired(true))
        .addStringOption(opt => opt.setName('option2').setDescription('Option 2').setRequired(true))
        .addStringOption(opt => opt.setName('option3').setDescription('Option 3').setRequired(false))
        .addStringOption(opt => opt.setName('option4').setDescription('Option 4').setRequired(false))
        .addStringOption(opt => opt.setName('option5').setDescription('Option 5').setRequired(false))
        .addStringOption(opt => opt.setName('option6').setDescription('Option 6').setRequired(false))
        .addStringOption(opt => opt.setName('option7').setDescription('Option 7').setRequired(false))
        .addStringOption(opt => opt.setName('option8').setDescription('Option 8').setRequired(false))
        .addStringOption(opt => opt.setName('option9').setDescription('Option 9').setRequired(false))
        .addStringOption(opt => opt.setName('option10').setDescription('Option 10').setRequired(false))
        .addChannelOption(opt => opt.setName('channel').setDescription('Salon (défaut: ce salon)').setRequired(false)))
    .addSubcommand(sub => sub
        .setName('pollend')
        .setDescription('Terminer un sondage et afficher les résultats')
        .addStringOption(opt => opt
            .setName('message_id')
            .setDescription('ID du message du sondage')
            .setRequired(true)));

async function handleCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'create':
            await handleAnnounce(interaction);
            break;
        case 'poll':
            await handlePollCreate(interaction);
            break;
        case 'pollend':
            await handlePollEnd(interaction);
            break;
        default:
            await interaction.reply({ content: 'Sous-commande inconnue', ephemeral: true });
    }
}

module.exports = { command, handleCommand };
