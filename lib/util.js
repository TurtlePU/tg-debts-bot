const util = {
    lineReduce: function (table, seed) {
        console.log(table, seed);
        if (!table.length)
            return '';
        return table.reduce((res, line) => {
            return res
                + `\n@${line.to_name}: ${line.amount}`;
        }, seed);
    },
    lineAbs: function (line) {
        return {
            to_name: line.to_name,
            amount: Math.abs(line.amount)
        };
    }
};

if (module) module.exports = util;
