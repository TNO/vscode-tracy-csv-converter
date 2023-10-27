import React from "react";
import { render } from "@testing-library/react";
// import ReactDOM from "react-dom";
import { describe, it } from "mocha";
import { assert, expect } from "chai";
import FileList from "../../Ux/FileList";

describe("Typescript test example", () => {
    it("test1", async () => {
        const ret = render(<button>Save</button>);
        
        // const button = await ret.getByLabelText("Save");
        // expect(button).to.not.be.null;

        const buttonDom = await ret.getByRole("button");
        expect(buttonDom).to.be.not.null;

        ret.unmount();
    });
})

describe("React FileList", () => {
    it("Renders", async () => {
        const rendered = render(<FileList onChange={() => {}}/>);

        const title = rendered.getByText("Files");
        assert.isNotNull(title);

        rendered.unmount();
    });
});