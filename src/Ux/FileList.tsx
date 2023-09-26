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

    const onHeaderSwitch = (file: string, value: string) => {
        const newFiles = cloneDeep(files);
        newFiles[file].header = parseInt(value);
        setFiles(newFiles);
    };

    const onRemoveFileRow = (file: string) => {
        const newFiles = cloneDeep(files);
        delete newFiles[file];
        setFiles(newFiles);
    };
    
    const renderFileHeaders = (file: string) => {
        const filesPossibleHeaders = headers_per_file[file];
        const hasPossibleHeaders = filesPossibleHeaders?.length > 1;
        return (
            <div>
                {/* Show the headers of the file */}
                {hasPossibleHeaders && 
                    <VSCodeDropdown value={files[file].header.toString()} onInput={(e: React.BaseSyntheticEvent) => onHeaderSwitch(file, e.target.value)}>
                        {filesPossibleHeaders.map((header, index) => (<VSCodeOption key={header + " header"} value={index.toString()}>{header}</VSCodeOption>))}
                    </VSCodeDropdown>}
                {!hasPossibleHeaders && // is there a better way to do this?
                    <span style={{color: 'red'}}>
                        {filesPossibleHeaders?.length === 1 ? "Only a single header, do you have the corrent converter?" : "Reading file headers"}
                    </span>}
            </div>
        );
    };

    const renderFileRow = (file: string) => {
        const iconStyle: React.CSSProperties = { width: 10, height: 10, color: removeMode ? 'red' : '', cursor: removeMode ? 'pointer' : 'default' };

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
                    {renderFileHeaders(file)}
                </VSCodeDataGridCell>
            </VSCodeDataGridRow>
        );
    };

    
    return (
        <div style={{ paddingBottom: 5, width: '100%' }}>
            <h2>Files</h2>
            <VSCodeDataGrid id="files-grid" gridTemplateColumns='2vw 40vw 200px' style={{ border: "1px solid white", minHeight: "100px" }}>
                <VSCodeDataGridRow row-rowType='sticky-header'>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='1'></VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='2'>File</VSCodeDataGridCell>
                    <VSCodeDataGridCell cellType='columnheader' gridColumn='3'>Converter</VSCodeDataGridCell>
                    <Tooltip title="The header/column that indicates the timestamp." placement='top-start'>
                        <VSCodeDataGridCell cellType='columnheader' gridColumn='4'>Timestamp Header</VSCodeDataGridCell>
                    </Tooltip>
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