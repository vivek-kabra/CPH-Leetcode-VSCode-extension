import os
import sys

def editTestCase():
    dir_path=sys.argv[2]
    test_case_id=sys.argv[3]
    new_input=sys.argv[4]
    new_expected_output=sys.argv[5]

    file_path=os.path.join(dir_path, "input", f"input{test_case_id}.txt")
    with open(file_path, 'w') as file:
        file.write(new_input)

    file_path=os.path.join(dir_path, "output", f"output{test_case_id}.txt")
    with open(file_path, 'w') as file:
        file.write(new_expected_output)

def addTestCase():
    dir_path=sys.argv[2]
    input=sys.argv[4]
    expected_output=sys.argv[5]

    last_test_case_id=0
    files= os.listdir(os.path.join(dir_path, "input"))
    for file in files:
        last_test_case_id= int(file[5:-4])

    file_path=os.path.join(dir_path, "input", f"input{last_test_case_id+1}.txt") 
    with open(file_path, 'w') as file:
        file.write(input)

    file_path=os.path.join(dir_path, "output", f"output{last_test_case_id+1}.txt")
    with open(file_path, 'w') as file:
        file.write(expected_output)

if (sys.argv[1]=="EDIT"):
    editTestCase()
else:
    addTestCase()