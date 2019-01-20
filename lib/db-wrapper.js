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
            start: () =>
                db.connect(
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
                ),

            tryMake: name =>
                db.query(`
                    create table if not exists ${name}(
                        to_name varchar(32) primary key,
                        amount bigint
                    )`
                ).then(
                    () => console.log(`Successfully created table ${name} if not exists`)
                ),

            insert: (from, amount, to) =>
                wrapper.tryMake(
                    from
                ).then(() =>
                    db.unitQuery(`
                        select exists(
                            select 1
                            from ${from}
                            where to_name = '${to}'
                        ) as result`
                    )
                ).then(exists => {
                    console.log('exists from db: ', exists);
                    exists = new Boolean(exists);
                    console.log('exists after cast: ', exists);
                    amount = new Number(amount);
                    if (exists) {
                        console.log('Updating debt...');
                        return db.unitQuery(`
                            select amount
                            as result
                            from ${from}
                            where to_name = '${to}'`
                        ).then(old_amount => {
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
                                    console.log('are there any debts left? ', exists);
                                    if (exists) {
                                        return new Promise(() => {});
                                    } else {
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
                        return new Promise(() => {});
                    }
                }),

            saveDebt: (from, amount, to) => {
                console.log('Saving debt...');
                return wrapper.insert(from, amount, to
                ).then(() =>
                    wrapper.insert(to, -amount, from)
                );
            },

            getStats: name =>
                wrapper.tryMake(name
                ).then(() =>
                    db.query(`select * from ${name}`)
                ).then(
                    query => query.rows
                ),

            setState: (chatID, state) =>
                db.query(`
                    insert into stte
                    values (${chatID}, ${state})
                    on conflict (id) do update
                        set state = ${state}`
                ),

            checkState: (chatID, reqState) =>
                db.unitQuery(`
                    select exists(
                        select 1
                        from stte
                        where id = ${chatID}
                    ) as result`
                ).then(exists =>
                    /* if */ exists
                    ?   db.unitQuery(`
                        select state
                        as result
                        from stte
                        where id = ${chatID}`)
                        .then(
                            state => state == reqState
                        )
                    :   false
                )
        };

        return wrapper;
    };
};

if (module) module.exports = WrapperFactory;
