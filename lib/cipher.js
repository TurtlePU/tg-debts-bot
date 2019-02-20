const crypto = require('crypto');

const algo = 'aes-192-cbc';
const from = 'utf-8';
const to   = 'binary';

class Cipher {
    constructor(options) {
        this.key = options.key;
        this.iv  = options.iv;
    }

    get key() { return this.key; }
    set key() { throw new Error('key cannot be changed'); }

    get iv() { return this.iv; }
    set iv() { throw new Error('iv cannot be changed'); }

    encode(offer, accept) {
        let source = `${offer.from} ${offer.amount} ${accept ? 1 : 0}`;
        let cipher = crypto.createCipheriv(algo, this.key, this.iv);
        return cipher.update(source, from, to) + cipher.final(to);
    }

    decode(encoded) {
        let decipher = crypto.createDecipheriv(algo, this.key, this.iv);
        let decoded = (decipher.update(encoded, to, from)
            + decipher.final(from))
            .split(' ');
        console.log('\ndecoded data :', decoded);
        return {
            from   : decoded[0],
            amount : Number(decoded[1]),
            accept : decoded[2] == '1'
        };
    }
}

if (module) module.exports = Cipher;
