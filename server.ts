import * as http from 'http';

import Bot      from './lib/bot';
import DBClient from './lib/db-wrapper';
import Cipher   from './lib/cipher';

const token  = process.env.TG_BOT_TOKEN || 'your token';
const url    = process.env.APP_URL      || 'server url';
const port   = process.env.PORT         || '8080';
const db_url = process.env.DATABASE_URL || 'PostgreSQL database url';
const name   = process.env.BOT_NAME     || 'debt_bot'; // goes after @, between 5 & 32 chars long

const cipher_key = process.env.CIPHER_KEY || 'exactly 24 symbols long.';
const cipher_iv  = process.env.CIPHER_IV  || 'exactly 16 chars';

console.log(
    '\nTG_BOT_TOKEN :', token,
    '\nAPP_URL      :', url,
    '\nPORT         :', port,
    '\nDATABASE_URL :', db_url,
    '\nBOT_NAME     :', name,
    '\nCIPHER_KEY   :', cipher_key,
    '\nCIPHER_IV    :', cipher_iv
);

async function init() {
    try {
        const client = new DBClient(db_url);
        await client.start();
        const cipher = new Cipher({
            key : cipher_key,
            iv  : cipher_iv
        });
        const bot = new Bot({
            token    : token,
            url      : 'https://' + url,
            port     : parseInt(port),
            name     : name,
            dataBase : client,
            cipher   : cipher
        });
        bot.start();
    } catch(error) {
        console.log(error);
    }
};

init();

// keeps server awake
setInterval(() => {
    http.get('http://' + url);
}, 10 * 60 * 1000);  // every 10 minutes
