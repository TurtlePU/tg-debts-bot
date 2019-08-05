"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const bot_1 = __importDefault(require("./lib/bot"));
const db_wrapper_1 = __importDefault(require("./lib/db-wrapper"));
// Use .env config if present
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const token = process.env.TG_BOT_TOKEN; // your token
const db_url = process.env.DATABASE_URL; // PostgreSQL connection string
const url = process.env.APP_URL; // server url
const name = process.env.BOT_NAME || 'debt_bot'; // goes after @, between 5 & 32 chars long
const port = +process.env.PORT || 8080;
console.log('\nTG_BOT_TOKEN :', token, '\nAPP_URL      :', url, '\nPORT         :', port, '\nDATABASE_URL :', db_url, '\nBOT_NAME     :', name);
async function init() {
    const dataBase = new db_wrapper_1.default(db_url);
    await dataBase.start();
    const bot = new bot_1.default({
        token, name, port, dataBase
    });
    await bot.start('https://' + url);
}
;
init();
// keeps server awake
setInterval(() => {
    http_1.default.get('http://' + url);
}, 10 * 60 * 1000); // every 10 minutes
