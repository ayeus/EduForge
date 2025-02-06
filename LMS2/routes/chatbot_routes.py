from flask import request, jsonify
import openai

def init_chatbot_routes(app):
    @app.route("/chat", methods=["POST"])
    def chat():
        user_message = request.json.get("message")

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        try:
            # Call OpenAI API
            response = openai.ChatCompletion.create(
                model="gpt-4",  # Use "gpt-3.5-turbo" if GPT-4 is not available
                messages=[
                    {"role": "system", "content": "You are a helpful assistant for a Learning Management System (LMS)."},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=150,
                temperature=0.7
            )

            bot_message = response["choices"][0]["message"]["content"]
            return jsonify({"message": bot_message})

        except Exception as e:
            return jsonify({"error": str(e)}), 500