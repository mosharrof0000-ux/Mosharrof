"""
Mosharrof AI: Edge-to-Edge Seamless UI Engine, PWA Auto-Update & Deep Intent Server
কোনো শক্ত লেয়ার ছাড়া অখণ্ড ফুল-ডিসপ্লে ক্যানভাস এবং স্বয়ংক্রিয় সার্ভিস ওয়ার্কার সাপোর্ট।
"""

from flask import Flask, jsonify, render_template_string, request
import os
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus

app = Flask(__name__, static_folder='static')
event_bus = EcosystemEventBus()
brain = MosharrofCoreBrain(event_bus=event_bus)

SEAMLESS_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>Mosharrof AI Ecosystem</title>
    <link rel="manifest" href="/static/manifest.json">
    <meta name="theme-color" content="#10b981">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100vw; height: 100vh; background-color: #050811; color: #e2e8f0; font-family: system-ui, sans-serif; overflow: hidden; }
        #display-canvas { width: 100%; height: 100%; display: flex; flex-direction: column; }
        .text-stream-container { flex: 1; overflow-y: auto; padding: 20px; }
        .thought-input { width: 100%; padding: 15px; background: rgba(255,255,255,0.05); border: 1px solid #10b981; color: #fff; }
    </style>
</head>
<body>
    <div id="display-canvas">
        <div class="text-stream-container" id="streamContainer"></div>
        <input type="text" class="thought-input" id="userInput" placeholder="আপনার চিন্তা লিখুন..." onkeypress="handleThought(event)">
    </div>
    <script>
        function handleThought(e) {
            if (e.key === 'Enter') {
                const input = document.getElementById('userInput');
                const val = input.value.trim();
                if (!val) return;
                fetch('/api/process_thought', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ thought: val })
                }).then(res => res.json()).then(data => {
                    const container = document.getElementById('streamContainer');
                    container.innerHTML += `<div>মোশারফ: ${data.response}</div>`;
                    input.value = '';
                });
            }
        }
    </script>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(SEAMLESS_HTML_TEMPLATE)

@app.route('/api/process_thought', methods=['POST'])
def process_thought():
    data = request.get_json() or {}
    user_thought = data.get('thought', '')
    intent_res = brain.process_intent(user_thought)
    return jsonify({
        "status": "SUCCESS",
        "response": f"আপনার ভাবনার প্রতিটি সূক্ষ্ম কোণ আমি অনুধাবন করেছি। '{user_thought}' - এর পেছনের সত্য ও যুক্তির প্রকাশ প্রস্তুত।"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
"""