import { assert } from "chai";
import Sinon from "sinon";
import { describe, it } from "mocha";
import { FTracyConverter, NEW_CONVERTERS, TracyData } from '../converters';
import { FileMetaData } from '../communicationProtocol';
import { ReadStream } from "fs";

// ParseType: [Input, MetaDataIndex, DataIndex][]
const testFileData: {[s: string]: [string, number, number][]} = {
    "CSV": [
            ["a,b,c,d\n1970-01-01T00:00:00,bt,ct,dt", 0, 0],
            ["a|b|c|d\n1970-01-01T00:00:00|bt|ct|dt", 0, 0],
            ["a;b;c;d\n1970-01-01T00:00:00;bt;ct;dt", 0, 0],
            ["afdsfax aedasfea fyeoa r6adosgfa\ng ahsdftak vdfs fd yksd fsd", -1, -1]
    ]
};
const testMetaData: FileMetaData[] = [
    {
        headers: ["a","b","c","d"],
        firstDate: "1970-01-01T00:00:00",
        lastDate: "1970-01-01T00:00:00",
        dataSizeIndices: [["1970-01-01T00:00:00", 1]]
    }
];
const testTracyData: TracyData[][] = [
    [{ a: "1970-01-01T00:00:00", b: "bt", c: "ct", d: "dt" }],
];

// Test the implemented converters
describe("CSV converters", () => {
    const csvConverters: [string, FTracyConverter<string | ReadStream>, number[]][] = [
        // Name, Converter, Should Pass
        ["Papa parser converter", NEW_CONVERTERS.TRACY_STREAM_PAPAPARSER, [0, 1, 2]],
    ];

    csvConverters.forEach(([name, converter, canPassTestIndices]) => {
        describe(name, () => {
            testFileData["CSV"].forEach(([inputData, metaDataIndex, tracyDataIndex], i) => {
                if (!canPassTestIndices.includes(i)) return;
                const metaData = testMetaData.at(metaDataIndex);
                const tracyData = testTracyData.at(tracyDataIndex);
            
                describe("getMetaData", () => {
                    it("should work with standard input " + i, () => {
                        Sinon.replace(converter, "fileReader", Sinon.fake.resolves(inputData));
                        converter.getMetadata("test").then(fmd => {
                            assert.deepEqual(fmd, metaData);
                        });
                        Sinon.restore();
                    });
                });
                describe("getData", () => {
                    it("should work with standard input " + i, () => {
                        Sinon.replace(converter, "fileReader", Sinon.fake.resolves(inputData));
                        converter.getData("test", [metaData!.firstDate, metaData!.lastDate]).then(fmd => {
                            assert.deepEqual(fmd, tracyData);
                        });
                        Sinon.restore();
                    });
                });
            
                // describe("fileReader", () => {
            
                // });
            });
        });
    });
    
});

// // These are more converter tests
// it("should bubble up file read errors", (done) => {
//     // stub the getMetadata of the converter implemetation
//     const stubbedConverter = Sinon.stub(testConverterUnimplemented);
//     const rejectionReason = "Test reject";
//     stubbedConverter.fileReader.rejects(rejectionReason);
//     const fileName = "a file";
//     const converterName = "testConverter";
//     conversionHandler.addConverter(converterName, stubbedConverter);

//     conversionHandler.getMetadata([fileName], [converterName]).then(v => {
//         assert.strictEqual(v[0].status, "rejected");
//         assert.strictEqual((v[0] as PromiseRejectedResult).reason, rejectionReason);
//     }).finally(done);
// });


// // Test all these converters, same tests for each
// ([
//     ["Stream-Papa", NEW_CONVERTERS.TRACY_STREAM_PAPAPARSER],
//     ["String-Standard", NEW_CONVERTERS.TRACY_STRING_STANDARD_CONVERTER],
//     ["String-JSON", NEW_CONVERTERS.TRACY_JSON_READER]
// ] as [string, FTracyConverter<string | ReadStream>][]).forEach(([name, converter]) => {
//     describe(name, () => {
//         // Stub converter file reader
//         converter.fileReader;
//         it("", () => {
//             converter.getMetadata();
//         });
//     });
// });

// it("Fail", () => {
//     assert.strictEqual(1, 2);
// });