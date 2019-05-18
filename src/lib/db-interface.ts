import { EventEmitter } from 'events';

export interface DB_Client extends EventEmitter {
    start(): Promise<this>
    restartOffers(): Promise<void>
    saveOffer(id: string, offer: Offer): Promise<void>
    getOffer(id: string): Promise<Offer>
    deleteOffer(id: string): Promise<boolean>
    saveDebt(from: string, amount: number, to: string): Promise<void>
    getStats(name: string): Promise<Row[]>
};

export type Offer = {
    from: string
    amount: number
}

export type Row = {
    to: string
    amount: number
}
