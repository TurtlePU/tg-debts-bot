const BotFactory = BaseBot => function Bot(token) {
    var bot = new BaseBot(token, { webHook : { port : process.env.PORT } });

    const url = process.env.APP_URL || server;
    bot.setWebHook(`${url}/bot${token}`);

    var dataBase;
    bot.setDataBase = client => dataBase = client;

    bot.onText(/\/start/, msg => {
        dataBase.setState(msg.chat.id, states.MAIN)
            .then(() => {
                return bot.sendMessage(msg.chat.id, 'Hi');
            })
            .catch(error => {
                console.log(error);
            });
    });

    bot.onText(/\/help/, msg => {
        dataBase.setState(msg.chat.id, states.MAIN)
            .then(() => {
                return bot.sendMessage(msg.chat.id, helpText);
            })
            .catch(error => {
                console.log(error);
            });
    });

    bot.onText(/\/share/, msg => {
        dataBase.setState(msg.chat.id, states.MAIN)
            .then(() => {
                return bot.sendMessage(
                    msg.chat.id,
                    shareText,
                    shareKeyboard
                );
            })
            .catch(error => {
                console.log(error);
            });
    });

    bot.onText(/\/stats/, msg => {
        dataBase.setState(msg.chat.id, states.MAIN)
            .then(() => {
                return dataBase.getStats(msg.from.username);
            })
            .then(table => {
                return bot.sendMessage(
                    msg.chat.id,
                    formatTable(table),
                    { reply_markup: statsKeyboard }
                );
            })
            .catch(error => {
                console.log(error);
            });
    });

    bot.onText(/\/debt$/, msg => {
        dataBase.setState(msg.chat.id, states.DEBT_AMOUNT)
            .then(() => {
                return bot.sendMessage(
                    msg.chat.id,
                    `Send amount & text (text is optional)`
                );
            })
            .catch(error => {
                console.log(error);
            });
    });

    let sendDebtTemplate = (msg, match) => {
        return bot.sendMessage(
                msg.chat.id,
                userText(match[2], match[1]) || debtText(Number(match[1]), msg.from.username),
                {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[ { text: 'Share', switch_inline_query: match[1] + (match[2] || '') } ]]
                    })
                })
            .then(() => {
                console.log('amount: ' + match[1])
            });
    };

    bot.onText(debtRegexp, (msg, match) => {
        dataBase.checkState(msg.chat.id, states.DEBT_AMOUNT)
            .then(correctState => {
                if (correctState) {
                    return dataBase.setState(msg.chat.id, states.MAIN)
                        .then(() => {
                            return sendDebtTemplate(msg, match);
                        });
                } else {
                    return bot.sendMessage(msg.chat.id, 'Maybe you forgot to type /debt ?');
                }
            })
            .catch(error => {
                console.log(error);
            });
    });

    bot.onText(/\/debt (-?\d+)(.+)?/, (msg, match) => {
        dataBase.setState(msg.chat.id, states.MAIN)
            .then(() => {
                bot.sendDebtTemplate(msg, match);
            })
            .catch(error => {
                console.log(error);
            });
    });

    let article_id = 0;
    const articleID = () => article_id++;

    bot.on('inline_query', query => {
        let answer;

        if (debtRegexp.test(query.query)) {
            let match = query.query.match(debtRegexp);

            let data = {
                name: query.from.username,
                amount: Number(match[1])
            };

            answer = {
                type: 'article',
                id: articleID(),
                title: `${data.amount > 0 ? `Debt` : `Offer`} ${Math.abs(data.amount)}`,
                input_message_content: {
                    message_text: userText(match[2], data.amount) || debtText(data.amount, data.name)
                },
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Ok 🌝', callback_data: offerData(data, true) },
                            { text: 'No 🌚', callback_data: offerData(data, false) }
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
        if (query.data == 'update') {
            dataBase.getStats(query.from.username)
                .then(table => {
                    return bot.editMessageText(
                        formatTable(table)
                        + '\n\nLast update: '
                        + new Date().toLocaleString(query.from.language_code),
                        {
                            chat_id: query.message.chat.id,
                            message_id: query.message.message_id,
                            reply_markup: statsKeyboard
                        });
                })
                .then(() => {
                    return bot.answerCallbackQuery(
                        query.id,
                        { text: 'Updated stats.' }
                    );
                })
                .catch(error => {
                    console.log(error);
                });
        } else {
            let data = parse(query.data);
            let by = query.from.username;

            console.log('answer: ' + data.answer);
            console.log('amount: ' + data.amount);

            if (by == data.name) {
                if (data.answer) {
                    return bot.answerCallbackQuery(
                            query.id,
                            { text: `You can't owe yourself` })
                        .catch(error => {
                            console.log(error);
                        });
                } else {
                    return bot.editMessageText(
                            `Debt proposal cancelled by @${by}`,
                            { inline_message_id: query.inline_message_id })
                        .catch(error => {
                            console.log(error);
                        });
                }
            }

            bot.editMessageText(
                    closedDealMsg(data.name, data.amount, by, data.answer),
                    {
                        inline_message_id: query.inline_message_id
                    })
                .then(() => {
                    if (data.answer)
                        return dataBase.saveDebt(data.name, data.amount, by)
                    else
                        return pass();
                })
                .catch(error => {
                    console.log(error);
                });
        }
    });

    return bot;
};

const name = `dudon_debt_bot`;
const server = `https://tg-debts-bot.herokuapp.com:443`;

const helpText = `
To ask for money in amount of N, type /debt N, then 'Share' the message.
To give money in amount of N, type /debt -N, then 'Share' the message.
To view your debts, type /stats.
To share this bot, type /share, then 'Share' the message.
Inline mode — @${name} N or @${name} share.`;

const formatTable = table =>
    table.length
    ? table.reduce((res, line) => res + `\n@${line.to_name}: ${line.amount}`, `Debts:\n`)
    : `No debts`;

const statsKeyboard = JSON.stringify({
    inline_keyboard: [[ {
        text: 'Update',
        callback_data: 'update'
    } ]]
});

const shareText = `Hi. My name is @${name}. I can manage all your debts. See you?`;
const shareKeyboard = {
    reply_markup: JSON.stringify({
        inline_keyboard: [[ { text: 'Share bot', switch_inline_query: `share` } ]]
    })
};

const userText = (text, amount) => (text && text.length) ? (text.substr(1) + `\n(amount: ${amount})`) : null;
const debtText = (debt, to) => `@${to} ${debt > 0 ? `wants` : `offers`} ${Math.abs(debt)}`;

const debtRegexp = /(-?\d+)(.+)?/;

const offerData = (data, result) => {
    return data.name + ' ' + data.amount + ' ' + (result ? '1' : '0');
};
const parse = src => {
    let spl = src.split(' ');
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

const pass = (...args) => new Promise(next => next(...args));

if (module) module.exports = BotFactory;
