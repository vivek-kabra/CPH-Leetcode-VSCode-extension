import requests
import json

url= "https://leetcode.com/graphql"

query= """
query getQuestionDetail{
  question(titleSlug: "two-sum") {
    questionId
    title
    exampleTestcases
  }
}
"""

headers= {
    "Content-Type": "application/json"
}

def fetch_problem():
    response = requests.post(url, json={"query": query}, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(data["data"])
        
    else:
        print("Error: ", response.status_code)

fetch_problem()