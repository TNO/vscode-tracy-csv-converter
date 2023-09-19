
interface Ivscodeapi {
    postMessage(message: any): void;
}
// @ts-ignore
export const vscodeAPI: Ivscodeapi = acquireVsCodeApi();

// The commands from the webview to the extension
export const EXT_COMMANDS = {
    submit: { id: "submit" }
}

type ReadDatesCommand = {
    command: string;
    files: {[s: string]: {}};
}

export const askForNewDates = (files: {}) => {
    vscodeAPI.postMessage({ command: "read-dates", files });
};

export const askForNewHeaders = (file: string, converter: string) => {
    vscodeAPI.postMessage({ command: "read-headers", file, converter});
}