interface FileStatusString { c: string }
export const FILE_STATUS_TABLE: { [s: string]: (...args: any[]) => FileStatusString } = {
    "New": () => ({c: "Reading file"}),
    "ReceivedHeaders": (amount) => ({c: `Received ${amount} headers. ${amount > 1 ? "Ready to merge." : "Warning: insufficient headers!"}`}),
    "Ready": () => ({c: "Ready to merge"}),
    "Error": (content) => ({c: `Error: ${content}`}),
};
// Data structure of the files in the webview
export interface FileData {
    // name: string, // This will be stored in the keys
    converter: number;
}

export interface FileStatus {
    status: FileStatusString;
    statusColor?: `#${string}`;
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
    headers: { [s: string]: string[] };
    date_start: string;
    date_end: string;
}

interface EncounteredErrorsMessage {
    command: 'error';
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
    SendSizeEstimateMessage | SubmissionErrorMessage | { command: "clear" };
