const BaseBot = require('node-telegram-bot-api');

const debtRegexp  = /(-?\d+)(.+)?/;
const digitsLimit = 9;

class Bot extends BaseBot {
    constructor(token, url, port) {
        super(token, { webHook: { port: port } });

        this.token = token;
        this.url = url;

        this.name;
        this.dataBase;
        this.cipher;

        this.articleID = 0;
    }

    start() {
        this.onText(/\/start/, this.onStart);
        this.onText(/\/help/, this.onHelp);
        this.onText(/\/share/, this.onShare);
        this.onText(/\/stats/, this.onStats);
        this.onText(debtRegexp, this.onDebt);

        this.on('inline_query', this.onInline);
        this.on('callback_query', this.onButton);

        this.setWebHook(`${this.url}/bot${this.token}`);
    }

    get articleID() { return this.articleID++; }
    set articleID(articleID) { this.articleID = articleID; }

    async onStart(msg) {
        try {
            await this.sendMessage(msg.chat.id, startText());
        } catch (error) {
            console.log(error);
        }
    }

    async onHelp(msg) {
        try {
            await this.sendMessage(msg.chat.id, helpText(this.name));
        } catch (error) {
            console.log(error);
        }
    }

    async onShare(msg) {
        try {
            await this.sendMessage(msg.chat.id, shareText(this.name), shareKeyboard);
        } catch (error) {
            console.log(error);
        }
    }

    async inlineShare(query) {
        try {
            await this.answerInlineQuery(query.id, [{
                type: 'article',
                id: this.articleID,
                title: 'Поделиться 🤖',
                input_message_content: {
                    message_text: shareText(this.name)
                }
            }]);
        } catch (error) {
            console.log(error);
        }
    }

    async onStats(msg) {
        try {
            let stats = await this.dataBase.getStats(msg.from.username);
            await this.sendMessage(msg.chat.id, statsText(stats), statsKeyboard);
        } catch(error) {
            console.log(error);
        }
    }

    async updateStats(query) {
        try {
            let stats = await this.dataBase.getStats(query.from.username);
            await Promise.all([
                this.deleteMessage(query.message.chat.id, query.message.message_id),
                this.answerCallbackQuery(query.id, { text: 'Обновлено.' }),
                this.sendMessage(query.message.chat.id, statsText(stats), statsKeyboard)
            ]);
        } catch(error) {
            console.log(error);
        }
    }

    async onDebt(msg, match) {
        try {
            if (match[1].length < digitsLimit) {
                await this.sendMessage(msg.chat.id, debtText(match[2], Number(match[1]), msg.from.username), {
                    reply_markup: JSON.stringify({
                        inline_keyboard: [[{
                            text: offerButton(match[1][0]),
                            switch_inline_query: match[1]
                                + (match[2] || '')
                        }]]
                    })
                });
                console.log('\namount :', match[1]);
            } else {
                await this.sendMessage(msg.chat.id, `❌ Размер долга нереально большой ❌`);
            }
        } catch (error) {
            console.log(error);
        }
    }

    async inlineDebt(query) {
        let match = query.query.match(debtRegexp);
        if (match[1].length >= digitsLimit) {
            await emptyInline();
            return;
        }
        let offer = {
            from: query.from.username,
            amount: Number(match[1])
        };
        let answer_main = debtArticle(offer, match);
        offer.amount = -offer.amount;
        let answer_addend = debtArticle(offer, match);
        try {
            await this.answerInlineQuery(query.id, [
                answer_main,
                answer_addend
            ], { cache_time: 0 });
        } catch (error) {
            console.log(error);
        }
    }

    debtArticle(offer, match) {
        return {
            type: 'article',
            id: this.articleID,
            title: debtTitle(offer.amount),
            input_message_content: {
                message_text: debtText(match[2], offer.amount, offer.from)
            },
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: 'Ок 🌝',
                        callback_data: this.cipher.encode(offer, true)
                    },
                    {
                        text: 'Не 🌚',
                        callback_data: this.cipher.encode(offer, false)
                    }
                ]]
            }
        };
    }

    async onOfferClick(query) {
        let offer = this.cipher.decode(query.data);
        offer.to = query.from.username;
        try {
            if (offer.to == offer.from) {
                if (offer.accept) {
                    await this.answerCallbackQuery(query.id, { text: `Нельзя должать себе` });
                } else {
                    await this.editMessageText(`Отменено @${offer.from}`, { inline_message_id: query.inline_message_id });
                }
            } else {
                await this.editMessageText(closedDealMsg(offer), { inline_message_id: query.inline_message_id });
                if (offer.accept)
                    await this.dataBase.saveDebt(offer);
            }
        } catch (error) {
            console.log(error);
        }
    }

    async onInline(query) {
        if (debtRegexp.test(query.query))
            await this.inlineDebt(query);
        else if (query.query == 'share' || query.query == '')
            await this.inlineShare(query);
        else
            await this.emptyInline(query);
    }

    async emptyInline(query) {
        try {
            await this.answerInlineQuery(query.id, []);
        } catch (error) {
            console.log(error);
        }
    }

    async onButton(query) {
        if (query.data == 'update')
            await this.updateStats(query);
        else
            await this.onOfferClick(query);
    }
};

