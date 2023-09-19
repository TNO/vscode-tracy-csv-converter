import React from 'react';
import { cloneDeep } from 'lodash';
import { Tooltip } from '@mui/material';
import { VSCodeButton, VSCodeDataGrid, VSCodeDataGridRow, VSCodeDataGridCell, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { vscodeAPI, askForNewHeaders } from '../WebviewCommunication';
import { CONVERTERS } from '../converters';

export default function FileList({files, headers_per_file, setFiles}) {
    const [remove_mode, setRemoveMode] = React.useState(false);

    const amount_of_files = Object.keys(files).length;

    // When you change the converter you want to use for a specific file
    const onConverterSwitch = (file: string, value: string) => {
        // Set the state
        const new_files = cloneDeep(files);
        new_files[file].converter = value;
        setFiles(new_files);
        
        // ask the extension to read the new headers
        askForNewHeaders(file, new_files[file].converter);
    };

    const onHeaderSwitch = (file: string, value: string) => {
        const new_files = cloneDeep(files);
        new_files[file].header = parseInt(value);
        setFiles(new_files);
    };

    const onRemoveFileRow = (file: string) => {
        const new_files = cloneDeep(files);
        delete new_files[file];
        setFiles(new_files);
    };
    
    const renderFileHeaders = (file: string) => {
        const files_possible_headers = headers_per_file[file];
        const has_possible_headers = files_possible_headers?.length > 1;
        return (
            <div>
                {/* Show the headers of the file */}
                {has_possible_headers && 
                    <VSCodeDropdown value={files[file].header.toString()} onInput={(e: any) => onHeaderSwitch(file, e.target.value)}>
                        {files_possible_headers.map((header, index) => (<VSCodeOption key={header + " header"} value={index.toString()}>{header}</VSCodeOption>))}
                    </VSCodeDropdown>}
                {!has_possible_headers && // is there a better way to do this?
                    <span style={{color: 'red'}}>
                        {files_possible_headers?.length === 1 ? "Only a single header, do you have the corrent converter?" : "Reading file headers"}
                    </span>}
            </div>
        );
    };

    const renderFileRow = (file: string) => {
        const icon_style: React.CSSProperties = { width: 10, height: 10, color: remove_mode ? 'red' : '', cursor: remove_mode ? 'pointer' : 'default' };

        return (
            <VSCodeDataGridRow key={file+"dropdown"}>
                <VSCodeDataGridCell gridColumn='1'>
                    {remove_mode && <div style={icon_style} className='codicon codicon-close' onClick={(e: any) => onRemoveFileRow(file)}/>}
                    {!remove_mode && <div style={icon_style} className='codicon codicon-circle-filled'/>}
                </VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='2'>{file.slice(1) /*Show file name*/}</VSCodeDataGridCell>
                <VSCodeDataGridCell gridColumn='3'>
                    {/* Show converters for the file */}
                    <VSCodeDropdown style={{ width: '100%' }} value={files[file].converter} onInput={(e: any) => onConverterSwitch(file, e.target.value)}>
                        {Object.keys(CONVERTERS).map((converter_name) => ( // TODO: disable unusable converters (based on filename?)
                            <VSCodeOption key={converter_name + " converter"} value={converter_name}>{converter_name}</VSCodeOption>
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
                {Object.keys(files).map((file, index) => renderFileRow(file))}
            </VSCodeDataGrid>
            <div style={{ paddingTop: 5 }}>
                <VSCodeButton appearance={amount_of_files === 0 ? 'primary' : 'secondary'} onClick={(e) => vscodeAPI.postMessage({ command: "add-files" })}>Add</VSCodeButton>
                <VSCodeButton appearance='secondary' onClick={(e) => setRemoveMode(mode => !mode)} disabled={amount_of_files === 0}>{remove_mode ? "Stop removing" : "Remove"}</VSCodeButton>
            </div>
        </div>
    );
    
}