const vscode = require('vscode');
const cp=require('child_process');
const fs= require('fs');
const path= require('path');

let runCommand; //Declared globally as it is used in two functions
const language= vscode.window.activeTextEditor.document.languageId;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context){
	let fetchCommand= vscode.commands.registerCommand('cph.fetchTestCases', () => {
        vscode.window.showInputBox({prompt: 'Enter Leetcode problem URL'}).then(problemURL =>{
            if (problemURL){
                fetchTestCases(problemURL);
            }
        });
    });

	runCommand= vscode.commands.registerCommand('cph.runTestCases', () =>{
	let runCmd;
	if (language=="cpp"){
		runCmd='"$fileNameWithoutExt"';
	}
	else{ //language is python
		runCmd='python3 "$fileName"';
	}
	runTestCases(language,	 runCmd);
	});

    context.subscriptions.push(fetchCommand);
	context.subscriptions.push(runCommand);
}


function fetchTestCases(problemURL){
    const scriptPath= path.join(__dirname, 'test_cases_fetching')
    cp.exec(`${scriptPath} ${problemURL} ${__dirname}`, (error, stdout, stderr) =>{
        if (error){
            vscode.window.showErrorMessage(`Error fetching test cases: ${stderr}`);
        }
		else{
            vscode.window.showInformationMessage('Test cases fetched');
        }
    });
}


function runCmdExecution(execCommand, inputPath, expectedOutput, idx){
	const child= cp.spawn(execCommand, { shell: true });

	const inputContent= fs.readFileSync(inputPath, 'utf-8');
	child.stdin.write(inputContent);
	child.stdin.end();

	let actualOutput= '';

	child.stdout.on('data', (data) =>{
		actualOutput+= data.toString(); 
	});
	child.stderr.on('data', (data) =>{
		vscode.window.showErrorMessage(`Execution failed: ${data}`);
	});
	child.on('close', (code) => {
		if (code==0){
			const result= actualOutput.trim() === expectedOutput.trim() ?'Passed':'Failed';
			vscode.window.showInformationMessage(`Test case ${idx + 1}: ${result}`);
		} 
		else{
			vscode.window.showErrorMessage(`Process exited with code: ${code}`);
		}
	});
}


function runTestCases(language, runCommand){
	const activeEditor= vscode.window.activeTextEditor;
    if (!activeEditor){
        vscode.window.showErrorMessage('No active editor found');
        return;
    }
    const inputDir= path.resolve(__dirname, 'input');
    const outputDir= path.resolve(__dirname, 'output');
    const inputFiles= fs.readdirSync(inputDir).filter(file =>file.startsWith('input'));

    inputFiles.forEach((inputFile, idx) =>{
        const inputPath= path.join(inputDir, inputFile);
        const expectedOutputPath= path.join(outputDir, `output${idx + 1}.txt`);
        const expectedOutput= fs.readFileSync(expectedOutputPath, 'utf-8');
			
		const fileName= activeEditor.document.fileName;
		const fileNameWithoutExt= path.basename(fileName, path.extname(fileName));
		
		if (language=="cpp"){
			const execCommand= runCommand.replace('$fileNameWithoutExt', path.join(path.dirname(fileName), fileNameWithoutExt));
			const compCommand='g++';
			const compArgs= ['-std=c++17', '-o', `"${path.join(path.dirname(fileName), fileNameWithoutExt)}"`, `"${fileName}"`];
			
			const compileProcess= cp.spawn(compCommand, compArgs, { shell: true });
			compileProcess.stdout.on('data', (data) =>{
				console.log(`Compilation stdout: ${data}`);
			});
			compileProcess.stderr.on('data', (data) =>{
				vscode.window.showErrorMessage(`Compilation failed: ${data}`);
			});
			compileProcess.on('close', (code) =>{
				if (code==0){
					runCmdExecution(execCommand, inputPath, expectedOutput, idx);
				}
				else{
					vscode.window.showErrorMessage('Compilation failed.');
				}
			});
		}
		else{ //language is python
			const execCommand= runCommand.replace('$fileName', fileName);
			runCmdExecution(execCommand, inputPath, expectedOutput, idx);
		}
    });
}

function deactivate() {}
module.exports = {
	activate,
	deactivate
}
