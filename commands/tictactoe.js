const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType, MessageFlags } = require('discord.js');

function checkWinner(board) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return board.includes(null) ? null : 'Draw';
}

async function startGame(interaction, p1, p2) {
    const board = Array(9).fill(null);
    let turn = p1, ended = false;

    const render = d => {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const k = i * 3 + j;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ttt_${k}`)
                        .setLabel(board[k] ?? '-')
                        .setStyle(board[k] === 'X' ? ButtonStyle.Primary : board[k] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary)
                        .setDisabled(d || board[k] !== null)
                );
            }
            rows.push(row);
        }
        return rows;
    };

    const embed = new EmbedBuilder().setTitle('❌ Tic-Tac-Toe ⭕').setDescription(`ตาของ: **${turn.username}**`).setColor(0x00ff99);
    const msg = await interaction.channel.send({ embeds: [embed], components: render(false) });

    const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

    col.on('collect', async i => {
        if (![p1.id, p2.id].includes(i.user.id)) return i.reply({ embeds: [new EmbedBuilder().setDescription('❌ คุณไม่ได้อยู่ในเกมนี้').setColor(0xff0000)], flags: MessageFlags.Ephemeral });
        if (i.user.id !== turn.id) return i.reply({ embeds: [new EmbedBuilder().setDescription('❌ ยังไม่ถึงตาคุณ').setColor(0xff0000)], flags: MessageFlags.Ephemeral });

        const idx = Number(i.customId.split('_')[1]);
        board[idx] = turn.id === p1.id ? 'X' : 'O';

        const res = checkWinner(board);
        if (res) {
            ended = true;
            const win = res === 'X' ? p1 : res === 'O' ? p2 : null;
            let sec = 30;
            const text = res === 'Draw' ? 'เสมอ! 🤝' : `ผู้ชนะคือ: **${win.username}** 🏆`;

            await i.update({ embeds: [embed.setDescription(`${text}\n\n🕒 ข้อความจะถูกลบใน ${sec} วินาที`).setColor(0xff0000)], components: render(true) });

            const timer = setInterval(async () => {
                sec--;
                if (sec > 0) await msg.edit({ embeds: [embed.setDescription(`${text}\n\n🕒 ข้อความจะถูกลบใน ${sec} วินาที`)] }).catch(() => {});
                else { clearInterval(timer); await msg.delete().catch(() => {}); await interaction.deleteReply().catch(() => {}); }
            }, 1000);

            return col.stop();
        }

        turn = turn.id === p1.id ? p2 : p1;
        await i.update({ embeds: [embed.setDescription(`ตาของ: **${turn.username}**`).setColor(0x00ff99)], components: render(false) });
    });

    col.on('end', async (_, r) => {
        if (r === 'time' && !ended) {
            await msg.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('❌ หมดเวลาการเล่น')
                        .setDescription('เกมจะถูกลบใน 5 วินาที')
                        .setColor(0x808080)
                ],
                components: render(true)
            }).catch(() => {});
            setTimeout(async () => { await msg.delete().catch(() => {}); await interaction.deleteReply().catch(() => {}); }, 5000);
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder().setName('tictactoe').setDescription('ท้าดวล XO Hansa พร้อมระบบลบข้อความอัตโนมัติ')
        .addUserOption(o => o.setName('opponent').setDescription('คนที่จะท้าดวล').setRequired(true)),

    async execute(interaction) {
        const p1 = interaction.user, p2 = interaction.options.getUser('opponent');
        if (p2.bot || p2.id === p1.id)
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle('❌ ผิดพลาด').setDescription('ไม่สามารถท้าตัวเองหรือบอทได้').setColor(0xff0000)], flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
            .setTitle('🎮 คำเชิญท้าดวล XO Hansa')
            .setDescription(`**${p2}**, คุณถูกท้าดวลโดย **${p1.username}**\nคุณจะรับคำท้าหรือไม่?`)
            .setColor(0xffa500);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_game').setLabel('เล่น').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('decline_game').setLabel('ไม่เล่น').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        const col = msg.createMessageComponentCollector({ time: 30000 });

        col.on('collect', async i => {
            if (i.user.id !== p2.id) return i.reply({ embeds: [new EmbedBuilder().setDescription('❌ เฉพาะผู้ถูกท้าเท่านั้นที่กดได้').setColor(0xff0000)], flags: MessageFlags.Ephemeral });
            if (i.customId === 'decline_game') { await i.update({ embeds: [new EmbedBuilder().setDescription(`❌ **${p2.username}** ปฏิเสธคำท้าของ ${p1.username}`).setColor(0xff0000)], components: [] }); return col.stop(); }
            if (i.customId === 'accept_game') { await i.update({ embeds: [new EmbedBuilder().setDescription(`⚔️ **${p1.username}** VS **${p2.username}**`).setColor(0x00ff00)], components: [] }); startGame(interaction, p1, p2); col.stop(); }
        });

        col.on('end', (c, r) => {
            if (r === 'time' && c.size === 0) {
                const time = new Date().toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('⌛ หมดเวลา')
                            .setDescription('ไม่มีการตอบรับคำเชิญภายในเวลาที่กำหนด')
                            .setFooter({ text: `หมดเวลาเมื่อ ${time}` })
                            .setColor(0x808080)
                    ],
                    components: []
                }).catch(() => {});
            }
        });
    }
};
