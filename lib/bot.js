const BaseBot = require('node-telegram-bot-api');
const UI = require('./ui');

const debtRegexp  = /(-?\d+)(.+)?/;
const digitsLimit = 9;

class Bot extends BaseBot {
    constructor(options) {
        super(options.token, { webHook: { port: options.port } });

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

    get articleID() { return this.articleID++; }
    set articleID(articleID) { this.articleID = articleID; }

    async onStart(msg) {
        try {
            await this.sendMessage(msg.chat.id, UI.start.text());
        } catch (error) {
            console.log(error);
        }
    }

    async onHelp(msg) {
        try {
            await this.sendMessage(msg.chat.id, UI.help.text(this.name));
        } catch (error) {
            console.log(error);
        }
    }

    async onShare(msg) {
        try {
            await this.sendMessage(msg.chat.id, UI.share.text(this.name), UI.share.keyboard);
        } catch (error) {
            console.log(error);
        }
    }

    async inlineShare(query) {
        try {
            await this.answerInlineQuery(query.id, [{
                type: 'article',
                id: this.articleID,
                title: UI.share.article.title,
                input_message_content: {
                    message_text: UI.share.text(this.name)
                }
            }]);
        } catch (error) {
            console.log(error);
        }
    }

    async onStats(msg) {
        try {
            let stats = await this.dataBase.getStats(msg.from.username);
            await this.sendMessage(msg.chat.id, UI.stats.text(stats), UI.stats.keyboard);
        } catch(error) {
            console.log(error);
        }
    }

    async updateStats(query) {
        try {
            let stats = await this.dataBase.getStats(query.from.username);
            await Promise.all([
                this.deleteMessage(query.message.chat.id, query.message.message_id),
                this.answerCallbackQuery(query.id, { text: UI.stats.callback_answer_text }),
                this.sendMessage(query.message.chat.id, UI.stats.text(stats), UI.stats.keyboard)
            ]);
        } catch(error) {
            console.log(error);
        }
    }

    async onDebt(msg, match) {
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
                    UI.debt.amount_overflow_text
                );
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
            amount: Number(match[1]),
            text: match[2]
        };
        let answer_main = debtArticle(offer);
        offer.amount = -offer.amount;
        let answer_addend = debtArticle(offer);
        try {
            await this.answerInlineQuery(query.id, [
                answer_main,
                answer_addend
            ], { cache_time: 0 });
        } catch (error) {
            console.log(error);
        }
    }

    debtArticle(offer) {
        return {
            type: 'article',
            id: this.articleID,
            title: UI.debt.article.title(offer.amount),
            input_message_content: {
                message_text: UI.debt.text(offer.text, offer.amount, offer.from)
            },
            reply_markup: UI.debt.article.keyboard(
                this.cipher.encode(offer, true),
                this.cipher.encode(offer, false)
            )
        };
    }

    async onOfferClick(query) {
        let offer = this.cipher.decode(query.data);
        offer.to = query.from.username;
        try {
            if (offer.to == offer.from) {
                if (offer.accept) {
                    await this.answerCallbackQuery(
                        query.id,
                        { text: UI.deal.self_accept_text }
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

if (module) module.exports = Bot;
