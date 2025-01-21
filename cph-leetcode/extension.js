const vscode = require('vscode');
const cp=require('child_process');
const fs= require('fs');
const path= require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context){
	vscode.window.registerWebviewViewProvider(
        'CPHleetcodeview', 
        new TestCasesViewProvider(context)
    );
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
					let language= vscode.window.activeTextEditor.document.languageId;
					if (language=="cpp"){
						runCmd='"$fileNameWithoutExt"';
					}
					else if (language=="python"){ 
						runCmd='python3 "$fileName"';
					}
					else { //language is java
						runCmd='cd "$path" && java "$fileNameWithoutExt"';
					}
					this.runTestCases(language,	 runCmd, webviewView);
                    return;
				case 'updateTestCase':
					this.updateTestCases(message.action, message.testCaseId, message.input, message.expectedOutput, webviewView);
					return;
				case 'showError':
					vscode.window.showErrorMessage(message.message);
					return;
				case 'showInfo':
					vscode.window.showInformationMessage(message.message);
					return;
            }
        });
    }

	fetchTestCases(problemURL, webviewView){
		const scriptPath= path.join(__dirname, 'test_cases_fetching')
		cp.exec(`${scriptPath} ${problemURL} ${__dirname}`, (error, stdout, stderr) =>{
			if (error){
				vscode.window.showErrorMessage(`Error fetching test cases: ${stderr}`);
				webviewView.webview.postMessage({ command: 'showError' });
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
	updateTestCases(action, testCaseId, new_input, new_expectedOutput, webviewView){
		const scriptPath= path.join(__dirname, 'test_cases_updating');
		cp.exec(`${scriptPath} ${action} ${__dirname} ${testCaseId} "${new_input}" "${new_expectedOutput}"`, (error, stdout, stderr) =>{
			if (error){
				vscode.window.showErrorMessage(`Error updating test case: ${stderr}`);
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
				if (action=="EDIT"){
					vscode.window.showInformationMessage('Test case edited');
				}
				else{
					vscode.window.showInformationMessage('Test case added');
				}
				
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
				reject(new Error(`${data}`));
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
					resolve(testResultsElem);
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
				reject(new Error(`Compilation failed: ${data}`));
			});
	
			compileProcess.on('close', (code)=>{
				if (code === 0){
					resolve();
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

		//Compilation is required before execution of code in case of C++ and java
		if (language=="cpp"){ 
			const compCommand='g++';
			const compArgs= ['-std=c++17', '-o', `"${path.join(path.dirname(fileName), fileNameWithoutExt)}"`, `"${fileName}"`];
			try{
                await this.compileCode(compCommand, compArgs);
            } 
			catch(error){
                vscode.window.showErrorMessage(error.message);
				let empty=[];
				webviewView.webview.postMessage({command: 'showTestResults', empty});
				return;
            }
		}
		else if (language=="java"){
			const compCommand='javac';
			const compArgs= [`"${fileName}"`];
			try{
                await this.compileCode(compCommand, compArgs);
            } 
			catch(error){
                vscode.window.showErrorMessage(error.message);
				let empty=[];
				webviewView.webview.postMessage({command: 'showTestResults', empty});
				return;
            }
		}
		let testResults=[];

		//Run the code for each test case
		for (const [idx, inputFile] of inputFiles.entries()){
			const inputPath= path.join(inputDir, inputFile);
			const expectedOutputPath= path.join(outputDir, `output${idx + 1}.txt`);
			const expectedOutput= fs.readFileSync(expectedOutputPath, 'utf-8');
			let execCommand;
			if (language=="cpp"){
				execCommand= runCommand.replace('$fileNameWithoutExt', path.join(path.dirname(fileName), fileNameWithoutExt));
			}
			else if (language=="python"){
				execCommand= runCommand.replace('$fileName', fileName);
			}
			else if (language=="java"){
				execCommand= runCommand.replace('$path', path.join(path.dirname(fileName))).replace('$fileNameWithoutExt', fileNameWithoutExt);
			}
			else{
				vscode.window.showErrorMessage('Unsupported language; please use C++/Python/Java');
				break;
			}
			try{
				const testResult=await this.runCmdExecution(execCommand, inputPath, expectedOutput, idx);
				testResults.push(testResult);
			}
			catch(error){
				vscode.window.showErrorMessage(`Execution failed: ${error.message} command: ${execCommand}`);
			}
		};
		webviewView.webview.postMessage({command: 'showTestResults', testResults});
	}
	
	getWebviewContent(webview){
		return `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>CPH-Leetcode</title>
				<style>
					body {
						font-family: Arial, sans-serif;
						padding: 10px;
					}
					.card {
						position: relative;
						border: 1px solid #ccc;
						padding: 10px;
						margin: 5px 0;
						border-radius: 5px;
					}
					.passed {
						border: 2px solid green;
					}
					.failed {
						border: 2px solid red;
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
					button {
						background-color:rgb(250, 226, 76); 
						color: black; 
						border: 2px solid rgb(172, 132, 0);
						border-radius: 5px; 
						padding: 7px 7px; 
						font-size: 14px; 
						font-weight: bold;
						cursor: pointer; 
					}
					button:hover {
						background-color: rgb(255, 196, 0);
					}
					.editButton {
						position: absolute;
						top: 50%;
						right: 10px;
						transform: translateY(-50%);
						background-color: #007BFF; 
						color: black; 
						border: 2px solid rgb(0, 49, 102);
						border-radius: 5px; 
						font-size: 14px;
						cursor: pointer;
						
					}
					.editButton:hover {
						background-color: rgb(1, 83, 170);
					}
					.addButton {
						background-color: #007BFF; 
						color: black; 
                        border: 2px solid rgb(0, 49, 102);
                        border-radius: 5px;
                        display: block;
                        margin: 10px auto;
                        font-size: 14px;
                        cursor: pointer;
					}
					.saveButton {
						background-color: #007BFF; 
						color: black; 
						border: 2px solid rgb(0, 49, 102);
						border-radius: 5px; 
						font-size: 14px;
						cursor: pointer;
					}
					.saveButton:hover {
						background-color: rgb(1, 83, 170);
					}
					.addSaveButton {
						background-color: #007BFF; 
						color: black; 
						border: 2px solid rgb(0, 49, 102);
						border-radius: 5px; 
						font-size: 14px;
						cursor: pointer;
					}
					.addSaveButton:hover {
						background-color: rgb(1, 83, 170);
					}
					
					button.addButton:hover {
						background-color: rgb(1, 83, 170);
						
					}
					.closeButton {
						background-color: #007BFF; 
						color: black; 
						border: 2px solid rgb(0, 49, 102);
						border-radius: 5px; 
						font-size: 14px;
						margin-left: 15px;
						display: inline-block;
						cursor: pointer;
					}
					.closeButton:hover {
						background-color: rgb(1, 83, 170);
					}
					input[type="text"] {
						border-radius: 25px; 
						border: 2px solid #007BFF;
						outline: none; 
					}
				</style>
			</head>
			<body>
				<h2>CPH-Leetcode</h2>
				<input type="text" id="problemUrl" placeholder="Enter LeetCode problem URL" style="width: 90%; padding: 8px; margin-bottom: 10px;">
				<button id="fetchTestCasesButton">Fetch test cases</button>
				<p id="statusLabel">Enter the URL and fetch test cases</p>
				<br>
				<button id="runTestCasesButton" disabled>Run test cases</button>
				<p id="runStatusLabel">Fetch test cases first.</p>
				<div id="resultsContainer"></div>

				<script>
					const vscode = acquireVsCodeApi();
					let testCases = [];

					document.getElementById('fetchTestCasesButton').addEventListener('click', () => {
						const problemUrl = document.getElementById('problemUrl').value;
						if (problemUrl.trim()!='') {
							document.getElementById('statusLabel').innerText = 'Fetching test cases...';
							vscode.postMessage({ command: 'fetchTestCases', url: problemUrl });
						}
					});

					document.getElementById('runTestCasesButton').addEventListener('click', ()=> {
							vscode.postMessage({ command: 'runTestCases', testCases });
					});

					window.addEventListener('message', function(event) {
						const message = event.data;

						switch (message.command) {
							case 'showTestCases':
								testCases = message.testCases;
								document.getElementById('statusLabel').innerText = 'Test cases fetched!';
								document.getElementById('runTestCasesButton').disabled = false;
								document.getElementById('runStatusLabel').innerText = '';
								displayTestCases(testCases);
								break;
							case 'showTestResults':
								displayTestResults(message.testResults);
								break;
							case 'showError':
								document.getElementById('statusLabel').innerText = 'An error occured!';
						}
					});

					function displayTestCases(testCases) {
						const resultsContainer = document.getElementById('resultsContainer');
						resultsContainer.innerHTML = ''; 
						let editContainerOpen=false;
						testCases.forEach(testCase => {
							const card = document.createElement('div');
							card.className = 'card'; 

							const testCasePara = document.createElement('p');
							testCasePara.textContent = 'Test case ' + testCase.testCaseId;

							const inputPara = document.createElement('p');
							inputPara.innerHTML = '<strong>Input:</strong> ' + testCase.input;

							
							const editButton = document.createElement('button');
							editButton.className = 'editButton';
							editButton.innerHTML = 'Edit';
							
							const editContainer = document.createElement('div');
							editContainer.style.display = 'none';

							const inputTextBox = document.createElement('textarea');
							inputTextBox.style.width = '90%';
							inputTextBox.style.marginTop = '10px';
							inputTextBox.placeholder = 'Edit input';
							inputTextBox.value = testCase.input;

							const outputTextBox = document.createElement('textarea');
							outputTextBox.style.width = '90%';
							outputTextBox.style.marginTop = '10px';
							outputTextBox.placeholder = 'Edit expected output';

							const saveButton = document.createElement('button');
							saveButton.className = 'saveButton';
							saveButton.innerHTML = 'Save';
							
							saveButton.addEventListener('click', () => {
								editContainerOpen=false;
								const updatedInput = inputTextBox.value;
								const updatedOutput = outputTextBox.value;
								if (updatedInput!="" && updatedOutput!="") {
									vscode.postMessage({
										command: 'updateTestCase',
										action: "EDIT",
										testCaseId: testCase.testCaseId,
										input: updatedInput,
										expectedOutput: updatedOutput
									});
									editContainer.style.display = 'none';
									editButton.style.display = 'inline';
								}
								else{
									vscode.postMessage({ command: 'showError', message: 'Missing field(s)' });
								}
								
							});

							editButton.addEventListener('click', () => {
								if (editContainerOpen){
									vscode.postMessage({ command: 'showInfo', message: 'One editing window already open' });
									return;
								}
								editContainerOpen=true;
								editContainer.style.display = 'block';
								editButton.style.display = 'none';
							});

							editContainer.appendChild(inputTextBox);
							editContainer.appendChild(outputTextBox);
							editContainer.appendChild(saveButton);

							card.appendChild(testCasePara);
							card.appendChild(inputPara);
							card.appendChild(editButton);
							card.appendChild(editContainer);

							resultsContainer.appendChild(card);
						});

						const addButton = document.createElement('button');
						addButton.className = 'addButton';
						addButton.innerHTML = '+ Add test case';

						addButton.addEventListener('click', () => {
							resultsContainer.removeChild(addButton);
							const addCard = document.createElement('div');
							addCard.className = 'card';

							const newLabel = document.createElement('p');
							newLabel.textContent = 'New test case';
							newLabel.style.fontWeight = 'bold';

							const addInputTextBox = document.createElement('textarea');
							addInputTextBox.style.width = '90%';
							addInputTextBox.style.marginTop = '10px';
							addInputTextBox.placeholder = 'Enter input';

							const addOutputTextBox = document.createElement('textarea');
							addOutputTextBox.style.width = '90%';
							addOutputTextBox.style.marginTop = '10px';
							addOutputTextBox.placeholder = 'Enter expected output';

							const addSaveButton = document.createElement('button');
							addSaveButton.className = 'addSaveButton';
							addSaveButton.innerHTML = 'Add'; 
							addSaveButton.style.marginTop = '10px';

							addSaveButton.addEventListener('click', () => {
								const addInput = addInputTextBox.value;
								const addOutput = addOutputTextBox.value;
								if (addInput!="" && addOutput!="") {
									vscode.postMessage({
										command: 'updateTestCase',
										action: "ADD",
										testCaseId: 0,
										input: addInput,
										expectedOutput: addOutput
									});
									resultsContainer.removeChild(addCard);
									resultsContainer.appendChild(addButton);
								}
								else {
									vscode.postMessage({ command: 'showError', message: 'Missing field(s)' });
								}
							});
							const closeButton = document.createElement('button');
							closeButton.className = 'closeButton';
							closeButton.innerHTML = 'Close'; 
							closeButton.addEventListener('click', () => {
								resultsContainer.removeChild(addCard);
								resultsContainer.appendChild(addButton);
							});

							addCard.appendChild(newLabel);
							addCard.appendChild(addInputTextBox);
							addCard.appendChild(addOutputTextBox);
							addCard.appendChild(addSaveButton);
							addCard.appendChild(closeButton);

							resultsContainer.appendChild(addCard);
						});
						resultsContainer.appendChild(addButton);
					}
					


					function displayTestResults(testResults) {
						const resultsContainer = document.getElementById('resultsContainer');
						resultsContainer.innerHTML = ''; 

						testResults.forEach(result => {
							const card = document.createElement('div');
							card.className = 'card ' + (result.passed ? 'passed' : 'failed');

							const testCasePara = document.createElement('p');
							testCasePara.textContent = 'Test Case ' + result.testCaseId + ': ' + (result.passed ? 'PASSED' : 'FAILED');
							testCasePara.style.color = result.passed?'green' : 'red';

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
