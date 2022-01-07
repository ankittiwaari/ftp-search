'use strict';
const ftp = require('basic-ftp');

class Ftp {
    constructor(details) {
        if (!details.filename) {
            throw new Error('Please provide file to search!')
        }
        this.ftpDetails = details;
        this.sourceUrl = details.sourceUrl;
        this.client = new ftp.Client();
        this.fileTypes = [
            'unknown',
            'file',
            'directory',
            'symbolicLink'
        ]
        this.client.ftp.verbose = false;
        this.ignoredDirs = details.ignoredDirs ? new RegExp(details.ignoredDirs.join('|')) : false
        this.maxRecursion = details.maxDepth || 4;
        this.filename = details.filename;
    }

    connect = async () => {
        try {
            let connectionOptions = {
                host: this.ftpDetails.host,
                user: this.ftpDetails.user,
                password: this.ftpDetails.password,
                // secure: this.ftpDetails.secure || false,
                // secureOptions: this.ftpDetails.secureOptions || null
            }
            await this.accessHost(connectionOptions);
            return true;
        } catch (err) {
            console.log('[ftp-search] Could not connect via FTP, exiting!')
            return false;
        }
    }
    listFiles = async (targetDir = '') => {
        try {
            if (targetDir) {
                await this.client.cd(`${targetDir}`)
            }
            let files = await this.client.list();
            let list = {
                file: [],
                directory: []
            }
            if (files instanceof Array && files.length > 0) {
                for (let f of files) {
                    list[this.fileTypes[f.type]].push(f.name)
                }
            }
            return list;
        } catch (e) {
            console.log(e)
            console.log(`Could not list files! ${e.message}`)
        }

    }
    close = () => {
        this.client.close();
    }

    /**
     * Customised access function to have a fine-grained control
     * @param options
     * @returns {Promise<FTPResponse>}
     */
    accessHost = async (options) => {
        const welcome = await this.client.connect(options.host, options.port)
        if (options.secure === true) {
            await this.client.useTLS(options.secureOptions)
        }
        await this.client.login(options.user, options.password)
        await this.client.send("TYPE I")
        await this.client.sendIgnoringError("STRU F")
        await this.client.sendIgnoringError("OPTS UTF8 ON")
        if (this.client.useTLS) {
            await this.client.sendIgnoringError("PBSZ 0")
            await this.client.sendIgnoringError("PROT P")
        }
        return welcome
    }
    currentPath = async (path = null) => {
        if (path) {
            await this.client.cd(path);
        }
        return this.client.pwd();
    }
    /**
     * Detect source installation directory
     */
    searchFile = async (targetDir = null) => {
        try {
            let found = false, index = 0, newDirs = [], requiredFile = this.filename,
                pathStack = {};
            let files = await this.listFiles(targetDir);
            let currentPath = await this.currentPath(targetDir);
            if (files.file.indexOf(requiredFile) !== -1) {
                return currentPath;
            }
            do {
                if (typeof files.directory[index++] === 'undefined') {
                    console.log('[ftp-search] Not found in top level directories, traversing 1 level deep.');
                    return this.nestedTraversal(pathStack, currentPath);
                } else {
                    newDirs = files.directory[index];
                }
                if (this.ignoredDirs && this.ignoredDirs.test(newDirs)) {
                    continue;
                }
                console.log(`[ftp-search] Searching at level {0}:: ${newDirs}`)
                let newFiles = await this.listFiles(`${currentPath}${newDirs}`);
                if (newFiles.file.indexOf(requiredFile) !== -1) {
                    found = true;
                }
                newFiles.directory = newFiles.directory.filter(dir => dir.indexOf('.') !== 0);
                if (newFiles.directory.length > 0 && (!this.ignoredDirs || (this.ignoredDirs && !this.ignoredDirs.test(newDirs)))) {
                    pathStack[newDirs] = newFiles.directory;
                }
            } while (!found)
            return newDirs;
        } catch (e) {
            console.log(`[ftp-search] Could not find source directory ${e.message}`);
        }
    }
    nestedTraversal = async (stack, topLevelPath = '', level = 1) => {
        if (level === parseInt(this.maxRecursion)) {
            return false;
        }
        let topLevel = Object.keys(stack);
        let nestedPath, nestedPathStack = {}, nestedIndex = 0;
        for await (let rootDir of topLevel) {
            for await (let nestedDirs of stack[rootDir]) {
                nestedPath = `${topLevelPath}${rootDir}/${nestedDirs}`.replace('//', '/');
                if (this.ignoredDirs && this.ignoredDirs.test(nestedPath)) {
                    continue;
                }
                console.log(`[ftp-search] Searching at level {${level}}:: ${nestedPath}`);
                let files = await this.listFiles(nestedPath);
                if (!(files && files.file)) {
                    continue;
                }
                if (files.file.indexOf(this.filename) !== -1) {
                    return nestedPath;
                } else {
                    if (files.directory.length > 0 && (!this.ignoredDirs || (this.ignoredDirs && !this.ignoredDirs.test(nestedPath)))) {
                        nestedPathStack[nestedPath] = files.directory;
                    }
                }
            }
        }
        return this.nestedTraversal(nestedPathStack, topLevelPath, ++level);
    }
}

module.exports = Ftp;