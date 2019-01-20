const http    = require('http');
const BaseBot = require('node-telegram-bot-api');
const PostGre = require('pg');

const BotFactory   = require('./lib/bot');
const DBCliFactory = require('./lib/db-wrapper');

const token  = process.env.TG_BOT_TOKEN;
const url    = process.env.APP_URL;
const port   = process.env.PORT;
const db_url = process.env.DATABASE_URL;
const name   = process.env.BOT_NAME;

console.log('TG_BOT_TOKEN:', token);
console.log('APP_URL:', url);
console.log('PORT:', port);
console.log('DATABASE_URL:', db_url);
console.log('BOT_NAME:', name);

const Client = new DBCliFactory(PostGre.Client);
Client.makeWrapper(db_url)
    .then(client => {
        const Bot = BotFactory(BaseBot);
        var bot = new Bot(token, 'https://' + url, port);

        bot.setDataBase(client);
        bot.setName(name);

        // keeps server awake
        setInterval(() => {
            http.get('http://' + server);
        }, 10 * 60 * 1000);  // every 10 minutes
    })
    .catch(error => {
        console.log(error);
    });
