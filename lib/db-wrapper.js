function WrapperFactory(BaseWrapper) {
    this.makeWrapper = (DB_URL) => new Wrapper(DB_URL).start();

    function Wrapper(DB_URL) {
        var db = new BaseWrapper({
            connectionString: DB_URL,
            ssl: true
        });

        db.unitQuery = sql =>
            db.query(sql).then(table => {
                if (table.rows.length)
                    return table.rows[0].result;
                else
                    return 0;
            });

        var wrapper = {
            start() {
                return db.connect()
                    .then(() => {
                        console.log('Successfully connected to database');
                    })
                    .then(() => {
                        return db.query(`
                            create table if not exists stte(
                                id bigint primary key,
                                state smallint
                            )`
                        );
                    })
                    .then(() => {
                        console.log('Created table of states if not exists');
                        return db.query(`
                            create table if not exists offr(
                                id bigint primary key,
                                name varchar(32),
                                amount bigint
                            )`
                        );
                    })
                    .then(() => {
                        console.log('Created table of offers if not exists');
                        return wrapper;
                    });
            },

            tryMake(name) {
                return db.query(`
                        create table if not exists ${name}(
                            to_name varchar(32) primary key,
                            amount bigint
                        )`
                    )
                    .then(() => {
                        console.log(`Created table ${name} if not exists`);
                    });
            },

            insert(from, amount, to) {
                return this.tryMake(from)
                    .then(() => {
                        return db.unitQuery(`
                            select exists(
                                select 1
                                from ${from}
                                where to_name = '${to}'
                            ) as result`
                        );
                    })
                    .then(exists => {
                        amount = new Number(amount);
                        if (exists) {
                            console.log('Updating debt...');
                            return db.unitQuery(`
                                    select amount
                                    as result
                                    from ${from}
                                    where to_name = '${to}'`
                                )
                                .then(old_amount => {
                                    old_amount = new Number(old_amount);
                                    console.log(amounts(amount, old_amount));
                                    if (old_amount + amount == 0) {
                                        console.log('Deleting debt...');
                                        return db.query(`
                                                delete
                                                from ${from}
                                                where to_name = '${to}'`
                                            )
                                            .then(() => {
                                                return db.unitQuery(`
                                                    select exists(
                                                        select 1
                                                        from ${from}
                                                    ) as result`
                                                );
                                            })
                                            .then(exists => {
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
                return this.insert(from, amount, to)
                    .then(() => {
                        return this.insert(to, -amount, from);
                    });
            },

            getStats(name) {
                return this.tryMake(name)
                    .then(() => {
                        return db.query(`select * from ${name}`)
                    })
                    .then(query => {
                        return query.rows;
                    });
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
                    )
                    .then(exists => {
                        if (exists) {
                            return db.unitQuery(`
                                    select state
                                    as result
                                    from stte
                                    where id = ${chatID}`
                                )
                                .then(state => {
                                    return new Number(state) == reqState;
                                });
                        } else return false;
                    });
            },

            saveOfferGetID(offer) {
                let offer_id;
                return db.unitQuery(`
                        select id
                        as result
                        from offr
                        order by id desc
                        limit 1`
                    )
                    .then(id => {
                        offer_id = Number(id) + 1;
                        console.log('Next available offer id:', offer_id);
                        return db.query(`
                            insert into offr
                            values (
                                ${offer_id},
                                '${offer.from}',
                                ${offer.amount}
                            )`
                        );
                    })
                    .then(() => {
                        return offer_id;
                    });
            },

            getOffer(offer_id) {
                console.log('getting offer...');
                console.log('offer_id:', offer_id);
                console.log('type:', typeof offer_id);
                return db.query(`
                        select 1
                        from offr
                        where id = ${offer_id}`
                    )
                    .then(table => {
                        console.log('Offer:', table.rows[0]);
                        return offerOmitID(table.rows[0])
                    });
            },

            deleteOffer(offer_id) {
                console.log('deleting offer...');
                console.log('offer_id:', offer_id);
                console.log('type:', typeof offer_id);
                return db.query(`
                    delete
                    from offr
                    where id = ${offer_id}`
                );
            }
        };

        return wrapper;
    };
};

const amounts = (amount, old_amount) =>
    `amount: ${amount}, old_amount: ${old_amount}, sum: ${amount + old_amount}`;

const pass = (...args) =>
    new Promise(next => next(...args));

const offerOmitID = row => {
    return {
        from: row.name,
        amount: Number(row.amount)
    };
};

if (module) module.exports = WrapperFactory;
