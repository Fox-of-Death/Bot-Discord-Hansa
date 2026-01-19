// ================== Web Server ==================
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is online!');
});

app.listen(port, () => {
  console.log(`✅ Web Server is running on port ${port}`);
});

// ================== Discord Bot ==================
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ กรุณาตั้งค่า DISCORD_TOKEN และ CLIENT_ID ใน .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ต้องเปิด intent นี้ใน Discord Dev Portal ด้วย
  ],
});

client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// โหลดคำสั่ง
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    } else {
      console.warn(`⚠️ คำสั่ง ${file} โครงสร้างไม่ถูกต้อง`);
    }
  }
}

// Deploy Slash Commands
const deployCommands = async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`⏳ Deploying ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash commands deployed!');
  } catch (error) {
    console.error('❌ Deploy Commands Error:', error);
  }
};

// Interaction
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: '❌ เกิดข้อผิดพลาดในการรันคำสั่ง',
      ephemeral: true,
    });
  }
});

// Ready
client.once(Events.ClientReady, async () => {
  console.log(`🚀 Logged in as ${client.user.tag}`);
  await deployCommands();
});

// Error
client.on('error', console.error);

// Login
client.login(process.env.DISCORD_TOKEN);