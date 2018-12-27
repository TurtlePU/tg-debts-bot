var debtMsg = (debt, to, accept) => `Debt ${debt ? 'from' : 'to'} @${to} ${accept ? 'accepted' : 'declined'}, deal closed`;

const BotFactory = (BaseBot) => function Bot(token) {
    var bot = new BaseBot(token, { polling: true });

    var chats = new Map();  // chat id by username
    var debts = new Map();  // debts by chat id (inner key --- username)
    var deals = new Map();  // deals by chat id (inner key --- username)

    bot.onText(/\/start/, (msg, match) => {
        users.set(msg.from.username, msg.chat.id);
        bot.sendMessage(msg.chat.id, 'Hi');
    });

    bot.onText(/\/debt @(\w+) ([1-9][0-9]*)/, (msg, match) => {
        var to = match[1];
        var toChat = chats.get(to);

        if (!toChat) {
            bot.sendMessage(msg.chat.id, `@${to} doesn't use this bot`);
        } else if (toChat == msg.chat.id) {
            bot.sendMessage(msg.chat.id, `You can't owe yourself`);
        } else {
            var toDeals = deals.get(toChat);
            if (!toDeals)
                deals.set(toChat, toDeals = new Map());

            var from = msg.from.username;

            if (!!toDeals.get(from)) {
                bot
                .sendMessage(msg.chat.id, `One pair can't have more than one deal at a time`)
                .then(() => bot
                .sendMessage(toChat, `Remind: you have open deal with @${from}`));
            } else {
                var amount = Number(match[2]);
                toDeals.set(from, amount);

                bot
                .sendMessage(toChat, `@${from} owes you ${amount}. Is that right?`)
                .then(() => bot
                .sendMessage(msg.chat.id, 'Debt request sent'));
            }
        }
    });

    var adAct = (accept) => (msg, match) => {
        var myDeals = deals.get(msg.chat.id);

        if (!myDeals) {
            bot.sendMessage(msg.chat.id, `You don't have any open deals right now`);
        } else {
            var to = match[1];
            var amount = myDeals.get(to);

            if (!amount) {
                bot.sendMessage(msg.chat.id, `You don't have an open deal with @${to}`);
            } else {
                var toId = chats.get(to);

                if (accept) {
                    var myDebts = debts.get(msg.chat.id);
                    if (!myDebts)
                        debts.set(msg.chat.id, myDebts = new Map());

                    var hisDebts = debts.get(toId);
                    if (!hisDebts)
                        debts.set(toId, hisDebts = new Map());

                    myDebts.set(to, myDebts.get(to) + amount);
                    hisDebts.set(msg.from.username, hisDebts.get(msg.from.username) - amount);
                }

                myDeals.delete(to);

                bot
                .sendMessage(msg.chat.id, debtMsg(amount > 0, to, accept))
                .then(() => bot
                .sendMessage(toId, debtMsg(amount < 0, msg.from.username, accept)));
            }
        }
    };

    bot.onText(/\/accept @(\w+)/, adAct(true));
    bot.onText(/\/decline @(\w+)/, adAct(false));

    return bot;
}

if (module) module.exports = BotFactory;
