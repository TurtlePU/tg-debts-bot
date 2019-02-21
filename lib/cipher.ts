import crypto from 'crypto';
import { OfferTemplate, OfferOption, OfferEncoder } from './common_types';

const algo = 'aes-192-cbc';
const from = 'utf8';
const to   = 'base64';

export = class Cipher implements OfferEncoder {
    __key : string;
    __iv  : string;

    constructor(options : { key : string, iv : string }) {
        this.__key = options.key;
        this.__iv  = options.iv;
    }

    get key() { return this.__key; }
    set key(_) { throw new Error('key cannot be changed'); }

    get iv() { return this.__iv; }
    set iv(_) { throw new Error('iv cannot be changed'); }

    encode(
        offer  : OfferTemplate,
        accept : boolean
    ) : string {
        let source = `${offer.from} ${offer.amount} ${accept ? 1 : 0}`;
        let cipher = crypto.createCipheriv(algo, this.key, this.iv);
        return cipher.update(source, from, to) + cipher.final(to);
    }

    decode(encoded : string) : OfferOption {
        let decipher = crypto.createDecipheriv(algo, this.key, this.iv);
        let decoded = (decipher.update(encoded, to, from) + decipher.final(from)).split(' ');
        console.log('\ndecoded data :', decoded);
        return {
            from   : decoded[0],
            amount : Number(decoded[1]),
            accept : decoded[2] == '1'
        };
    }
};
