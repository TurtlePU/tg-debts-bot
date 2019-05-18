import { StatsRow, Offer, OfferTemplate } from './common_types';
import util from './util';

import Bot from 'node-telegram-bot-api';

const ok_sign = '✅';
const no_sign = '❌';
const money = '₽';

function sign(ok: boolean) {
    return ok ? ok_sign : no_sign;
}

const UI = {
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
                + `/share — поделиться этим ботом.\n`
                + `/start — краткая справка.\n`
                + `/help — это сообщение.\n\n`
                + `Инлайн (@${name} + команда):\n\n`
                + `пусто — поделиться этим ботом.\n`
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
                        text: '🤖 Поделиться ботом',
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
                return '👏 Поздравляем, долгов нет!';
            let debts = table.filter(debt => debt.amount > 0);
            let owes = table.filter(debt => debt.amount < 0).map(util.lineAbs);
            return ''
                + util.lineReduce(debts, 'Вы должны:\n')
                + (debts.length && owes.length ? '\n\n' : '')
                + util.lineReduce(owes, 'Вам должны:\n');
        },
        callback_answer_text() {
            return '🔄 Обновлено';
        },
        keyboard(): Bot.SendMessageOptions {
            return {
                reply_markup: {
                    inline_keyboard: [[{
                        text: '🔄 Обновить',
                        callback_data: 'update'
                    }]]
                }
            };
        }
    },
    debt: {
        info(amount: number, hide?: boolean) {
            let action = amount > 0 ? 'взял в долг' : 'отдал';
            let object = hide ? '💰' : (`${Math.abs(amount)} ${money}`);
            return `Я ${action} ${object}`;
        },
        text(text: string, amount: number) {
            if (text && (text.length > 1)) {
                return '' 
                    + `*${UI.debt.info(amount)}*`
                    + `\n`
                    + text.substr(1);
            } else {
                return UI.debt.info(amount) + '.';
            }
        },
        keyboard(
            text: string,
            amount: number
        ): Bot.SendMessageOptions {
            return {
                reply_markup: {
                    inline_keyboard: [[{
                        text: UI.debt.info(amount, true),
                        switch_inline_query: `${amount}${text || ''}`
                    }]]
                }
            };
        },
        amount_overflow_text: function(): string {
            return `${no_sign} Долг слишком большой.`;
        },
        article: {
            title: function(amount: number): string {
                return `${amount > 0 ? 'Взять в долг' : 'Отдать'} ${Math.abs(amount)} ${money}`;
            },
            keyboard: function(): Bot.InlineKeyboardMarkup {
                return {
                    inline_keyboard: [[
                        { text: '🌝 Ок', callback_data: '1' },
                        { text: '🌚 Не', callback_data: '0' }
                    ]]
                };
            }
        }
    },
    deal: {
        text: function(offer: Offer): string {
            let person = offer.amount > 0 ? offer.from : offer.to;
            let neg = offer.accept ? '' : 'не';
            return `${sign(offer.accept)} @${person} ${neg} получил ${Math.abs(offer.amount)} ${money}.`;
        },
        self_accept_text: function(): string {
            return `${no_sign} Нельзя должать себе`;
        },
        cancel_text: function(): string {
            return `${no_sign} Запрос отменен.`;
        },
        expire_text: function(offer: OfferTemplate): string {
            return `${no_sign} Время запроса истекло.`;
        }
    }
};

export default UI;
