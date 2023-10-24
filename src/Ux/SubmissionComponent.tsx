import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import React from "react";
import { FileDataContext } from "./FileDataContext";
import { Ext2WebMessage, postW2EMessage, updateWebviewState, vscodeAPI } from "../communicationProtocol";

interface Props {
    dates: [string, string];
}

let initialization = false;
export default function SubmissionComponent({ dates }: Props) {
    const { fileData, fileDataDispatch: _fileDataDispatch } = React.useContext(FileDataContext);

    const amountOfFiles = Object.keys(fileData).length;

    // Style
    const [submitText, setSubmitText] = React.useState("");
    const submitError = submitText.includes("ERROR");

    const sameEdgeDates = dates[0] === dates[1];

    const onMessage = (event: MessageEvent) => {
        const message = event.data as Ext2WebMessage;
        switch (message.command) {
            case "initialize": {
                initialization = false;
                break;
            }
            case "submit-message":
                setSubmitText(message.text);
                break;
        }
    };

    // Run only once!
    React.useEffect(() => {
        window.addEventListener('message', onMessage);

        // initialize
        initialization = true;
        const prevState = vscodeAPI.getState();
        if (prevState) {
            // Read prev state
            setSubmitText(prevState.submitText);
        }
    }, []);

    React.useEffect(() => {
        if (initialization) return;
        updateWebviewState({ submitText });
    }, [submitText]);

    function onSubmit () {
        setSubmitText("Loading...");
        postW2EMessage({ command: "submit", 
            files: fileData[0], 
            constraints: dates,
        });
    }

    return (
        <div>
            <VSCodeButton appearance={amountOfFiles > 0 ? 'primary' : 'secondary'} onClick={onSubmit} disabled={ amountOfFiles === 0 || sameEdgeDates }>Merge and Open</VSCodeButton>
            {(!submitError && submitText.length > 0) && <VSCodeProgressRing/>}
            {submitText.length > 0 && <span style={{ color: submitError ? "red" : undefined }}>{submitText}</span>}
        </div>
    )
}