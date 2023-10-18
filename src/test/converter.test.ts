import { assert } from "chai";
import Sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { FTracyConverter, NEW_CONVERTERS, TracyData, multiTracyCombiner } from '../converters';
import { FileMetaData, FileMetaDataOptions } from '../communicationProtocol';
import { ReadStream } from "fs";
import { cloneDeep } from "lodash";

// ParseType: [file type name, Input, MetaDataIndex, DataIndex][]
const testFileData: {[s: string]: [string, string, number, number][]} = {
    "CSV": [
            ["comma-delimited CSV", "a,b,c,d\n1970-01-01T00:00:00,bt,ct,dt", 0, 0],
            ["line-delimited CSV", "a|b|c|d\n1970-01-01T00:00:00|bt|ct|dt", 0, 0],
            ["semicolon-delimited CSV", "a;b;c;d\n1970-01-01T00:00:00;bt;ct;dt", 0, 0],
            ["non-CSV", "afdsfax aedasfea fyeoa r6adosgfa\ng ahsdftak vdfs fd yksd fsd", -1, -1]
    ]
};
const testMetaData: FileMetaData[] = [
    {
        headers: ["a","b","c","d"],
        firstDate: "1970-01-01T00:00:00",
        lastDate: "1970-01-01T00:00:00",
        dataSizeIndices: [["1970-01-01T00:00:00", 1]],
        termOccurrances: []
    },
];
const testTracyData: TracyData[][] = [
    [{ a: "1970-01-01T00:00:00", b: "bt", c: "ct", d: "dt" }],
];
const metadataOptions: [string, FileMetaDataOptions, number][] = [
    ["empty", { terms: [], termSearchIndex: 1 }, 0],
    ["partial no flags",     { terms: [["b", { caseSearch: false, reSearch: false, wholeSearch: false }]], termSearchIndex: 1 }, 1],
    ["partial c caseSearch", { terms: [["b", { caseSearch: true, reSearch: false, wholeSearch: false }]], termSearchIndex: 1 }, 1],
    ["partial w caseSearch", { terms: [["B", { caseSearch: true, reSearch: false, wholeSearch: false }]], termSearchIndex: 1 }, 0],
    ["regfull no reSearch ", { terms: [["b.", { caseSearch: false, reSearch: false, wholeSearch: false }]], termSearchIndex: 1 }, 0],
    ["regfull reSearch",     { terms: [["b.", { caseSearch: false, reSearch: true, wholeSearch: false }]], termSearchIndex: 1 }, 1],
    ["partial wholeSearch",  { terms: [["b", { caseSearch: false, reSearch: false, wholeSearch: true }]], termSearchIndex: 1 }, 0],
    ["full wholeSearch",     { terms: [["bt", { caseSearch: false, reSearch: false, wholeSearch: true }]], termSearchIndex: 1 }, 1]
];

