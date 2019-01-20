const fs = require('fs');
const http = require('http');

const RETRY_ATTEMPTS = 1;
const retry = (count) => fs.readFile('private/token', startBot(count));

const startBot = (count) => (err, token) => {
    if (err) {
        console.log('Failed to read from file. Error:');
        console.log(err);

        if (count) {
            retry(count - 1);
        } else {
            console.log('No attempts left');
            throw err;
        }
    } else {
        console.log('Successfully read from file. Token:');
        console.log(token);

        const server = `https://tg-debts-bot.herokuapp.com:443`;

        const Bot = require('./lib/bot')(require('node-telegram-bot-api'));
        var bot = new Bot(token, server);

        let db_url = process.env.DATABASE_URL;

        console.log('DATABASE_URL:');
        console.log(db_url);

        const WrapperFactory = require('./lib/db-wrapper');
        const Client = new WrapperFactory(require('pg').Client);

        Client.makeWrapper(db_url)
        .then(
            client => {
                bot.setDataBase(client);

                // keeps server awake
                setInterval(() => {
                    http.get(server);
                }, 30 * 60 * 1000);  // every 30 minutes
            },
            error => console.log(error)
        );
    }
}

retry(RETRY_ATTEMPTS);
