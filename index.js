const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is online!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Web Server is running on port ${port}`);
});

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const commands = []; 
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }
}

const deployCommands = async () => {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
        console.error('❌ Missing DISCORD_TOKEN or CLIENT_ID in Environment Variables');
        return;
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    try {
        console.log(`⏳ Started refreshing ${commands.length} application (/) commands.`);
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('❌ Deploy Commands Error:', error);
    }
};

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'เกิดข้อผิดพลาดในการรันคำสั่ง!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'เกิดข้อผิดพลาดในการรันคำสั่ง!', ephemeral: true });
        }
    }
});

client.once(Events.ClientReady, c => {
    console.log(`🚀 Ready! Logged in as ${c.user.tag}`);
    deployCommands();
});

client.on('error', err => console.error('Discord Client Error:', err));

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('❌ DISCORD_TOKEN is not defined!');
} else {
    console.log('⏳ Attempting to login to Discord...');
    client.login(token).catch(err => {
        console.error('❌ Login failed:', err.message);
    });
}