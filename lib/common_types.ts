import { EventEmitter } from 'events';

export interface OfferTemplate {
    from:   string,
    amount: number
};

export interface Offer extends OfferTemplate {
    to: string,
    accept: boolean
};

export interface StatsRow {
    to_name: string,
    amount: number
};

export interface BotPostgreClient extends EventEmitter {
    start(): Promise<this>,
    saveOffer(id: string, offer: OfferTemplate): Promise<void>,
    getOffer(id: string): Promise<OfferTemplate>,
    deleteOffer(id: string): Promise<boolean>,
    saveDebt(offer: Offer): Promise<void>,
    getStats(name: string): Promise<StatsRow[]>,
    setState(chatID: number, state: number): Promise<void>,
    checkState(chatID: number, reqState: number): Promise<boolean>
};

export interface BotOptions {
    token: string,
    port: number,
    name: string,
    dataBase: BotPostgreClient
};

export interface BotType {
    start(url: string): void
};
