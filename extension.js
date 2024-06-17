const vscode = require('vscode');
const path = require('path');

class SnippetFile {
    constructor(label, uri, provider) {
        this.label = label;
        this.uri = uri;
        this.provider = provider;
    }

    getTreeItem() {
        const treeItem = new vscode.TreeItem(this.label);
        treeItem.command = {
            command: 'vscode.open',
            title: '',
            arguments: [this.uri]
        };
        treeItem.contextValue = 'snippetFile';
        return treeItem;
    }

    async delete() {
        await this.provider.deleteSnippet(this.label);
    }

    async buildOrRun() {
        await this.provider.buildOrRunSnippet(this.uri);
    }
}

class SnippetFileProvider {
    constructor(context) {
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    async getChildren() {
        const snippetFolder = path.join(this.context.globalStorageUri.fsPath, 'snippets');
        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(snippetFolder));
            return files.map(([fileName]) => new SnippetFile(fileName, vscode.Uri.file(path.join(snippetFolder, fileName)), this));
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    getTreeItem(element) {
        return element.getTreeItem();
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    async deleteSnippet(snippetName) {
        const snippetFolder = path.join(this.context.globalStorageUri.fsPath, 'snippets');
        const snippetPath = path.join(snippetFolder, snippetName);
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(snippetPath), { recursive: false });
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete snippet: ${error.message}`);
        }
    }

    async renameSnippet(oldSnippetName, newSnippetName) {
        const snippetFolder = path.join(this.context.globalStorageUri.fsPath, 'snippets');
        const oldSnippetPath = path.join(snippetFolder, oldSnippetName);
        const newSnippetPath = path.join(snippetFolder, newSnippetName);

        try {
            await vscode.workspace.fs.rename(vscode.Uri.file(oldSnippetPath), vscode.Uri.file(newSnippetPath));
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename snippet: ${error.message}`);
        }
    }

    async buildOrRunSnippet(snippetUri) {
        const snippetFolder = path.join(this.context.globalStorageUri.fsPath, 'snippets');
        vscode.window.showInformationMessage(`Building/Running snippet: ${snippetUri.fsPath}`);
        
        const terminal = vscode.window.createTerminal('Snippet Terminal');
        terminal.show();
        
        if (snippetUri.fsPath.endsWith('.py')) {
            terminal.sendText(`python ${snippetUri.fsPath}`);
        } else if (snippetUri.fsPath.endsWith('.java')) {
            terminal.sendText(`javac ${snippetUri.fsPath}; cd \"${snippetFolder}\"; java ${path.basename(snippetUri.fsPath, '.java')}`);
            terminal.sendText(`cmd /c del /Q ${path.basename(snippetUri.fsPath, ".java")}.class`);
        } else if (snippetUri.fsPath.endsWith('.cs')) {
            terminal.sendText(`dotnet run ${snippetUri.fsPath}`);
        } else if (snippetUri.fsPath.endsWith('.cpp')) {
            terminal.sendText(`g++ ${snippetUri.fsPath} -o ${path.basename(snippetUri.fsPath, '.cpp')}; ./${path.basename(snippetUri.fsPath, '.cpp')}`);
        } else if (snippetUri.fsPath.endsWith('.c')) {
            terminal.sendText(`gcc ${snippetUri.fsPath} -o ${path.basename(snippetUri.fsPath, '.c')}; ./${path.basename(snippetUri.fsPath, '.c')}`);
        } else if (snippetUri.fsPath.endsWith('.bat') || snippetUri.fsPath.endsWith('.cmd')) {
            terminal.sendText(`cmd /c ${snippetUri.fsPath}`);
        } else if (snippetUri.fsPath.endsWith('.sh')) {
            terminal.sendText(`bash ${snippetUri.fsPath}`);
        } else if (snippetUri.fsPath.endsWith('.js')) {
            terminal.sendText(`cd \"${path.dirname(snippetUri.fsPath)}\" && npm install && node ${snippetUri.fsPath}`);
        } else if (snippetUri.fsPath.endsWith('.rb')) {
            terminal.sendText(`ruby ${snippetUri.fsPath}`);
        } else if (snippetUri.fsPath.endsWith('.rs')) {
            terminal.sendText(`rustc ${snippetUri.fsPath} -o ${path.basename(snippetUri.fsPath, '.rs')}; cd \"${snippetFolder}\"; ./${path.basename(snippetUri.fsPath, '.rs')}.exe`);
        } else if (snippetUri.fsPath.endsWith('.html')) {
            const snippetUriWithScheme = vscode.Uri.file(snippetUri.fsPath);
            await vscode.env.openExternal(snippetUriWithScheme);
        } else {
            vscode.window.showWarningMessage('Unsupported file type.');
        }
    }

    async openSnippet(snippetUri) {
        const snippetUriWithScheme = vscode.Uri.file(snippetUri.fsPath);
        await vscode.env.openExternal(snippetUriWithScheme);
    }

    async getSnippets() {
        const snippetFolder = path.join(this.context.globalStorageUri.fsPath, 'snippets');
        try {
            const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(snippetFolder));
            return files.map(([fileName]) => ({
                label: fileName,
                uri: vscode.Uri.file(path.join(snippetFolder, fileName)),
                provider: this
            }));
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }
}

