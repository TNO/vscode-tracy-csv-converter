import React from "react";
import SearchInput from "./SearchInput";
import { VSCodeDropdown, VSCodeOption, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { DEFAULT_SEARCH_TERMS, DEFAULT_TERM_SEARCH_INDEX } from "../constants";
import { Ext2WebMessage, TermFlags, updateWebviewState, vscodeAPI } from "../communicationProtocol";
import { cloneDeep } from "lodash";

interface Props {
    minHeaders: number;
    onChange?: (terms: [string, TermFlags][], searchHeaderIndex: number) => void;
    value?: {[s: string]: TermFlags};
}

let initialization = false;
// [string, termflags], number
export default function TermSearch({ minHeaders, onChange = () => {} }: Props) {
    const [headerToSearch, setHeaderToSearch] = React.useState(DEFAULT_TERM_SEARCH_INDEX);
    const [terms, setTerms] = React.useState<{[s: string]: TermFlags}>({});

    const [searchText, setSearchText] = React.useState<[string, TermFlags]>(["", { caseSearch: false, wholeSearch: false, reSearch: false }]);
    const [searching, setSearching] = React.useState(false);

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize":
                initialization = false;
                break;
            case "metadata":
                setSearching(false);
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
            onChange(Object.keys(prevState.terms).map(t => [t, prevState.terms[t]]), prevState.headerToSearch);
        }
    }, []);

    // Update persistance state
    React.useEffect(() => {
        if (initialization) return;
        onChange(Object.keys(terms).map(t => [t, terms[t]]), headerToSearch);
        updateWebviewState({ headerToSearch, terms })
    }, [headerToSearch, terms]);
    
    const headersArray: number[] = (minHeaders > 2) ? new Array(minHeaders).fill(0) : [0, 1];
    return (<div>
        Header Index:
        <span style={{ display: "flex" }}>
            <VSCodeDropdown value={headerToSearch.toString()} disabled={minHeaders === 0} onInput={(e: React.BaseSyntheticEvent) => { setHeaderToSearch(parseInt(e.target.value)); setSearching(true); }}>
                {headersArray.map((_, v) => (<VSCodeOption key={v} value={v.toString()}>{v.toString()}</VSCodeOption>))}
            </VSCodeDropdown>
            {searching && <VSCodeProgressRing/>}
        </span>
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
                        {displayFlags(terms[s])}
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

function displayFlags(f: TermFlags) {
    
    return (<span>
        {f.caseSearch && <span
            slot="end"
            style={{
                borderRadius: "20%",
                marginRight: "5px",
                color: "var(--input-placeholder-foreground)"
            }}
            className="codicon codicon-case-sensitive"
        />}
        {f.wholeSearch && <span
            slot="end"
            style={{
                borderRadius: "20%",
                marginRight: "5px",
                color: "var(--input-placeholder-foreground)"
            }}
            className="codicon codicon-whole-word"
        />}
        {f.reSearch && <span
            slot="end"
            style={{
                borderRadius: "20%",
                marginRight: "5px",
                color: "var(--input-placeholder-foreground)"
            }}
            className="codicon codicon-regex"
        />}
    </span>);
}