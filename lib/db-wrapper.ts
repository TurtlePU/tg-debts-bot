import { Client, QueryConfig } from 'pg';
import { BotPostgreClient, Offer, OfferTemplate, StatsRow } from './common_types';

const offerExpire = 60 * 60 * 1000; // after hour

export default class MyClient extends Client implements BotPostgreClient {
    constructor(DB_URL: string) {
        super({
            connectionString: DB_URL,
            ssl: true
        });
    }

    async unitQuery(sql: string | QueryConfig): Promise<any> {
        let table = await this.query(sql);
        if (table.rows.length)
            return table.rows[0].result;
        else
            return 0;
    }

    async start(): Promise<this> {
        await this.connect();
        console.log('\nSuccessfully connected to database');
        await this.query(`
            create table if not exists stte(
                id bigint primary key,
                state smallint
            )`
        );
        console.log('\nCreated table of states if not exists');
        await this.query(`
            create table if not exists offr(
                id varchar(255) primary key,
                from_name varchar(32),
                amount bigint
            )`
        );
        console.log('\nCreated table of offers if not exists');
        return this;
    }

    async saveOffer(id: string, offer: OfferTemplate): Promise<void> {
        await this.query(`
            insert into offr
            values (
                '${id}',
                '${offer.from}',
                ${offer.amount}
            )`
        );
        setTimeout(async () => {
            let deleted = await this.deleteOffer(id);
            if (deleted)
                this.emit('expired_offer', id);
        }, offerExpire);
    }

    async getOffer(id: string): Promise<OfferTemplate> {
        let query = await this.query(`
            select *
            from offr
            where id = ${id}
            limit 1`
        );
        if (query.rowCount === 0)
            throw new Error(`Offer not found. ID = ${id}`);
        let result = query.rows[0];
        return {
            from: result.from_name,
            amount: result.amount
        };
    }

    async deleteOffer(id: string): Promise<boolean> {
        let count = await this.unitQuery(`
            delete
            from offr
            as result
            where id = ${id}`
        );
        return count !== 0;
    }

    async tryMake(name: string): Promise<void> {
        await this.query(`
            create table if not exists ${name}(
                to_name varchar(32) primary key,
                amount bigint
            )`
        );
        console.log(`\nCreated table ${name} if not exists`);
    }

    async saveDebt(offer: Offer): Promise<void> {
        let from   = offer.from,
            amount = offer.amount,
            to     = offer.to;
        console.log('\nSaving debt...');
        await Promise.all([
            this.insert(from, amount, to),
            this.insert(to, -amount, from)
        ]);
    }

    async insert(
        from:   string,
        amount: number,
        to:     string
    ): Promise<void> {
        await this.tryMake(from);
        let debtExists = await this.unitQuery(`
            select exists(
                select *
                from ${from}
                where to_name = '${to}'
            ) as result`
        );
        if (debtExists) {
            console.log('\nDebt exists');
            let oldAmount = parseInt(await this.unitQuery(`
                select amount
                as result
                from ${from}
                where to_name = '${to}'`
            ));
            console.log('\n', this.amounts(amount, oldAmount));
            if (oldAmount + amount == 0) {
                console.log('\nDeleting debt...');
                await this.query(`
                    delete
                    from ${from}
                    where to_name = '${to}'`
                )
                let notEmpty = await this.unitQuery(`
                    select exists(
                        select *
                        from ${from}
                    ) as result`
                );
                if (!notEmpty) {
                    console.log('\nDeleting table...');
                    await this.query(`drop table ${from}`);
                }
            } else {
                console.log('\nUpdating debt...');
                await this.query(`
                    update ${from}
                    set amount = ${oldAmount + amount}
                    where to_name = '${to}'`
                );
            }
        } else if (amount != 0) {
            console.log('\nMaking new debt...');
            await this.query(`
                insert into ${from}
                values ('${to}', ${amount})`
            );
        } else {
            console.log('\n0-debts are not worth saving');
        }
    };

    amounts(
        amount:     number,
        old_amount: number
    ): string {
        return ''
            + `amount     : ${amount}\n`
            + `old_amount : ${old_amount}\n`
            + `sum        : ${amount + old_amount}`;
    };

    async getStats(name: string): Promise<StatsRow[]> {
        await this.tryMake(name);
        let table = (await this.query(`select * from ${name}`)).rows;
        console.log('\nGot stats');
        return table;
    }

    async setState(
        chatID: number,
        state:  number
    ): Promise<void> {
        await this.query(`
            insert into stte
            values (${chatID}, ${state})
            on conflict (id) do update
                set state = ${state}`
        );
    }

    async checkState(
        chatID:   number,
        reqState: number
    ): Promise<boolean> {
        let hasState = await this.unitQuery(`
            select exists(
                select *
                from stte
                where id = ${chatID}
            ) as result`
        );
        if (hasState) {
            let state = await this.unitQuery(`
                select state
                as result
                from stte
                where id = ${chatID}`
            );
            return new Number(state) == reqState;
        } else return false;
    }
};
