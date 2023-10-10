import { assert } from 'chai';
import { describe, it } from 'mocha';
import { formatNumber, getAnswers } from '../utility';

describe("utility", () => {

    describe("getAnswers", () => {
        it("should return empty answers if empty input", () => {
            const tuple = getAnswers([], []);
            assert.deepEqual(tuple, [[], [], [], []]);
        });
    
        it("should sort according to fulfilled promises", (done) => {
            Promise.allSettled<Promise<number>>([Promise.resolve(1), Promise.reject<number>('2')]).then(settledPromises => {
                const tuple = getAnswers<string, number>(["fulfilled", "failed"], settledPromises);
                assert.deepEqual(tuple, [["fulfilled", 1, "failed", '2']]);
            }).finally(() => done());
        });
    
        it("should throw an error if unequal arrays", () => {
            Promise.allSettled<Promise<number>>([Promise.resolve(1), Promise.reject<number>(2)]).then(settledPromises => {
                assert.throws(() => getAnswers(["fulfilled"], settledPromises));
            })
        });
    });
    
    describe("formatNumber", () => {
        ([
            [10, "10"],
            [1_000, "1.00k"],
            [1_000_000, "1.00M"],
            [1_000_000_000, "1.00G"]
        ] as [number, string][]).forEach(([num, text]) => {
            it("should handle number " + text, () => {
                assert.strictEqual(formatNumber(num), text);
            });
        });
    });
    
    describe("getDateStringTimezone", () => {
    
    });

});

