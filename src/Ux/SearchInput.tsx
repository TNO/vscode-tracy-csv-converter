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

    return (<div>
        <VSCodeTextField
            style={{ marginRight: "5px" }}
            placeholder="Search Text"
            value={searchText}
            onInput={(e) => setSearchText((e as React.ChangeEvent<HTMLInputElement>).target.value)}
            onKeyUp={(e) => {
                if (e.key === "Enter" && searchText !== "") {
                    onSearch(searchText, flags);
                    if (clearOnSearch) setSearchText("");
                }
            }}
            {...other}
        >
            <Tooltip title={<h3>Match Case</h3>} placement="bottom" arrow>
                <span
                    slot="end"
                    style={{
                        backgroundColor: flags.caseSearch ? "dodgerblue" : "",
                        borderRadius: "20%",
                        marginRight: "5px",
                        cursor: "pointer",
                    }}
                    className="codicon codicon-case-sensitive"
                    onClick={() => setFlags({ ...flags, caseSearch: !flags.caseSearch })}
                ></span>
            </Tooltip>
            <Tooltip title={<h3>Match Whole Word</h3>} placement="bottom" arrow>
                <span
                    slot="end"
                    style={{
                        backgroundColor: flags.wholeSearch ? "dodgerblue" : "",
                        borderRadius: "20%",
                        marginRight: "5px",
                        cursor: "pointer",
                    }}
                    className="codicon codicon-whole-word"
                    onClick={() => setFlags({ ...flags, wholeSearch: !flags.wholeSearch })}
                ></span>
            </Tooltip>
            <Tooltip title={<h3>Use Regular Expression</h3>} placement="bottom" arrow>
                <span
                    slot="end"
                    style={{
                        backgroundColor: flags.reSearch ? "dodgerblue" : "",
                        borderRadius: "20%",
                        marginRight: "5px",
                        cursor: "pointer",
                    }}
                    className="codicon codicon-regex"
                    onClick={() => setFlags({ ...flags, reSearch: !flags.reSearch })}
                ></span>
            </Tooltip>
            <Tooltip title={<h3>Clear</h3>} placement="bottom" arrow>
                <span
                    slot="end"
                    style={{ cursor: "pointer" }}
                    className="codicon codicon-close"
                    onClick={() => {
                        setSearchText("");
                        onSearch("", flags);
                    }}
                ></span>
            </Tooltip>
        </VSCodeTextField>
    </div>)
}