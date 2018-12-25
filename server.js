const RETRY_ATTEMPTS = 1;
const retry = (count) => require('fs').readFile('private/token', startBot(count));

const startBot = (count) => (err, token) => {
    if (err) {
        console.log('Failed to read from file:');
        console.log(err);
        if (count) {
            retry(count - 1);
        } else {
            console.log('No attempts left');
            throw err;
        }
    }

    const Bot = require('lib/bot.js')(require('node-telegram-bot-api'));
    var bot = new Bot(token);
}

retry(RETRY_ATTEMPTS);