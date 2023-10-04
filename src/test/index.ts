import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

// This file is run to execute the tests
export function run(): Promise<void> {
    // Create the mocha tester
    const mocha = new Mocha({
        ui: 'tdd',
        color: true
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        glob('**/**.test.js', { cwd: testsRoot }).then((files: string[]) => {

        // Add files to the test suite
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        try {
            // Run the mocha tests
            mocha.run(failures => {
            if (failures > 0) {
                e(new Error(`${failures} tests failed.`));
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