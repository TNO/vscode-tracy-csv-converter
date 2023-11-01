import { DEFAULT_SEARCH_TERMS } from "./constants";

export const FILE_STATUS_TABLE: { [s: string]: (...args: (string | number)[]) => string } = {
    "New": () => ("Reading file"),
    "ReceivedHeaders": (amount) => (`Received ${amount} headers.`),
    "Ready": () => ("Ready to merge"),
    "Error": (content) => (`Error: ${content}`),
};

export interface FileStatus {
    status: string;
    error?: string;
    warning?: string;
}

// Data structure of the files in the webview
export interface FileSendData {
    // name: string, // This will be stored in the keys
    converter: number;
    termSearchIndex: number;
}

export interface FileDisplayData {
    status: FileStatus;
    dates: [string, string];
    terms: [string, number][];
}

export interface FileSharedData {
    headers: string[];
}

export type FileData = FileSendData & FileDisplayData & FileSharedData;

// Meta data of files
export interface FileMetaData {
    fileName: string;
    headers: string[];
    firstDate: string;
    lastDate: string;
    dataSizeIndices: [string, number][]; // Probably not a number
    termOccurrances: [string, number][];
}

export interface TermFlags {
    caseSearch: boolean,
    wholeSearch: boolean,
    reSearch: boolean,
}

export interface FileMetaDataOptions {
    terms: [string, TermFlags][],
    termSearchIndex: {[s: string]: number}
}

export interface DatesState {
    earliest: number;
    latest: number;
    begin: number;
    end: number;
}

// Webview Persistance State
interface WebviewState {
    // MultiConverterOptionsWebview (app)
    fileData: {[s: string]: FileData}
    dates: DatesState;
    fileSize: number;
    submitText: string;
    // TermSearch
    headerToSearch: string;
    terms: {[s: string]: TermFlags};
}



export const updateWebviewState = (state: Partial<WebviewState>) => {
    const oldState: WebviewState = vscodeAPI.getState() || { // Defaults
        fileData: {},
        dates: {
            earliest: 0,
            latest: 0,
            begin: 0,
            end: 0
        },
        fileSize: 0,
        submitText: "",
        headerToSearch: "",
        terms: populateTerms(DEFAULT_SEARCH_TERMS),
    };
    vscodeAPI.setState({ ...oldState, ...state });
};

// The messages from the webview to the extension panel handler
export type SubmissionTypes = "save" | "open";
export type Web2ExtMessage = { command: "add-files" | "initialize" }
    | { command: "read-metadata", files: { [s: string]: FileSendData }, options: FileMetaDataOptions }
    | { command: "submit", files: { [s: string]: FileSendData }, constraints: [string, string], type: SubmissionTypes }
    | { command: "get-file-size", date_start: string, date_end: string };

// The messages from the extension panel handler to the webview
export type Ext2WebMessage = { command: "clear" }
    | { command: "initialize", converters: string[] }
    | { command: "add-files", data: string[] }
    | { command: "metadata", metadata: FileMetaData[], totalStartDate: string, totalEndDate: string }
    | { command: "error" | "warning", file_names: string[], messages: string[] }
    | { command: "size-estimate", size: number }
    | { command: "submit-message", text: string };

interface Ivscodeapi {
    postMessage(message: Web2ExtMessage): void;
    setState(state: WebviewState): void;
    getState(): WebviewState | undefined;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const vscodeAPI: Ivscodeapi = acquireVsCodeApi();

export const postW2EMessage = (message: Web2ExtMessage) => {
    vscodeAPI.postMessage(message);
};

export function populateTerms(defaultTerms: string[]) {
    const t: {[s: string]: TermFlags} = {};
    defaultTerms.forEach(v => t[v] = { caseSearch: false, wholeSearch: false, reSearch: false } as TermFlags);
    return t;
}