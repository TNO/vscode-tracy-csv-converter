
interface Ivscodeapi {
    postMessage(message: any): void;
}
// @ts-ignore
export const vscodeAPI: Ivscodeapi = acquireVsCodeApi();

export interface FileData {
    // name: string, // This will be stored in the keys
    converter: number,
    header: number,
}

// The commands from the webview to the extension
export const EXT_COMMANDS = {
    submit: { id: "submit" }
}

type ReadDatesCommand = {
    command: string;
    files: {[s: string]: {}};
}

export const askForNewDates = (files: {}, comparator: string) => {
    vscodeAPI.postMessage({ command: "read-dates", files, comparator });
};

export const askForNewHeaders = (file: string, converter: number) => {
    vscodeAPI.postMessage({ command: "read-headers", file, converter});
}

export function askForMultipleNewHeaders(file_names: string[], converters: number[]) {
    vscodeAPI.postMessage({ command: "read-multiple-headers", file_names, converters })
}