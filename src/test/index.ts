import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import globalJsdom from 'global-jsdom';

// This file is run to execute the tests
export function run(): Promise<void> {
    // Create the mocha tester
    const mochaPureTS = new Mocha({
        ui: 'tdd',
        color: true,
    });
    
    mochaPureTS.globalSetup(() => {
        globalJsdom();
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        glob('**/**.test.js?(x)', { cwd: testsRoot }).then((files: string[]) => {
            

            // Add files to the test suite
            files.filter(f => f.endsWith(".test.js")).forEach(f => mochaPureTS.addFile(path.resolve(testsRoot, f)));


            try {
                // Run the mocha tests
                mochaPureTS.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} normal tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                e(err);
            }
        }).catch(error => {
            e(error);
        });
    });
}