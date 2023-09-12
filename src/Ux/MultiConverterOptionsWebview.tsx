import React from 'react';
import { List, ListItem, ListItemButton, ListItemText, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { CONVERTERS } from '../converters';

const BACKDROP_STYLE: React.CSSProperties = {
    width: '100vw', height: 'calc(90% - 10px)', backgroundColor: '#00000030', position: 'absolute', padding: '10px'
}
const DIALOG_STYLE: React.CSSProperties = {height: '90', width: '70%', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'};
const innerStyle: React.CSSProperties = {
    display: 'flex', height: '20px', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
    paddingLeft: '2px'
};

const STYLES: {[s: string]: React.CSSProperties} = {
    "pb5": { paddingBottom: 5 }
};

interface Ivscodeapi {
    postMessage(message: any): void;
}
// @ts-ignore
const vscodeAPI: Ivscodeapi = acquireVsCodeApi();

/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default function MultiConverterOptionsWebview() {
    
    const [files, setFiles] = React.useState<string[]>([]);
    const [file_converters, setFileConverters] = React.useState<string[]>([]);
    const [file_headers, setFileHeaders] = React.useState<string[][]>([]);

    const onMessage = (event: MessageEvent) => {
        const message = event.data;
        switch (message.command) {
            case "clear":
                setFiles([]);
                break;
            case "add-files": // When new files are read by the extension, send to the webview and add them here
                const new_files: string[] = message.data;
                setFiles([...files, ...new_files]);
                setFileConverters([...file_converters, ...Array<string>(new_files.length).fill('Auto converter')]); // TODO: find a better way to create a new array with a filled pop
                setFileHeaders([...file_headers, Array(new_files.length).fill([])]);


                // ask the extension to read headers of the new files
                new_files.forEach((file, index) => {
                    vscodeAPI.postMessage({ command: "read-headers", index: index + files.length, file: file, converter: 'Auto converter'});
                });
                
                break;
            case "headers": // When a file is read to get the headers, send to the webview and display
                // If wrong converter, data will be undefined, add a temp string
                setFileHeaders(file_headers.map((old_header_array, i) => {
                    if (i === message.index) {
                        return message.data;
                    } else {
                        return old_header_array;
                    }
                }));
                break;
        }
    };

    window.addEventListener('message', onMessage);

    const onConverterSwitch = (index: number, value: string) => {
        // Set the state
        setFileConverters(file_converters.map((c, i) => {
            if (i === index) {
                return value;
            } else {
                return c;
            }
        }));
        // ask the extension to read the new headers
        vscodeAPI.postMessage({ command: "read-headers", index, file: files[index], converter: file_converters[index]});
    };

    const renderFiles = () => {
        return (
            <div style={STYLES["pb5"]}>
                <h2>Files</h2>
                <VSCodeDataGrid id="files-grid">
                    <VSCodeDataGridRow row-rowType='header'>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='1'>File</VSCodeDataGridCell>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>Converter</VSCodeDataGridCell>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='3'>Sort Header</VSCodeDataGridCell>
                    </VSCodeDataGridRow>
                    {files.map((file, index) => (<VSCodeDataGridRow>
                        <VSCodeDataGridCell gridColumn='1'>{file.slice(1) /*Show file name*/}</VSCodeDataGridCell>
                        <VSCodeDataGridCell gridColumn='2'>
                            {/* Show converters for the file */}
                            <VSCodeDropdown value={file_converters[index]} onInput={(e: any) => onConverterSwitch(index, e.target.value)}>
                                {Object.keys(CONVERTERS).map((converter_name) => ( // TODO: disable unusable converters (based on filename?)
                                    <VSCodeOption value={converter_name}>{converter_name}</VSCodeOption>
                                ))}
                            </VSCodeDropdown>
                        </VSCodeDataGridCell>
                        <VSCodeDataGridCell gridColumn='3'>
                            {/* Show the headers of the file */}
                            {file_headers[index]?.length > 1 && <VSCodeDropdown>
                                {file_headers[index].map((header) => (<VSCodeOption value={header}>{header}</VSCodeOption>))}
                            </VSCodeDropdown>}
                            {!(file_headers[index]?.length > 1) && // find a better way to do this
                            <span style={{color: 'red'}}>
                                {file_headers[index]?.length === 1 ? "Can't read file, do you have the corrent converter?" : "Reading file headers"}
                            </span>}
                        </VSCodeDataGridCell>
                    </VSCodeDataGridRow>))}
                </VSCodeDataGrid>
                <VSCodeButton appearance='secondary' onClick={(e) => vscodeAPI.postMessage({ command: "add-files" })}>Add</VSCodeButton>
                {/* The delete button is a work in progress */}
            </div>
        );
    };

    return (
        <div style={BACKDROP_STYLE}>
            <h1>Options</h1>
            <div className='dialog' style={DIALOG_STYLE}>
                {renderFiles()}
                
                {/* Put the file options here */}
                <VSCodeButton appearance='primary' onClick={(e) => {}}>Submit</VSCodeButton>
            </div>
        </div>
    );
}