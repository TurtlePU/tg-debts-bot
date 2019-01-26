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
                 + `/start — краткая справка.\n`
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

        bot.onText(debtRegexp, (msg, match) => {
            dataBase.setState(msg.chat.id, states.MAIN)
                .then(() => {
                    if (match[1].length < DIGITS_LIMIT)
                        return sendDebtTemplate(msg, match);
                    else
                        return bot.sendMessage(
                            msg.chat.id,
                            `❌ Размер долга нереально большой ❌`
                        );
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
                                text: offerButton(match[1][0]),
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

                if (match[1].length >= DIGITS_LIMIT) {
                    return bot.answerInlineQuery(
                        query.id,
                        []
                    );
                }

                let offer = {
                    from: query.from.username,
                    amount: Number(match[1])
                };

                return dataBase.saveOfferGetID(offer)
                    .then(id => {
                        answer = {
                            type: 'article',
                            id: articleID(),
                            title: debtTitle(offer.amount),
                            input_message_content: {
                                message_text: userText(match[2], offer.amount)
                                           || debtText(offer.amount, offer.from)
                            },
                            reply_markup: {
                                inline_keyboard: [[
                                    {
                                        text: 'Ок 🌝',
                                        callback_data: `${id} 1`
                                    },
                                    {
                                        text: 'Не 🌚',
                                        callback_data: `${id} 0`
                                    }
                                ]]
                            }
                        };

                        return bot.answerInlineQuery(
                            query.id,
                            [answer],
                            { cache_time: 0 }
                        );
                    })
                    .catch(error => {
                        console.log(error);
                    });
            } else if (query.query == 'share' || query.query == '') {
                answer = {
                    type: 'article',
                    id: articleID(),
                    title: 'Поделиться 🤖',
                    input_message_content: {
                        message_text: shareText()
                    }
                };

                return bot.answerInlineQuery(
                        query.id,
                        [answer],
                        { cache_time: 0 }
                    )
                    .catch(error => {
                        console.log(error);
                    });
            } else {
                return bot.answerInlineQuery(
                    query.id,
                    []
                );
            }
        });

        let article_id = 0;
        const articleID = () => article_id++;

        bot.on('callback_query', query => {
            if (query.data == 'update') {
                dataBase.getStats(query.from.username)
                    .then(table => {
                        return bot.editMessageText(
                            formatTable(table)
                            + '\n\nОбновлено '
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
                            { text: 'Обновлено.' }
                        );
                    })
                    .catch(error => {
                        console.log(error);
                    });
            } else {
                let answer = parse(query.data);
                let by = query.from.username;

                dataBase.getOffer(answer.offer_id)
                    .then(offer => {
                        if (by == offer.from) {
                            if (answer.accept) {
                                return bot.answerCallbackQuery(
                                    query.id,
                                    { text: `Нельзя должать себе` }
                                );
                            } else {
                                return dataBase.deleteOffer(answer.offer_id)
                                    .then(() => {
                                        return bot.editMessageText(
                                            `Отменено @${by}`,
                                            { inline_message_id:
                                                query.inline_message_id }
                                        );
                                    });
                            }
                        } else {
                            return dataBase.deleteOffer(answer.offer_id)
                                .then(() => {
                                    return bot.editMessageText(
                                        closedDealMsg(
                                            offer.from,
                                            offer.amount,
                                            by,
                                            answer.accept
                                        ),
                                        { inline_message_id:
                                            query.inline_message_id }
                                    );
                                });
                                .then(() => {
                                    if (answer.accept)
                                        return dataBase.saveDebt(
                                            offer.from,
                                            offer.amount,
                                            by
                                        );
                                    else
                                        return pass();
                                });
                        }
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
            text: 'Поделиться 🤖',
            switch_inline_query: ''
        } ]]
    })
};

const formatTable = table =>
    table.length
    ?   table.reduce((res, line) => {
            return res
                 + `\n@${line.to_name}: ${line.amount}`;
        }, 'Долги:\n')
    :   'Нет долгов';

const statsKeyboard = JSON.stringify({
    inline_keyboard: [[ {
        text: 'Обновить 🔄',
        callback_data: 'update'
    } ]]
});

const debtRegexp = /(-?\d+)(.+)?/;

const DIGITS_LIMIT = 9;

const userText = (text, amount) =>
    (text && (text.length > 1))
    ?   (text.substr(1) + `\n\n‼️ Количество: ${amount} ‼️`)
    :   null;

const debtText = (amount, to) =>
    `Я ${amount > 0 ? 'хочу' : 'даю'} ${Math.abs(amount)} (${to})`;

const offerButton = (minus) =>
    (minus == '-' ? 'Предложить' : 'Попросить') + ' 💰';

const debtTitle = amount =>
    `${amount > 0 ? `Попросить` : `Предложить`} ${Math.abs(amount)}`;

const parse = src => {
    let spl = src.split(' ');
    console.log('split result:', spl);
    return {
        offer_id: Number(spl[0]),
        accept: spl[1] == '1'
    };
};

const closedDealMsg = (from, amount, to, accept) => {
    let arg1 = amount > 0 ? `долга (кол-во: ${amount})` : -amount;
    let arg2 = accept ? `принято` : `отвергнуто`;
    return `Предложение ${arg1} было ${arg2} @${to}. (${from})`
};

const states = {
    MAIN: 0,
    DEBT_AMOUNT: 1
};

const pass = (...args) => new Promise(next => next(...args));

if (module) module.exports = BotFactory;