async function ensureSnippetFolderExists(context) {
    const snippetFolder = path.join(context.globalStorageUri.fsPath, 'snippets');
    try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(snippetFolder));
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.log('Snippet folder creation failed:', error);
        }
    }
}

async function activate(context) {
    await ensureSnippetFolderExists(context);

    const snippetProvider = new SnippetFileProvider(context);
    vscode.window.registerTreeDataProvider('snippetView', snippetProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('vscode-snippetsplus.cs', async function () {
            vscode.window.showInformationMessage('Welcome To VSCode Snippets!');
            
            const fileTypes = ['Python', 'Java', 'NodeJS', 'HTML', 'C#', 'C++', 'C', 'Ruby', 'Rust', 'Batch', 'Bash', 'CMD'];
            const selectedFileType = await vscode.window.showQuickPick(fileTypes, {
                placeHolder: 'Select a file type',
                canPickMany: false
            });

            if (selectedFileType) {
                const fileExtension = {
                    'Python': 'py',
                    'Java': 'java',
                    'NodeJS': 'js',
                    'HTML': "html",
                    'C#': 'cs',
                    'C++': 'cpp',
                    'C': 'c',
                    'Ruby': 'rb',
                    'Rust': 'rs',
                    'Batch': 'bat',
                    'Bash': 'sh',
                    'CMD': 'cmd'
                }[selectedFileType];

                const snippetName = await vscode.window.showInputBox({ placeHolder: 'Enter the snippet file name' });
                if (snippetName) {
                    const snippetFolder = path.join(context.globalStorageUri.fsPath, 'snippets');
                    const snippetPath = path.join(snippetFolder, `${snippetName}.${fileExtension}`);
                    const snippetUri = vscode.Uri.file(snippetPath);

                    const initialContent = `# This is a new ${selectedFileType} snippet`;

                    try {
                        await vscode.workspace.fs.writeFile(snippetUri, Buffer.from(initialContent, 'utf8'));
                        vscode.window.showTextDocument(snippetUri);
                        snippetProvider.refresh();
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create snippet: ${error.message}`);
                    }
                }
            }
        }),

        vscode.commands.registerCommand('vscode-snippetsplus.ds', async function () {
            const snippets = await snippetProvider.getSnippets();
            const selectedSnippet = await vscode.window.showQuickPick(snippets, {
                placeHolder: 'Select a snippet to delete',
                canPickMany: false
            });

            if (selectedSnippet) {
                const confirmed = await vscode.window.showWarningMessage(`Are you sure you want to delete '${selectedSnippet.label}'?`, 'Delete', 'Cancel');
                if (confirmed === 'Delete') {
                    await snippetProvider.deleteSnippet(selectedSnippet.label);
                }
            }
        }),

        vscode.commands.registerCommand('vscode-snippetsplus.brs', async function () {
            const snippets = await snippetProvider.getSnippets();
            const selectedSnippet = await vscode.window.showQuickPick(snippets, {
                placeHolder: 'Select a snippet to build/run',
                canPickMany: false
            });

            if (selectedSnippet) {
                await snippetProvider.buildOrRunSnippet(selectedSnippet.uri);
            }
        }),

        vscode.commands.registerCommand('vscode-snippetsplus.os', async function () {
            const snippets = await snippetProvider.getSnippets();
            const selectedSnippet = await vscode.window.showQuickPick(snippets, {
                placeHolder: 'Select a snippet to open',
                canPickMany: false
            });

            if (selectedSnippet) {
                vscode.window.showTextDocument(selectedSnippet.uri);
            }
        }),

        vscode.commands.registerCommand('vscode-snippetsplus.rs', async function () {
            const snippets = await snippetProvider.getSnippets();
            const selectedSnippet = await vscode.window.showQuickPick(snippets, {
                placeHolder: 'Select a snippet to rename',
                canPickMany: false
            });

            if (selectedSnippet) {
                const newSnippetName = await vscode.window.showInputBox({ placeHolder: 'Enter the new snippet file name' });
                if (newSnippetName) {
                    const oldSnippetName = selectedSnippet.label;
                    const fileExtension = path.extname(oldSnippetName);
                    await snippetProvider.renameSnippet(oldSnippetName, `${newSnippetName}${fileExtension}`);
                }
            }
        }),

    );

    vscode.window.createTreeView('snippetView', { treeDataProvider: snippetProvider });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
