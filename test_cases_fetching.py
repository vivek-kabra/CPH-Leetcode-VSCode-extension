import os
import requests
import json
import html
from bs4 import BeautifulSoup 


def storeTestCases(data):
    path="/Users/vivekkabra/Desktop" #Path to be replaced with extension's directory where test cases are to be stored
    if os.path.exists(os.path.join(path, "input")):
        files=os.listdir(os.path.join(path, "input"))
        for file in files:
            os.remove(os.path.join(path, "input", file))
    else:
        os.mkdir(os.path.join(path, "input"))

    if os.path.exists(os.path.join(path, "output")):
        files=os.listdir(os.path.join(path, "output"))
        for file in files:
            os.remove(os.path.join(path, "output", file))
    else:
        os.mkdir(os.path.join(path, "output"))
    
    #Test case input storage
    test_inputs=data["data"]["question"]["exampleTestcaseList"]
    count=1
    for case in test_inputs:
        with open(os.path.join(path, "input", f"input{count}.txt"), "w") as f: #!!!!!!!!!Make sure to store the inputs in 'input' directory
            f.write(case)
        count+=1

    # Test case output processing and storage
    decoded_content = html.unescape(data["data"]["question"]["content"])
    soup = BeautifulSoup(decoded_content, 'html.parser')

    test_outputs=[]
    for pre in soup.find_all('pre'):
        if 'Output:' in pre.text:
            lines = pre.text.splitlines()
            for line in lines:
                if line.startswith("Output:"):
                    test_outputs.append(line.split("Output:")[1].strip())
    
    count=1
    for case in test_outputs:
        with open(os.path.join(path, "output", f"output{count}.txt"), "w") as f: #!!!!!!!!!Make sure to store the outputs in 'output' directory
            f.write(case)
        count+=1
  

problem_url="https://leetcode.com/problems/two-sum/description/" #Example problem
problem_name=problem_url.split("/")[problem_url.split("/").index("problems")+1]
endpoint_url= "https://leetcode.com/graphql"

query= f"""
query getQuestionDetail{{
  question(titleSlug: "{problem_name}") {{
    questionId
    title
    exampleTestcaseList
    content
  }}
}}
"""

headers= {
    "Content-Type": "application/json"
}


def fetch_problem():
    response = requests.post(endpoint_url, json={"query": query}, headers=headers)
    global problem_content
    if response.status_code == 200:
        data = response.json()
        storeTestCases(data)
        
    else:
        print("Error: ", response.status_code)

fetch_problem()


# content="\u003Cp\u003EGiven an array of integers \u003Ccode\u003Enums\u003C/code\u003E&nbsp;and an integer \u003Ccode\u003Etarget\u003C/code\u003E, return \u003Cem\u003Eindices of the two numbers such that they add up to \u003Ccode\u003Etarget\u003C/code\u003E\u003C/em\u003E.\u003C/p\u003E\n\n\u003Cp\u003EYou may assume that each input would have \u003Cstrong\u003E\u003Cem\u003Eexactly\u003C/em\u003E one solution\u003C/strong\u003E, and you may not use the \u003Cem\u003Esame\u003C/em\u003E element twice.\u003C/p\u003E\n\n\u003Cp\u003EYou can return the answer in any order.\u003C/p\u003E\n\n\u003Cp\u003E&nbsp;\u003C/p\u003E\n\u003Cp\u003E\u003Cstrong class=\"example\"\u003EExample 1:\u003C/strong\u003E\u003C/p\u003E\n\n\u003Cpre\u003E\n\u003Cstrong\u003EInput:\u003C/strong\u003E nums = [2,7,11,15], target = 9\n\u003Cstrong\u003EOutput:\u003C/strong\u003E [0,1]\n\u003Cstrong\u003EExplanation:\u003C/strong\u003E Because nums[0] + nums[1] == 9, we return [0, 1].\n\u003C/pre\u003E\n\n\u003Cp\u003E\u003Cstrong class=\"example\"\u003EExample 2:\u003C/strong\u003E\u003C/p\u003E\n\n\u003Cpre\u003E\n\u003Cstrong\u003EInput:\u003C/strong\u003E nums = [3,2,4], target = 6\n\u003Cstrong\u003EOutput:\u003C/strong\u003E [1,2]\n\u003C/pre\u003E\n\n\u003Cp\u003E\u003Cstrong class=\"example\"\u003EExample 3:\u003C/strong\u003E\u003C/p\u003E\n\n\u003Cpre\u003E\n\u003Cstrong\u003EInput:\u003C/strong\u003E nums = [3,3], target = 6\n\u003Cstrong\u003EOutput:\u003C/strong\u003E [0,1]\n\u003C/pre\u003E\n\n\u003Cp\u003E&nbsp;\u003C/p\u003E\n\u003Cp\u003E\u003Cstrong\u003EConstraints:\u003C/strong\u003E\u003C/p\u003E\n\n\u003Cul\u003E\n\t\u003Cli\u003E\u003Ccode\u003E2 &lt;= nums.length &lt;= 10\u003Csup\u003E4\u003C/sup\u003E\u003C/code\u003E\u003C/li\u003E\n\t\u003Cli\u003E\u003Ccode\u003E-10\u003Csup\u003E9\u003C/sup\u003E &lt;= nums[i] &lt;= 10\u003Csup\u003E9\u003C/sup\u003E\u003C/code\u003E\u003C/li\u003E\n\t\u003Cli\u003E\u003Ccode\u003E-10\u003Csup\u003E9\u003C/sup\u003E &lt;= target &lt;= 10\u003Csup\u003E9\u003C/sup\u003E\u003C/code\u003E\u003C/li\u003E\n\t\u003Cli\u003E\u003Cstrong\u003EOnly one valid answer exists.\u003C/strong\u003E\u003C/li\u003E\n\u003C/ul\u003E\n\n\u003Cp\u003E&nbsp;\u003C/p\u003E\n\u003Cstrong\u003EFollow-up:&nbsp;\u003C/strong\u003ECan you come up with an algorithm that is less than \u003Ccode\u003EO(n\u003Csup\u003E2\u003C/sup\u003E)\u003C/code\u003E\u003Cfont face=\"monospace\"\u003E&nbsp;\u003C/font\u003Etime complexity?"