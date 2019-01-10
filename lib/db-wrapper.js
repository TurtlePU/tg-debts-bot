function WrapperFactory(BaseWrapper) {
    this.makeWrapper = (DB_URL) => new Wrapper(DB_URL).start();

    function Wrapper(DB_URL) {
        var wrapper = new BaseWrapper({
            connectionString: DB_URL,
            ssl: true
        });

        wrapper.start = () =>
            wrapper.connect()
            .then(
                () => wrapper.query(`create table if not exists users (name varchar(32) primary key)`))
            .then(
                () => wrapper
            );

        wrapper.test = name =>
            wrapper.query(`select exists (select 1 from users where name = '${name}')`);

        wrapper.make = name =>
            wrapper.query(`create table ${name} (to varchar(32) primary key, amount bigint)`)
            .then(
                () => wrapper.query(`insert into users values '${name}'`)
            );

        wrapper.insert = (from, amount, to) =>
            wrapper.query(`select amount from ${from} where to = '${to}'`)
            .then(
                old_amount =>
                    old_amount + amount == 0
                    ?   wrapper.query(`delete from ${from} where to = '${to}'`)
                        .then(
                            () => wrapper.query(`select exists (select 1 from ${from})`))
                        .then(
                            exists => exists ? null : delete_table(name))
                    :   wrapper.query(`update ${from} set amount = ${old_amount + amount} where to = '${to}'`)
            );

        wrapper.delete_table = name =>
            wrapper.query(`drop table ${name}`)
            .then(
                () => wrapper.query(`delete from users where name = '${name}'`)
            );

        wrapper.saveDebt = (from, amount, to) =>
            wrapper.test(from)
            .then(
                exists => exists ? null : wrapper.make(from))
            .then(
                () => wrapper.insert(from, amount, to))
            .then(
                () => wrapper.test(to))
            .then(
                exists => exists ? null : wrapper.make(to))
            .then(
                () => wrapper.insert(to, -amount, from)
            );

        wrapper.getStats = name =>
            wrapper.test(name)
            .then(
                exists => exists ? wrapper.query(`select * from ${name}`) : []
            );

        return wrapper;
    };
}

if (module) module.exports = WrapperFactory;
