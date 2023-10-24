import React from "react";
import { FILE_STATUS_TABLE, FileData, FileStatus } from "../communicationProtocol";
import { cloneDeep, isEqual } from "lodash";
import { DEFAULT_TERM_SEARCH_INDEX } from "../constants";

type FileDataReducerAction = 
    | { type: "set-data", state: {[s: string]: FileData} }
    | { type: "add-files", files: string[] }
    | { type: "new-status", level: keyof FileStatus, files: string[], messages: string[] }
    | { type: "new-metadata", files: string[], headers: string[][], status: string[], dates: [string, string][], terms: [string, number][][] }
    | { type: "switch-signal-word-header", header: string }
    | { type: "switch-converter", file: string, converter: number }
    | { type: "remove-file", file: string };

let searchHeader = "";
export function fileDataReducer(state: [{ [s: string]: FileData }, number], action: FileDataReducerAction): [{ [s: string]: FileData}, number] {
    const [newState, dirty] = cloneDeep(state);
    console.log("Performing action", action.type);
    let newMetadata = 0;
    switch (action.type) {
        case "set-data":
            return [action.state, dirty];
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
        case "new-status":
            action.files.forEach((f, i) => newState[f].status[action.level] = action.messages[i]);
            break;
        case "new-metadata":
            action.files.forEach((f, i) => {
                newState[f].headers = action.headers[i];
                newState[f].termSearchIndex = searchHeader === "" ? DEFAULT_TERM_SEARCH_INDEX : action.headers[i].indexOf(searchHeader);
                newState[f].dates = action.dates[i];
                newState[f].status.status = action.status[i];
                newState[f].terms = action.terms[i];
            })
            break;
        case "switch-converter":
            // reset
            newState[action.file].dates = ["", ""];
            newState[action.file].status = { status: FILE_STATUS_TABLE.New() };
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
    // Should one of the following occur, try to update the metadata
    switch(action.type) {
        case "add-files":
        case "remove-file":
        case "switch-converter":
        case "switch-signal-word-header":
            newMetadata++;
    }
    // If nothing has changed, don't ask for new metadata
    if (isEqual(state, newState)) {
        newMetadata = 0;
    }
    
    return [newState, dirty + newMetadata];
}


// eslint-disable-next-line @typescript-eslint/naming-convention
export const FileDataContext = React.createContext<{
    fileData: [{[s: string]: FileData}, number],
    fileDataDispatch: React.Dispatch<FileDataReducerAction>,
}>({
    fileData: [{}, 0],
    fileDataDispatch: () => {},
});
