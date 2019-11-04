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
