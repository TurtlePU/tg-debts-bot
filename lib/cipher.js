const crypto = require('crypto');

const algo = 'aes-192-cbc';
const from = 'utf-8';
const to   = 'binary';

function Cipher(options) {
    const key = options.key;
    const iv  = options.iv;

    this.encode = function(offer, accept) {
        let source = `${offer.from} ${offer.amount} ${accept ? 1 : 0}`;
        let cipher = crypto.createCipheriv(algo, key, iv);

        return cipher.update(source, from, to) + cipher.final(to);
    };

    this.decode = function(encoded) {
        let decipher = crypto.createDecipheriv(algo, key, iv);
        let decoded  = (decipher.update(encoded, to, from)
                       +decipher.final(from))
                       .split(' ');

        console.log('decoded data:', decoded);

        return {
            from   : decoded[0],
            amount : Number(decoded[1]),
            accept : decoded[2] == '1'
        };
    };
};

if (module) module.exports = Cipher;
