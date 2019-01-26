function BotFactory(BaseBot) {
    return function Bot(token, url, port) {
        var bot = new BaseBot(token, { webHook : { port : port } });
        bot.setWebHook(`${url}/bot${token}`);

        var dataBase;
        bot.setDataBase = client => { dataBase = client; };

        var name;
        bot.setName = botName => { name = botName; };

        bot.onText(/\/start/, msg => {
            dataBase.setState(msg.chat.id, states.MAIN)
                .then(() => {
                    return bot.sendMessage(msg.chat.id, startText());
                })
                .catch(error => {
                    console.log(error);
                });
        });

        const startText = () => {
            return `Привет! 👋\n`
                 + `Я — записная книжка долгов.\n\n`
                 + `💰 Чтобы попросить в долг, напиши сумму.\n\n`
                 + `🗄 Чтобы посмотреть свои долги, напиши /stats.\n\n`
                 + `👋 Если хочешь поздороваться ещё раз, напиши /start.\n\n`
                 + `❓ Чтобы получить более подробное руководство, напиши /help.`;
        };

        bot.onText(/\/help/, msg => {
            dataBase.setState(msg.chat.id, states.MAIN)
                .then(() => {
                    return bot.sendMessage(msg.chat.id, helpText());
                })
                .catch(error => {
                    console.log(error);
                });
        });

        const helpText = () => {
            return `Команды ([текст] — по вкусу):\n\n`
                 + ` N [текст] — попросить N 💰.\n`
                 + `-N [текст] — предложить N 💰.\n`
                 + `/stats — посмотреть свои долги.\n`
                 + `/share — поделиться этим 🤖.\n`
                 + `/help — это сообщение.\n\n`
                 + `Инлайн (@${name} + команда):\n\n`
                 + `пусто — поделиться этим 🤖.\n`
                 + ` N [текст] — попросить 💰.\n`
                 + `-N [текст] — предложить 💰.`;
        };

        bot.onText(/\/share/, msg => {
            dataBase.setState(msg.chat.id, states.MAIN)
                .then(() => {
                    return bot.sendMessage(
                        msg.chat.id,
                        shareText(),
                        shareKeyboard
                    );
                })
                .catch(error => {
                    console.log(error);
                });
        });

        const shareText = () => {
            return `Привет! 👋\n`
                 + `Я — Долгер (@${name}), записная книжка долгов.\n`
                 + `Ещё увидимся?`;
        }

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

        bot.onText(debtRegexp, (msg, match) => {
            dataBase.checkState(msg.chat.id, states.DEBT_AMOUNT)
                .then(correctState => {
                    if (correctState)
                        return dataBase.setState(msg.chat.id, states.MAIN)
                            .then(() => {
                                return sendDebtTemplate(msg, match);
                            });
                    else return bot.sendMessage(
                        msg.chat.id,
                        'Maybe you forgot to type /debt ?'
                    );
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

        const sendDebtTemplate = (msg, match) => {
            return bot.sendMessage(
                    msg.chat.id,
                       userText(match[2], match[1])
                    || debtText(Number(match[1]), msg.from.username),
                    {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [[ {
                                text: 'Send offer 💰',
                                switch_inline_query: match[1]
                                                   + (match[2] || '')
                            } ]]
                        })
                    })
                .then(() => {
                    console.log('amount: ' + match[1])
                });
        };

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
                    title: debtTitle(data.amount),
                    input_message_content: {
                        message_text: userText(match[2], data.amount)
                                   || debtText(data.amount, data.name)
                    },
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: 'Ok 🌝',
                                callback_data: offerData(data, true)
                            },
                            {
                                text: 'No 🌚',
                                callback_data: offerData(data, false)
                            }
                        ]]
                    }
                };
            } else if (query.query == 'share') {
                answer = {
                    type: 'article',
                    id: articleID(),
                    title: 'Share bot 🤖',
                    input_message_content: {
                        message_text: shareText()
                    }
                };
            } else return;

            bot.answerInlineQuery(
                    query.id,
                    [answer],
                    { cache_time: 0 }
                )
                .catch(error => {
                    console.log(error);
                });
        });

        let article_id = 0;
        const articleID = () => article_id++;

        bot.on('callback_query', query => {
            if (query.data == 'update') {
                dataBase.getStats(query.from.username)
                    .then(table => {
                        return bot.editMessageText(
                            formatTable(table)
                            + '\n\nLast update: '
                            + new Date()
                                .toLocaleString(query.from.language_code),
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
                                { inline_message_id:
                                    query.inline_message_id })
                            .catch(error => {
                                console.log(error);
                            });
                    }
                }

                bot.editMessageText(
                        closedDealMsg(
                            data.name,
                            data.amount,
                            by,
                            data.answer
                        ),
                        { inline_message_id:
                            query.inline_message_id })
                    .then(() => {
                        if (data.answer)
                            return dataBase.saveDebt(
                                data.name,
                                data.amount,
                                by);
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
};

const shareKeyboard = {
    reply_markup: JSON.stringify({
        inline_keyboard: [[ {
            text: 'Share bot 🤖',
            switch_inline_query: 'share'
        } ]]
    })
};

const formatTable = table =>
    table.length
    ?   table.reduce((res, line) => {
            return res
                 + `\n@${line.to_name}: ${line.amount}`;
        }, 'Debts:\n')
    :   'No debts';

const statsKeyboard = JSON.stringify({
    inline_keyboard: [[ {
        text: 'Update 🔄',
        callback_data: 'update'
    } ]]
});

const debtRegexp = /(-?\d+)(.+)?/;

const userText = (text, amount) =>
    (text && text.length)
    ?   (text.substr(1) + `\n(amount: ${amount})`)
    :   null;

const debtText = (amount, to) =>
    `I ${amount > 0 ? 'want' : 'offer'} ${Math.abs(amount)} (${to})`;

const debtTitle = amount =>
    `${amount > 0 ? `Debt` : `Offer`} ${Math.abs(amount)}`;

const offerData = (data, result) =>
    `${data.name} ${data.amount} ${result ? '1' : '0'}`;

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
    return `Offer of ${arg1} was ${arg2} by @${to}. (${from})`
};

const states = {
    MAIN: 0,
    DEBT_AMOUNT: 1
};

const pass = (...args) => new Promise(next => next(...args));

if (module) module.exports = BotFactory;
