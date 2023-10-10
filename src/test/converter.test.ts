import { assert } from 'chai';
import { ConversionHandler, FTracyConverter, NEW_CONVERTERS } from '../converters';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { FileMetaData } from '../communicationProtocol';
import Sinon from 'sinon';
import { FILE_NAME_HEADER, RESOLVED_TIMESTAMP_HEADER } from '../constants';

const testConverterUnimplemented : FTracyConverter<string> = {
    getMetadata: function (): Promise<FileMetaData> {
        throw new Error('Function not implemented.');
    },
    getData: function (): Promise<{ [s: string]: string; }[]> {
        throw new Error('Function not implemented.');
    },
    fileReader: function (): Promise<string> {
        throw new Error('Function not implemented.');
    }
};

// An example of correct meta data, for tests that are supposed to pass
const correctFakeMetaData: FileMetaData = {
    headers: ["timestampTest", "data"],
    firstDate: "1970-01-01T00:00:00",
    lastDate: "1970-01-01T00:00:01",
    dataSizeIndices: [["1970-01-01T00:00:01", 1]],
};

describe("ConversionHandler", () => {
    const conversionHandler = new ConversionHandler(() => 0);

    afterEach(() => {
        Sinon.restore();
        conversionHandler.clear(); // Do I need to test this?      
    });

    it("getConvertersList should start empty", () => {
        assert.deepEqual(conversionHandler.getConvertersList(), []);
    });

    it("getConvertersList should not be empty after adding a converter", () => {
        conversionHandler.addConverter("Test", testConverterUnimplemented);
        assert.strictEqual(conversionHandler.getConvertersList().length, 1);
    });

    it("getConverterKey should return undefined if no converter at index", () => {
        assert.isUndefined(conversionHandler.getConverterKey(0));
    });

    it("getConverterKey should return the testConverter if entered at position", () => {
        conversionHandler.addConverter("Test", testConverterUnimplemented);
        assert.strictEqual(conversionHandler.getConverterKey(0), "Test");
    });

    describe("getMetadata", () => {
        afterEach(() => {
            Sinon.restore();
            conversionHandler.clear();
        });

        // TODO: generalize this
        // Reject bad files
        it("should reject zip files", (done) => {
            const stubbedConverter = Sinon.stub(testConverterUnimplemented);
            stubbedConverter.getMetadata.resolves(correctFakeMetaData);
            const fileName = "a file.zip";
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, stubbedConverter);

            conversionHandler.getMetadata([fileName], [converterName]).then(v => {
                assert.strictEqual(v[0].status, "rejected");
            }).finally(done);
        });
        
        it("should call nothing if no files", (done) => {
            const spiedTestConverter = Sinon.spy(testConverterUnimplemented);
            conversionHandler.addConverter("test", spiedTestConverter);
            conversionHandler.getMetadata([], []).then(v => {
                assert.deepEqual(v, []);
                Sinon.assert.callCount(spiedTestConverter.getMetadata, 0);
            }).finally(done);
        });

        // Reject malformed metadata
        ([
            ["<= 1 headers", { ...correctFakeMetaData, headers: ["testFewHeaders"] }],
            ["no headers/first header is a timestamp", { ...correctFakeMetaData, headers: ["1970-01-01T00:00:00", "testTimestampHeader"] }],
            ["inability to get size indices", { ...correctFakeMetaData, dataSizeIndices: [] }]
        ] as [string, FileMetaData][]).forEach(([name, fakeMetaData]) => {
            it("should reject files with "+name, (done) => {
                // stub the getMetadata of the converter implemetation
                const stubbedConverter = Sinon.stub(testConverterUnimplemented);
                stubbedConverter.getMetadata.resolves(fakeMetaData);
                const fileName = "a file";
                const converterName = "testConverter";
                conversionHandler.addConverter(converterName, stubbedConverter);
                // Test it
                conversionHandler.getMetadata([fileName], [converterName]).then(v => {
                    assert.strictEqual(v[0].status, "rejected");
                }).finally(done);
            });
        });

        it("should return metadata gained from converter function", (done) => {
            // stub the getMetadata of the converter implemetation
            const stubbedConverter = Sinon.stub(testConverterUnimplemented);
            stubbedConverter.getMetadata.resolves(correctFakeMetaData);
            const fileName = "a file";
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, stubbedConverter);
            // Test it
            conversionHandler.getMetadata([fileName], [converterName]).then(v => {
                assert.strictEqual(v[0].status, "fulfilled");
                assert.deepEqual((v[0] as PromiseFulfilledResult<FileMetaData>).value, correctFakeMetaData);
            }).finally(done);
        });

        it("should cache file metadatas", (done) => {
            // stub the getMetadata of the converter implemetation
            const stubbedConverter = Sinon.stub(testConverterUnimplemented);
            stubbedConverter.getMetadata.resolves(correctFakeMetaData);
            const fileName = "a file";
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, stubbedConverter);
            // Test it
            conversionHandler.getMetadata([fileName], [converterName]).then(v0 => {
                assert.strictEqual(v0[0].status, "fulfilled");
                Sinon.assert.calledOnce(stubbedConverter.getMetadata); // check double check
                return conversionHandler.getMetadata([fileName], [converterName]);
            }).then(v1 => {
                // call it again
                assert.strictEqual(v1[0].status, "fulfilled");
                // returns are equal
                assert.deepEqual<FileMetaData>((v1[0] as PromiseFulfilledResult<FileMetaData>).value, correctFakeMetaData);
                // still only called once
                Sinon.assert.calledOnce(stubbedConverter.getMetadata);
            }).finally(done);
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

        it("should bubble up parsing errors", (done) => {
            const fileName = "a file";
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, testConverterUnimplemented);
            conversionHandler.getMetadata([fileName], [converterName]).then(v => {
                assert.strictEqual(v[0].status, "rejected");
            }).finally(done);
        });

    });

    describe("getConversion", () => {
        afterEach(() => {
            Sinon.restore();
            conversionHandler.clear();
        })

        it("should call nothing if no files are given", (done) => {
            const spiedTestConverter = Sinon.spy(testConverterUnimplemented);
            conversionHandler.addConverter("test", spiedTestConverter);
            conversionHandler.getConversion([], [], ["", ""]).then(v => {
                assert.deepEqual(v, []);
                Sinon.assert.callCount(spiedTestConverter.getData, 0);
            }).finally(done);
        });

        const addedHeaders = [FILE_NAME_HEADER, RESOLVED_TIMESTAMP_HEADER];
        it("should add extra headers " + addedHeaders.reduce((p, c) => p + ", " + c), (done) => {
            const stubbedConverter = Sinon.stub(testConverterUnimplemented);
            stubbedConverter.getData.resolves([{"timestampTest": "1970-01-01T00:00:00", "messageTest": "test"}]);
            const fileName = "test file";
            const converterName = "test";
            conversionHandler.addConverter(converterName, stubbedConverter);
            conversionHandler.getConversion([fileName], [converterName], ["1970-01-01T00:00:00", "2000-01-01T00:00:00"]).then(v => {
                assert.strictEqual(v[0].status, "fulfilled");
                const convertedData = (v[0] as PromiseFulfilledResult<{[s: string]: string}[]>).value;
                assert.hasAllKeys(convertedData, addedHeaders);
            }).finally(done);
        });
    });

    

    

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
});