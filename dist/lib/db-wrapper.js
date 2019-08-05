"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const offerExpireTime = 60 * 60 * 1000; // after 1 hour
class MyClient extends pg_1.Client {
    constructor(connection_string) {
        super({
            connectionString: connection_string,
            ssl: true
        });
    }
    async start() {
        await this.connect();
        console.log('\nSuccessfully connected to database');
        await this.query(`
            create table if not exists stte(
                id integer primary key,
                state smallint
            )`);
        console.log('\nCreated table of states if not exists');
        await this.query(`
            create table if not exists offr(
                id varchar(255) primary key,
                from_name varchar(32),
                amount integer,
                make_time timestamp
            )`);
        console.log('\nCreated table of offers if not exists');
        return this;
    }
    async restartOffers() {
        let offers = (await this.query('select * from offr')).rows;
        let now = Date.now();
        offers.forEach(offer => {
            let expires = offer.make_time.getTime() + offerExpireTime;
            this.expireOffer(offer.id, {
                from: offer.from_name,
                amount: offer.amount
            }, Math.max(expires - now, 0));
        });
    }
    async saveOffer(id, offer) {
        await this.query('insert into offr values($1, $2, $3, $4)', [id, offer.from, offer.amount, new Date()]);
        console.log('saved offer:', offer, '\non id =', id);
        this.expireOffer(id, offer, offerExpireTime);
    }
    async getOffer(id) {
        console.log('getting offer on id =', id);
        let query = await this.query('select * from offr where id = $1', [id]);
        if (query.rowCount === 0)
            throw new Error(`Offer not found. ID = ${id}`);
        let result = query.rows[0];
        console.log('got offer:', result);
        return {
            from: result.from_name,
            amount: result.amount
        };
    }
    async deleteOffer(id) {
        console.log('trying to delete offer on id =', id);
        let { rowCount } = await this.query('delete from offr where id = $1', [id]);
        return rowCount > 0;
    }
    async saveDebt(from, amount, to) {
        if (amount == 0) {
            return;
        }
        await Promise.all([
            this.insert(from, amount, to),
            this.insert(to, -amount, from)
        ]);
    }
    async getStats(name) {
        await this.tryMake(name);
        let table = (await this.query(`select * from ${name}`)).rows;
        console.log('\nGot stats');
        return table.map(row => (Object.assign({}, row, { to: row.to_name })));
    }
    async tryMake(name) {
        await this.query(`
            create table if not exists ${name}(
                to_name varchar(32) primary key,
                amount integer
            )`);
        console.log(`\nCreated table ${name} if not exists`);
    }
    expireOffer(id, offer, expireTime) {
        setTimeout(async () => {
            let deleted = await this.deleteOffer(id);
            if (deleted) {
                console.log('offer expired:', offer, '\non id =', id);
                this.emit('expired_offer', id, offer);
            }
        }, expireTime);
    }
    async insert(from, amount, to) {
        await this.tryMake(from);
        let debtQuery = await this.query(`select amount from ${from} where to_name = $1`, [to]);
        amount += debtQuery.rowCount > 0
            ? debtQuery.rows[0].amount
            : 0;
        console.log('new amount:', amount);
        if (amount !== 0) {
            await this.query(`insert into ${from} values ($1, $2)`
                + 'on conflict (to_name) do update set amount = $2', [to, amount]);
            console.log('set or updated debt');
        }
        else {
            await this.query(`delete from ${from} where to_name = $1`, [to]);
            console.log('deleted debt');
            let isEmpty = !(await this.query(`select exists(select * from ${from}) as result`)).rows[0].result;
            if (isEmpty) {
                await this.query(`drop table ${name}`);
                console.log('dropped table');
            }
            else {
                console.log('saved table');
            }
        }
    }
}
exports.default = MyClient;
;
