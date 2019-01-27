const crypto = require('crypto');

const algo = 'aes-192-cbc';
const from = 'utf-8';
const to   = 'binary';

function Cipher(options) {
    const key = options.key;
    const iv  = options.iv;

    this.encode(offer, answer) {
        let source = `${offer.from} ${offer.amount} ${answer ? 1 : 0}`;
        let cipher = crypto.createCipheriv(algo, key, iv);

        return cipher.update(source, from, to) + cipher.final(to);
    };

    this.decode(encoded) {
        let decipher = crypto.createDecipheriv(algo, key, iv);
        let decoded  = (decipher.update(encoded, to, from)
                       +decipher.final(from))
                       .split(' ');

        console.log('decoded data:', splitted);

        return {
            from   : splitted[0],
            amount : Number(splitted[1]),
            answer : splitted[2] == '1'
        };
    };
};

if (module) module.exports = Cipher;
