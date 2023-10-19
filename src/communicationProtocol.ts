import { DEFAULT_SEARCH_TERMS, DEFAULT_TERM_SEARCH_INDEX } from "./constants";

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
export interface FileData {
    // name: string, // This will be stored in the keys
    converter: number;
}

export interface FileListDisplayData {
    status: FileStatus;
    dates: [string, string];
    terms: [string, number][];
}

// The messages from the webview to the extension panel handler
export type Web2ExtMessage = { command: "add-files" | "initialize" }
    | { command: "read-metadata", files: { [s: string]: FileData }, options: FileMetaDataOptions }
    | { command: "submit", files: { [s: string]: FileData }, constraints: [string, string] }
    | { command: "get-file-size", date_start: string, date_end: string };


// Meta data of files
export interface FileMetaData {
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
    termSearchIndex: string
}

// Webview Persistance State
interface WebviewState {
    // MultiConverterOptionsWebview (app)
    files: { [s: string]: FileData };
    headersPerFile: { [s: string]: string[] };
    dates: [number, number, string, string];
    fileSize: number;
    submitText: string;
    // FileList
    fileListData: { [s: string]: FileListDisplayData };
    convertersList: string[];
    // TermSearch
    headerToSearch: string;
    terms: {[s: string]: TermFlags};
}

interface Ivscodeapi {
    postMessage(message: Web2ExtMessage): void;
    setState(state: WebviewState): void;
    getState(): WebviewState | undefined;
}
// @ts-ignore
export const vscodeAPI: Ivscodeapi = acquireVsCodeApi();

export const postW2EMessage = (message: Web2ExtMessage) => {
    vscodeAPI.postMessage(message);
};

function populateTerms(defaultTerms: string[]) {
    const t: {[s: string]: TermFlags} = {};
    defaultTerms.forEach(v => t[v] = { caseSearch: false, wholeSearch: false, reSearch: false } as TermFlags);
    return t;
}

export const updateWebviewState = (state: Partial<WebviewState>) => {
    const oldState: WebviewState = vscodeAPI.getState() || { // Defaults
        files: {},
        headersPerFile: {},
        dates: [0, 0, "", ""],
        fileSize: 0,
        submitText: "",
        fileListData: {},
        convertersList: [],
        headerToSearch: "",
        terms: populateTerms(DEFAULT_SEARCH_TERMS),
    };
    vscodeAPI.setState({ ...oldState, ...state });
};

// The messages from the extension panel handler to the webview
export type Ext2WebMessage = { command: "clear" }
    | { command: "initialize", converters: string[] }
    | { command: "add-files", data: string[] }
    | { command: "metadata", metadata: { [s: string]: FileMetaData }, totalStartDate: string, totalEndDate: string }
    | { command: "error" | "warning", file_names: string[], messages: string[] }
    | { command: "size-estimate", size: number }
    | { command: "submit-message", text: string };