// Test the implemented converters
describe("CSV converters", () => {
    const csvConverters: [string, FTracyConverter<string | ReadStream>, number[]][] = [
        // Name, Converter, Should Pass
        ["Papa parser converter", NEW_CONVERTERS.TRACY_STREAM_PAPAPARSER, [0, 1, 2]],
        ["deprecated standard converter", NEW_CONVERTERS.TRACY_STRING_STANDARD_CONVERTER, [0]],
    ];

    csvConverters.forEach(([name, converter, canPassTestIndices]) => {
        describe(name, () => {
            describe("fileRead", () => {
                afterEach(() => {
                    Sinon.restore();
                });
                it("should bubble up thrown file read errors", (done) => {
                    async function fileReadThrow(): Promise<string | ReadStream> {
                        throw "File Read error";
                    }
                    Sinon.replace(converter, "fileReader", fileReadThrow);
                    converter.getMetadata("test", metadataOptions[0][1]).then(() => {
                        // Should not happen
                        assert.fail("Should not return any metadata for a thrown file read error");
                    }).catch((reason) => {
                        assert.exists(reason);
                    }).finally(done);
                });
            });
            describe("getMetaData", () => {
                afterEach(() => {
                    Sinon.restore();
                });
                let onlyOnce = true;
                testFileData["CSV"].forEach(([fileName, inputData, metaDataIndex], i) => {
                    if (canPassTestIndices.includes(i)) {
                        const metaData = testMetaData.at(metaDataIndex);
                        // Should be able to pass
                        it("should work with " + fileName + " files", (done) => {
                            Sinon.replace(converter, "fileReader", Sinon.fake.resolves(inputData));
                            converter.getMetadata("test", metadataOptions[0][1]).then(fmd => {
                                assert.deepEqual(fmd, metaData);
                            }).finally(done);
                        });
                        if (onlyOnce) {
                            onlyOnce = false;
                            // Test all the options
                            metadataOptions.slice(1).forEach((v) => {
                                it("should be able to handle the option " + v[0] + " correctly", (done) => {
                                    Sinon.replace(converter, "fileReader", Sinon.fake.resolves(inputData));
                                    const editedMetaData = cloneDeep(metaData)!;
                                    editedMetaData.termOccurrances = [[v[1].terms[0][0], v[2]]];
                                    converter.getMetadata("test", v[1]).then(fmd => {
                                        assert.deepEqual(fmd, editedMetaData);
                                    }).finally(done);
                                });
                            });
                        }
                    } else {
                        // Should not pass
                        it("should not work with " + fileName + " files", (done) => {
                            Sinon.replace(converter, "fileReader", Sinon.fake.resolves(inputData));
                            converter.getMetadata("test", metadataOptions[0][1]).then(() => {
                                // Should not happen, fail
                                assert.fail("Should not return any metadata for an unparsable file");
                            }).catch((reason) => {
                                // Should give an reason for the failure
                                assert.exists(reason);
                            }).finally(done);
                            
                        })
                    }
                });
            });
            describe("getData", () => {
                afterEach(() => {
                    Sinon.restore();
                });
                testFileData["CSV"].forEach(([fileName, inputData, metaDataIndex, tracyDataIndex], i) => {
                    if (canPassTestIndices.includes(i)) {
                        // Should be able to pass
                        const metaData = testMetaData.at(metaDataIndex);
                        const tracyData = testTracyData.at(tracyDataIndex);
                        it("should work with " + fileName + " files", (done) => {
                            Sinon.replace(converter, "fileReader", Sinon.fake.resolves(inputData));
                            converter.getData("test", [metaData!.firstDate, metaData!.lastDate]).then(fmd => {
                                assert.deepEqual(fmd, tracyData);
                            }).finally(done);
                        });
                    } else {
                        // Should not pass
                        it("should not work with " + fileName + " files", (done) => {
                            Sinon.replace(converter, "fileReader", Sinon.fake.resolves(inputData));
                            converter.getData("test", ["doesn't matter", "doesn't matter"]).then(() => {
                                // Should not happen, fail
                                assert.fail("Should not return any tracyData for an unparsable file");
                            }).catch((reason) => {
                                // Should give an reason for the failure
                                assert.exists(reason);
                            }).finally(done);
                            
                        })
                    }
                });
            });
        });
    });
    
});

describe("multiTracyCombiner", () => {
    const exampleTracyData: TracyData[][] = [
        [{"timestamp": "0", "b": "c"}, {"timestamp": "2", "b": "c"}],
        [{"timestamp": "1", "b": "c"}, {"timestamp": "3", "b": "c"}],
        [{"timestamp": "4", "b": "c"}, {"timestamp": "5", "b": "c"}],
        [{"timestamp": "5", "b": "c"}, {"timestamp": "6", "b": "c"}],
        [{"timestamp": "7", "d": "e"}, {"timestamp": "8", "d": "e"}]
    ];

    it("should return an empty array if empty input", () => {
        assert.deepEqual(multiTracyCombiner([]), []);
    });

    it("should be able to handle empty arrays as elements", () => {
        assert.deepEqual(multiTracyCombiner([exampleTracyData[0], []]), exampleTracyData[0]);
    });

    it("should return a combination of two input arrays", () => {
        assert.deepEqual(multiTracyCombiner([exampleTracyData[0], exampleTracyData[2]]), [exampleTracyData[0][0], exampleTracyData[0][1], exampleTracyData[2][0], exampleTracyData[2][1]]);
    });

    it("should sort the output array according to the timestamps", () => {
        assert.deepEqual(multiTracyCombiner([exampleTracyData[0], exampleTracyData[1]]), [exampleTracyData[0][0], exampleTracyData[1][0], exampleTracyData[0][1], exampleTracyData[1][1]]);
    });

    it("should have two of the same 'id'ing headers beside each other", () => {
        assert.deepEqual(multiTracyCombiner([exampleTracyData[2], exampleTracyData[3]]), [exampleTracyData[2][0], exampleTracyData[2][1], exampleTracyData[3][0], exampleTracyData[3][1]]);
    });

    it("should be able to handle multiple (" + exampleTracyData.length + ") arrays", () => {
        assert.deepEqual(multiTracyCombiner(exampleTracyData).length, exampleTracyData.map(a => a.length).reduce((p, c) => p + c));
    });

    it("should give the first element of the output all the headers", () => {
        assert.hasAllKeys(multiTracyCombiner([exampleTracyData[0], exampleTracyData[4]])[0], ["timestamp", "b", "d"]);
    });
});
