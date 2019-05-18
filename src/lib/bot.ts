import TelegramBot from 'node-telegram-bot-api';
import UI from './ui';

import { DB_Client } from './db-interface';

const debtRegexp  = /(-?\d+)(.+)?/;
const digitsLimit = 9;

export default class DebtBot extends TelegramBot {
    readonly name: string;
    readonly token: string;
    readonly dataBase: DB_Client;

    constructor(options: BotOptions) {
        let { dataBase, name, port, token } = options;

        super(token, { webHook: { port } });

        this.name = name;
        this.token = token;
        this.dataBase = dataBase;
    }

    async start(url: string): Promise<void> {
        this.onText(/\/start/, (msg) => {
            this.onStart(msg);
        });
        this.onText(/\/help/,  (msg) => {
            this.onHelp(msg);
        });
        this.onText(/\/share/, (msg) => {
            this.onShare(msg);
        });
        this.onText(/\/stats/, (msg) => {
            this.onStats(msg);
        });
        this.onText(debtRegexp, (msg, match) => {
            this.onDebt(msg, match);
        });

        this.on('inline_query', (query) => {
            this.onInline(query);
        });
        this.on('chosen_inline_result', (result) => {
            this.onChosenInlineResult(result)
        });

        this.dataBase.on('expired_offer', (id) => {
            this.onExpiredOffer(id);
        });
        await this.dataBase.restartOffers();

        this.on('callback_query', (query) => {
            this.onButton(query)
        });

        await this.setWebHook(`${url}/bot${this.token}`);
    }

