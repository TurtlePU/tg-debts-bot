import { StatsRow, Offer, OfferTemplate } from './common_types';
import util from './util';

import Bot from 'node-telegram-bot-api';

export default {
    start: {
        text() {
            return `Привет! 👋\n`
                + `Я — записная книжка долгов.\n\n`
                + `💰 Чтобы попросить в долг, напиши сумму.\n\n`
                + `🗄 Чтобы посмотреть свои долги, напиши /stats.\n\n`
                + `👋 Если хочешь поздороваться ещё раз, напиши /start.\n\n`
                + `❓ Чтобы получить более подробное руководство, напиши /help.`;
        }
    },
    help: {
        text(name: string) {
            return ''
                + `Команды ([текст] — по вкусу):\n\n`
                + ` N [текст] — ты получил N 💰.\n`
                + `-N [текст] — ты отдал N 💰.\n`
                + `/stats — посмотреть свои долги.\n`
                + `/share — поделиться этим 🤖.\n`
                + `/start — краткая справка.\n`
                + `/help — это сообщение.\n\n`
                + `Инлайн (@${name} + команда):\n\n`
                + `пусто — поделиться этим 🤖.\n`
                + ` N [текст] — ты получил 💰.\n`
                + `-N [текст] — ты отдал 💰.`;
        }
    },
    share: {
        text(name: string) {
            return ''
                + `Привет! 👋\n`
                + `Я — Долгер (@${name}), записная книжка долгов.\n`
                + `Ещё увидимся?`;
        },
        keyboard(): Bot.SendMessageOptions {
            return {
                reply_markup: {
                    inline_keyboard: [[{
                        text: 'Поделиться 🤖',
                        switch_inline_query: ''
                    }]]
                }
            };
        }, 
        article: {
            title() {
                return 'Поделиться 🤖';
            }
        }
    },
    stats: {
        text(table: StatsRow[]) {
            if (!table.length)
                return 'Долгов нет 👏';
            let debts = table.filter(debt => debt.amount > 0);
            let owes = table.filter(debt => debt.amount < 0).map(util.lineAbs);
            return ''
                + util.lineReduce(debts, 'Вы должны:\n')
                + (debts.length && owes.length ? '\n\n' : '')
                + util.lineReduce(owes, 'Вам должны:\n');
        },
        callback_answer_text() {
            return 'Обновлено.';
        },
        keyboard(): Bot.SendMessageOptions {
            return {
                reply_markup: {
                    inline_keyboard: [[{
                        text: 'Обновить 🔄',
                        callback_data: 'update'
                    }]]
                }
            };
        }
    },
    debt: {
        text(text: string, amount: number) {
            if (text && (text.length > 1)) {
                return text.substr(1)
                    + `\n\n`
                    + `‼️ ${amount > 0 ? 'хочет' : 'даёт'} ${Math.abs(amount)} ‼️`;
            } else {
                return `Я ${amount > 0 ? 'хочу' : 'даю'}`
                    + ` ${Math.abs(amount)}`;
            }
        },
        keyboard: function(
            text: string,
            amount: number
        ): Bot.SendMessageOptions {
            return {
                reply_markup: {
                    inline_keyboard: [[{
                        text: `Я ${amount < 0 ? 'отдал' : 'получил'} 💰`,
                        switch_inline_query: `${amount}${text || ''}`
                    }]]
                }
            };
        },
        amount_overflow_text: function(): string {
            return '❌ Размер долга нереально большой ❌';
        },
        article: {
            title: function(amount: number): string {
                return `${amount > 0 ? `Попросить` : `Предложить`} ${Math.abs(amount)}`;
            },
            keyboard: function(): Bot.InlineKeyboardMarkup {
                return {
                    inline_keyboard: [[
                        { text: 'Ок 🌝', callback_data: '1' },
                        { text: 'Не 🌚', callback_data: '0' }
                    ]]
                };
            }
        }
    },
    deal: {
        text: function(offer: Offer): string {
            let arg1 = offer.amount > 0
                    ? `долга (кол-во: ${offer.amount})`
                    : -offer.amount;
            let arg2 = offer.accept
                    ? `принято`
                    : `отвергнуто`;
            return `Предложение ${arg1} было ${arg2} @${offer.to}.`;
        },
        self_accept_text: function(): string {
            return 'Нельзя должать себе';
        },
        cancel_text: function(owner: string): string {
            return `Отменено @${owner}`;
        },
        expire_text: function(offer: OfferTemplate): string {
            return `Ожидание ${offer.amount} истекло`;
        }
    }
};
