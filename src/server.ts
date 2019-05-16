import http from 'http';

import Bot      from './lib/bot';
import DBClient from './lib/db-wrapper';

const token  = process.env.TG_BOT_TOKEN || 'your token';
const url    = process.env.APP_URL      || 'server url';
const port   = process.env.PORT         || '8080';
const db_url = process.env.DATABASE_URL || 'PostgreSQL database url';
const name   = process.env.BOT_NAME     || 'debt_bot'; // goes after @, between 5 & 32 chars long

console.log(
    '\nTG_BOT_TOKEN :', token,
    '\nAPP_URL      :', url,
    '\nPORT         :', port,
    '\nDATABASE_URL :', db_url,
    '\nBOT_NAME     :', name
);

async function init() {
    try {
        const client = new DBClient(db_url);
        await client.start();
        const bot = new Bot({
            token: token,
            port:  parseInt(port),
            name:  name,
            dataBase: client
        });
        await bot.start('https://' + url);
    } catch(error) {
        console.log(error);
    }
};

init();

// keeps server awake
setInterval(() => {
    http.get('http://' + url);
}, 10 * 60 * 1000);  // every 10 minutes
