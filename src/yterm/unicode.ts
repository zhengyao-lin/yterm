/** Some utilities for unicode */

export function unicodeCharAt (s: string, i: number): UnicodeChar {
    return [...s][i];
}

export function unicodeLength (s: string): number {
    return [...s].length;
}

export type UnicodeChar = string;
