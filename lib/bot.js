const formatTable = table =>
    table.length
    ? table.reduce((res, line) => res + `\n@${line.to_name}: ${line.amount}`, `Debts:\n`)
    : `No debts`;

const debtMsg = (debt, to) => `@${to} ${debt > 0 ? `wants` : `offers`} ${Math.abs(debt)}`;

const inlineDebt = /(-?\d+)/;

const offerData = (data, result) => {
    data.answer = result;
    return JSON.stringify(data);
};

const closedDealMsg = (from, amount, to, accept) => {
    let arg1 = amount > 0 ? `debt (amount: ${amount})` : -amount;
    let arg2 = accept ? `accepted` : `declined`;
    return `Offer of ${arg1} from @${from} ${arg2} by @${to}.`
};

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

    bot.onText(/\/help/, msg =>
        bot.sendMessage(msg.chat.id, `
To ask for money in amount of N, type /debt N, then 'Share' the message.
To give money in amount of N, type /debt -N, then 'Share' the message.
To view your debts, type /stats.
Inline mode — @dudon_debts_bot N`)
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/stats/, msg =>
        dataBase.getStats(msg.from.username)
        .then(
            table => bot.sendMessage(msg.chat.id, formatTable(table)))
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/debt (-?\d+)/, (msg, match) => {
        let data = {
            name: msg.from.username,
            amount: Number(match[1])
        };

        bot.sendMessage(
            msg.chat.id,
            debtMsg(data.amount, data.name),
            {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [
                            { text: 'Share', switch_inline_query: `${data.amount}` }
                        ]
                    ]
                })
            })
        .catch(
            error => console.log(error)
        );
    });

    let articleID = 0;

    bot.on('inline_query', query => {
        if (inlineDebt.test(query.query)) {
            let data = {
                name: query.from.username,
                amount: Number(query.query.match(inlineDebt)[1])
            };

            let answer = {
                type: 'article',
                id: articleID,
                title: `${data.amount > 0 ? `debt` : `offer`} ${Math.abs(data.amount)}`,
                input_message_content: {
                    message_text: debtMsg(data.amount, data.name)
                },
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '👍', callback_data: offerData(data, true) },
                            { text: '👎', callback_data: offerData(data, false) }
                        ]
                    ]
                }
            };

            ++articleID;

            bot.answerInlineQuery(query.id, [answer]).catch(error => console.log(error));
        }
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
            inline_message_id: query.inline_message_id })
        .then(
            () => data.answer ? dataBase.saveDebt(data.name, data.amount, by) : null)
        .catch(
            error => console.log(error)
        );
    });

    return bot;
};

if (module) module.exports = BotFactory;
