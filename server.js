const fs = require('fs');

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

        const Bot = require('./lib/bot')(require('node-telegram-bot-api'));
        var bot = new Bot(token);
    }
}

retry(RETRY_ATTEMPTS);
