var debtMsg = (debt, to, accept) => `Debt ${debt ? 'from' : 'to'} @${to} ${accept ? 'accepted' : 'declined'}, deal closed`;

const BotFactory = BaseBot => function Bot(token) {
    var bot = new BaseBot(token, { webHook : { port : process.env.PORT } });

    const url = process.env.APP_URL || `https://tg-debts-bot.herokuapp.com:443`;
    bot.setWebHook(`${url}/bot${token}`);

    var dataBase;
    bot.setDataBase = client => dataBase = client;

    bot.onText(/\/start/, msg => bot.sendMessage(msg.chat.id, 'Hi'));

    bot.onText(/\/debt (-?\d+)/, (msg, match) => {
        let amount = Number(match[1]);

        let text = `You gave ${amount} to @${msg.from.username}?`;

        let options = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    //
                ]
            })
        };
    });

    return bot;
}

if (module) module.exports = BotFactory;
