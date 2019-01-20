function WrapperFactory(BaseWrapper) {
    this.makeWrapper = (DB_URL) => new Wrapper(DB_URL).start();

    function Wrapper(DB_URL) {
        var db = new BaseWrapper({
            connectionString: DB_URL,
            ssl: true
        });

        db.unitQuery = sql =>
            db.query(sql).then(table => table.rows[0].result);

        var wrapper = {
            start() {
                return db.connect(
                ).then(
                    () => console.log('Successfully connected to database')
                ).then(
                    () =>
                    db.query(`
                        create table if not exists stte(
                            id bigint primary key,
                            state smallint
                        )`
                    )
                ).then(
                    () => {
                        console.log('Made table of states if not exists');
                        return wrapper;
                    }
                );
            },

            tryMake(name) {
                return db.query(`
                    create table if not exists ${name}(
                        to_name varchar(32) primary key,
                        amount bigint
                    )`
                ).then(
                    () => console.log(`Successfully created table ${name} if not exists`)
                );
            },

            insert(from, amount, to) {
                return wrapper.tryMake(from)
                .then(() =>
                    db.unitQuery(`
                        select exists(
                            select 1
                            from ${from}
                            where to_name = '${to}'
                        ) as result`
                    )
                ).then(exists => {
                    amount = new Number(amount);
                    if (exists) {
                        console.log('Updating debt...');
                        return db.unitQuery(`
                            select amount
                            as result
                            from ${from}
                            where to_name = '${to}'`
                        ).then(old_amount => {
                            console.log('type of old_amount:');
                            console.log(typeof old_amount);
                            old_amount = new Number(old_amount);
                            console.log(`amount: ${amount}, old_amount: ${old_amount}, sum: ${amount + old_amount}`);
                            if (old_amount + amount == 0) {
                                console.log('Deleting debt...');
                                return db.query(`
                                    delete
                                    from ${from}
                                    where to_name = '${to}'`
                                ).then(() =>
                                    db.unitQuery(`
                                        select exists(
                                            select 1
                                            from ${from}
                                        ) as result`
                                    )
                                ).then(exists => {
                                    if (exists) {
                                        return pass();
                                    } else {
                                        console.log('Deleting table...');
                                        return db.query(`
                                            drop table ${from}`
                                        );
                                    }
                                });
                            } else {
                                console.log('Updating debt...');
                                return db.query(`
                                    update ${from}
                                    set amount = ${old_amount + amount}
                                    where to_name = '${to}'`
                                );
                            }
                        });
                    } else if (amount != 0) {
                        console.log('Making new debt...');
                        return db.query(`
                            insert into ${from}
                            values ('${to}', ${amount})`
                        );
                    } else {
                        console.log('0-debts are not worth saving');
                        return pass();
                    }
                });
            },

            saveDebt(from, amount, to) {
                console.log('Saving debt...');
                return this.insert(from, amount, to).then(() => this.insert(to, -amount, from));
            },

            getStats(name) {
                return wrapper.tryMake(name)
                .then(() =>
                    db.query(`select * from ${name}`)
                ).then(
                    query => query.rows
                );
            },

            setState(chatID, state) {
                return db.query(`
                    insert into stte
                    values (${chatID}, ${state})
                    on conflict (id) do update
                        set state = ${state}`
                );
            },

            checkState(chatID, reqState) {
                return db.unitQuery(`
                    select exists(
                        select 1
                        from stte
                        where id = ${chatID}
                    ) as result`
                ).then(exists => {
                    if (exists) {
                        return db.unitQuery(`
                            select state
                            as result
                            from stte
                            where id = ${chatID}`
                        ).then(
                            state => new Number(state) == reqState
                        );
                    } else return false;
                });
            }
        };

        return wrapper;
    };
};

const pass = (...args) => new Promise(next => next(...args));

if (module) module.exports = WrapperFactory;
