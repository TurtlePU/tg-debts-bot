import TelegramBot from 'node-telegram-bot-api';
import UI  from './ui';

const debtRegexp  = /(-?\d+)(.+)?/;
const digitsLimit = 9;

import {
    BotType,
    BotOptions,
    BotPostgreClient,
    Offer,
    OfferTemplate
} from './common_types';

interface TextedOffer extends OfferTemplate {
    text: string
};

function toOffer(
    offerTemplate : OfferTemplate,
    to : string,
    accept : boolean
) : Offer {
    return {
        from   : offerTemplate.from,
        amount : offerTemplate.amount,
        to     : to,
        accept : accept
    };
}

export default class DebtBot extends TelegramBot implements BotType {
    token : string;
    name  : string;
    dataBase : BotPostgreClient;

    constructor(options : BotOptions) {
        super(options.token, {
            webHook : {
                port : options.port,
                key  : '',
                cert : '',
                pfx  : ''
            }
        });

        this.token    = options.token;
        this.name     = options.name;
        this.dataBase = options.dataBase;
    }

    start(url : string) : void {
        this.onText(/\/start/, this.onStart);
        this.onText(/\/help/, this.onHelp);
        this.onText(/\/share/, this.onShare);
        this.onText(/\/stats/, this.onStats);
        this.onText(debtRegexp, this.onDebt);

        this.on('inline_query', this.onInline);
        this.on('chosen_inline_result', this.onChosenInlineResult);

        this.dataBase.on('expired_offer', this.onExpiredOffer);

        this.on('callback_query', this.onButton);

        this.setWebHook(`${url}/bot${this.token}`);
    }

    async onStart(msg : TelegramBot.Message) : Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.start.text()
            );
        } catch (error) {
            console.log(error);
        }
    }

    async onHelp(msg : TelegramBot.Message) : Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.help.text(this.name)
            );
        } catch (error) {
            console.log(error);
        }
    }

    async onShare(msg : TelegramBot.Message) : Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.share.text(this.name),
                UI.share.keyboard()
            );
        } catch (error) {
            console.log(error);
        }
    }

    async inlineShare(query : TelegramBot.InlineQuery) : Promise<void> {
        try {
            await this.answerInlineQuery(query.id, [this.shareArticle()]);
        } catch (error) {
            console.log(error);
        }
    }

    shareArticle() : TelegramBot.InlineQueryResultArticle {
        return {
            type: 'article',
            id: '0',
            title: UI.share.article.title(),
            input_message_content: {
                message_text: UI.share.text(this.name)
            }
        };
    }

    async onStats(msg : TelegramBot.Message) : Promise<void> {
        try {
            let stats = await this.dataBase.getStats(msg.from.username);
            await this.sendMessage(
                msg.chat.id,
                UI.stats.text(stats),
                UI.stats.keyboard()
            );
        } catch(error) {
            console.log(error);
        }
    }

    async updateStats(query : TelegramBot.CallbackQuery) : Promise<void> {
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
                    UI.stats.keyboard()
                )
            ]);
        } catch(error) {
            console.log(error);
        }
    }

    async onDebt(msg : TelegramBot.Message, match : RegExpExecArray) : Promise<void> {
        try {
            if (match[1].length < digitsLimit) {
                let amount = Number(match[1]);
                let text   = match[2];
                await this.sendMessage(
                    msg.chat.id,
                    UI.debt.text(text, amount, msg.from.username),
                    UI.debt.keyboard(text, amount)
                );
                console.log('\namount :', amount);
            } else {
                await this.sendMessage(
                    msg.chat.id,
                    UI.debt.amount_overflow_text()
                );
            }
        } catch (error) {
            console.log(error);
        }
    }

    async inlineDebt(query : TelegramBot.InlineQuery) : Promise<void> {
        let match = query.query.match(debtRegexp);
        if (match[1].length >= digitsLimit) {
            await this.emptyInline(query);
            return;
        }
        let offer = {
            from   : query.from.username,
            amount : parseInt(match[1]),
            text   : match[2]
        };
        let answer_main = this.debtArticle(offer);
        offer.amount = -offer.amount;
        let answer_addend = this.debtArticle(offer);
        try {
            await this.answerInlineQuery(query.id, [
                answer_main,
                answer_addend
            ]);
        } catch (error) {
            console.log(error);
        }
    }

    debtArticle(offer : TextedOffer) : TelegramBot.InlineQueryResultArticle {
        return {
            type: 'article',
            id: (offer.amount > 0 ? '+' : '') + String(offer.amount),
            title: UI.debt.article.title(offer.amount),
            input_message_content: {
                message_text: UI.debt.text(
                    offer.text,
                    offer.amount,
                    offer.from
                )
            },
            reply_markup: UI.debt.article.keyboard()
        };
    }

    async onOfferClick(query : TelegramBot.CallbackQuery) : Promise<void> {
        try {
            let offer = toOffer(
                await this.dataBase.getOffer(
                    query.inline_message_id
                ),
                query.from.username,
                query.data === '1'
            );
            if (offer.to == offer.from) {
                if (offer.accept) {
                    await this.answerCallbackQuery(
                        query.id,
                        { text: UI.deal.self_accept_text() }
                    );
                } else {
                    await this.editMessageText(
                        UI.deal.cancel_text(offer.from),
                        { inline_message_id: query.inline_message_id }
                    );
                    await this.dataBase.deleteOffer(
                        query.inline_message_id
                    );
                }
            } else {
                await this.editMessageText(
                    UI.deal.text(offer),
                    { inline_message_id: query.inline_message_id }
                );
                await this.dataBase.deleteOffer(
                    query.inline_message_id
                );
                if (offer.accept)
                    await this.dataBase.saveDebt(offer);
            }
        } catch (error) {
            console.log(error);
        }
    }

    async onInline(query : TelegramBot.InlineQuery) : Promise<void> {
        if (debtRegexp.test(query.query))
            await this.inlineDebt(query);
        else if (query.query == 'share' || query.query == '')
            await this.inlineShare(query);
        else
            await this.emptyInline(query);
    }

    async emptyInline(query : TelegramBot.InlineQuery) : Promise<void> {
        try {
            await this.answerInlineQuery(query.id, []);
        } catch (error) {
            console.log(error);
        }
    }

    async onChosenInlineResult(result : TelegramBot.ChosenInlineResult) : Promise<void> {
        if (result.query != '') try {
            await this.dataBase.saveOffer(
                result.inline_message_id,
                {
                    from   : result.from.username,
                    amount : parseInt(result.result_id)
                }
            );
        } catch (error) {
            console.log(error);
        }
    }

    async onExpiredOffer(id: string): Promise<void> {
        await this.editMessageText(
            UI.deal.expire_text(),
            { inline_message_id: id }
        );
    }

    async onButton(query : TelegramBot.CallbackQuery) : Promise<void> {
        if (query.data == 'update')
            await this.updateStats(query);
        else
            await this.onOfferClick(query);
    }
};
