const BotFactory = (BaseBot) => function Bot(token) {
    var bot = new BaseBot(token, { polling: true });

    bot.onText(/\/start/, (msg, match) => {
        bot.sendMessage(msg.chat.id, 'Hi');
    });

    return bot;
}

if (module) module.exports = BotFactory;
