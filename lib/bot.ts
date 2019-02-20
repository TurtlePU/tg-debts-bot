import Bot = require('node-telegram-bot-api');
import UI  = require('./ui');

const debtRegexp  = /(-?\d+)(.+)?/;
const digitsLimit = 9;

import {
    BotType,
    BotOptions,
    BotPostgreClient,
    OfferEncoder,
    TextedOffer,
    OfferOption,
    Offer
} from './common_types';

function toOffer(offerOption : OfferOption) : Offer {
    return {
        from   : offerOption.from,
        amount : offerOption.amount,
        accept : offerOption.accept,
        to     : ''
    };
}

export = class DebtBot extends Bot implements BotType {
    token : string;
    url   : string;
    name  : string;
    dataBase : BotPostgreClient;
    cipher   : OfferEncoder;
    articleID : number;

    nextArticleID() : number { return this.articleID++; }

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
        this.url      = options.url;
        this.name     = options.name;
        this.dataBase = options.dataBase;
        this.cipher   = options.cipher;

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

    async onStart(msg : Bot.Message) : Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.start.text()
            );
        } catch (error) {
            console.log(error);
        }
    }

    async onHelp(msg : Bot.Message) : Promise<void> {
        try {
            await this.sendMessage(
                msg.chat.id,
                UI.help.text(this.name)
            );
        } catch (error) {
            console.log(error);
        }
    }

    async onShare(msg : Bot.Message) : Promise<void> {
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

    async inlineShare(query : Bot.InlineQuery) : Promise<void> {
        try {
            await this.answerInlineQuery(query.id, [this.shareArticle()]);
        } catch (error) {
            console.log(error);
        }
    }

    shareArticle() : Bot.InlineQueryResultArticle {
        return {
            type: 'article',
            id: String(this.nextArticleID()),
            title: UI.share.article.title(),
            input_message_content: {
                message_text: UI.share.text(this.name)
            }
        };
    }

    async onStats(msg : Bot.Message) : Promise<void> {
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

    async updateStats(query : Bot.CallbackQuery) : Promise<void> {
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

    async onDebt(msg : Bot.Message, match : RegExpExecArray) : Promise<void> {
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

    async inlineDebt(query : Bot.InlineQuery) : Promise<void> {
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
            ], { cache_time: 0 });
        } catch (error) {
            console.log(error);
        }
    }

    debtArticle(offer : TextedOffer) : Bot.InlineQueryResultArticle {
        return {
            type: 'article',
            id: String(this.nextArticleID()),
            title: UI.debt.article.title(offer.amount),
            input_message_content: {
                message_text: UI.debt.text(
                    offer.text,
                    offer.amount,
                    offer.from
                )
            },
            reply_markup: UI.debt.article.keyboard(
                this.cipher.encode(offer, true),
                this.cipher.encode(offer, false)
            )
        };
    }

    async onOfferClick(query : Bot.CallbackQuery) : Promise<void> {
        let offer = toOffer(this.cipher.decode(query.data));
        offer.to = query.from.username;
        try {
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
                }
            } else {
                await this.editMessageText(
                    UI.deal.text(offer),
                    { inline_message_id: query.inline_message_id }
                );
                if (offer.accept)
                    await this.dataBase.saveDebt(offer);
            }
        } catch (error) {
            console.log(error);
        }
    }

    async onInline(query : Bot.InlineQuery) : Promise<void> {
        if (debtRegexp.test(query.query))
            await this.inlineDebt(query);
        else if (query.query == 'share' || query.query == '')
            await this.inlineShare(query);
        else
            await this.emptyInline(query);
    }

    async emptyInline(query : Bot.InlineQuery) : Promise<void> {
        try {
            await this.answerInlineQuery(query.id, []);
        } catch (error) {
            console.log(error);
        }
    }

    async onButton(query : Bot.CallbackQuery) : Promise<void> {
        if (query.data == 'update')
            await this.updateStats(query);
        else
            await this.onOfferClick(query);
    }
};
