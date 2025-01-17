import os
import requests
import json
import html
from bs4 import BeautifulSoup 
import sys

problem_url= sys.argv[1] 
problem_name= problem_url.split("/")[problem_url.split("/").index("problems")+1]

def storeTestCases(data):
    path= sys.argv[2] #Provided as path of extension's directory where test cases are to be stored
    if os.path.exists(os.path.join(path, "input")): 
        files= os.listdir(os.path.join(path, "input"))
        for file in files:
            os.remove(os.path.join(path, "input", file))
    else:
        os.mkdir(os.path.join(path, "input"))

    if os.path.exists(os.path.join(path, "output")):
        files= os.listdir(os.path.join(path, "output"))
        for file in files:
            os.remove(os.path.join(path, "output", file))
    else:
        os.mkdir(os.path.join(path, "output"))
    
    #Test case input storage
    test_inputs= data["data"]["question"]["exampleTestcaseList"]
    count=1
    for case in test_inputs:
        with open(os.path.join(path, "input", f"input{count}.txt"), "w") as f:
            f.write(case)
        count+=1

    # Test case output processing and storage
    decoded_content= html.unescape(data["data"]["question"]["content"])
    soup= BeautifulSoup(decoded_content, 'html.parser')

    test_outputs=[]
    for pre in soup.find_all('pre'):
        if 'Output:' in pre.text:
            lines = pre.text.splitlines()
            for line in lines:
                if line.startswith("Output:"):
                    test_outputs.append(line.split("Output:")[1].strip())
    
    count=1
    for case in test_outputs:
        with open(os.path.join(path, "output", f"output{count}.txt"), "w") as f: 
            f.write(case)
        count+=1
  
endpoint_url= "https://leetcode.com/graphql"
query=f"""
query getQuestionDetail{{
  question(titleSlug: "{problem_name}") {{
    questionId
    title
    exampleTestcaseList
    content
  }}
}}
"""

headers={
    "Content-Type": "application/json"
}

def fetch_problem():
    response= requests.post(endpoint_url, json={"query": query}, headers=headers)
    global problem_content
    if response.status_code==200:
        data = response.json()
        storeTestCases(data)
    else:
        print("Error: ", response.status_code)

fetch_problem()

