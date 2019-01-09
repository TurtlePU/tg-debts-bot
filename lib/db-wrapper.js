const WrapperFactory = function(BaseWrapper) {
    this.makeWrapper = (DB_URL) => new Wrapper(DB_URL).start();

    function Wrapper(DB_URL) {
        var wrapper = new BaseWrapper({
            connectionString: DB_URL,
            ssl: true
        });

        wrapper.start = () => new Promise((resolve, reject) => {
            wrapper.connect()
            .then(
                () => wrapper.query(`create table users (name varchar(32) primary key)`),
                reject)
            .then(
                () => resolve(wrapper),
                reject
            );
        });

        // make simpler

        wrapper.test = name => {
            var obj;
            obj.then = (pass, fail) =>
                wrapper.query(`select exists (select * from users where name = '${name}')`)
                .then(
                    exists => {
                        if (exists)
                            return pass();
                        else
                            throw fail();
                    },
                    error => console.log(error)
                );
            return obj;
        }

        wrapper.make = name => new Promise();
            // make new table and insert its name to 'users'

        wrapper.insert = (from, amount, to) => new Promise();
            // insert and delete if 0, delete if empty

        wrapper.saveDebt = (from, amount, to) =>
            wrapper.test(from)
            .then(
                () => wrapper.test(to),
                () => wrapper.make(from)
                      .then(
                          () => wrapper.saveDebt(from, amount, to),
                          error => console.log(error)
                      ))
            .then(
                () => wrapper.insert(from, amount, to),
                () => {
                    wrapper.make(to)
                    .then(
                        () => wrapper.saveDebt(from, amount, to),
                        error => console.log(error)
                    );
                })
            .then(
                () => wrapper.insert(to, -amount, from),
                error => console.log(error))
            .catch(
                error => console.log(error)
            );

        // make pure Promises, no 'sender'

        wrapper.sendStats = (name, sender) =>
            wrapper.test(name)
            .then(
                () => wrapper.query(`select * from ${name}`),
                () => sender(`No debts`))
            .then(
                entries => sender(entries.reduce((res, line) => res + `\n@${line.to}: ${line.amount}`, `Debts:\n`)),
                error => console.log(error)
            );

        return wrapper;
    };
}

if (module) module.exports = WrapperFactory;
