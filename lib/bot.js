const BotFactory = BaseBot => function Bot(token) {
    var bot = new BaseBot(token, { webHook : { port : process.env.PORT } });

    const url = process.env.APP_URL || `https://tg-debts-bot.herokuapp.com:443`;
    bot.setWebHook(`${url}/bot${token}`);

    var dataBase;
    bot.setDataBase = client => dataBase = client;

    bot.onText(/\/start/, msg =>
        bot.sendMessage(msg.chat.id, 'Hi')
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/debt (-?\d+) (?:@(\w{5,32}))?/, (msg, match) => {
        let data = {
            name: match[2] || msg.from.username,
            amount: Number(match[1])
        };

        bot.sendMessage(msg.chat.id, debtMsg(data.amount, data.name), optionsTab(data))
        .catch(
            error => console.log(error)
        );
    });

    bot.on('callback_query', query => {
        let data = JSON.parse(query.data);
        let by = query.from.username;

        if (by == data.name) {
            bot.answerCallbackQuery(
                query.id, {
                text: `You can't owe yourself` })
            .catch(
                error => console.log(error)
            );
            return;
        }

        bot.editMessageText(
            closedDealMsg(data.name, data.amount, by, data.answer), {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id })
        .then(
            () => data.answer ? dataBase.saveDebt(data.name, data.amount, by) : null)
        .catch(
            error => console.log(error)
        );
    });

    bot.onText(/\/stats/, msg =>
        dataBase.getStats(msg.from.username)
        .then(
            table => bot.sendMessage(msg.chat.id, formatTable(table)))
        .catch(
            error => console.log(error)
        )
    );

    return bot;
};

var debtMsg = (debt, to) => `@${to} ${debt > 0 ? `wants` : `offers`} ${Math.abs(debt)}`;

var offerData = (data, result) => {
    data.answer = result;
    return JSON.stringify(data);
};

var optionsTab = data => {
    return {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [
                    { text: '👍', callback_data: offerData(data, true) },
                    { text: '👎', callback_data: offerData(data, false) }
                ],
                [
                    { text: "Share", switch_inline_query: `/debt ${data.amount} @${data.name}` }
                ]
            ]
        })
    };
};

var closedDealMsg = (from, amount, to, accept) => {
    let arg1 = amount > 0 ? `debt (amount: ${amount})` : -amount;
    let arg2 = accept ? `accepted` : `declined`;
    return `Offer of ${arg1} ${arg2} by ${to}.`
};

var formatTable = table =>
    table
    ? table.reduce((res, line) => res + `\n@${line.to}: ${line.amount}`, `Debts:\n`)
    : `No debts`;

if (module) module.exports = BotFactory;
