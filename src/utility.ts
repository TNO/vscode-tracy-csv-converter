import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

/**
 * Filters out the rejected promises, get the values of the fulfilled promises.
 * @param promises The settled promises.
 * @returns The values of all the fulfilled/resolved promises
 */
export function getFulfilled<Type>(promises: PromiseSettledResult<Type>[]): Type[] {
    return (promises.filter(p => p.status === "fulfilled") as PromiseFulfilledResult<Type>[]).map(p => p.value);
}

/**
 * Get the indices of the fulfilled promises.
 * @param promises The settled promises.
 * @returns An array of indices.
 */
export function getFulfilledIndices(promises: PromiseSettledResult<unknown>[]): number[] {
    const out: number[] = [];
    promises.forEach((p, i) => { if (p.status === "fulfilled") out.push(i); });
    return out;
}

/**
 * Sort the input array according to the indices of the fulfilled and rejected promises.
 * @example
 * const files = ["C:/File1.csv", "C:/File2.csv"];
 * const contentPromises = readFiles(files);
 * const [fulfilledFiles, fulfilledFileContents, rejectedFiles, rejectionReasons] = getAnswers(files, contentPromises);
 * @param array The array to sort according to the promises.
 * @param promises The settled promises.
 * @throws `Error` if array and promises have unequal lengths
 * @returns A tuple containing arrays of the fulfilled and rejected results. Format: `[fulfilled array, fulfilled values, rejected array, rejected messages]`.
 */
export function getAnswers<Type1, Type2>(array: Type1[], promises: PromiseSettledResult<Type2>[]): [Type1[], Type2[], Type1[], string[]] {
    if (array.length !== promises.length) throw Error("Cannot sort unequal arrays");
    const fulfilledArray1: Type1[] = [];
    const fulfilledValues: Type2[] = [];
    const rejectedArray1: Type1[] = [];
    const rejectedMessages: string[] = [];
    promises.forEach((psr, i) => {
        if (psr.status === "fulfilled") {
            fulfilledArray1.push(array[i]);
            fulfilledValues.push((psr as PromiseFulfilledResult<Type2>).value);
        } else {
            rejectedArray1.push(array[i]);
            const prr = (psr as PromiseRejectedResult).reason;
            switch (typeof prr) {
                case "object":
                    if (prr.message)
                        rejectedMessages.push(prr.message);
                    else rejectedMessages.push("Unknown:", prr);
                    break;
                default:
                    rejectedMessages.push(prr);
            }
        }
    });
    return [fulfilledArray1, fulfilledValues, rejectedArray1, rejectedMessages];
    
}

/**
 * Filters out the resolved promises, get the messages of the rejected promises.
 * @param promises The settled promises.
 * @returns The messages of all the rejected promises
 */
export function getRejected(promises: PromiseSettledResult<unknown>[]) {
    return (promises.filter(p => p.status === "rejected") as PromiseRejectedResult[]).map(p => p.reason);
}

/**
 * Get the indices of the rejected promises.
 * @param promises The settled promises.
 * @returns An array of indices.
 */
export function getRejectedIndices(promises: PromiseSettledResult<unknown>[]): number[] {
    const out: number[] = [];
    promises.forEach((p, i) => { if (p.status === "rejected") out.push(i); });
    return out;
}

const METRIC_RANGES = [
    // { divider: 1e18, suffix: 'E' },
    // { divider: 1e15, suffix: 'P' },
    // { divider: 1e12, suffix: 'T' },
    { divider: 1e9, suffix: 'G' },
    { divider: 1e6, suffix: 'M' },
    { divider: 1e3, suffix: 'k' },
];

/**
 * Turn numbers into metric suffixed versions.
 * @example formatNumber(1000) === "1k"
 * @param num The number to format.
 * @returns A shorthand number using metric suffixes. (max 2 decimals)
 */
export function formatNumber(num: number): string {
    for (const div of METRIC_RANGES) {
        if (num >= div.divider) {
            return (num / div.divider).toFixed(2) + div.suffix;
        }
    }
    return num.toFixed(0);
}

// dayjs.extend(utc);

/**
 * Checks whether a date string contains a specified timezone and returns it if it does.
 * @param str The string to check.
 * @returns The timezone string or undefined if it doesn't exist.
 */
export function getDateStringTimezone(str: string) {
    // has colon, has 2 digits, maybe has a dot and then some digits, has any number of whitespaces, has some non-digit(s) and maybe (a plus and 4 digits)
    const matched = str.match(/:\d{2}(\.?\d+?)?\s*(\D+\+?(\d{4})?)$/) ?? [];
    return matched.at(2);
}

/**
 * Turns a string into a dayjs object. Used like this for ease of refactoring.
 * @param str The string to parse.
 * @returns A dayjs object.
 */
export function parseDateString(str: string): dayjs.Dayjs {
    return dayjs(str);
}

/**
 * Turns a number into a dayjs object. Used like this for ease of refactoring.
 * @param num The number to parse, indicates the milliseconds since the epoch.
 * @returns A dayjs object.
 */
export function parseDateNumber(num: number): dayjs.Dayjs {
    return dayjs(num);
}

