const formatTable = table =>
    table.length
    ? table.reduce((res, line) => res + `\n@${line.to_name}: ${line.amount}`, `Debts:\n`)
    : `No debts`;

const name = `dudon_debt_bot`;
const server = `https://tg-debts-bot.herokuapp.com:443`;

const shareText = `Hi. My name is @${name}. I can manage all your debts. See you?`;

const shareKeyboard = {
    reply_markup: JSON.stringify({
        inline_keyboard: [[ { text: 'Share bot', switch_inline_query: `share` } ]]
    })
};

const userText = (text, amount) => text && text.length ? text + `\n(amount: ${amount})` : null;
const debtMsg = (debt, to) => `@${to} ${debt > 0 ? `wants` : `offers`} ${Math.abs(debt)}`;

const debtRegexp = /(-?\d+) (.+)?/;

const offerData = (data, result) => {
    return data.name + ' ' + data.amount + ' ' + (result ? '1' : '0');
};

const parse = src => {
    let spl = src.split(' ');
    console.log(spl);
    return {
        name: spl[0],
        amount: Number(spl[1]),
        answer: spl[2] == '1'
    };
};

const closedDealMsg = (from, amount, to, accept) => {
    let arg1 = amount > 0 ? `debt (amount: ${amount})` : -amount;
    let arg2 = accept ? `accepted` : `declined`;
    return `Offer of ${arg1} from @${from} ${arg2} by @${to}.`
};

const states = {
    MAIN: 0,
    DEBT_AMOUNT: 1
};

const BotFactory = BaseBot => function Bot(token) {
    var bot = new BaseBot(token, { webHook : { port : process.env.PORT } });

    const url = process.env.APP_URL || server;
    bot.setWebHook(`${url}/bot${token}`);

    var dataBase;
    bot.setDataBase = client => dataBase = client;

    bot.onText(/\/start/, msg =>
        dataBase.setState(msg.chat.id, states.MAIN)
        .then(
            () => bot.sendMessage(msg.chat.id, 'Hi'))
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/help/, msg =>
        dataBase.setState(msg.chat.id, states.MAIN)
        .then(
            () => bot.sendMessage(msg.chat.id, `
To ask for money in amount of N, type /debt N, then 'Share' the message.
To give money in amount of N, type /debt -N, then 'Share' the message.
To view your debts, type /stats.
To share this bot, type /share, then 'Share' the message.
Inline mode — @${name} N or @${name} share.`))
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/share/, msg =>
        dataBase.setState(msg.chat.id, states.MAIN)
        .then(
            () => bot.sendMessage(msg.chat.id, shareText, shareKeyboard))
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/stats/, msg =>
        dataBase.setState(msg.chat.id, states.MAIN)
        .then(
            () => dataBase.getStats(msg.from.username))
        .then(
            table => bot.sendMessage(msg.chat.id, formatTable(table)))
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/debt$/, msg =>
        dataBase.setState(msg.chat.id, states.DEBT_AMOUNT)
        .then(
            () => bot.sendMessage(msg.chat.id, `Send amount & text (text is optional)`))
        .catch(
            error => console.log(error)
        )
    );

    bot.sendDebtTemplate = (msg, match) =>
        bot.sendMessage(
            msg.chat.id,
            userText(match[2], match[1]) || debtMsg(Number(match[1]), msg.from.username),
            {
                reply_markup: JSON.stringify({
                    inline_keyboard: [[ { text: 'Share', switch_inline_query: match[1] + ' ' + match[2] } ]]
                })
            }
        );

    bot.onText(debtRegexp, (msg, match) =>
        dataBase.checkState(msg.chat.id, states.DEBT_AMOUNT)
        .then(
            correctState =>
            /* if */ correctState
            ?   dataBase.setState(msg.chat.id, states.MAIN)
                .then(
                    () => bot.sendDebtTemplate(msg, match)
                )
            /* else */
            :   bot.sendMessage(msg.chat.id, 'Maybe you forgot to type /debt ?'))
        .catch(
            error => console.log(error)
        )
    );

    bot.onText(/\/debt (-?\d+) (.+)?/, (msg, match) =>
        dataBase.setState(msg.chat.id, states.MAIN)
        .then(
            () => bot.sendDebtTemplate(msg, match))
        .catch(
            error => console.log(error)
        )
    );

    let article_id = 0;
    const articleID = () => article_id++;

    bot.on('inline_query', query => {
        let answer;

        if (debtRegexp.test(query.query)) {
            let match = query.query.match(debtRegexp);
            console.log(match);

            let data = {
                name: query.from.username,
                amount: Number(match[1])
            };

            answer = {
                type: 'article',
                id: articleID(),
                title: `${data.amount > 0 ? `Debt` : `Offer`} ${Math.abs(data.amount)}`,
                input_message_content: {
                    message_text: userText(match[2]) || debtMsg(data.amount, data.name)
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
        } else if (query.query == 'share') {
            answer = {
                type: 'article',
                id: articleID(),
                title: 'Share bot',
                input_message_content: {
                    message_text: shareText
                }
            };
        } else {
            return;
        }

        bot.answerInlineQuery(query.id, [answer]).catch(error => console.log(error));
    });

    bot.on('callback_query', query => {
        let data = parse(query.data);
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
