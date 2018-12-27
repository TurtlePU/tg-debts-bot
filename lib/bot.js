var debtMsg = (debt, to, accept) => `Debt ${debt ? 'from' : 'to'} @${to} ${accept ? 'accepted' : 'declined'}, deal closed`;

const BotFactory = (BaseBot) => function Bot(token) {
    var bot = new BaseBot(token, { webHook : { port : process.env.PORT } });

    const url = process.env.APP_URL || `https://tg-debts-bot.herokuapp.com:443`;
    bot.setWebHook(`${url}/bot${token}`);

    var chats = new Map();  // chat id by username
    var debts = new Map();  // debts by username (inner key --- username)
    var deals = new Map();  // deals by username (inner key --- username)

    var deleteUser = (name) => {
        chats.delete(name);

        debts.get(name).forEach((_, debtor) => debts.get(debtor).delete(name));
        debts.delete(name);

        deals.get(name).forEach((_, dealer) => deals.get(dealer).delete(name));
        deals.delete(name);
    }

    var notifyDeletion = (name, notify) => {
        console.log(`deleting @${name}`);
        if (notify)
            bot.tailMessage(notify, `@${name} doesn't use this bot`);
        deleteUser(name);
    }

    bot.tailMessage = (name, text, notify) => {
        console.log(chats.get(name));
        bot
        .sendMessage(chats.get(name), text)
        .then(null, notifyDeletion(name, notify));
    }

    bot.onText(/\/start/, (msg, match) => {
        let name = msg.from.username;
        chats.set(name, msg.chat.id);
        bot.tailMessage(name, 'Hi');
    });

    bot.onText(/\/debt/, (msg, match) => {
        bot.tailMessage(msg.from.username,
            `Syntax: "/debt @username *n*".\n` +
            `Asks @username for a debt in amount of *n* (*n* > 0) or to owe you in amount of *-n*`);
    });

    bot.onText(/\/debt @(\w+) (-?[0-9]*\.[0-9]{2})/, (msg, match) => {
        let from = msg.from.username;
        let fromId = msg.chat.id;
        let to = match[1];
        let toId = chats.get(to);

        if (!toId) {
            bot.tailMessage(from, `@${to} doesn't use this bot`);
        } else if (toId == fromId) {
            bot.tailMessage(from, `You can't owe yourself`);
        } else {
            bot.sendMessage(toId, 'ping').then(
                (ping) => {
                    bot.deleteMessage(toId, ping.message_id);

                    var toDeals = deals.get(to);
                    if (!toDeals)
                        deals.set(to, toDeals = new Map());

                    if (!!toDeals.get(from)) {
                        bot
                        .sendMessage(fromId, `One pair can't have more than one deal at a time`)
                        .then(() => bot.tailMessage(to, `Remind: you have open deal with @${from}`));
                    } else {
                        var amount = Number(match[2]);
                        toDeals.set(from, amount);

                        bot
                        .sendMessage(toId, `${amount > 0 ? `@${from} owes you ${amount}` : `you owe ${amount} to @${from}`}. Is that right?`)
                        .then(() => bot.tailMessage(from, 'Debt request sent'));
                    }
                },
                () => bot.notifyDeletion(to, from)
            );
        }
    });

    bot.onText(/\/accept/, (msg, match) => {
        bot.tailMessage(msg.from.username,
            `Syntax: "/accept @username".\n` +
            `Makes new debt (or owe) proposed by @username.`);
    });

    bot.onText(/\/decline/, (msg, match) => {
        bot.tailMessage(msg.from.username,
            `Syntax: "/decline @username".\n` +
            `Declines new debt (or owe) proposed by @username.`);
    });

    var adAct = (accept) => (msg, match) => {
        let from = msg.from.username;
        let myDeals = deals.get(from);

        if (!myDeals) {
            bot.tailMessage(from, `You don't have any open deals right now`);
        } else {
            let to = match[1];
            let amount = myDeals.get(to);

            let fromId = msg.chat.id;

            if (!amount) {
                bot.sendMessage(fromId, `You don't have an open deal with @${to}`);
            } else {
                var toId = chats.get(to);

                bot.sendMessage(toId, 'ping').then(
                    (ping) => {
                        bot.deleteMessage(toId, ping.message_id);

                        if (accept) {
                            let fromDebts = debts.get(from);
                            if (!fromDebts)
                                debts.set(from, fromDebts = new Map());

                            let toDebts = debts.get(to);
                            if (!toDebts)
                                debts.set(to, toDebts = new Map());

                            fromDebts.set(to, fromDebts.get(to) + amount);
                            toDebts.set(from, toDebts.get(from) - amount);
                        }

                        myDeals.delete(to);

                        bot
                        .sendMessage(fromId, debtMsg(amount > 0, to, accept))
                        .then(() => bot.tailMessage(to, debtMsg(amount < 0, msg.from.username, accept), from));
                    },
                    () => bot.notifyDeletion(to, from)
                );
            }
        }
    };

    bot.onText(/\/accept @(\w+)/, adAct(true));
    bot.onText(/\/decline @(\w+)/, adAct(false));

    var statsMsg = (name) => {
        let result = 'Debts:\n';

        if (!debts.empty())
            debts.get(name).forEach((amount, debtor) => result += `\n@${debtor} ${amount}`);
        else
            result += '\nno debts, no owes.';

        result += '\n\nDeals:\n';

        if (!deals.empty())
            deals.get(name).forEach((amount, dealer) => result += `\n@${dealer} ${amount}`);
        else
            result += '\nno deals.';

        return result;
    }

    bot.onText(/\/stats/, (msg, match) => {
        let name = msg.from.username;
        bot.tailMessage(name, statsMsg(name));
    });

    return bot;
}

if (module) module.exports = BotFactory;
