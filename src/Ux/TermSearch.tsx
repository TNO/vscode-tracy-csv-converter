import React from "react";
import SearchInput from "./SearchInput";
import { VSCodeDropdown, VSCodeOption, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Ext2WebMessage, FileSharedData, TermFlags, populateTerms, updateWebviewState, vscodeAPI } from "../communicationProtocol";
import { cloneDeep } from "lodash";
import { Tooltip } from "@mui/material";
import { DEFAULT_SEARCH_TERMS, DEFAULT_TERM_SEARCH_INDEX } from "../constants";

interface Props {
    minHeaders: number;
    files: {[s: string]: FileSharedData};
    onChange?: (terms: [string, TermFlags][], searchHeader: string) => void;
    value?: {[s: string]: TermFlags};
}

let initialization = false;
// [string, termflags], number
export default function TermSearch({ minHeaders, files, onChange = () => {} }: Props) {
    const [headerToSearch, setHeaderToSearch] = React.useState<string>("");
    const [terms, setTerms] = React.useState<{[s: string]: TermFlags}>(populateTerms(DEFAULT_SEARCH_TERMS));

    const [searchText, setSearchText] = React.useState<[string, TermFlags]>(["", { caseSearch: false, wholeSearch: false, reSearch: false }]);
    const [searching, setSearching] = React.useState(false);

    // Only the headers that are present in all files are searchable (though the first header, timestamp, is excluded later)
    const searchableHeaders = Object.keys(files).map(f => files[f].headers)
        .reduce((p, c) => c.filter(h => p.length === 0 || p.includes(h)), []);

    if (headerToSearch === "" && searchableHeaders.length > 0) {
        setHeaderToSearch(searchableHeaders[DEFAULT_TERM_SEARCH_INDEX]);
    }

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize":
                initialization = false;
                break;
            case "metadata":
                setSearching(false);
                break;
        }
    }

    React.useEffect(() => {
        window.addEventListener('message', onMessage);
        // Read persistance state
        const prevState = vscodeAPI.getState();
        if (prevState) {
            initialization = true;
            setHeaderToSearch(prevState.headerToSearch);
            setTerms(prevState.terms);
            
            onChange(Object.keys(prevState.terms).map(t => [t, prevState.terms[t]]), headerToSearch);
        }
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        onChange(Object.keys(terms).map(t => [t, terms[t]]), headerToSearch);
        // Update persistance state
        updateWebviewState({ headerToSearch: headerToSearch, terms })
    }, [headerToSearch, terms]);
        
    return (<div>
        <Tooltip title={"The terms that are searched for are defined here."}>
            <h3 style={{ marginBottom: "2px" }}>Search term</h3>
        </Tooltip>
        <div>
            Header:
            <span style={{ display: "flex" }}>
                <VSCodeDropdown value={headerToSearch} disabled={minHeaders === 0} onInput={(e: React.BaseSyntheticEvent) => { setHeaderToSearch(e.target.value); setSearching(true); }}>
                    {searchableHeaders.map((h, i) => (i > 0 && <VSCodeOption key={i} value={h}>{h}</VSCodeOption>))}
                </VSCodeDropdown>
                {searching && <VSCodeProgressRing/>}
            </span>
        </div>
        <SearchInput clearOnSearch value={searchText} onSearch={(s: string, f: TermFlags) => {
            const newTerms = cloneDeep(terms);
            newTerms[s] = f;
            setSearching(true);
            setTerms(newTerms);
        }}/>
        <div style={{ border: "1px solid var(--badge-background)", marginRight: '5px', minHeight: '75px', paddingBottom: "10px"}}>
            {Object.keys(terms).map(s => (
                <div key={s} className="hover-border" onClick={() => { setSearchText([s, terms[s]]); }}
                    style={{display: "flex", justifyContent: "space-between", marginBottom: '1px', padding: '5px', background: 'var(--button-secondary-background)'}}
                >
                    <span>{s}</span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        {<span
                            slot="end"
                            style={{
                                borderRadius: "20%",
                                marginRight: "5px",
                                color: terms[s].caseSearch ? "var(--input-foreground)" : "var(--input-placeholder-foreground)",
                                opacity: terms[s].caseSearch ? "100%" : "10%"
                            }}
                            className="codicon codicon-case-sensitive"
                        />}
                        {<span
                            slot="end"
                            style={{
                                borderRadius: "20%",
                                marginRight: "5px",
                                color: terms[s].wholeSearch ? "var(--input-foreground)" : "var(--input-placeholder-foreground)",
                                opacity: terms[s].wholeSearch ? "100%" : "10%"
                            }}
                            className="codicon codicon-whole-word"
                        />}
                        {<span
                            slot="end"
                            style={{
                                borderRadius: "20%",
                                marginRight: "5px",
                                color: terms[s].reSearch ? "var(--input-foreground)" : "var(--input-placeholder-foreground)",
                                opacity: terms[s].reSearch ? "100%" : "10%"
                            }}
                            className="codicon codicon-regex"
                        />}
                        <span
                            slot="end"
                            style={{ cursor: "pointer", color: "red", margin: "2px" }}
                            className="codicon codicon-close"
                            onClick={(event) => {
                                event.stopPropagation();
                                const newTerms = cloneDeep(terms);
                                delete newTerms[s];
                                setSearching(true);
                                setTerms(newTerms);
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>);
}