const BotFactory = BaseBot => function Bot(token) {
    var bot = new BaseBot(token, { webHook : { port : process.env.PORT } });

    const url = process.env.APP_URL || `https://tg-debts-bot.herokuapp.com:443`;
    bot.setWebHook(`${url}/bot${token}`);

    var dataBase;
    bot.setDataBase = client => dataBase = client;

    bot.onText(/\/start/, msg => bot.sendMessage(msg.chat.id, 'Hi'));

    bot.onText(/\/debt (-?\d+)/, (msg, match) => {
        let data = {
            name: msg.from.username,
            amount: Number(match[1])
        };

        bot.sendMessage(msg.chat.id, 'Forward the message below to other user')
        .then(() =>
            bot.sendMessage(msg.chat.id, debtMsg(data.amount, data.name), optionsTab(data))
        );
    });

    bot.on('callback_query', query => {
        let data = JSON.parse(query.data);
        let by = query.from.username;

        if (by == data.name) {
            bot.answerCallbackQuery(
                query.id, {
                text: `You can't owe yourself`
            });
            return;
        }

        bot.editMessageText(
            closedDealMsg(data.name, data.amount, by, data.answer), {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id
        });

        if (data.answer)
            dataBase.saveDebt(data.name, data.amount, by);
    });

    bot.onText(/\/stats/, msg => {
        dataBase.sendStats(msg.from.username, res => bot.sendMessage(msg.chat.id, res));
    });

    return bot;
};

var debtMsg = (debt, to) => `@${to} ${debt > 0 ? `wants` : `offers`} ${Math.abs(debt)}`;

var offerData = (data, result) => {
    data.answer = result;
    return JSON.stringify(data);
};

var optionsTab = (data) => {
    reply_markup: JSON.stringify({
        inline_keyboard: [
            [{ text: '👍', callback_data: offerData(data, true) }],
            [{ text: '👎', callback_data: offerData(data, false) }]
        ]
    })
};

var closedDealMsg = (from, amount, to, accept) => {
    let arg1 = amount > 0 ? `debt (amount: ${amount})` : -amount;
    let arg2 = accept ? `accepted` : `declined`;
    return `Offer of ${arg1} ${arg2} by ${to}.`
};

if (module) module.exports = BotFactory;
