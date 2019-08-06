import { EventEmitter } from 'events';

import { User } from './user';

export interface DB_Client extends EventEmitter {
    start(): Promise<this>

    restartOffers(): Promise<void>
    saveOffer(id: string, offer: Offer): Promise<void>
    getOffer(id: string): Promise<Offer>
    deleteOffer(id: string): Promise<boolean>

    saveDebt(from: User, amount: number, to: User): Promise<void>

    getStats(user: User): Promise<Row[]>
}

export type Offer = {
    from: User
    amount: number
}

export type Row = {
    to: User
    amount: number
}
