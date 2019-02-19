const BaseWrapper = require('pg').Client;

class Wrapper extends BaseWrapper {
    constructor(DB_URL) {
        super({
            connectionString: DB_URL,
            ssl: true
        });
    }

    async unitQuery(sql) {
        let table = await this.query(sql);
        if (table.rows.length)
            return table.rows[0].result;
        else
            return 0;
    }

    async start() {
        await this.connect();
        console.log('\nSuccessfully connected to database');
        await this.query(`
            create table if not exists stte(
                id bigint primary key,
                state smallint
            )`
        );
        console.log('\nCreated table of states if not exists');
        return this;
    }

    async tryMake(name) {
        await this.query(`
            create table if not exists ${name}(
                to_name varchar(32) primary key,
                amount bigint
            )`
        );
        console.log(`\nCreated table ${name} if not exists`);
    }

    async saveDebt(offer) {
        let from   = offer.from,
            amount = offer.amount,
            to     = offer.to;
        console.log('\nSaving debt...');
        await Promise.all([
            this.insert(from, amount, to),
            this.insert(to, -amount, from)
        ]);
    }

    async insert(from, amount, to) {
        await this.tryMake(from);
        let debtExists = await this.unitQuery(`
            select exists(
                select *
                from ${from}
                where to_name = '${to}'
            ) as result`
        );
        amount = new Number(amount);
        if (debtExists) {
            console.log('\nDebt exists');
            let oldAmount = new Number(await this.unitQuery(`
                select amount
                as result
                from ${from}
                where to_name = '${to}'`
            ));
            console.log('\n', amounts(amount, oldAmount));
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
                    set amount = ${old_amount + amount}
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

    amounts(amount, old_amount) {
        return ''
            + `amount     : ${amount}\n`
            + `old_amount : ${old_amount}\n`
            + `sum        : ${amount + old_amount}`;
    };

    async getStats(name) {
        await this.tryMake(name);
        let table = (await this.query(`select * from ${name}`)).rows;
        console.log('\nGot stats');
        return table;
    }

    async setState(chatID, state) {
        await this.query(`
            insert into stte
            values (${chatID}, ${state})
            on conflict (id) do update
                set state = ${state}`
        );
    }

    async checkState(chatID, reqState) {
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

if (module) module.exports = Wrapper;
