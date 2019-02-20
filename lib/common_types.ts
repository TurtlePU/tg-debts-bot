interface StatsRow {
    to_name : string,
    amount  : number
};

interface OfferTemplate {
    from   : string,
    amount : number
};

interface Offer extends OfferTemplate {
    to : string,
    accept? : boolean
};
