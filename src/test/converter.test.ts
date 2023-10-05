import { assert } from 'chai';
import { ConversionHandler, FTracyConverter, NEW_CONVERTERS } from '../converters';
import { describe, it } from 'mocha';
import { FileMetaData } from '../communicationProtocol';
import Sinon from 'sinon';

describe("ConversionHandler", () => {

    const testConverterUnimplemented : FTracyConverter<string> = {
        getMetadata: function (): Promise<FileMetaData> {
            throw new Error('Function not implemented.');
        },
        getData: function (): Promise<{ [s: string]: string; }[]> {
            throw new Error('Function not implemented.');
        },
        fileReader: function (fileName: string): Promise<string> {
            throw new Error('Function not implemented.');
        }
    };

    it("getConvertersList should start empty", () => {
        const converter = new ConversionHandler();
        assert.deepEqual(converter.getConvertersList(), []);
    });

    it("getConvertersList should not be empty after adding a converter", () => {
        const converter = new ConversionHandler();
        converter.addConverter("Test", testConverterUnimplemented);
        assert.strictEqual(converter.getConvertersList().length, 1);
    });

    it("getConverterKey should return undefined if no converter at index", () => {
        const converter = new ConversionHandler();
        assert.isUndefined(converter.getConverterKey(0));
    });

    it("getConverterKey should return the testConverter if entered at position", () => {
        const converter = new ConversionHandler();
        converter.addConverter("Test", testConverterUnimplemented);
        assert.strictEqual(converter.getConverterKey(0), "Test");
    });

    it("getMetadata should call nothing if no files", (done) => {
        const converter = new ConversionHandler();
        const testConverter = Sinon.spy(testConverterUnimplemented);
        converter.addConverter("test", testConverter);
        converter.getMetadata([], []).then(v => {
            assert.deepEqual(v, []);
            Sinon.assert.callCount(testConverter.getMetadata, 0);
        }).finally(() => done());
    });

    it("getData should call nothing if no files", (done) => {
        const converter = new ConversionHandler();
        const testConverter = Sinon.spy(testConverterUnimplemented);
        converter.addConverter("test", testConverter);
        converter.getConversion([], [], ["", ""]).then(v => {
            assert.deepEqual(v, []);
            Sinon.assert.callCount(testConverter.getData, 0);
        }).finally(() => done());
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
