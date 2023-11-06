import React from "react";
import { FileData, FileStatus } from "../../communicationProtocol";
import { cloneDeep } from "lodash";

type FileDataReducerAction = 
    | { type: "set-data", state: {[s: string]: FileData} }
    | { type: "add-files", files: string[] }
    | { type: "new-status", level: keyof FileStatus, files: string[], messages: string[] }
    | { type: "new-metadata", files: string[], headers: string[][], status: string[], dates: [string, string][], terms: [string, number][][] }
    | { type: "switch-signal-word-header", header: string }
    | { type: "switch-converter", file: string, converter: number }
    | { type: "remove-file", file: string };

let searchHeader = "";
export function fileDataReducer(state: { [s: string]: FileData }, action: FileDataReducerAction): { [s: string]: FileData} {
    const newState = cloneDeep(state);
    console.log("Performing action", action.type);
    switch (action.type) {
        case "set-data":
            return action.state;
        case "add-files":
            action.files.forEach(f =>
                newState[f] ??= {
                    converter: 0,
                    headers: [],
                    termSearchIndex: -2,
                    dates: ["", ""],
                    status: { status: "Reading file..." },
                    terms: []
                }
            );
            break;
        case "new-status":
            action.files.forEach((f, i) => newState[f].status[action.level] = action.messages[i]);
            break;
        case "new-metadata":
            action.files.forEach((f, i) => {
                newState[f].headers = action.headers[i];
                newState[f].termSearchIndex = searchHeader === "" ? -2 : action.headers[i].indexOf(searchHeader);
                newState[f].dates = action.dates[i];
                newState[f].status.status = action.status[i];
                newState[f].terms = action.terms[i];
            })
            break;
        case "switch-converter":
            // reset
            newState[action.file].dates = ["", ""];
            newState[action.file].status = { status: "Reading file again..." };
            // set to new
            newState[action.file].converter = action.converter;
            break;
        case "switch-signal-word-header":
            searchHeader = action.header;
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
