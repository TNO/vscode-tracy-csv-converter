import React from "react";
import { FILE_STATUS_TABLE, FileData, FileStatus } from "../communicationProtocol";
import { cloneDeep } from "lodash";
import { DEFAULT_TERM_SEARCH_INDEX } from "../constants";

type FileDataReducerAction = 
    | { type: "set-data", state: {[s: string]: FileData} }
    | { type: "add-files", files: string[] }
    | { type: "new-headers", files: string[], headers: string[][] }
    | { type: "new-status", level: keyof FileStatus, files: string[], messages: string[] }
    | { type: "new-dates", files: string[], dates: [string, string][] }
    | { type: "new-terms", files: string[], terms: [string, number][][] }
    | { type: "switch-signal-word-header", header: string }
    | { type: "switch-converter", file: string, converter: number }
    | { type: "remove-file", file: string };

export function fileDataReducer(state: { [s: string]: FileData }, action: FileDataReducerAction) {
    const newState = cloneDeep(state);
    // if ("files" in action)
    //     action.files.forEach(f => 
    //         newState[f] ??= {
    //             converter: 0,
    //             headers: [],
    //             termSearchIndex: DEFAULT_TERM_SEARCH_INDEX,
    //             dates: ["", ""],
    //             status: { status: "" },
    //             terms: []
    //         }
    //     );
    switch (action.type) {
        case "set-data":
            return action.state;
        case "add-files":
            action.files.forEach(f => 
                newState[f] ??= {
                    converter: 0,
                    headers: [],
                    termSearchIndex: DEFAULT_TERM_SEARCH_INDEX,
                    dates: ["", ""],
                    status: { status: "" },
                    terms: []
                }
            );
            break;
        case "new-headers":
            action.files.forEach((f, i) => newState[f].headers = action.headers[i]);
            break;
        case "new-dates":
            action.files.forEach((f, i) => newState[f].dates = action.dates[i]);
            break;
        case "new-status":
            action.files.forEach((f, i) => newState[f].status[action.level] = action.messages[i]);
            break;
        case "new-terms":
            action.files.forEach((f, i) => newState[f].terms = action.terms[i]);
            break;
        case "switch-converter":
            // reset
            newState[action.file].dates = ["", ""];
            newState[action.file].status = { status: FILE_STATUS_TABLE.New() };
            // set to new
            newState[action.file].converter = action.converter;
            break;
        case "switch-signal-word-header":
            // find the header
            Object.keys(newState).forEach(f => {
                newState[f].termSearchIndex = newState[f].headers.indexOf(action.header);
            });
            break;
        case "remove-file":
            delete newState[action.file];
            break;
        default:
            break;
    }
    return newState;
}


// eslint-disable-next-line @typescript-eslint/naming-convention
export const FileDataContext = React.createContext<{
    fileData: {[s: string]: FileData},
    fileDataDispatch: React.Dispatch<FileDataReducerAction>,
}>({
    fileData: {},
    fileDataDispatch: () => {},
});
