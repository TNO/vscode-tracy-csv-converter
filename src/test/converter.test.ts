import { assert } from 'chai';
import { ConversionHandler, FTracyConverter, NEW_CONVERTERS } from '../converters';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { FileMetaData } from '../communicationProtocol';
import Sinon from 'sinon';

describe("ConversionHandler", () => {
    const conversionHandler = new ConversionHandler();

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

    

    beforeEach(() => {
        conversionHandler.clear(); // Do I need to test this?      
    });

    afterEach(() => {
        Sinon.restore();
    })

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
        const spiedTestConverter = Sinon.spy(testConverterUnimplemented);
        it("should call nothing if no files", (done) => {
            conversionHandler.addConverter("test", spiedTestConverter);
            conversionHandler.getMetadata([], []).then(v => {
                assert.deepEqual(v, []);
                Sinon.assert.callCount(spiedTestConverter.getMetadata, 0);
            }).finally(() => done());
        });

        it("should cache file metadatas", (done) => {
            const spiedFileReader = Sinon.replace(testConverterUnimplemented, "getMetadata", Sinon.fake.resolves("test-getMetadata"));
            const converterName = "testConverter";
            conversionHandler.addConverter(converterName, testConverterUnimplemented);
            conversionHandler.getMetadata(["a file"], [converterName]).then(v => {
                // This should just return a good thing
                (v[0] as PromiseFulfilledResult<FileMetaData>).value
            });
            spiedTestConverter.fileReader.calledOnce;
        });

        it("should bubble up file read errors", (done) => {

        });

        it("should bubble up parsing errors", (done) => {

        });

    });

    describe("getConversion", () => {
        const spiedTestConverter = Sinon.spy(testConverterUnimplemented);
        it("getData should call nothing if no files", (done) => {
            conversionHandler.addConverter("test", spiedTestConverter);
            conversionHandler.getConversion([], [], ["", ""]).then(v => {
                assert.deepEqual(v, []);
                Sinon.assert.callCount(spiedTestConverter.getData, 0);
            }).finally(() => done());
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
