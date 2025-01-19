const vscode = require('vscode');
const cp=require('child_process');
const fs= require('fs');
const path= require('path');

let language;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context){

	vscode.window.registerWebviewViewProvider(
        'CPHleetcodeview', 
        new TestCasesViewProvider(context)
    );

	// let fetchCommand= vscode.commands.registerCommand('cph.fetchTestCases', () => {
    //     vscode.window.showInputBox({prompt: 'Enter Leetcode problem URL'}).then(problemURL =>{
    //         if (problemURL){
    //             fetchTestCases(problemURL);
    //         }
    //     });
    // });

	// runCommand= vscode.commands.registerCommand('cph.runTestCases', () =>{
	// let runCmd;
	// if (language=="cpp"){
	// 	runCmd='"$fileNameWithoutExt"';
	// }
	// else{ //language is python
	// 	runCmd='python3 "$fileName"';
	// }
	// runTestCases(language,	 runCmd);
	// });

    // context.subscriptions.push(fetchCommand);
	// context.subscriptions.push(runCommand);
}



class TestCasesViewProvider {
    constructor(context) {
        this._context = context;
    }
    resolveWebviewView(webviewView, context, token) {
		webviewView.webview.options = {
			enableScripts: true, 
		};
        webviewView.webview.html = this.getWebviewContent(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'fetchTestCases':
                    this.fetchTestCases(message.url, webviewView);
                    return;
                case 'runTestCases':
					let runCmd;
					language= vscode.window.activeTextEditor.document.languageId;
					if (language=="cpp"){
						runCmd='"$fileNameWithoutExt"';
					}
					else{ //language is python
						runCmd='python3 "$fileName"';
					}
					this.runTestCases(language,	 runCmd, webviewView);
                    return;
            }
        });
    }

	fetchTestCases(problemURL, webviewView){
		const scriptPath= path.join(__dirname, 'test_cases_fetching')
		cp.exec(`${scriptPath} ${problemURL} ${__dirname}`, (error, stdout, stderr) =>{
			if (error){
				vscode.window.showErrorMessage(`Error fetching test cases: ${stderr}`);
			}
			else{
				const testCasesDir = path.join(__dirname, 'input');
				const testCases = [];
				const files = fs.readdirSync(testCasesDir);
				files.forEach(file => {
					const testCaseId = parseInt(file.slice(5, -4));
					
					const filePath = path.join(testCasesDir, file);
					const fileContent = fs.readFileSync(filePath, 'utf-8');
					
					testCases.push({
						testCaseId: testCaseId,
						input: fileContent
					});
				});

				webviewView.webview.postMessage({ command: 'showTestCases', testCases });
				vscode.window.showInformationMessage('Test cases fetched');
			}
		});
	}
	
	runCmdExecution(execCommand, inputPath, expectedOutput, idx){
		
		return new Promise((resolve, reject) =>{
			let testResultsElem;
			const child= cp.spawn(execCommand, { shell: true });
		
			const inputContent= fs.readFileSync(inputPath, 'utf-8');
			child.stdin.write(inputContent);
			child.stdin.end();
		
			let actualOutput= '';
		
			child.stdout.on('data', (data) =>{
				actualOutput+= data.toString(); 
			});
			child.stderr.on('data', (data) =>{
				// vscode.window.showErrorMessage(`Execution failed: ${data}`);
				reject(new Error(`Execution failed: ${data}`));
			});
			child.on('close', (code) => {
				if (code==0){
					const result= (actualOutput.trim() === expectedOutput.trim());
					testResultsElem={
						testCaseId: idx + 1,
						passed: result,
						input: inputContent,
						expected: expectedOutput.trim(),
						actual: actualOutput.trim()
					};
					
					// vscode.window.showInformationMessage(`Test case ${idx + 1}: ${result}`);
					resolve(testResultsElem);
				} 
				else{
					reject(new Error(`Process exited with code: ${code}`));
				}
			});
		});
		
	}

	compileCode(compCommand, compArgs){
		return new Promise((resolve, reject) => {
			const compileProcess = cp.spawn(compCommand, compArgs, { shell: true });
			compileProcess.stdout.on('data', (data) =>{
				console.log(`Compilation stdout: ${data}`);
			});
	
			compileProcess.stderr.on('data', (data) =>{
				console.log(`Compilation stderr: ${data}`);
			});
	
			compileProcess.on('close', (code)=>{
				if (code === 0){
					resolve();
				}
				else{
					reject(new Error('Compilation failed'));
				}
			});
		});
	}
	
	async runTestCases(language, runCommand, webviewView){
		const activeEditor= vscode.window.activeTextEditor;
		if (!activeEditor){
			vscode.window.showErrorMessage('No active editor found');
			return;
		}
		const inputDir= path.resolve(__dirname, 'input');
		const outputDir= path.resolve(__dirname, 'output');
		const inputFiles= fs.readdirSync(inputDir).filter(file =>file.startsWith('input'));
		const fileName= activeEditor.document.fileName;
		const fileNameWithoutExt= path.basename(fileName, path.extname(fileName));

		if (language=="cpp"){ //Compilation is required before execution of code in case of C++
			const compCommand='g++';
			const compArgs= ['-std=c++17', '-o', `"${path.join(path.dirname(fileName), fileNameWithoutExt)}"`, `"${fileName}"`];
			try{
                await this.compileCode(compCommand, compArgs);
            } 
			catch(error){
                vscode.window.showErrorMessage(error.message);
				return;
            }
		}
		let testResults=[];

		for (const [idx, inputFile] of inputFiles.entries()){
			const inputPath= path.join(inputDir, inputFile);
			const expectedOutputPath= path.join(outputDir, `output${idx + 1}.txt`);
			const expectedOutput= fs.readFileSync(expectedOutputPath, 'utf-8');
			let execCommand;
			if (language=="cpp"){
				execCommand= runCommand.replace('$fileNameWithoutExt', path.join(path.dirname(fileName), fileNameWithoutExt));
			}
			else{ //language is python
				execCommand= runCommand.replace('$fileName', fileName);
			}
			try{
				const testResult=await this.runCmdExecution(execCommand, inputPath, expectedOutput, idx);
				testResults.push(testResult);
			}
			catch(error){
				vscode.window.showErrorMessage(`Execution failed: ${error.message} and ${fileName}`);
			}
		};
		webviewView.webview.postMessage({command: 'showTestResults', testResults});
	}
	
	getWebviewContent(webview) {
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Test Cases</title>
				<style>
					body {
						font-family: Arial, sans-serif;
						padding: 10px;
					}
					.card {
						border: 1px solid #ccc;
						padding: 10px;
						margin: 5px 0;
						border-radius: 5px;
					}
					.passed {
						background-color: #d4edda;
					}
					.failed {
						background-color: #f8d7da;
					}
					#statusLabel {
						margin-top: 10px;
						font-size: 14px;
						color: #007acc;
					}
					#runStatusLabel {
						margin-top: 10px;
						font-size: 14px;
						color: #f00;
					}
				</style>
			</head>
			<body>
				<h2>LeetCode Test Case Fetcher</h2>

				<input type="text" id="problemUrl" placeholder="Enter LeetCode problem URL" style="width: 100%; padding: 8px; margin-bottom: 10px;">
				<button id="fetchTestCasesBtn">Fetch Test Cases</button>
				<p id="statusLabel">Enter the URL and fetch test cases.</p>
				<br>
				<button id="runTestCasesBtn" disabled>Run Test Cases</button>
				<p id="runStatusLabel">Fetch test cases first.</p>
				<div id="resultsContainer"></div>

				<script>
					const vscode = acquireVsCodeApi();
					let testCases = [];

					document.getElementById('fetchTestCasesBtn').addEventListener('click', () => {
						console.log("Fetch test cases button clicked");
						const problemUrl = document.getElementById('problemUrl').value;
						document.getElementById('statusLabel').innerText = 'Fetching test cases...';
						vscode.postMessage({ command: 'fetchTestCases', url: problemUrl });
					});

					document.getElementById('runTestCasesBtn').addEventListener('click', function() {
						if (testCases.length > 0) {
							vscode.postMessage({ command: 'runTestCases', testCases });
						}
					});

					window.addEventListener('message', function(event) {
						const message = event.data;

						switch (message.command) {
							case 'showTestCases':
								testCases = message.testCases;
								document.getElementById('statusLabel').innerText = 'Test cases fetched!';
								document.getElementById('runTestCasesBtn').disabled = false;
								displayTestCases(testCases);
								break;
							case 'showTestResults':
								displayTestResults(message.testResults);
								break;
						}
					});

					function displayTestCases(testCases) {
					const resultsContainer = document.getElementById('resultsContainer');
					resultsContainer.innerHTML = ''; // Clear any existing results

					testCases.forEach(testCase => {
						const card = document.createElement('div');
						card.className = 'card';  // Keep it simple for test case display

						const testCasePara = document.createElement('p');
						testCasePara.textContent = 'Test Case ' + testCase.testCaseId;

						const inputPara = document.createElement('p');
						inputPara.innerHTML = '<strong>Input:</strong> ' + testCase.input;

						card.appendChild(testCasePara);
						card.appendChild(inputPara);

						resultsContainer.appendChild(card);
						});
					}


					function displayTestResults(testResults) {
						const resultsContainer = document.getElementById('resultsContainer');
						resultsContainer.innerHTML = ''; // Clear any existing results

						testResults.forEach(result => {
							const card = document.createElement('div');
							card.className = 'card ' + (result.passed ? 'passed' : 'failed');

							const testCasePara = document.createElement('p');
							testCasePara.textContent = 'Test Case ' + result.testCaseId + ': ' + (result.passed ? 'Passed' : 'Failed');

							const inputPara = document.createElement('p');
							inputPara.innerHTML = '<strong>Input:</strong> ' + result.input;

							const expectedPara = document.createElement('p');
							expectedPara.innerHTML = '<strong>Expected:</strong> ' + result.expected;

							const actualPara = document.createElement('p');
							actualPara.innerHTML = '<strong>Actual:</strong> ' + result.actual;

							card.appendChild(testCasePara);
							card.appendChild(inputPara);
							card.appendChild(expectedPara);
							card.appendChild(actualPara);

							resultsContainer.appendChild(card);
						});
					}
				</script>
			</body>
			</html>
		`;
	}
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}
