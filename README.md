# ftp-search
# Introduction
This module can be used to search for a particular file using FTP protocol. Since the FTP does not offer any built-in search feature, this module simply looks in each folder recursively and returns the path of first occurrence of specified file.

It has the following limitations at present that are to be removed in subsequent updates
1. It only searches for the first occurrence of specified file.

# Usage
```js
const FTPSearch = require('@ankittiwaari/ftp-search');
(async () => {
    let ftp = new FTPSearch({
        host: '<ftp-host>',
        user: '<username>',
        password: '<password>',
        filename: '<file to search for>',
        ignoredDirs: [
            'dirname1',
            'dirname2',
        ], // list of directories to ignore
        maxRecursion: 4 // (Optional) maximum depth the search should continue. The default value is 4 
    });
    await ftp.connect();
    let path = await ftp.searchFile()
    console.log(path);
})()
```