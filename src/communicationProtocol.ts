interface FileStatus { c: string };
export const FILE_STATUS_TABLE: { [s: string]: (...args: any[]) => FileStatus } = {
    "New": () => ({c: "Reading file"}),
    "ReceivedHeaders": (amount) => ({c: `Received ${amount} headers`}),
    "Ready": () => ({c: "Ready to merge"}),
    "Error": (content) => ({c: `Error: ${content}`}),
};

export interface FileData {
    // name: string, // This will be stored in the keys
    converter: number;
    status: FileStatus;
    statusColor?: `#${string}`;
}

// The messages from the webview to the extension panel handler
interface ReadDatesMessage {
    command: "read-dates";
    files: { [s: string]: FileData };
}

interface ReadNewHeadersMessage {
    command: "read-headers";
    fileNames: string[];
    converters: number[];
}

interface SubmitMessage {
    command: "submit";
    files: { [s: string]: FileData };
    constraints: [string, string];
}

export type Web2ExtMessage = ReadDatesMessage | ReadNewHeadersMessage | SubmitMessage | { command: "add-files" | "initialize" };

interface Ivscodeapi {
    postMessage(message: Web2ExtMessage): void;
}
// @ts-ignore
export const vscodeAPI: Ivscodeapi = acquireVsCodeApi();

export const askForNewDates = (files: { [s: string]: FileData }) => {
    vscodeAPI.postMessage({ command: "read-dates", files });
};

export const askForNewHeaders = (fileNames: string[], converter: number[]) => {
    vscodeAPI.postMessage({ command: "read-headers", fileNames, converters: converter});
}

// The messages from the extension panel handler to the webview
interface InitializeMessage {
    command: "initialize";
    converters: string[];
}

interface AddFilesMessage {
    command: "add-files";
    data: string[];
}

interface SendHeadersMessage {
    command: 'headers';
    file_names: string[];
    data: string[][];
}

interface EncounteredErrorsMessage {
    command: 'error';
    file_names: string[];
    messages: string[];
}

interface SendEdgeDatesMessage {
    command: 'edge-dates';
    date_start: string;
    date_end: string;
}

interface SubmissionErrorMessage {
    command: 'submit-message';
    text: string;
}

export type Ext2WebMessage = InitializeMessage | AddFilesMessage | SendHeadersMessage | EncounteredErrorsMessage | SendEdgeDatesMessage | SubmissionErrorMessage | { command: "clear" };
