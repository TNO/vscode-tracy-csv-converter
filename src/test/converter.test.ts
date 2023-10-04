import { assert } from 'chai';
import { ConversionHandler, NEW_CONVERTERS } from '../converters';
import { describe, it } from 'mocha';

describe("Converter Tests", () => {
    it("Converter empty", () => {
        const converter = new ConversionHandler();
        assert.deepEqual(converter.getConvertersList(), []);
    });

    it("Converter not empty", () => {
        const converter = new ConversionHandler();
        converter.addConverter("Test", NEW_CONVERTERS.TRACY_STREAM_PAPAPARSER);
        assert.strictEqual(converter.getConvertersList().length, 1);
    });

    // it("Fail", () => {
    //     assert.strictEqual(1, 2);
    // });
});
