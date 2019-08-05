"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const ui_1 = __importDefault(require("./ui"));
const debtRegexp = /(-?\d+)(.+)?/;
const digitsLimit = 9;
class DebtBot extends node_telegram_bot_api_1.default {
    constructor(options) {
        let { dataBase, name, port, token } = options;
        super(token, { webHook: { port } });
        this.name = name;
        this.token = token;
        this.dataBase = dataBase;
    }
    async start(url) {
        this.onText(/\/start/, (msg) => {
            this.onStart(msg);
        });
        this.onText(/\/help/, (msg) => {
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
            this.onChosenInlineResult(result);
        });
        this.dataBase.on('expired_offer', (id) => {
            this.onExpiredOffer(id);
        });
        await this.dataBase.restartOffers();
        this.on('callback_query', (query) => {
            this.onButton(query);
        });
        await this.setWebHook(`${url}/bot${this.token}`);
    }
    async onStart(msg) {
        try {
            await this.sendMessage(msg.chat.id, ui_1.default.start.text(), {
                parse_mode: 'Markdown'
            });
        }
        catch (error) {
            console.log(error);
        }
    }
    async onHelp(msg) {
        try {
            await this.sendMessage(msg.chat.id, ui_1.default.help.text(this.name), {
                parse_mode: 'Markdown'
            });
        }
        catch (error) {
            console.log(error);
        }
    }
    async onShare(msg) {
        try {
            await this.sendMessage(msg.chat.id, ui_1.default.share.text(this.name), Object.assign({}, ui_1.default.share.keyboard(), { parse_mode: 'Markdown' }));
        }
        catch (error) {
            console.log(error);
        }
    }
    async inlineShare(query) {
        try {
            await this.answerInlineQuery(query.id, [this.shareArticle()]);
        }
        catch (error) {
            console.log(error);
        }
    }
    shareArticle() {
        return {
            type: 'article',
            id: '0',
            title: ui_1.default.share.article.title(),
            input_message_content: {
                message_text: ui_1.default.share.text(this.name),
                parse_mode: 'Markdown'
            }
        };
    }
    async onStats(msg) {
        try {
            let stats = await this.dataBase.getStats(msg.from.username);
            await this.sendMessage(msg.chat.id, ui_1.default.stats.text(stats), Object.assign({}, ui_1.default.stats.keyboard()));
        }
        catch (error) {
            console.log(error);
        }
    }
    async updateStats(query) {
        try {
            let stats = await this.dataBase.getStats(query.from.username);
            await Promise.all([
                this.deleteMessage(query.message.chat.id, String(query.message.message_id)),
                this.answerCallbackQuery(query.id, { text: ui_1.default.stats.callback_answer_text() }),
                this.sendMessage(query.message.chat.id, ui_1.default.stats.text(stats), Object.assign({}, ui_1.default.stats.keyboard()))
            ]);
        }
        catch (error) {
            console.log(error);
        }
    }
    async onDebt(msg, match) {
        try {
            if (match[1].length < digitsLimit) {
                let amount = Number(match[1]);
                let text = match[2];
                await this.sendMessage(msg.chat.id, ui_1.default.debt.text(text, amount), Object.assign({}, ui_1.default.debt.keyboard(text, amount), { parse_mode: 'Markdown' }));
                console.log('\namount :', amount);
            }
            else {
                await this.sendMessage(msg.chat.id, ui_1.default.debt.amount_overflow_text(), {
                    parse_mode: 'Markdown'
                });
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    async inlineDebt(query) {
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
        }
        catch (error) {
            console.log(error);
        }
    }
    debtArticle(amount, text) {
        return {
            type: 'article',
            id: `${amount > 0 ? '+' : ''}${amount}`,
            title: ui_1.default.debt.article.title(amount),
            input_message_content: {
                message_text: ui_1.default.debt.text(text, amount),
                parse_mode: 'Markdown'
            },
            reply_markup: ui_1.default.debt.article.keyboard()
        };
    }
    async onOfferClick(query) {
        try {
            let { from, amount } = await this.dataBase.getOffer(query.inline_message_id);
            let to = query.from.username;
            let accept = query.data == '1';
            if (to == from) {
                if (accept) {
                    await this.answerCallbackQuery(query.id, { text: ui_1.default.deal.self_accept_text() });
                }
                else {
                    await this.editMessageText(ui_1.default.deal.cancel_text(), {
                        inline_message_id: query.inline_message_id,
                        parse_mode: 'Markdown'
                    });
                    await this.dataBase.deleteOffer(query.inline_message_id);
                }
            }
            else {
                await this.editMessageText(ui_1.default.deal.text(from, amount, to, accept), {
                    inline_message_id: query.inline_message_id,
                    parse_mode: 'Markdown'
                });
                await this.dataBase.deleteOffer(query.inline_message_id);
                if (accept) {
                    await this.dataBase.saveDebt(from, amount, to);
                }
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    async onInline(query) {
        if (debtRegexp.test(query.query)) {
            await this.inlineDebt(query);
        }
        else if (query.query === '') {
            await this.inlineShare(query);
        }
        else {
            await this.emptyInline(query);
        }
    }
    async emptyInline(query) {
        try {
            await this.answerInlineQuery(query.id, []);
        }
        catch (error) {
            console.log(error);
        }
    }
    async onChosenInlineResult(result) {
        if (result.query != '') {
            try {
                await this.dataBase.saveOffer(result.inline_message_id, {
                    from: result.from.username,
                    amount: +result.result_id
                });
            }
            catch (error) {
                console.log(error);
            }
        }
    }
    async onExpiredOffer(id) {
        await this.editMessageText(ui_1.default.deal.expire_text(), {
            inline_message_id: id,
            parse_mode: 'Markdown'
        });
    }
    async onButton(query) {
        if (query.data === 'update') {
            await this.updateStats(query);
        }
        else {
            await this.onOfferClick(query);
        }
    }
}
exports.default = DebtBot;
