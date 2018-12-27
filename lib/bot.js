const BotFactory = (BaseBot) => function Bot(token) {
    var bot = new BaseBot(token, { polling: true });

    //

    return bot;
}

if (module) module.exports = BotFactory;
