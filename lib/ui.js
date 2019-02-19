const util = require('./util');

const UI = {
    start: {
        text: function () {
            return `Привет! 👋\n`
                + `Я — записная книжка долгов.\n\n`
                + `💰 Чтобы попросить в долг, напиши сумму.\n\n`
                + `🗄 Чтобы посмотреть свои долги, напиши /stats.\n\n`
                + `👋 Если хочешь поздороваться ещё раз, напиши /start.\n\n`
                + `❓ Чтобы получить более подробное руководство, напиши /help.`;
        }
    },
    help: {
        text: function (name) {
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
        text: function (name) {
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
        },
        article: {
            title: 'Поделиться 🤖'
        }
    },
    stats: {
        text: function (table) {
            if (!table.length)
                return 'Долгов нет 👏';
            let debts = table.filter(debt => debt.amount > 0), owes = table.filter(debt => debt.amount < 0).map(util.lineAbs);
            return ''
                + util.lineReduce(debts, 'Вы должны:\n')
                + (debts.length && owes.length ? '\n\n' : '')
                + util.lineReduce(owes, 'Вам должны:\n');
        },
        callback_answer_text: 'Обновлено.',
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
        text: function (text, amount, to) {
            if (text && (text.length > 1)) {
                return text.substr(1)
                    + `\n\n`
                    + `‼️ Количество: ${amount} ‼️`;
            }
            else {
                return `Я ${amount > 0 ? 'хочу' : 'даю'}`
                    + ` ${Math.abs(amount)} (${to})`;
            }
        },
        keyboard: function (text, amount) {
            return {
                reply_markup: JSON.stringify({
                    inline_keyboard: [[{
                        text: (amount < 0 ? 'Предложить' : 'Попросить') + ' 💰',
                        switch_inline_query: `${amount}${text || ''}`
                    }]]
                })
            };
        },
        amount_overflow_text: '❌ Размер долга нереально большой ❌',
        article: {
            title: function (amount) {
                return `${amount > 0 ? `Попросить` : `Предложить`} ${Math.abs(amount)}`;
            },
            keyboard: function (accept, refuse) {
                return {
                    inline_keyboard: [[
                        { text: 'Ок 🌝', callback_data: accept },
                        { text: 'Не 🌚', callback_data: refuse }
                    ]]
                };
            }
        }
    },
    deal: {
        text: function (offer) {
            let from = offer.from, amount = offer.amount, to = offer.to, accept = offer.accept;
            let arg1 = amount > 0 ? `долга (кол-во: ${amount})` : -amount, arg2 = accept ? `принято` : `отвергнуто`;
            return `Предложение ${arg1} было ${arg2} @${to}. (${from})`;
        },
        self_accept_text: `Нельзя должать себе`,
        cancel_text: function (owner) {
            return `Отменено @${owner}`;
        }
    }
};

if (module) module.exports = UI;
