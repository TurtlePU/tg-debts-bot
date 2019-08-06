import { EventEmitter } from 'events';
import { v1 as neo4j } from 'neo4j-driver';

import { DB_Client, Offer, Row } from './db-interface';
import { User } from './user';

const offers_lifetime = 60 * 60 * 1000;  // after 1 hour
const check_time = 60 * 60 * 1000;   // every 1 hour

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

    async start(): Promise<void> {
        await this.session.run(`
            CREATE CONSTRAINT ON (user: User) ASSERT user.id IS UNIQUE;
            CREATE CONSTRAINT ON (offer: Offer) ASSERT offer.id IS UNIQUE;
        `);
        (function deleteUseless(session: neo4j.Session) {
            setTimeout(deleteUseless, check_time, session);
            session.run(`
                MATCH () -[record:OWES]-> () WHERE record.amount = 0 DELETE record;
                MATCH (user: User) WHERE NOT (user) -- () DELETE user;
            `);
        })(this.session);
    }

    async restartOffers(): Promise<void> {
        (async function deleteOutdated(session: neo4j.Session) {
            setTimeout(deleteOutdated, offers_lifetime, session);
            (await session.run(`
                MATCH (offer: Offer)
                WHERE offer.timestamp + ${offers_lifetime} < timestamp()
                DETACH DELETE offer
                RETURN offer.id AS id;
            `)).records.forEach(record => {
                console.log(`offer #${record.get('id')} expired`);
                this.emit('expired_offer', record.get('id'));
            });
        })(this.session);
    }

    async saveOffer(id: string, offer: Offer): Promise<void> {
        await Promise.all([
            this.updateUser(offer.from),
            this.session.run(`
                MATCH (user: User { id: {uid} })
                CREATE (user) -[:OFFERED]-> (:Offer {
                    id: {id},
                    amount: {amount},
                    timestamp: timestamp()
                });`,
                {
                    uid: offer.from.id,
                    id: id,
                    amount: neo4j.int(offer.amount)
                }
            )
        ]);
        console.log(`saved offer #${id}`);
    }

    async getOffer(id: string): Promise<Offer> {
        let result = (await this.session.run(`
            MATCH (from: User) -[:OFFERED]-> (offer: Offer { id: {id} })
            RETURN from, offer.amount AS amount;`, { id }
        )).records.map(record => ({
            from: get_user(record.get('from')),
            amount: get_number(record.get('amount'))
        }));
        if (result.length == 0) {
            throw new Error(`Offer #${id} not found`);
        }
        console.log('Offer-from:', result[0].from);
        return result[0];
    }

    async deleteOffer(id: string): Promise<boolean> {
        let result = await this.session.run(`
            MATCH (offer: Offer { id: {id} })
            DETACH DELETE offer;`, { id }
        );
        return result.summary.counters.nodesDeleted() != 0;
    }

    async saveDebt(from: User, amount: number, to: User): Promise<void> {
        if (from.id > to.id) {
            amount *= -1;
            [ from, to ] = [ to, from ];
        }
        await Promise.all([
            this.updateUser(from),
            this.updateUser(to),
            this.session.run(`
                MATCH (from: User { id: {from} })
                MATCH (to: User { id: {to} })
                MERGE (from) -[record:OWES]-> (to)
                    ON CREATE SET record.amount = {amount}
                    ON MATCH SET record.amount = record.amount + {amount};
                `,
                {
                    from: from.id,
                    amount: neo4j.int(amount),
                    to: to.id
                }
            )
        ]);
    }

    async getStats(user: User): Promise<Row[]> {
        await this.updateUser(user);
        return (await this.session.run(`
            MATCH (from: User { id: {id} }) -[record:OWES]- (to: User)
            RETURN to,
                CASE WHEN startNode(record) = from
                    THEN record.amount
                    ELSE -record.amount
                END AS amount;
            `, { id: user.id }
        )).records.map(record => ({
            amount: get_number(record.get('amount')),
            to: get_user(record.get('to'))
        })).filter(row => row.amount != 0);
    }

    protected updateUser(user: User) {
        return this.session.run(`
            MERGE (user: User { id: {id} }) SET user = {
                ${user.username ? 'username: {username},' : ''}
                full_name: {full_name},
                id: {id}
            };`, user
        );
    }
}

function get_number(num: neo4j.Integer): number {
    return num.toNumber();
}

function get_user(user: neo4j.Node): User {
    let props = user.properties;
    return {
        id: props['id'],
        full_name: props['full_name'],
        username: props['username']
    };
}
