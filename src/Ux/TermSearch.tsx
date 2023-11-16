/** @jsxImportSource @emotion/react */
import React from "react";
import SearchInput from "./SearchInput";
import { VSCodeButton, VSCodeDropdown, VSCodeOption, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import { Ext2WebMessage, FileData, TermFlags, populateTerms, updateWebviewState, vscodeAPI } from "../communicationProtocol";
import { cloneDeep, isEqual } from "lodash";
import { Tooltip } from "@mui/material";
import { DEFAULT_SEARCH_TERMS } from "../constants";

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
        updateWebviewState({ headerToSearch, terms })
    }, [headerToSearch, terms]);

    const prevTermsRef = React.useRef({});

    function onSearch() {
        onChange(Object.keys(terms).map(t => [t, terms[t]]), headerToSearch);
        setSearching(true);
        prevTermsRef.current = terms;
    }

    const sameTerms = isEqual(prevTermsRef.current, terms);
        
    return (<div>
        <Tooltip placement="top" title={"The signal words that are searched for are defined here."} disableInteractive>
            <h3 css={{ marginBottom: "2px", display: "inline-block" }}>Signal Words</h3>
        </Tooltip>
        <div>
            <Tooltip placement="top" title={"The header that is searched for the signal words. Only contains headers that are present in both files."} disableInteractive>
                <span>Searched Header:</span>
            </Tooltip>
            <span css={{ display: "flex", justifyContent: "space-between", paddingRight: "5px" }}>
                <VSCodeDropdown value={headerToSearch} disabled={minHeaders === 0}
                    css={{ color: (searchableHeaders.length > 0 && !(searchableHeaders.includes(headerToSearch))) ? "red" : undefined }}
                    onInput={(e: React.BaseSyntheticEvent) => {
                        setHeaderToSearch(e.target.value);
                    }}>
                    {searchableHeaders.length > 0 && !(searchableHeaders.includes(headerToSearch))
                        && <VSCodeOption selected css={{ color: "red" }} key={-1} value={headerToSearch}>{headerToSearch}</VSCodeOption>}
                    {searchableHeaders.map(h => (<VSCodeOption selected={h === headerToSearch} key={h} value={h}>{h}</VSCodeOption>))}
                </VSCodeDropdown>
                {searching && <VSCodeProgressRing/>}
                <span>
                    <Tooltip title={<div>
                        <h2 css={{ fontSize: "16px", fontWeight: "bold", marginBottom: "2px" }}>Help</h2>
                        <ul css={{ marginTop: "2px" }}>
                            <li className="help-list-element">The flag <i className="codicon codicon-case-sensitive"/> indicates
                                 whether the term is case sensitive.</li>
                            <li className="help-list-element">The flag <i className="codicon codicon-whole-word"/> indicates
                                 whether it should only match if the term is the whole word. Example: Fail &rarr; <i>Fail</i>ure will not match.</li>
                            <li className="help-list-element">The flag <i className="codicon codicon-regex"/> indicates
                                 whether the term is parsed as a regular expression.</li>
                        </ul>
                        <span css={{ fontSize: "14px" }}>After every term change, press <b>enter</b> to update the list.</span>
                    </div>} disableInteractive className="vertically-center"><i className="codicon codicon-question"/></Tooltip>
                    <VSCodeButton
                        appearance={satisfiedSearch && sameTerms ? "secondary" : "primary"}
                        onClick={onSearch}
                        disabled={headerToSearch === "" || searchableHeaders.length === 0}>Search</VSCodeButton>
                </span>
            </span>
        </div>
        <SearchInput clearOnSearch value={searchText} onSearch={(s: string, f: TermFlags) => {
            const newTerms = cloneDeep(terms);
            newTerms[s] = f;
            setTerms(newTerms);
        }}/>
        <div css={{ border: "1px solid var(--badge-background)", marginRight: '5px', minHeight: '75px', paddingBottom: "10px"}}>
            {Object.keys(terms).map(s => (
                <div key={s} className="hover-border" onClick={() => { setSearchText([s, terms[s]]); }}
                    css={{display: "flex", justifyContent: "space-between", marginBottom: '1px', padding: '5px', background: 'var(--button-secondary-background)'}}
                >
                    <span>{s}</span>
                    <div css={{ display: "flex", alignItems: "center" }}>
                        {<span
                            slot="end"
                            css={{
                                borderRadius: "20%",
                                marginRight: "5px",
                                color: terms[s].caseSearch ? "var(--input-foreground)" : "var(--input-placeholder-foreground)",
                                opacity: terms[s].caseSearch ? "100%" : "10%"
                            }}
                            className="codicon codicon-case-sensitive"
                        />}
                        {<span
                            slot="end"
                            css={{
                                borderRadius: "20%",
                                marginRight: "5px",
                                color: terms[s].wholeSearch ? "var(--input-foreground)" : "var(--input-placeholder-foreground)",
                                opacity: terms[s].wholeSearch ? "100%" : "10%"
                            }}
                            className="codicon codicon-whole-word"
                        />}
                        {<span
                            slot="end"
                            css={{
                                borderRadius: "20%",
                                marginRight: "5px",
                                color: terms[s].reSearch ? "var(--input-foreground)" : "var(--input-placeholder-foreground)",
                                opacity: terms[s].reSearch ? "100%" : "10%"
                            }}
                            className="codicon codicon-regex"
                        />}
                        <span
                            slot="end"
                            css={{ cursor: "pointer", color: "red", margin: "2px" }}
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