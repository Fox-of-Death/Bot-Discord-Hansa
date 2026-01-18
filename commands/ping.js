const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check the bot latency'),
    async execute(interaction) {
        const latency = interaction.client.ws.ping;
        
        const pingEmbed = new EmbedBuilder()
            .setColor(0x00FF99)
            .setTitle('📡 Connection Status')
            .addFields(
                { name: 'API Latency', value: `\`${latency}ms\``, inline: true },
                { name: 'Status', value: '🟢 Operational', inline: true }
            )
            .setTimestamp()

        await interaction.reply({ embeds: [pingEmbed] });
    },
};