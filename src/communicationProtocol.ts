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

// The messages from the webview to the extension panel handler
interface ReadMetadataMessage {
    command: "read-metadata";
    files: { [s: string]: FileData};
}

interface SubmitMessage {
    command: "submit";
    files: { [s: string]: FileData };
    constraints: [string, string];
}

interface GetFileSizeMessage {
    command: "get-file-size";
    date_start: string;
    date_end: string;
}

export type Web2ExtMessage = ReadMetadataMessage | SubmitMessage | GetFileSizeMessage | { command: "add-files" | "initialize" };


// Meta data of files
export interface FileMetaData {
    headers: string[];
    firstDate: string;
    lastDate: string;
    dataSizeIndices: [string, number][]; // Probably not a number
}

interface WebviewState {
    files: { [s: string]: FileData };
    headersPerFile: { [s: string]: string[] };
    dates: [number, number, string, string];
    fileSize: number;
    submitText: string;
    filesStatus: { [s: string]: FileStatus };
    filesDates: { [s: string]: [string, string] };
    convertersList: string[];
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

export const updateWebviewState = (state: Partial<WebviewState>) => {
    const oldState: WebviewState = vscodeAPI.getState() || { // Defaults
        files: {},
        headersPerFile: {},
        dates: [0, 0, "", ""],
        fileSize: 0,
        submitText: "",
        filesStatus: {},
        filesDates: {},
        convertersList: []
    };
    vscodeAPI.setState({ ...oldState, ...state });
};

// The messages from the extension panel handler to the webview
interface InitializeMessage {
    command: "initialize";
    converters: string[];
}

interface AddFilesMessage {
    command: "add-files";
    data: string[];
}

interface SendMetadataMessage {
    command: "metadata";
    metadata: { [s: string]: FileMetaData };
    totalStartDate: string;
    totalEndDate: string;
}

interface EncounteredErrorsMessage {
    command: 'error';
    file_names: string[];
    messages: string[];
}

interface EncounteredWarningsMessage {
    command: 'warning';
    file_names: string[];
    messages: string[];
}

interface SendSizeEstimateMessage {
    command: 'size-estimate';
    size: number;
}

interface SubmissionErrorMessage {
    command: 'submit-message';
    text: string;
}

export type Ext2WebMessage = InitializeMessage | AddFilesMessage | SendMetadataMessage | EncounteredErrorsMessage |
    EncounteredWarningsMessage | SendSizeEstimateMessage | SubmissionErrorMessage | { command: "clear" };
