export interface StatsRow {
    to_name : string,
    amount  : number
};

export interface OfferTemplate {
    from    : string,
    amount  : number
};

export interface TextedOffer extends OfferTemplate {
    text : string
};

export interface OfferOption extends OfferTemplate {
    accept : boolean
};

export interface Offer extends OfferOption {
    to : string
};

export interface BotPostgreClient {
    start() : Promise<this>,
    saveDebt(offer : Offer) : Promise<void>,
    getStats(name : string) : Promise<StatsRow[]>,
    setState(chatID : number, state : number) : Promise<void>,
    checkState(chatID : number, reqState : number) : Promise<boolean>
};

export interface OfferEncoder {
    encode(offer : OfferTemplate, accept : boolean) : string,
    decode(encoded : string) : OfferOption
};

export interface BotOptions {
    token : string,
    url   : string,
    port  : number,
    name  : string,
    dataBase : BotPostgreClient,
    cipher : OfferEncoder
};

export interface BotType {
    start() : void
};
