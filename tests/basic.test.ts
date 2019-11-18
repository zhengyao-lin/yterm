import { describe, it } from "mocha";
import { expect } from "chai";

import { ANSISequence, parseANSIStream, ANSICommand } from "../src/yterm/ansi";

function parseToChunks (data: string): Array<ANSISequence | string> {
    const chunks: Array<ANSISequence | string> = [];
    const compressedChunks = []; // collapsing consecutive strings together

    parseANSIStream(data, chunks.push.bind(chunks));

    let standingChunk = "";

    for (const chunk of chunks) {
        if (chunk instanceof ANSISequence) {
            if (standingChunk !== "") {
                compressedChunks.push(standingChunk);
                standingChunk = "";
            }

            compressedChunks.push(chunk);
        } else {
            standingChunk += chunk;
        }
    }

    if (standingChunk !== "") {
        compressedChunks.push(standingChunk);
    }

    return compressedChunks;
}

describe("parseANSIStream", () => {
    it("doesn't touch normal text", () => {
        expect(parseToChunks("abcdefghi")).to.eql(["abcdefghi"]);
    });

    it("correctly recognize a single escape sequence", () => {
        expect(parseToChunks("abcdefghi\x1b[1AAAA")).to.include("abcdefghi").and.include("AAA");
    });

    it("correctly recognize a single escape in the end", () => {
        expect(parseToChunks("abcdefghi\x1b[1A")).to.include("abcdefghi");
    });

    it("correctly recognize a single escape in the beginning", () => {
        expect(parseToChunks("\x1b[1AAAA")).to.include("AAA");
    });
});