const UI = {
    start: {
        text: function() {
            return `Привет! 👋\n`
                + `Я — записная книжка долгов.\n\n`
                + `💰 Чтобы попросить в долг, напиши сумму.\n\n`
                + `🗄 Чтобы посмотреть свои долги, напиши /stats.\n\n`
                + `👋 Если хочешь поздороваться ещё раз, напиши /start.\n\n`
                + `❓ Чтобы получить более подробное руководство, напиши /help.`;
        }
    },
    help: {
        text: function(name) {
            return ''
                + `Команды ([текст] — по вкусу):\n\n`
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
        }
    },
    share: {
        text: function(name) {
            return ''
                + `Привет! 👋\n`
                + `Я — Долгер (@${name}), записная книжка долгов.\n`
                + `Ещё увидимся?`;
        },
        keyboard: {
            reply_markup: JSON.stringify({
                inline_keyboard: [[{
                    text: 'Поделиться 🤖',
                    switch_inline_query: ''
                }]]
            })
        }
    },
    stats: {
        text: function(table) {
            if (!table.length)
                return 'Долгов нет 👏';
        
            let debts = table.filter(debt => debt.amount > 0),
                owes  = table.filter(debt => debt.amount < 0).map(lineAbs);
        
            return ''
                + lineReduce(debts, 'Вы должны:\n')
                + (debts.length && owes.length ? '\n\n' : '')
                + lineReduce(owes, 'Вам должны:\n');
        },
        keyboard: {
            reply_markup: JSON.stringify({
                inline_keyboard: [[{
                    text: 'Обновить 🔄',
                    callback_data: 'update'
                }]]
            })
        }
    },
    debt: {
        text: function(text, amount, to) {
            if (text && (text.length > 1)) {
                return text.substr(1)
                    + `\n\n`
                    + `‼️ Количество: ${amount} ‼️`;
            } else {
                return `Я ${amount > 0 ? 'хочу' : 'даю'}`
                    + ` ${Math.abs(amount)} (${to})`;
            }
        }
    }
};

function startText() {
    return `Привет! 👋\n`
        + `Я — записная книжка долгов.\n\n`
        + `💰 Чтобы попросить в долг, напиши сумму.\n\n`
        + `🗄 Чтобы посмотреть свои долги, напиши /stats.\n\n`
        + `👋 Если хочешь поздороваться ещё раз, напиши /start.\n\n`
        + `❓ Чтобы получить более подробное руководство, напиши /help.`;
};

function helpText(name) {
    return ''
        + `Команды ([текст] — по вкусу):\n\n`
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

function shareText(name) {
    return ''
        + `Привет! 👋\n`
        + `Я — Долгер (@${name}), записная книжка долгов.\n`
        + `Ещё увидимся?`;
};

const shareKeyboard = {
    reply_markup: JSON.stringify({
        inline_keyboard: [[{
            text: 'Поделиться 🤖',
            switch_inline_query: ''
        }]]
    })
};

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
        to_name: line.to_name,
        amount: Math.abs(line.amount)
    };
};

function statsText(table) {
    if (!table.length)
        return 'Долгов нет 👏';

    let debts = table.filter(debt => debt.amount > 0),
        owes  = table.filter(debt => debt.amount < 0).map(lineAbs);

    return ''
        + lineReduce(debts, 'Вы должны:\n')
        + (debts.length && owes.length ? '\n\n' : '')
        + lineReduce(owes, 'Вам должны:\n');
};

const statsKeyboard = {
    reply_markup: JSON.stringify({
        inline_keyboard: [[{
            text: 'Обновить 🔄',
            callback_data: 'update'
        }]]
    })
};

function closedDealMsg(offer) {
    let from   = offer.from,
        amount = offer.amount,
        to     = offer.to,
        accept = offer.accept;
    let arg1 = amount > 0 ? `долга (кол-во: ${amount})` : -amount,
        arg2 = accept ? `принято` : `отвергнуто`;
    return `Предложение ${arg1} было ${arg2} @${to}. (${from})`;
};

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

if (module) module.exports = Bot;
