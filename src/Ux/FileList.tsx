import React from 'react';
import { cloneDeep } from 'lodash';
import { Tooltip } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { vscodeAPI, FileData, askForNewHeaders } from '../WebviewCommunication';

interface Props {
    converters_list: string[],
    files: {[s: string]: FileData},
    headers_per_file: {[s: string]: string[]},
    setFiles: (f: {[s: string]: FileData}) => void
}
export default function FileList({converters_list, files, headers_per_file, setFiles}: Props) {
    // const [removeMode, setRemoveMode] = React.useState(false);
    const removeMode = true;

    const amountOfFiles = Object.keys(files).length;

    // When you change the converter you want to use for a specific file
    const onConverterSwitch = (file: string, value: string) => {
        // Set the state
        const newFiles = cloneDeep(files);
        newFiles[file].converter = parseInt(value);
        setFiles(newFiles);
        
        // ask the extension to read the new headers
        askForNewHeaders([file], [newFiles[file].converter]);
    };

    const onRemoveFileRow = (file: string) => {
        const newFiles = cloneDeep(files);
        delete newFiles[file];
        setFiles(newFiles);
    };

    const renderFileRow = (file: string) => {
        const iconStyle: React.CSSProperties = { width: 10, height: 10, color: removeMode ? 'red' : '', cursor: removeMode ? 'pointer' : 'default' };
        const fileStatus = headers_per_file[file] ? "Ready to merge" : "Attempting to read";
        const statusStyle: React.CSSProperties = {};

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
                        {converters_list.map((converter_name, index) => ( // TODO: disable unusable converters (based on filename?)
                            <VSCodeOption key={converter_name + " converter"} value={index.toString()}>{converter_name}</VSCodeOption>
                        ))}
                    </VSCodeDropdown>
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='4'>
                    <span style={statusStyle}>{fileStatus}</span>
                </VSCodeDataGridCell>
            </VSCodeDataGridRow>
        );
    };

    
    return (
        <div style={{ paddingBottom: 5, width: '100%' }}>
            <h2>Files</h2>
            <VSCodeDataGrid id="files-grid" gridTemplateColumns='2vw 40vw 250px' style={{ border: "1px solid white", minHeight: "100px" }}>
                <VSCodeDataGridRow row-rowType='sticky-header'>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='1'></VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>File</VSCodeDataGridCell>
                    <Tooltip title="The format of the file.">
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='3'>Format</VSCodeDataGridCell>
                    </Tooltip>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='4'>Status</VSCodeDataGridCell>
                </VSCodeDataGridRow>
                {Object.keys(files).map((file) => renderFileRow(file))}
            </VSCodeDataGrid>
            <div style={{ paddingTop: 5 }}>
                <VSCodeButton appearance={amountOfFiles === 0 ? 'primary' : 'secondary'} onClick={() => vscodeAPI.postMessage({ command: "add-files" })}>Add</VSCodeButton>
                {/* <VSCodeButton appearance='secondary' onClick={() => setRemoveMode(mode => !mode)} disabled={amountOfFiles === 0}>{removeMode ? "Stop removing" : "Remove"}</VSCodeButton> */}
            </div>
        </div>
    );
    
}