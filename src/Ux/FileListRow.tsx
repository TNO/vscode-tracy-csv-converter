/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { VSCodeDataGridCell, VSCodeDataGridRow, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import React from 'react';
import { FileData } from '../communicationProtocol';
import { DEFAULT_TERM_SEARCH_INDEX, WARNING_COLOR, WEBVIEW_TIMESTAMP_FORMAT } from '../constants';
import { parseDateString } from '../utility';

interface Props {
    fileName: string;
    fileData: FileData;

    onRemove: (file: string) => void;
    onConverterSwitch: (file: string, value: string) => void;
    convertersList: string[];
}

export default function FileListRow({ fileName, fileData, convertersList, onRemove, onConverterSwitch }: Props) {
    const removeMode = true;

    const totalAmountOfSignalWords = fileData?.terms?.reduce((p, c) => p + c[1], 0);

    const iconStyle = css({ width: 10, height: 10, color: removeMode ? 'red' : '', cursor: removeMode ? 'pointer' : 'default' });

    return (
        <VSCodeDataGridRow key={fileName+"row"}>
            <VSCodeDataGridCell gridColumn='1'>
                {removeMode && <div css={iconStyle} className='codicon codicon-close' onClick={() => onRemove(fileName)}/>}
                {!removeMode && <div css={iconStyle} className='codicon codicon-circle-filled'/>}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell gridColumn='2'>{fileName}</VSCodeDataGridCell>
            <VSCodeDataGridCell gridColumn='3'>
                {/* Show converters for the file */}
                <VSCodeDropdown css={{ width: '100%' }} value={fileData.converter.toString()} onInput={(e: React.BaseSyntheticEvent) => onConverterSwitch(fileName, e.target.value)}>
                    {convertersList.map((converterName, index) => ( // TODO: disable unusable converters (based on filename?)
                        <VSCodeOption key={converterName + " converter"} value={index.toString()}>{converterName}</VSCodeOption>
                    ))}
                </VSCodeDropdown>
            </VSCodeDataGridCell>
            <VSCodeDataGridCell gridColumn='4'>
                {fileData && fileData.dates[0] !== "" && fileData.dates[1] !== "" && <div>
                    <div>{parseDateString(fileData.dates[0]).format(WEBVIEW_TIMESTAMP_FORMAT)} to</div>
                    <div>{parseDateString(fileData.dates[1]).format(WEBVIEW_TIMESTAMP_FORMAT)}</div>
                </div>}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell gridColumn='5'>
                {fileData.termSearchIndex === -1 && <span css={{ color: WARNING_COLOR }}>Warning: file doesn't contain selected header, using default header instead!</span>} {/* if file doesn't have selected header, tell the user */}
                {fileData.termSearchIndex >= -1 && <span>Searching in column "{fileData.headers[fileData.termSearchIndex === -1 ? DEFAULT_TERM_SEARCH_INDEX : fileData.termSearchIndex]}"</span>}
                {fileData.termSearchIndex === -2 && totalAmountOfSignalWords === 0 && <span>No header selected.</span>}
                {fileData && fileData.termSearchIndex !== -2 && totalAmountOfSignalWords === 0 && <div>No terms found!</div>}
                {fileData && fileData.terms.map(([term, amount]) => (
                    amount > 0 && <div key={term}>{term} ({amount.toString()} times)</div>
                ))}
            </VSCodeDataGridCell>
            <VSCodeDataGridCell gridColumn='6'>
                {fileData && !(fileData.status.error) && <div>{ fileData.status.status }</div>}
                {fileData && !(fileData.status.error) && fileData.status.warning && <div css={{color: WARNING_COLOR}}>{fileData.status.warning}</div>}
                {fileData && fileData.status.error && <div css={{ color: "#FF0000"}}>Error: {fileData.status.error}</div>}
            </VSCodeDataGridCell>
        </VSCodeDataGridRow>
    );
}