import os
import sys

def updateTestCases():
    dir_path=sys.argv[1]
    testCaseId=sys.argv[2]
    new_input=sys.argv[3]
    new_expectedOutput=sys.argv[4]
    file_path=os.path.join(dir_path, "input", f"input{testCaseId}.txt")

    with open(file_path, 'w') as file:
        file.write(new_input)

    file_path=os.path.join(dir_path, "output", f"output{testCaseId}.txt")

    with open(file_path, 'w') as file:
        file.write(new_expectedOutput)

updateTestCases()