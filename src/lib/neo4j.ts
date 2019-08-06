import { EventEmitter } from 'events';
import { v1 as neo4j } from 'neo4j-driver';

import { DB_Client, Offer, Row } from './db-interface';
import { User } from './user';

const offers_expire_time = 60 * 60 * 1000; // after 1 hour

export default class Neo4jClient extends EventEmitter implements DB_Client {
    protected readonly driver: neo4j.Driver;
    protected session: neo4j.Session;

    constructor(url: string, credentials: { user: string, password: string }) {
        super();
        let { user, password } = credentials;
        this.driver = neo4j.driver(url, neo4j.auth.basic(user, password));
        this.session = this.driver.session();
        this.close = this.close.bind(this);
        this.handleShutdown();
    }

    protected handleShutdown() {
        process.on('exit', this.close);
        //catches ctrl+c event
        process.on('SIGINT', this.close);
        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', this.close);
        process.on('SIGUSR2', this.close);
        //catches uncaught exceptions
        process.on('uncaughtException', this.close);
    }

    protected close() {
        this.driver.close();
    }

    async start(): Promise<this> {
        await this.session.run(`
            CREATE CONSTRAINT ON (user: User) ASSERT user.id IS UNIQUE
            CREATE CONSTRAINT ON (offer: Offer) ASSERT offer.id IS UNIQUE
        `)
        return this;
    }

    async restartOffers(): Promise<void> {
        let result = await this.session.run(`
            MATCH (offer: Offer)
            RETURN
                offer.id AS id,
                offer.expires - timestamp() AS time
        `);
        result.records.forEach(record => {
            let id: string = record.get('id');
            let time: neo4j.Integer = record.get('time');
            this.expireOffer(id, time.isNegative() ? 0 : time.toNumber());
        });
    }

    async saveOffer(id: string, offer: Offer): Promise<void> {
        await this.updateUser(offer.from);
        await this.session.run(`
            MATCH (user: User)
            WHERE user.id = {uid}
            CREATE (user) -[:OFFERED]-> (:Offer {
                id: {id},
                amount: {amount},
                expires: timestamp() + {lifetime}
            })`,
            {
                uid: offer.from.id,
                id: id,
                amount: neo4j.int(offer.amount),
                lifetime: neo4j.int(offers_expire_time)
            }
        );
        console.log(`saved offer #${id}`);
        this.expireOffer(id, offers_expire_time);
    }

    async getOffer(id: string): Promise<Offer> {
        let result = (await this.session.run(`
            MATCH (user: User) -[:OFFERED]-> (offer: Offer)
            WHERE offer.id = {id}
            RETURN
                user AS from,
                offer.amount AS amount
            `, { id }
        )).records.map(record => ({
            from: get_user((record.get('from') as neo4j.Node).properties),
            amount: (record.get('amount') as neo4j.Integer).toNumber()
        }));
        if (result.length == 0) {
            throw new Error(`Offer #${id} not found`);
        }
        console.log('Offer-from:', result[0].from);
        return result[0];
    }

    async deleteOffer(id: string): Promise<boolean> {
        return (await this.session.run(`
            MATCH (offer: Offer)
            WHERE offer.id = {id}
            DETACH DELETE offer`, { id }
        )).summary.counters.nodesDeleted() != 0;
    }

    async saveDebt(from: User, amount: number, to: User): Promise<void> {
        if (from.id > to.id) {
            amount *= -1;
            [ from, to ] = [ to, from ];
        }
        await Promise.all([
            this.updateUser(from),
            this.updateUser(to)
        ]);
        let balance = (await this.session.run(`
            MATCH (from: User), (to: User)
            WHERE from.id = {from} AND to.id = {to}
            MERGE (from) -[record:OWES]-> (to)
                ON CREATE SET record.amount = {amount}
                ON MATCH SET record.amount = record.amount + {amount}

            WITH from, record, to, record.amount as amount
            MATCH () -[record]-> ()
            WHERE record.amount = 0 DELETE record

            WITH from, to, amount MATCH (from)
            WHERE NOT (from) -- () DELETE from

            WITH to, amount MATCH (to)
            WHERE NOT (to) -- () DELETE to

            WITH amount RETURN amount
            `,
            {
                from: from.id,
                amount: neo4j.int(amount),
                to: to.id
            }
        )).records[0].get('amount');
        console.log('new debt balance:', balance);
    }

    async getStats(user: User): Promise<Row[]> {
        await this.updateUser(user);
        return (await this.session.run(`
            MATCH (self: User) -[record:OWES]- (other: User)
            WHERE user.id = {id}
            RETURN CASE WHEN startNode(record) = self
                THEN record.amount AS amount, other AS to
                ELSE -record.amount AS amount, other AS to
            `, { id: user.id }
        )).records.map(record => ({
            amount: (record.get('amount') as neo4j.Integer).toNumber(),
            to: get_user((record.get('to') as neo4j.Node).properties)
        }));
    }

    protected expireOffer(id: string, after: number) {
        setTimeout(async () => {
            let deleted = await this.deleteOffer(id);
            if (deleted) {
                console.log(`offer #${id} expired`);
                this.emit('expired_offer', id);
            }
        }, after);
    }

    protected async updateUser(user: User) {
        return this.session.run(`
            MERGE (user: User { id: {id} })
            SET user = {
                id: {id},
                ${user.username ? 'username: {username},' : ''}
                full_name: {full_name}
            }`,
            user
        );
    }
}

function get_user(user: object): User {
    let result: User = {
        id: user['id'],
        full_name: user['full_name']
    };
    if (user['username']) {
        result.username = user['username'];
    }
    return result;
}
