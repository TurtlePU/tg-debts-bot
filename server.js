const http = require('http');

const Bot      = require('./lib/bot');
const DBClient = require('./lib/db-wrapper');
const Cipher   = require('./lib/cipher');

const token  = process.env.TG_BOT_TOKEN;
const url    = process.env.APP_URL;
const port   = process.env.PORT;
const db_url = process.env.DATABASE_URL;
const name   = process.env.BOT_NAME;

const cipher_key = process.env.CIPHER_KEY;
const cipher_iv  = process.env.CIPHER_IV;

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
client.start()
    .then(() => {
        const bot = new Bot(token, 'https://' + url, port);

        bot.setName(name);
        bot.setDataBase(client);

        bot.setCipher(new Cipher({
            key : cipher_key,
            iv  : cipher_iv
        }));

        bot.start();
    })
    .catch(error => {
        console.log('\n', error);
    });

// keeps server awake
setInterval(() => {
    http.get('http://' + url);
}, 10 * 60 * 1000);  // every 10 minutes
