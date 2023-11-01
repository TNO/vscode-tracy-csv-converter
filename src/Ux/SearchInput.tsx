/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { Tooltip } from '@mui/material';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import React from 'react';
import { TermFlags } from '../communicationProtocol';

interface Props {
    onSearch: (s: string, f: TermFlags) => void;
    clearOnSearch?: boolean;
    value?: [string, TermFlags];
}

export default function SearchInput({ onSearch, clearOnSearch = false, value, ...other }: Props & {[s: string]: unknown}) {
    const [flags, setFlags] = React.useState<TermFlags>({ caseSearch: false, wholeSearch: false, reSearch: false });
    const [searchText, setSearchText] = React.useState<string>("");

    // Change on value change
    React.useEffect(() => {
        const [valText, valFlags] = value ?? ["", { caseSearch: false, wholeSearch: false, reSearch: false }];
        setSearchText(valText);
        setFlags(valFlags);
    }, [value]);

    function clear() {
        setSearchText("");
        setFlags({ caseSearch: false, reSearch: false, wholeSearch: false });
    }

    const iconCss = css({
        borderRadius: "20%",
        marginRight: "5px",
        cursor: "pointer",
    });
    return (<div>
        <VSCodeTextField
            css={{ marginRight: "5px" }}
            placeholder="Search Text"
            value={searchText}
            onInput={(e) => setSearchText((e as React.ChangeEvent<HTMLInputElement>).target.value)}
            onKeyUp={(e) => {
                if (e.key === "Enter" && searchText !== "") {
                    onSearch(searchText, flags);
                    if (clearOnSearch) clear();
                }
            }}
            {...other}
        >
            <Tooltip title={<h3>Match Case</h3>} placement="bottom" arrow disableInteractive>
                <span
                    slot="end"
                    style={{
                        backgroundColor: flags.caseSearch ? "dodgerblue" : "",
                    }}
                    css={iconCss}
                    className="codicon codicon-case-sensitive"
                    onClick={() => setFlags({ ...flags, caseSearch: !flags.caseSearch })}
                ></span>
            </Tooltip>
            <Tooltip title={<h3>Match Whole Word</h3>} placement="bottom" arrow disableInteractive>
                <span
                    slot="end"
                    style={{
                        backgroundColor: flags.wholeSearch ? "dodgerblue" : "",
                    }}
                    css={iconCss}
                    className="codicon codicon-whole-word"
                    onClick={() => setFlags({ ...flags, wholeSearch: !flags.wholeSearch })}
                ></span>
            </Tooltip>
            <Tooltip title={<h3>Use Regular Expression</h3>} placement="bottom" arrow disableInteractive>
                <span
                    slot="end"
                    style={{
                        backgroundColor: flags.reSearch ? "dodgerblue" : "",
                    }}
                    css={iconCss}
                    className="codicon codicon-regex"
                    onClick={() => setFlags({ ...flags, reSearch: !flags.reSearch })}
                ></span>
            </Tooltip>
            <Tooltip title={<h3>Clear</h3>} placement="bottom" arrow disableInteractive>
                <span
                    slot="end"
                    css={{ cursor: "pointer" }}
                    className="codicon codicon-close"
                    onClick={clear}
                ></span>
            </Tooltip>
        </VSCodeTextField>
    </div>)
}