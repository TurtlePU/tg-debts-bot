const BaseBot = require('node-telegram-bot-api');

function Bot(token, url, port) {
    // *** CONSTRUCTION *** //

    var bot = new BaseBot(token, { webHook : { port : port } });

    // *** INIT & UTIL SECTION *** //

    var name;
    this.setName = function(botName) {
        name = botName;
    };

    var dataBase;
    this.setDataBase = function(client) {
        dataBase = client;
    };

    var cipher;
    this.setCipher = function(dataCipher) {
        cipher = dataCipher;
    };

    this.start = function() {
        bot.setWebHook(`${url}/bot${token}`);
    };

    function logger(error) {
        console.log('\n', error);
    };

    // *** START SECTION *** //

    bot.onText(/\/start/, msg => {
        bot.sendMessage(
            msg.chat.id,
            startText()
        ).catch(logger);
    });

    function startText() {
        return `Привет! 👋\n`
             + `Я — записная книжка долгов.\n\n`
             + `💰 Чтобы попросить в долг, напиши сумму.\n\n`
             + `🗄 Чтобы посмотреть свои долги, напиши /stats.\n\n`
             + `👋 Если хочешь поздороваться ещё раз, напиши /start.\n\n`
             + `❓ Чтобы получить более подробное руководство, напиши /help.`;
    };

    // *** HELP SECTION *** //

    bot.onText(/\/help/, msg => {
        bot.sendMessage(
            msg.chat.id,
            helpText()
        ).catch(logger);
    });

    function helpText() {
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

    // *** SHARE SECTION *** //

    bot.onText(/\/share/, msg => {
        bot.sendMessage(
            msg.chat.id,
            shareText(),
            shareKeyboard
        ).catch(logger);
    });

    function inlineShare(query) {
        let answer = {
            type  : 'article',
            id    : articleID(),
            title : 'Поделиться 🤖',
            input_message_content : {
                message_text : shareText()
            }
        };

        bot.answerInlineQuery(
            query.id,
            [answer]
        ).catch(logger);
    };

    function shareText() {
        return `Привет! 👋\n`
             + `Я — Долгер (@${name}), записная книжка долгов.\n`
             + `Ещё увидимся?`;
    };

    const shareKeyboard = {
        reply_markup : JSON.stringify({
            inline_keyboard : [[ {
                text : 'Поделиться 🤖',
                switch_inline_query : ''
            } ]]
        })
    };

    // *** STATS SECTION *** //

    bot.onText(/\/stats/, msg => {
        dataBase.getStats(msg.from.username)
            .then(table => {
                return bot.sendMessage(
                    msg.chat.id,
                    statsText(table),
                    { reply_markup : statsKeyboard }
                );
            })
            .catch(logger);
    });

    function updateStats(query) {
        let stats;
        dataBase.getStats(query.from.username)
            .then(table => {
                stats = table;
                return bot.deleteMessage(
                    query.message.chat.id,
                    query.message.message_id
                );
            })
            .then(() => {
                return bot.answerCallbackQuery(
                    query.id,
                    { text : 'Обновлено.' }
                );
            })
            .then(() => {
                return bot.sendMessage(
                    query.message.chat.id,
                    statsText(stats),
                    { reply_markup : statsKeyboard }
                );
            })
            .catch(logger);
    };

    var statsText = new TableFormatter().format;
    function TableFormatter() {
        function lineReduce(table, seed) {
            console.log(table, seed);
            if (!table.length)
                return '';
            return table.reduce((res, line) => {
                return res
                     + `\n@${line.to_name}: ${line.amount}`;
            }, seed);
        };

        function lineAbs(line) {
            return {
                to_name : line.to_name,
                amount  : Math.abs(line.amount)
            };
        };

        this.format = function(table) {
            if (!table.length)
                return '';

            let debts = table.filter(debt => debt.amount > 0),
                owes  = table.filter(debt => debt.amount < 0)
                             .map(lineAbs);

            return ''
            + lineReduce(debts, 'Вы должны:\n')
            + (debts.length && owes.length ? '\n\n' : '')
            + lineReduce(owes, 'Вам должны:\n');
        };
    };

    const statsKeyboard = JSON.stringify({
        inline_keyboard : [[ {
            text : 'Обновить 🔄',
            callback_data : 'update'
        } ]]
    });

    // *** DEBT SECTION *** //

    bot.onText(debtRegexp, (msg, match) => {
        if (match[1].length < DIGITS_LIMIT)
            bot.sendMessage(
                msg.chat.id,
                debtText(
                    match[2],
                    Number(match[1]),
                    msg.from.username
                ),
                {
                    reply_markup : JSON.stringify({
                        inline_keyboard : [[ {
                            text : offerButton(match[1][0]),
                            switch_inline_query : match[1]
                                               + (match[2] || '')
                        } ]]
                    })
                }
            )
            .then(() => {
                console.log('\namount :', match[1]);
            });
            .catch(logger);
        else
            bot.sendMessage(
                msg.chat.id,
                `❌ Размер долга нереально большой ❌`
            ).catch(logger);
    });

    function inlineDebt(query) {
        let match = query.query.match(debtRegexp);

        if (match[1].length >= DIGITS_LIMIT)
            return emptyInline();

        let offer = {
            from   : query.from.username,
            amount : Number(match[1])
        };

        let answer = {
            type  : 'article',
            id    : articleID(),
            title : debtTitle(offer.amount),
            input_message_content : {
                message_text : debtText(match[2], offer.amount, offer.from)
            },
            reply_markup : {
                inline_keyboard : [[
                    {
                        text : 'Ок 🌝',
                        callback_data : cipher.encode(offer, true)
                    },
                    {
                        text : 'Не 🌚',
                        callback_data : cipher.encode(offer, false)
                    }
                ]]
            }
        };

        bot.answerInlineQuery(
            query.id,
            [answer],
            { cache_time : 0 }
        ).catch(logger);
    };

    function onOfferClick(query) {
        let offer = cipher.decode(query.data);
        offer.to  = query.from.username;

        if (offer.to == offer.from) {
            if (offer.accept) {
                bot.answerCallbackQuery(
                    query.id,
                    { text : `Нельзя должать себе` }
                ).catch(logger);
            } else {
                bot.editMessageText(
                    `Отменено @${offer.from}`,
                    { inline_message_id :
                        query.inline_message_id }
                ).catch(logger);
            }
        } else {
            bot.editMessageText(
                    closedDealMsg(offer),
                    { inline_message_id :
                        query.inline_message_id }
                )
                .then(() => {
                    if (offer.accept)
                        return dataBase.saveDebt(offer);
                    else
                        return pass();
                })
                .catch(logger);
        }
    };

    const debtRegexp = /(-?\d+)(.+)?/;

    const DIGITS_LIMIT = 9;

    function debtText(text, amount, to) {
        if (text && (text.length > 1)) {
            return text.substr(1)
                 + `\n\n`
                 + `‼️ Количество: ${amount} ‼️`;
        } else {
            return `Я ${amount > 0 ? 'хочу' : 'даю'}`
                 + ` ${Math.abs(amount)} (${to})`;
        }
    };

    function offerButton(minus) {
        return (minus == '-' ? 'Предложить' : 'Попросить') + ' 💰';
    };

    function debtTitle(amount) {
        return `${amount > 0 ? `Попросить` : `Предложить`} ${Math.abs(amount)}`;
    };

    // *** INLINE SECTION *** //

    bot.on('inline_query', query => {
        if (debtRegexp.test(query.query))
            inlineDebt(query);
        else if (query.query == 'share' || query.query == '')
            inlineShare(query);
        else
            emptyInline(query);
    });

    let article_id = 0;
    function articleID() {
        return article_id++;
    };

    function emptyInline(query) {
        return bot.answerInlineQuery(query.id, [])
            .catch(logger);
    };

    // *** BUTTONS SECTION *** //

    bot.on('callback_query', query => {
        if (query.data == 'update')
            updateStats(query);
        else
            onOfferClick(query);
    });

    function closedDealMsg(from, amount, to, accept) {
        let arg1 = amount > 0 ? `долга (кол-во: ${amount})` : -amount;
        let arg2 = accept ? `принято` : `отвергнуто`;
        return `Предложение ${arg1} было ${arg2} @${to}. (${from})`
    };

    function pass(...args) {
        return new Promise(next => next(...args));
    };
};

if (module) module.exports = Bot;
