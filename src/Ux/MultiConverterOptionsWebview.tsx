import React from 'react';
import { List, ListItem, ListItemButton, ListItemText, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { CONVERTERS } from '../converters';

const BACKDROP_STYLE: React.CSSProperties = {
    width: 'calc(100% - 50px)', height: 'calc(100% - 50px)', backgroundColor: '#00000030', position: 'absolute', margin: '10px', paddingLeft: '10px'
}
const DIALOG_STYLE: React.CSSProperties = {height: '100%', width: 'calc(100% - 20px)', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'start', overflow: 'auto'};

const STYLES: {[s: string]: React.CSSProperties} = {
    "pt5": { paddingTop: 5 },
    "pb5": { paddingBottom: 5 },
    "border1white": { border: "1px solid white "},
    "minheight200": { minHeight: "100px" }
};

function getStyle(style_string: string) {
    return style_string.split(' ').map(s => STYLES[s] ?? "").reduce((prev, curr) => {return {...prev, ...curr};});
}

interface Ivscodeapi {
    postMessage(message: any): void;
}
// @ts-ignore
const vscodeAPI: Ivscodeapi = acquireVsCodeApi();

const DEFAULT_CONVERTER = Object.keys(CONVERTERS)[0];

/**
 * This is the Webview that is shown when the user wants to select multiple csv files.
 */
export default function MultiConverterOptionsWebview() {
    
    const [files, setFiles] = React.useState<string[]>([]);
    const [file_converters, setFileConverters] = React.useState<string[]>([]);
    const [file_headers, setFileHeaders] = React.useState<number[]>([]);
    const [headers_per_file, setHeadersPerFile] = React.useState<{[s: string]: string[]}>({});
    const [remove_mode, setRemoveMode] = React.useState(false);

    const onMessage = (event: MessageEvent) => {
        const message = event.data;
        
        // console.log("Received message:", message.command)
        switch (message.command) {
            case "clear":
                setFiles([]);
                break;
            case "add-files": // When new files are read by the extension, send to the webview and add them here
                const new_files: string[] = message.data;
                // console.log(`Added ${new_files.length} new files`);
                setFiles(files => {
                    // ask the extension to read headers of the new files
                    new_files.forEach((file) => {
                        vscodeAPI.postMessage({ command: "read-headers", file: file, converter: DEFAULT_CONVERTER});
                    });

                    return [...files, ...new_files];
                });
                setFileConverters(file_converters => [...file_converters, ...Array<string>(new_files.length).fill(DEFAULT_CONVERTER)]);
                setFileHeaders(file_headers => [...file_headers, ...Array(new_files.length).fill(0)])
                
                break;
            case "headers": // When a file is read to get the headers, send to the webview and display
                // console.log("Received headers for file", message.file, message.data);
                // If wrong converter, data will be undefined, add a temp string
                setHeadersPerFile(prev => { 
                    let new_headers = {...prev}; // TODO: find a way to deepcopy
                    new_headers[message.file] = message.data;
                    return new_headers;
                });
                break;
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);
    }, []);

    // When you change the converter you want to use for a specific file
    const onConverterSwitch = (index: number, value: string) => {
        // Set the state
        const new_converters = file_converters.map((c, i) => {
            if (i === index) return value;
            return c;
        });

        setFileConverters(new_converters); // dont know if this is necessary
        
        // ask the extension to read the new headers
        vscodeAPI.postMessage({ command: "read-headers", file: files[index], converter: new_converters[index]});
    };

    const onHeaderSwitch = (index: number, value: string) => {
        const new_headers = file_headers.map((h, i) => {
            if (i === index) return parseInt(value);
            return h;
        });
        setFileHeaders(new_headers);
    };

    const onRemoveFileRow = (index) => {
        let new_files = [...files], new_file_converters = [...file_converters], new_file_headers = [...file_headers];
        new_files.splice(index, 1);
        new_file_converters.splice(index, 1);
        new_file_headers.splice(index, 1);
        setFiles(new_files);
        setFileConverters(new_file_converters);
        setFileHeaders(new_file_headers);
    };

    const onSubmit = (e: any) => {
        // file_headers will contain ""s if no selection was made, this can be equated to the first header of the file
        // TODO: fix this?
        vscodeAPI.postMessage({ command: "submit", files, file_converters, file_headers: file_headers.map((h, i)=> headers_per_file[files[i]][h]) });
        // console.log(file_headers);
        // console.log(headers_per_file);
    };

    const renderFileHeaders = (file: string, index: number) => {
        const files_possible_headers = headers_per_file[file];
        const has_possible_headers = files_possible_headers?.length > 1;
        return (
            <div>
                {/* Show the headers of the file */}
                {has_possible_headers && 
                    <VSCodeDropdown value={file_headers[index].toString()} onInput={(e: any) => onHeaderSwitch(index, e.target.value)}>
                        {files_possible_headers.map((header, index) => (<VSCodeOption value={index.toString()}>{header}</VSCodeOption>))}
                    </VSCodeDropdown>}
                {!has_possible_headers && // find a better way to do this
                    <span style={{color: 'red'}}>
                        {files_possible_headers?.length === 1 ? "Only a single header, do you have the corrent converter?" : "Reading file headers"}
                    </span>}
            </div>
        );
    };

    const renderFileRow = (file: string, index: number) => {
        const icon_style: React.CSSProperties = { width: 10, height: 10, color: remove_mode ? 'red' : '', cursor: remove_mode ? 'pointer' : 'default' };

        return (
            <VSCodeDataGridRow key={file+index+"dropdown"}>
                <VSCodeDataGridCell gridColumn='1'>
                    {remove_mode && <div style={icon_style} className='codicon codicon-close' onClick={(e: any) => onRemoveFileRow(index)}/>}
                    {!remove_mode && <div style={icon_style} className='codicon codicon-circle-filled'/>}
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='2'>{file.slice(1) /*Show file name*/}</VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='3'>
                    {/* Show converters for the file */}
                    <VSCodeDropdown value={file_converters[index]} onInput={(e: any) => onConverterSwitch(index, e.target.value)}>
                        {Object.keys(CONVERTERS).map((converter_name) => ( // TODO: disable unusable converters (based on filename?)
                            <VSCodeOption value={converter_name}>{converter_name}</VSCodeOption>
                        ))}
                    </VSCodeDropdown>
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='4'>
                    {renderFileHeaders(file, index)}
                </VSCodeDataGridCell>
            </VSCodeDataGridRow>
        );
    };

    const renderFiles = () => {
        return (
            <div style={STYLES["pb5"]}>
                <h2>Files</h2>
                <VSCodeDataGrid id="files-grid" gridTemplateColumns='2vw 40vw 20vw' style={getStyle("border1white minheight200")}>
                    <VSCodeDataGridRow row-rowType='sticky-header'>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='1'></VSCodeDataGridCell>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>File</VSCodeDataGridCell>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='3'>Converter</VSCodeDataGridCell>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='4'>Sort Header</VSCodeDataGridCell>
                    </VSCodeDataGridRow>
                    {files.map((file, index) => renderFileRow(file, index))}
                </VSCodeDataGrid>
                <div style={getStyle("pt5")}>
                    <VSCodeButton appearance={files.length === 0 ? 'primary' : 'secondary'} onClick={(e) => vscodeAPI.postMessage({ command: "add-files" })}>Add</VSCodeButton>
                    <VSCodeButton appearance='secondary' onClick={(e) => setRemoveMode(mode => !mode)} disabled={files.length === 0}>{remove_mode ? "Stop removing" : "Remove"}</VSCodeButton>
                </div>
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
                <VSCodeButton appearance={files.length > 0 ? 'primary' : 'secondary'} onClick={onSubmit} disabled={files.length === 0}>Submit</VSCodeButton>
            </div>
        </div>
    );
}