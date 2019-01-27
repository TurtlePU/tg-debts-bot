const BaseWrapper = require('pg').Client;

function Wrapper(DB_URL) {
    var db = new BaseWrapper({
        connectionString: DB_URL,
        ssl: true
    });

    db.unitQuery = function(sql) {
        return db.query(sql).then(table => {
            if (table.rows.length)
                return table.rows[0].result;
            else
                return 0;
        });
    };

    this.start = function() {
        return db.connect()
            .then(() => {
                console.log('\nSuccessfully connected to database');
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
                console.log('\nCreated table of states if not exists');
                return this;
            });
    };

    this.tryMake = function(name) {
        return db.query(`
                create table if not exists ${name}(
                    to_name varchar(32) primary key,
                    amount bigint
                )`
            )
            .then(() => {
                console.log(`\nCreated table ${name} if not exists`);
            });
    };

    function insert(from, amount, to) {
        return this.tryMake(from)
            .then(() => {
                return db.unitQuery(`
                    select exists(
                        select *
                        from ${from}
                        where to_name = '${to}'
                    ) as result`
                );
            })
            .then(exists => {
                amount = new Number(amount);
                if (exists) {
                    console.log('\nDebt exists');
                    return db.unitQuery(`
                            select amount
                            as result
                            from ${from}
                            where to_name = '${to}'`
                        )
                        .then(old_amount => {
                            old_amount = new Number(old_amount);
                            console.log('\n', amounts(amount, old_amount));
                            if (old_amount + amount == 0) {
                                console.log('\nDeleting debt...');
                                return db.query(`
                                        delete
                                        from ${from}
                                        where to_name = '${to}'`
                                    )
                                    .then(() => {
                                        return db.unitQuery(`
                                            select exists(
                                                select *
                                                from ${from}
                                            ) as result`
                                        );
                                    })
                                    .then(exists => {
                                        if (exists) {
                                            return pass();
                                        } else {
                                            console.log('\nDeleting table...');
                                            return db.query(`
                                                drop table ${from}`
                                            );
                                        }
                                    });
                            } else {
                                console.log('\nUpdating debt...');
                                return db.query(`
                                    update ${from}
                                    set amount = ${old_amount + amount}
                                    where to_name = '${to}'`
                                );
                            }
                        });
                } else if (amount != 0) {
                    console.log('\nMaking new debt...');
                    return db.query(`
                        insert into ${from}
                        values ('${to}', ${amount})`
                    );
                } else {
                    console.log('\n0-debts are not worth saving');
                    return pass();
                }
            });
    };

    this.saveDebt = function(offer) {
        let from   = offer.from,
            amount = offer.amount,
            to     = offer.to;
        console.log('\nSaving debt...');
        return insert(from, amount, to)
            .then(() => {
                return insert(to, -amount, from);
            });
    };

    this.getStats = function(name) {
        return this.tryMake(name)
            .then(() => {
                return db.query(`select * from ${name}`)
            })
            .then(query => {
                console.log('\nGot stats');
                return query.rows;
            });
    };

    this.setState = function(chatID, state) {
        return db.query(`
            insert into stte
            values (${chatID}, ${state})
            on conflict (id) do update
                set state = ${state}`
        );
    };

    this.checkState = function(chatID, reqState) {
        return db.unitQuery(`
                select exists(
                    select *
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
    };
};

function amounts(amount, old_amount) {
    return `amount     : ${amount}\n`
         + `old_amount : ${old_amount}\n`
         + `sum        : ${amount + old_amount}`;
};

function pass() {
    return new Promise(next => next(...args));
};

if (module) module.exports = Wrapper;
