import fs from "fs";

const testFolder = 'src/__test__/';

export function copyConfigFiles(filePaths: string[]) {
    filePaths.forEach(filePath => {
        fs.copyFileSync(`${filePath}.default`, `${testFolder}${filePath}`, )
    })
}
export function deleteConfigFiles(filePaths: string[]) {
    filePaths.forEach(filePath => {
        fs.unlinkSync(`${testFolder}${filePath}`)
    })
}
