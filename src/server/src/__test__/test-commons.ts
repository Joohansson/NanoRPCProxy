import fs from "fs";

const testFolder = 'src/__test__/';

export function getTestPath(filename: String) {
    return `${testFolder}${filename}`
}

export function copyConfigFiles(filePaths: string[]) {
    filePaths.forEach(filePath => {
        fs.copyFileSync(`${filePath}.default`, getTestPath(filePath), )
    })
}
export function deleteConfigFiles(filePaths: string[]) {
    filePaths.forEach(filePath => {
        try {
            let path = getTestPath(filePath);
            fs.unlinkSync(path)
        } catch (e) {
            // file might not be found which is OK
        }
    })
}
