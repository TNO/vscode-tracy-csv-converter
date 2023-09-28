# Tracy CSV converter
A CSV converter for [Tracy](https://github.com/TNO/vscode-tracy). The main goal of this repository is to provide an example on how to create your own converter for Tracy. To do this, press "Use this template" (above) -> "Create a new repository" and adapt  [`src/converters.ts`](./src/converters.ts).

## Installation
To install in Visual Studio Code:
1. Obtain the plugin `.vsix` file:
    - If you want to install the latest release, go to the [Latest release](https://github.com/TNO/vscode-tracy-csv-converter/releases/latest) and download the `vscode-tracy-csv-converter-X.X.X.vsix` file under *Assests*.
    - If you want to install a specific commit, click on the :heavy_check_mark: next to the commit -> *Details* -> *Summary* -> under *Artifacts*, *vscode-vsix* and extract the downloaded `vscode-vsix.zip`.
1. Open Visual Studio Code, in the side bar go to *Extensions* -> `···` (right top) -> *Install from VSIX...* -> open the downloaded `vscode-tracy-csv-converter-X.X.X.vsix`.
1. To test, download the [example](https://github.com/TNO/vscode-tracy-csv-converter/raw/main/examples/dummy.csv.zip), extract the zip and open it with Vistual Studio Code. Press "Help" (top bar) -> "Show All Commands" (or `CTRL` + `SHIFT` + `P`). Now there are two extra options.
    1. Search for "Tracy CSV converter: open current document with Tracy". Press enter and select "Using standard converter". Tracy will now open.
    1. Search for "Tracy CSV converter: open multiple documents with Tracy". A new view will appear, where you can add files using a file selection dialog. Press "Merge & Open" to open Tracy.
1. If you want to upgrade Tracy in the future, repeat the instructions above.

## Developing
To develop Tracy CSV converter:
1. Make sure that [Node.js](https://nodejs.org/en/) (version 18+ recommended) and [Git](https://git-scm.com/) are installed.
1. Execute: 
    ```bash
    # Clone the repository
    git clone https://github.com/TNO/vscode-tracy-csv-converter.git
    cd vscode-tracy-csv-converter
    # Install dependencies
    npm ci 
    # Open the repository in Visual Studio Code
    code .
    ```
1. In Vistual Studio Code, go to *Run* (menu bar) -> *Start Debugging*. A new Visual Studio Code instance (*Extension Development Host*) will be started with Tracy CSV converter installed. To apply any code changes go to *Run* (menu bar) -> *Restart Debugging*.

## Creating a new release
To create a new release, go to the [CI GitHub action](https://github.com/TNO/vscode-tracy-csv-converter/actions/workflows/ci.yml) -> *Run workflow* -> adjust type accordingly -> *Run workflow*. Wait till build completes and add the [release notes](https://github.com/TNO/vscode-tracy-csv-converter/releases/latest).
