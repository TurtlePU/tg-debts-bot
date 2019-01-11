function WrapperFactory(BaseWrapper) {
    this.makeWrapper = (DB_URL) => new Wrapper(DB_URL).start();

    function Wrapper(DB_URL) {
        var db = new BaseWrapper({
            connectionString: DB_URL,
            ssl: true
        });

        db.unitQuery = sql =>
            db.query(sql + ' as result').then(table => table.rows[0].result);

        var wrapper = {
            start: () =>
                db.connect()
                .then(() => {
                    console.log('Successfully connected to database');
                    return wrapper;
                }),

            tryMake: name =>
                db.query(`
                create table if not exists ${name}(
                    to_name varchar(32) primary key,
                    amount bigint
                )`),

            insert: (from, amount, to) =>
                wrapper.tryMake(from)
                .then(() =>
                    db.unitQuery(`
                    select exists(
                        select 1
                        from ${from}
                        where to_name = '${to}'
                    )`))
                .then(exists => {
                    console.log(`check ${name} in insert: `, exists);
                    return /* if */ exists
                    ?   db.unitQuery(`
                        select amount
                        from ${from}
                        where to_name = '${to}'`)
                        .then(old_amount =>
                            /* if */ old_amount + amount == 0
                            ?   db.query(`
                                delete
                                from ${from}
                                where to_name = '${to}'`)
                                .then(() =>
                                    db.unitQuery(`
                                    select exists(
                                        select 1
                                        from ${from}
                                    )`))
                                .then(exists =>
                                    /* if */ exists
                                    ?   null
                                    /* else */
                                    :   db.query(`
                                        drop table ${name}`)
                                )
                            /* else */
                            :   db.query(`
                                update ${from}
                                set amount = ${old_amount + amount}
                                where to_name = '${to}'`)
                        )
                    /* else */
                    :   db.query(`
                        insert
                        into ${from}
                        values ('${to}', ${amount})`);
                }),

            saveDebt: (from, amount, to) =>
                wrapper.insert(from, amount, to)
                .then(() =>
                    wrapper.insert(to, -amount, from)
                ),

            getStats: name =>
                db.unitQuery(`
                select exists(
                    select 1
                    from pg_tables
                    where tablename = '${name}'
                )`)
                .then(exists => {
                    console.log(`check ${name} in getStats: `, exists);
                    return /* if */ exists
                    ?   db.query(`select * from ${name}`).then(query => query.rows)
                    /* else */
                    :   [];
                })
        };

        return wrapper;
    };
};

if (module) module.exports = WrapperFactory;
