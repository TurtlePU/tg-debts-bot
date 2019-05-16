import http from 'http';

import Bot      from './lib/bot';
import DBClient from './lib/db-wrapper';

// Use .env config if present
import dotenv from 'dotenv';
dotenv.config();

const token  = process.env.TG_BOT_TOKEN;            // your token
const db_url = process.env.DATABASE_URL;            // PostgreSQL connection string
const url    = process.env.APP_URL;                 // server url
const port   = process.env.PORT     || '8080';      // port to listen to connections
const name   = process.env.BOT_NAME || 'debt_bot';  // goes after @, between 5 & 32 chars long

console.log(
    '\nTG_BOT_TOKEN :', token,
    '\nAPP_URL      :', url,
    '\nPORT         :', port,
    '\nDATABASE_URL :', db_url,
    '\nBOT_NAME     :', name
);

async function init() {
    const client = new DBClient(db_url);
    await client.start();
    const bot = new Bot({
        token: token,
        port: +port,
        name:  name,
        dataBase: client
    });
    await bot.start('https://' + url);
};

init();

// keeps server awake
setInterval(() => {
    http.get('http://' + url);
}, 10 * 60 * 1000);  // every 10 minutes
