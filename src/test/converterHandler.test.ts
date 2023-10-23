import { assert } from "chai";
import Sinon from "sinon";
import { describe, it, afterEach } from "mocha";
import { FileMetaData, FileMetaDataOptions } from "../communicationProtocol";
import { FILE_NAME_HEADER, RESOLVED_TIMESTAMP_HEADER } from "../constants";
import { ConversionHandler } from "../converterHandler";
import { FTracyConverter } from "../converters";

// An example of correct meta data, for tests that are supposed to pass
const correctFakeMetaData: FileMetaData = {
    fileName: "testFileName",
    headers: ["timestampTest", "data"],
    firstDate: "1970-01-01T00:00:00",
    lastDate: "1970-01-01T00:00:01",
    dataSizeIndices: [["1970-01-01T00:00:01", 1]],
    termOccurrances: []
};
const metadataOptions: FileMetaDataOptions = {
    terms: [],
    termSearchIndex: {}
};
metadataOptions.termSearchIndex[correctFakeMetaData.fileName] = 1;

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
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, stubbedConverter);

            conversionHandler.getMetadata([correctFakeMetaData.fileName], [converterName], metadataOptions).then(v => {
                assert.strictEqual(v[0].status, "rejected");
            }).finally(done);
        });
        
        it("should call nothing if no files", (done) => {
            const spiedTestConverter = Sinon.spy(testConverterUnimplemented);
            conversionHandler.addConverter("test", spiedTestConverter);
            conversionHandler.getMetadata([], [], metadataOptions).then(v => {
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
                const converterName = "testConverter";
                conversionHandler.addConverter(converterName, stubbedConverter);
                // Test it
                conversionHandler.getMetadata([correctFakeMetaData.fileName], [converterName], metadataOptions).then(v => {
                    assert.strictEqual(v[0].status, "rejected");
                }).finally(done);
            });
        });

        it("should return metadata gained from converter function", (done) => {
            // stub the getMetadata of the converter implemetation
            const stubbedConverter = Sinon.stub(testConverterUnimplemented);
            stubbedConverter.getMetadata.resolves(correctFakeMetaData);
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, stubbedConverter);
            // Test it
            conversionHandler.getMetadata([correctFakeMetaData.fileName], [converterName], metadataOptions).then(v => {
                assert.strictEqual(v[0].status, "fulfilled");
                assert.deepEqual((v[0] as PromiseFulfilledResult<FileMetaData>).value, correctFakeMetaData);
            }).finally(done);
        });

        it("should cache file metadatas", (done) => {
            // stub the getMetadata of the converter implemetation
            const stubbedConverter = Sinon.stub(testConverterUnimplemented);
            stubbedConverter.getMetadata.resolves(correctFakeMetaData);
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, stubbedConverter);
            // Test it
            conversionHandler.getMetadata([correctFakeMetaData.fileName], [converterName], metadataOptions).then(v0 => {
                assert.strictEqual(v0[0].status, "fulfilled");
                Sinon.assert.calledOnce(stubbedConverter.getMetadata); // check double check
                return conversionHandler.getMetadata([correctFakeMetaData.fileName], [converterName], metadataOptions);
            }).then(v1 => {
                // call it again
                assert.strictEqual(v1[0].status, "fulfilled");
                // returns are equal
                assert.deepEqual<FileMetaData>((v1[0] as PromiseFulfilledResult<FileMetaData>).value, correctFakeMetaData);
                // still only called once
                Sinon.assert.calledOnce(stubbedConverter.getMetadata);
            }).finally(done);
        });
        // TODO: add test for differing cache
        // TODO: add test for terms options
        

        it("should bubble up parsing errors", (done) => {
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, testConverterUnimplemented);
            conversionHandler.getMetadata([correctFakeMetaData.fileName], [converterName], metadataOptions).then(v => {
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
            const converterName = "test";
            conversionHandler.addConverter(converterName, stubbedConverter);
            conversionHandler.getConversion([correctFakeMetaData.fileName], [converterName], ["1970-01-01T00:00:00", "2000-01-01T00:00:00"]).then(v => {
                assert.strictEqual(v[0].status, "fulfilled");
                const convertedData = (v[0] as PromiseFulfilledResult<{[s: string]: string}[]>).value;
                assert.hasAllKeys(convertedData, addedHeaders);
            }).finally(done);
        });
    });
});