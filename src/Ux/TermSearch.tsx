import React from "react";
import SearchInput from "./SearchInput";
import { VSCodeButton, VSCodeDropdown, VSCodeOption, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Ext2WebMessage, FileData, FileSharedData, TermFlags, populateTerms, updateWebviewState, vscodeAPI } from "../communicationProtocol";
import { cloneDeep } from "lodash";
import { Tooltip } from "@mui/material";
import { DEFAULT_SEARCH_TERMS, DEFAULT_TERM_SEARCH_INDEX } from "../constants";

interface Props {
    minHeaders: number;
    files: {[s: string]: FileData};
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
    const searchableHeaders = Object.keys(files)
        .reduce((p, f) => files[f].headers.filter(h => p.length === 0 || p.includes(h)), [] as string[]);

    const satisfiedSearch = Object.keys(files).reduce<boolean>((p, f) => p && files[f].headers[files[f].termSearchIndex] === headerToSearch, true);

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
        }
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        // Update persistance state
        updateWebviewState({ headerToSearch: headerToSearch, terms })
    }, [headerToSearch, terms]);
        
    return (<div>
        <Tooltip placement="top" title={"The signal words that are searched for are defined here."} disableInteractive>
            <h3 style={{ marginBottom: "2px" }}>Signal Words</h3>
        </Tooltip>
        <div>
            <Tooltip placement="top" title={"The header that is searched for the signal words. Only contains headers that are present in both files."} disableInteractive>
                <span>Searched Header:</span>
            </Tooltip>
            <span style={{ display: "flex", justifyContent: "space-between", paddingRight: "5px" }}>
                <VSCodeDropdown value={headerToSearch} disabled={minHeaders === 0}
                    style={{ color: (searchableHeaders.length > 0 && !(searchableHeaders.includes(headerToSearch))) ? "red" : undefined }}
                    onInput={(e: React.BaseSyntheticEvent) => {
                        setHeaderToSearch(e.target.value);
                    }}>
                    {searchableHeaders.length > 0 && !(searchableHeaders.includes(headerToSearch))
                        && <VSCodeOption selected style={{ color: "red" }} key={-1} value={headerToSearch}>{headerToSearch}</VSCodeOption>}
                    {searchableHeaders.map(h => (<VSCodeOption selected={h === headerToSearch} key={h} value={h}>{h}</VSCodeOption>))}
                </VSCodeDropdown>
                {searching && <VSCodeProgressRing/>}
                <span>
                    <VSCodeButton
                        appearance={satisfiedSearch ? "secondary" : "primary"}
                        onClick={() => { onChange(Object.keys(terms).map(t => [t, terms[t]]), headerToSearch); setSearching(true); }}
                        disabled={headerToSearch === "" || searchableHeaders.length === 0}>Search</VSCodeButton>
                </span>
            </span>
        </div>
        <SearchInput clearOnSearch value={searchText} onSearch={(s: string, f: TermFlags) => {
            const newTerms = cloneDeep(terms);
            newTerms[s] = f;
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
                                setTerms(newTerms);
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    </div>);
}