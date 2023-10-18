import React from 'react';
import { cloneDeep } from 'lodash';
import { Tooltip } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { vscodeAPI, FileData, FILE_STATUS_TABLE, Ext2WebMessage, FileStatus, updateWebviewState, FileListDisplayData } from '../communicationProtocol';
import { parseDateString } from '../utility';
import { WEBVIEW_TIMESTAMP_FORMAT } from '../constants';

interface Props {
    files: {[s: string]: FileData},
    setFiles: React.Dispatch<React.SetStateAction<{ [s: string]: FileData }>>
}

type ActionType = 
    | { type: "set-data", state: { [s: string]: FileListDisplayData } }
    | { type: "new-status", level: keyof FileStatus, files: string[], messages: string[] }
    | { type: "new-dates", files: string[], dates: [string, string][] }
    | { type: "new-terms", files: string[], terms: [string, number][][] }
    | { type: "switch-converter", file: string }
    | { type: "remove-file", file: string };

function reducer(state: { [s: string]: FileListDisplayData }, action: ActionType) {
    const newState = cloneDeep(state);
    if ("files" in action) action.files.forEach(f => newState[f] ??= { dates: ["", ""], status: { status: "" }, terms: [] });
    switch (action.type) {
        case "set-data":
            return action.state;
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
            newState[action.file].dates = ["", ""];
            newState[action.file].status = { status: FILE_STATUS_TABLE.New() };
            break;
        case "remove-file":
            delete newState[action.file];
            break;
        default:
            break;
    }
    return newState;
}

let initialization = false;
export default function FileList({files, setFiles}: Props) {
    // Initialize states, this is here because the converters.ts imports fs and vscode
    const [convertersList, setConvertersList] = React.useState<string[]>(["Getting converters"]);

    // const [removeMode, setRemoveMode] = React.useState(false);
    const removeMode = true;

    const [filesDisplayData, dispatch] = React.useReducer(reducer, {});

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize":
                setConvertersList(message.converters);
                initialization = false;
                break;
            case "warning":
            case "error":
                dispatch({ type: "new-status", files: message.file_names, level: message.command, messages: message.messages});
                break;
            case "add-files": { // When new files are read by the extension, send to the webview and add them here
                // Add the requested files
                setFiles((files) => {
                    const newFiles = cloneDeep(files);
                    message.data.forEach((fileName) => {
                        if (!newFiles[fileName]) {
                            newFiles[fileName] = { converter: 0 };
                        }
                    });
                    return newFiles;
                });
                break;
            }
            case "metadata": {
                const files = Object.keys(message.metadata);
                dispatch({ type: "new-dates", files, dates: files.map(f => [ message.metadata[f].firstDate, message.metadata[f].lastDate ])});
                dispatch({ type: "new-status", files, level: "status", messages: files.map(f => FILE_STATUS_TABLE.ReceivedHeaders(message.metadata[f].headers.length))});
                dispatch({ type: "new-terms", files, terms: files.map(f => message.metadata[f].termOccurrances)});
                break;
            }
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', onMessage);
        // Read persistance state
        const prevState = vscodeAPI.getState();
        if (prevState) {
            initialization = true;
            dispatch({ type: "set-data", state: prevState.fileListData });
        }
    }, []);

    // Update persistance state
    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ fileListData: filesDisplayData, convertersList });
    }, [filesDisplayData, convertersList]);

    const amountOfFiles = Object.keys(files).length;

    // When you change the converter you want to use for a specific file
    const onConverterSwitch = (file: string, value: string) => {
        // Set the state
        const newFiles = cloneDeep(files);
        newFiles[file].converter = parseInt(value);
        setFiles(newFiles);

        // Reset display data
        dispatch({ type: "switch-converter", file });
    };

    const onRemoveFileRow = (file: string) => {
        const newFiles = cloneDeep(files);
        delete newFiles[file];
        setFiles(newFiles);
        dispatch({ type: "remove-file", file });
    };

    const onAddFiles = () => {
        vscodeAPI.postMessage({ command: "add-files" });
    };

    const renderFileRow = (file: string) => {
        const iconStyle: React.CSSProperties = { width: 10, height: 10, color: removeMode ? 'red' : '', cursor: removeMode ? 'pointer' : 'default' };
        const displayData = filesDisplayData[file];

        return (
            <VSCodeDataGridRow key={file+"dropdown"}>
                <VSCodeDataGridCell gridColumn='1'>
                    {removeMode && <div style={iconStyle} className='codicon codicon-close' onClick={() => onRemoveFileRow(file)}/>}
                    {!removeMode && <div style={iconStyle} className='codicon codicon-circle-filled'/>}
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='2'>{file}</VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='3'>
                    {/* Show converters for the file */}
                    <VSCodeDropdown style={{ width: '100%' }} value={files[file].converter.toString()} onInput={(e: React.BaseSyntheticEvent) => onConverterSwitch(file, e.target.value)}>
                        {convertersList.map((converterName, index) => ( // TODO: disable unusable converters (based on filename?)
                            <VSCodeOption key={converterName + " converter"} value={index.toString()}>{converterName}</VSCodeOption>
                        ))}
                    </VSCodeDropdown>
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='4'>
                    {displayData && displayData.dates[0] !== "" && displayData.dates[1] !== "" && <div>
                        <div>{parseDateString(displayData.dates[0]).format(WEBVIEW_TIMESTAMP_FORMAT)} to</div>
                        <div>{parseDateString(displayData.dates[1]).format(WEBVIEW_TIMESTAMP_FORMAT)}</div>
                    </div>}
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='5'>
                    {displayData && displayData.terms.length === 0 && <div>No terms found!</div>}
                    {displayData && displayData.terms.map(([term, amount]) => (
                        amount > 0 && <div key={term}>{term} ({amount.toString()} times)</div>
                    ))}
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='6'>
                    {displayData && !(displayData.status.error) && <div>{ displayData.status.status }</div>}
                    {displayData && !(displayData.status.error) && displayData.status.warning && <div style={{color: "#FF5733"}}>{displayData.status.warning}</div>}
                    {displayData && displayData.status.error && <div style={{ color: "#FF0000"}}>Error: {displayData.status.error}</div>}
                </VSCodeDataGridCell>
            </VSCodeDataGridRow>
        );
    };

    
    return (
        <div style={{ paddingBottom: 5, width: '100%' }}>
            <h2>Files</h2>
            <VSCodeDataGrid id="files-grid" gridTemplateColumns='2vw 30vw 250px 165px 160px' style={{ border: "1px solid white", minHeight: "100px" }}>
                <VSCodeDataGridRow row-rowType='sticky-header'>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='1'></VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>File</VSCodeDataGridCell>
                    <Tooltip title="The format of the file.">
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='3'>Format</VSCodeDataGridCell>
                    </Tooltip>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='4'>Timestamps</VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='5'>Terms</VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='6'>Status</VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {Object.keys(files).map(renderFileRow)}
            </VSCodeDataGrid>
            <div style={{ paddingTop: 5 }}>
                <VSCodeButton appearance={amountOfFiles === 0 ? 'primary' : 'secondary'} onClick={onAddFiles}>Add</VSCodeButton>
                {/* <VSCodeButton appearance='secondary' onClick={() => setRemoveMode(mode => !mode)} disabled={amountOfFiles === 0}>{removeMode ? "Stop removing" : "Remove"}</VSCodeButton> */}
            </div>
        </div>
    );
    
}