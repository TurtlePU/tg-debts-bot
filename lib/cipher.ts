import crypto from 'crypto';
import { OfferTemplate, OfferOption, OfferEncoder } from './common_types';

const algo = 'aes-192-cbc';
const from = 'utf8';
const to   = 'base64';

export default class Cipher implements OfferEncoder {
    __key : string;
    __iv  : string;

    constructor(options : { key : string, iv : string }) {
        this.__key = options.key;
        this.__iv  = options.iv;
    }

    key() : string { return this.__key; }
    iv()  : string { return this.__iv; }

    encode(
        offer  : OfferTemplate,
        accept : boolean
    ) : string {
        let source = `${offer.from} ${offer.amount} ${accept ? 1 : 0}`;
        let cipher = crypto.createCipheriv(algo, this.key(), this.iv());
        return cipher.update(source, from, to) + cipher.final(to);
    }

    decode(encoded : string) : OfferOption {
        let decipher = crypto.createDecipheriv(algo, this.key(), this.iv());
        let decoded = (decipher.update(encoded, to, from) + decipher.final(from)).split(' ');
        console.log('\ndecoded data :', decoded);
        return {
            from   : decoded[0],
            amount : Number(decoded[1]),
            accept : decoded[2] == '1'
        };
    }
};
