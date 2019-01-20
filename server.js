const http = require('http');

const server = 'tg-debts-bot.herokuapp.com:443';

const token  = process.env.TG_BOT_TOKEN;
console.log('TG_BOT_TOKEN:', token);

const Bot = require('./lib/bot')(require('node-telegram-bot-api'));
var bot = new Bot(token, 'https://' + server);

const db_url = process.env.DATABASE_URL;
console.log('DATABASE_URL:', db_url);

const WrapperFactory = require('./lib/db-wrapper');
const Client = new WrapperFactory(require('pg').Client);
Client.makeWrapper(db_url)
    .then(client => {
        bot.setDataBase(client);

        // keeps server awake
        setInterval(() => {
            http.get('http://' + server);
        }, 30 * 60 * 1000);  // every 30 minutes
    })
    .catch(error => {
        console.log(error);
    });
