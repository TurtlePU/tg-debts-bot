import http from 'http';

import Bot from './lib/bot';
import DBClient from './lib/neo4j';

// Use .env config if present
import dotenv from 'dotenv';
dotenv.config();

const url  = process.env.APP_URL;        // server url
const port = +process.env.PORT || 8080;  // server port

const token = process.env.TG_BOT_TOKEN;            // your token
const name  = process.env.BOT_NAME || 'debt_bot';  // goes after @, between 5 & 32 chars long

const db_url  = process.env.GRAPHENEDB_BOLT_URL;       // url of neo4j db
const db_user = process.env.GRAPHENEDB_BOLT_USER;      // user in db
const db_pass = process.env.GRAPHENEDB_BOLT_PASSWORD;  // password of user

console.log(
    '\nAPP_URL :', url,
    '\nPORT    :', port,
    '\n==============================================',
    '\nTG_BOT_TOKEN :', token,
    '\nBOT_NAME     :', name,
    '\n==============================================',
    '\nBOLT_URL  :', db_url,
    '\nBOLT_USER :', db_user,
    '\nBOLT_PASS :', db_pass,
);

async function init() {
    const dataBase = new DBClient(
        db_url,
        {
            user: db_user,
            password: db_pass
        }
    );
    await dataBase.start();
    const bot = new Bot({
        token, name, port, dataBase
    });
    await bot.start('https://' + url);
};

init();

// keeps server awake
setInterval(() => {
    http.get('http://' + url);
}, 10 * 60 * 1000);  // every 10 minutes
