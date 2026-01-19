const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('ท้าดวล XO Hansa พร้อมระบบลบข้อความอัตโนมัติ')
        .addUserOption(option => 
            option.setName('opponent')
                .setDescription('คนที่จะท้าดวล')
                .setRequired(true)),
    async execute(interaction) {
        const player1 = interaction.user;
        const player2 = interaction.options.getUser('opponent');

        if (player2.bot || player2.id === player1.id) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ ผิดพลาด')
                .setDescription('คู่ต่อสู้ไม่ถูกต้อง! ไม่สามารถท้าตัวเองหรือบอทได้')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] });
        }

        const inviteEmbed = new EmbedBuilder()
            .setTitle('🎮 คำเชิญท้าดวล XO Hansa')
            .setDescription(`**${player2}**, คุณถูกท้าดวลโดย **${player1.username}**\nคุณจะรับคำท้าหรือไม่?`)
            .setColor(0xFFA500);

        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_game').setLabel('เล่น').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('decline_game').setLabel('ไม่เล่น').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({
            embeds: [inviteEmbed],
            components: [inviteRow],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== player2.id) {
                const warnEmbed = new EmbedBuilder().setDescription('❌ เฉพาะผู้ถูกท้าเท่านั้นที่กดได้!').setColor(0xFF0000);
                return i.reply({ embeds: [warnEmbed], flags: [MessageFlags.Ephemeral] });
            }

            if (i.customId === 'decline_game') {
                const declineEmbed = new EmbedBuilder()
                    .setDescription(`❌ **${player2.username}** ปฏิเสธคำท้าของ ${player1.username}`)
                    .setColor(0xFF0000);
                await i.update({ embeds: [declineEmbed], components: [] });
                return collector.stop();
            }

            if (i.customId === 'accept_game') {
                const startEmbed = new EmbedBuilder()
                    .setDescription(`⚔️ **${player1.username}** VS **${player2.username}**`)
                    .setColor(0x00FF00);
                await i.update({ embeds: [startEmbed], components: [] });
                await startGame(interaction, player1, player2);
                return collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⌛ หมดเวลา')
                    .setDescription('ไม่มีการตอบรับคำเชิญภายในเวลาที่กำหนด')
                    .setColor(0x808080);
                interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    }
};

async function startGame(interaction, player1, player2) {
    const board = Array(9).fill(null);
    let currentTurn = player1;
    let isGameOver = false;

    const makeBoard = (disabled = false) => {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const index = i * 3 + j;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ttt_${index}`)
                        .setLabel(board[index] || '-')
                        .setStyle(board[index] === 'X' ? ButtonStyle.Primary : board[index] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary)
                        .setDisabled(disabled || !!board[index])
                );
            }
            rows.push(row);
        }
        return rows;
    };

    const gameEmbed = new EmbedBuilder()
        .setTitle('❌ Tic-Tac-Toe ⭕')
        .setDescription(`ตาของ: **${currentTurn.username}**`)
        .setColor(0x00FF99);

    const gameMsg = await interaction.channel.send({
        embeds: [gameEmbed],
        components: makeBoard(),
    });

    const collector = gameMsg.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: 300000 // 5 นาทีสำหรับการเล่น
    });

    collector.on('collect', async i => {
        if (i.user.id !== player1.id && i.user.id !== player2.id) {
            const warnEmbed = new EmbedBuilder().setDescription('❌ คุณไม่ได้ร่วมเล่นในเกมนี้').setColor(0xFF0000);
            return i.reply({ embeds: [warnEmbed], flags: [MessageFlags.Ephemeral] });
        }

        if (i.user.id !== currentTurn.id) {
            const warnEmbed = new EmbedBuilder().setDescription('❌ ยังไม่ถึงตาคุณ!').setColor(0xFF0000);
            return i.reply({ embeds: [warnEmbed], flags: [MessageFlags.Ephemeral] });
        }

        const index = parseInt(i.customId.split('_')[1]);
        board[index] = currentTurn.id === player1.id ? 'X' : 'O';
        
        const winner = checkWinner(board);
        if (winner) {
            isGameOver = true;
            const winnerUser = winner === 'X' ? player1 : player2;
            const resultText = winner === 'Draw' ? "เสมอ! 🤝" : `ผู้ชนะคือ: **${winnerUser.username}** 🏆`;
            
            let countdown = 30;
            gameEmbed.setDescription(`${resultText}\n\n🕒 **ข้อความจะถูกลบใน ${countdown} วินาที**`)
                     .setColor(0xFF0000);

            await i.update({ embeds: [gameEmbed], components: makeBoard(true) });

            const countdownInterval = setInterval(async () => {
                countdown--;
                if (countdown > 0) {
                    gameEmbed.setDescription(`${resultText}\n\n🕒 **ข้อความจะถูกลบใน ${countdown} วินาที**`);
                    await gameMsg.edit({ embeds: [gameEmbed] }).catch(() => {});
                } else {
                    clearInterval(countdownInterval);
                    await gameMsg.delete().catch(() => {});
                    await interaction.deleteReply().catch(() => {});
                }
            }, 1000);

            return collector.stop();
        }

        currentTurn = currentTurn.id === player1.id ? player2 : player1;
        gameEmbed.setDescription(`ตาของ: **${currentTurn.username}**`);
        await i.update({ embeds: [gameEmbed], components: makeBoard() });
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && !isGameOver) {
            const timeoutEmbed = new EmbedBuilder()
                .setTitle('❌ หมดเวลาการเล่น')
                .setDescription('ไม่มีการตอบสนองนานเกินไป (5 นาที) เกมจะถูกลบอัตโนมัติใน 5 วินาที')
                .setColor(0x808080);

            await gameMsg.edit({ embeds: [timeoutEmbed], components: makeBoard(true) }).catch(() => {});
            
            setTimeout(async () => {
                await gameMsg.delete().catch(() => {});
                await interaction.deleteReply().catch(() => {});
            }, 5000);
        }
    });
}

function checkWinner(board) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return board.includes(null) ? null : 'Draw';
}