    private async onStart(msg: TelegramBot.Message): Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.start.text(),
                {
                    parse_mode: 'Markdown'
                }
            );
        } catch (error) {
            console.log(error);
        }
    }

    private async onHelp(msg: TelegramBot.Message): Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.help.text(this.name),
                {
                    parse_mode: 'Markdown'
                }
            );
        } catch (error) {
            console.log(error);
        }
    }

    private async onShare(msg: TelegramBot.Message): Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.share.text(this.name),
                {
                    ...UI.share.keyboard(),
                    parse_mode: 'Markdown'
                }
            );
        } catch (error) {
            console.log(error);
        }
    }

    private async inlineShare(query: TelegramBot.InlineQuery): Promise<void> {
        try {
            await this.answerInlineQuery(
                query.id,
                [this.shareArticle()]
            );
        } catch (error) {
            console.log(error);
        }
    }

    private shareArticle(): TelegramBot.InlineQueryResultArticle {
        return {
            type: 'article',
            id: '0',
            title: UI.share.article.title(),
            input_message_content: {
                message_text: UI.share.text(this.name),
                parse_mode: 'Markdown'
            }
        };
    }

    private async onStats(msg: TelegramBot.Message): Promise<void> {
        try {
            let stats = await this.dataBase.getStats(msg.from.username);
            await this.sendMessage(
                msg.chat.id,
                UI.stats.text(stats),
                {
                    ...UI.stats.keyboard(),
                    parse_mode: 'Markdown'
                }
            );
        } catch(error) {
            console.log(error);
        }
    }

    private async updateStats(query: TelegramBot.CallbackQuery): Promise<void> {
        try {
            let stats = await this.dataBase.getStats(query.from.username);
            await Promise.all([
                this.deleteMessage(
                    query.message.chat.id,
                    String(query.message.message_id)
                ),
                this.answerCallbackQuery(
                    query.id,
                    { text: UI.stats.callback_answer_text() }
                ),
                this.sendMessage(
                    query.message.chat.id,
                    UI.stats.text(stats),
                    {
                        ...UI.stats.keyboard(),
                        parse_mode: 'Markdown'
                    }
                )
            ]);
        } catch(error) {
            console.log(error);
        }
    }

    private async onDebt(msg: TelegramBot.Message, match: RegExpExecArray): Promise<void> {
        try {
            if (match[1].length < digitsLimit) {
                let amount = Number(match[1]);
                let text   = match[2];
                await this.sendMessage(
                    msg.chat.id,
                    UI.debt.text(text, amount),
                    {
                        ...UI.debt.keyboard(text, amount),
                        parse_mode: 'Markdown'
                    }
                );
                console.log('\namount :', amount);
            } else {
                await this.sendMessage(
                    msg.chat.id,
                    UI.debt.amount_overflow_text(),
                    {
                        parse_mode: 'Markdown'
                    }
                );
            }
        } catch (error) {
            console.log(error);
        }
    }

    private async inlineDebt(query: TelegramBot.InlineQuery): Promise<void> {
        let match = query.query.match(debtRegexp);
        if (match[1].length >= digitsLimit) {
            await this.emptyInline(query);
            return;
        }
        let amount = +match[1];
        let text = match[2];
        let answer_main = this.debtArticle(amount, text);
        let answer_addend = this.debtArticle(-amount, text);
        try {
            await this.answerInlineQuery(query.id, [
                answer_main,
                answer_addend
            ]);
        } catch (error) {
            console.log(error);
        }
    }

    private debtArticle(amount: number, text: string): TelegramBot.InlineQueryResultArticle {
        return {
            type: 'article',
            id: `${amount > 0 ? '+' : ''}${amount}`,
            title: UI.debt.article.title(amount),
            input_message_content: {
                message_text: UI.debt.text(text, amount),
                parse_mode: 'Markdown'
            },
            reply_markup: UI.debt.article.keyboard()
        };
    }

    private async onOfferClick(query: TelegramBot.CallbackQuery): Promise<void> {
        try {
            let { from, amount } = await this.dataBase.getOffer(
                query.inline_message_id
            );
            let to = query.from.username;
            let accept = query.data == '1';
            if (to == from) {
                if (accept) {
                    await this.answerCallbackQuery(
                        query.id,
                        { text: UI.deal.self_accept_text() }
                    );
                } else {
                    await this.editMessageText(
                        UI.deal.cancel_text(),
                        {
                            inline_message_id: query.inline_message_id,
                            parse_mode: 'Markdown'
                        }
                    );
                    await this.dataBase.deleteOffer(
                        query.inline_message_id
                    );
                }
            } else {
                await this.editMessageText(
                    UI.deal.text(from, amount, to, accept),
                    {
                        inline_message_id: query.inline_message_id,
                        parse_mode: 'Markdown'
                    }
                );
                await this.dataBase.deleteOffer(
                    query.inline_message_id
                );
                if (accept) {
                    await this.dataBase.saveDebt(from, amount, to);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    private async onInline(query: TelegramBot.InlineQuery): Promise<void> {
        if (debtRegexp.test(query.query)) {
            await this.inlineDebt(query);
        } else if (query.query === '') {
            await this.inlineShare(query);
        } else {
            await this.emptyInline(query);
        }
    }

    private async emptyInline(query: TelegramBot.InlineQuery): Promise<void> {
        try {
            await this.answerInlineQuery(query.id, []);
        } catch (error) {
            console.log(error);
        }
    }

    private async onChosenInlineResult(result: TelegramBot.ChosenInlineResult): Promise<void> {
        if (result.query != '') {
            try {
                await this.dataBase.saveOffer(
                    result.inline_message_id,
                    {
                        from: result.from.username,
                        amount: +result.result_id
                    }
                );
            } catch (error) {
                console.log(error);
            }
        }
    }

    private async onExpiredOffer(id: string): Promise<void> {
        await this.editMessageText(
            UI.deal.expire_text(),
            {
                inline_message_id: id,
                parse_mode: 'Markdown'
            }
        );
    }

    private async onButton(query: TelegramBot.CallbackQuery): Promise<void> {
        if (query.data === 'update') {
            await this.updateStats(query);
        } else {
            await this.onOfferClick(query);
        }
    }
}

type BotOptions = {
    token: string,
    port: number,
    name: string,
    dataBase: DB_Client
}
