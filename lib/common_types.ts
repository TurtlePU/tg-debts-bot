interface StatsRow {
    to_name : string,
    amount  : number
};

interface OfferTemplate {
    from    : string,
    amount  : number
};

interface OfferOption extends OfferTemplate {
    accept : boolean
};

interface Offer extends OfferOption {
    to : string
};
