import { StatsRow } from './common_types'

export default {
    lineReduce: function(
        table : StatsRow[],
        seed  : string
    ) : string {
        console.log(table, seed);
        if (!table.length)
            return '';
        return table.reduce((res, line) => {
            return res
                + `\n@${line.to_name}: ${line.amount}`;
        }, seed);
    },

    lineAbs: function(line : StatsRow) : StatsRow {
        return {
            to_name : line.to_name,
            amount  : Math.abs(line.amount)
        };
    }
};
