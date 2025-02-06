import openai
import os

# Set the API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Test the API
try:
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",  # Use "gpt-4" if you have access
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello, how are you?"}
        ],
        max_tokens=50,
        temperature=0.7
    )
    print("Response:", response["choices"][0]["message"]["content"])
except Exception as e:
    print("Error:", str(e))