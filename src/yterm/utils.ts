export function assert (cond: boolean, msg: string) {
    if (!cond) {
        throw Error(`assertion failed: ${msg}`);
    }
}

export class Pair<A, B> {
    public fst: A;
    public snd: B;

    constructor (fst: A, snd: B) {
        this.fst = fst;
        this.snd = snd;
    }
}

/**
 * Returns a regex representing the union of two languages
 */
export function regexUnion(...rs: Array<RegExp>) {
    if (rs.length == 0) {
        return /$.^/; // a regex that matches nothing ()
    }

    // otherwise concatenating all patterns with union
    return new RegExp(rs.map(r => `(${r.source})`).join("|"));
}

/**
 * Modifies a regex to include the start of a string
 */
export function regexMatchStart(r: RegExp) {
    return new RegExp("^" + r.source);
}
