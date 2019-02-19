const http = require('http');

const Bot      = require('./lib/bot');
const DBClient = require('./lib/db-wrapper');
const Cipher   = require('./lib/cipher');

const token  = process.env.TG_BOT_TOKEN || 'your token';
const url    = process.env.APP_URL      || 'server url';
const port   = process.env.PORT         || '8080';
const db_url = process.env.DATABASE_URL || 'PostgreSQL database url';
const name   = process.env.BOT_NAME     || 'debt_bot (goes after "at" sign)';

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

const client = new DBClient(db_url);

try {
    await client.start();
    const cipher = new Cipher({
        key : cipher_key,
        iv  : cipher_iv
    });
    const bot = new Bot({
        token    : token,
        url      : 'https://' + url,
        port     : port,
        name     : name,
        dataBase : client,
        cipher   : cipher
    });
    bot.start();
} catch(error) {
    console.log(error);
}

// keeps server awake
setInterval(() => {
    http.get('http://' + url);
}, 10 * 60 * 1000);  // every 10 minutes
