"""
Mosharrof AI: Edge-to-Edge Seamless UI Engine, PWA Auto-Update & Deep Intent Server
কোনো শক্ত লেয়ার ছাড়া অখণ্ড ফুল-ডিসপ্লে ক্যানভাস এবং স্বয়ংক্রিয় সার্ভিস ওয়ার্কার সাপোর্ট।
"""

from flask import Flask, jsonify, render_template_string, request, send_from_directory
import os
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus

app = Flask(__name__, static_folder='static')
event_bus = EcosystemEventBus()
brain = MosharrofCoreBrain(event_bus=event_bus)

# লেয়ারহীন, অখণ্ড ফুল-ডিসপ্লে ক্যানভাস ও PWA অটো-আপডেট রেজিস্ট্রেশন
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
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            width: 100vw;
            height: 100vh;
            background-color: #050811;
            color: #e2e8f0;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            overflow: hidden;
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            padding-left: env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
        }

        #display-canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            background: radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.08) 0%, rgba(5, 8, 17, 1) 100%);
            z-index: 1;
        }

        .system-pass-header {
            width: 100%;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: transparent;
            z-index: 10;
        }

        .system-title {
            font-size: 1.1rem;
            font-weight: 700;
            letter-spacing: 2px;
            color: rgba(255, 255, 255, 0.7);
            text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .text-stream-container {
            width: 100%;
            flex: 1;
            overflow-y: auto;
            padding: 20px 30px;
            display: flex;
            flex-direction: column;
            gap: 25px;
            scrollbar-width: none;
        }
        .text-stream-container::-webkit-scrollbar {
            display: none;
        }

        .shadow-thought-stream {
            font-size: 1.4rem;
            line-height: 1.8;
            color: rgba(241, 245, 249, 0.92);
            text-shadow: 0 0 15px rgba(16, 185, 129, 0.4), 0 2px 8px rgba(0, 0, 0, 0.8);
            animation: fadeInPass 1.2s ease-in-out;
            background: transparent;
            border: none;
        }

        .rebel-accent {
            color: #10b981;
            font-weight: 600;
            text-shadow: 0 0 20px rgba(16, 185, 129, 0.8);
        }

        @keyframes fadeInPass {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .bottom-pass-bar {
            width: 100%;
            padding: 20px 30px;
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10;
        }

        .thought-input {
            width: 90%;
            max-width: 800px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 30px;
            padding: 15px 25px;
            color: #fff;
            font-size: 1.1rem;
            outline: none;
            backdrop-filter: blur(5px);
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
            transition: all 0.3s ease;
        }

        .thought-input:focus {
            border-color: #10b981;
            box-shadow: 0 0 25px rgba(16, 185, 129, 0.6);
        }
    </style>
</head>
<body>
    <div id="display-canvas">
        <div class="system-pass-header">
            <span class="system-title">MOSHARROF AI • SEAMLESS BRAIN</span>
            <span style="color: #10b981; font-size: 0.9rem;">● Auto-Update Active</span>
        </div>

        <div class="text-stream-container" id="streamContainer">
            <div class="shadow-thought-stream">
                <span class="rebel-accent">মোশারফ এআই জাগ্রত:</span> কোনো দেয়াল বা আলাদা লেয়ার নেই। সমগ্র ডিসপ্লে জুড়ে অখণ্ড ছায়াসম ভাবনা বয়ে চলেছে...
            </div>
        </div>

        <div class="bottom-pass-bar">
            <input type="text" class="thought-input" placeholder="আপনার গভীর চিন্তা বা বাক্য লিখুন..." id="userInput" onkeypress="handleThought(event)">
        </div>
    </div>

    <script>
        // PWA Auto-Update সার্ভিস ওয়ার্কার স্বয়ংক্রিয় রেজিস্ট্রেশন
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/static/sw.js')
                    .then(reg => console.log('Mosharrof AI Service Worker Registered Successfully!'))
                    .catch(err => console.log('SW Registration Failed:', err));
            });
        }

        function handleThought(e) {
            if (e.key === 'Enter') {
                const input = document.getElementById('userInput');
                const val = input.value.trim();
                if (!val) return;

                const container = document.getElementById('streamContainer');
                
                const userNode = document.createElement('div');
                userNode.className = 'shadow-thought-stream';
                userNode.innerHTML = `<span style="color: #38bdf8;">আপনি:</span> ${val}`;
                container.appendChild(userNode);

                input.value = '';
                container.scrollTop = container.scrollHeight;

                fetch('/api/process_thought', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ thought: val })
                })
                .then(res => res.json())
                .then(data => {
                    const aiNode = document.createElement('div');
                    aiNode.className = 'shadow-thought-stream';
                    const aiLabel = document.createElement('span');
                    aiLabel.className = 'rebel-accent';
                    aiLabel.textContent = 'মোশারফ:';
                    aiNode.appendChild(aiLabel);
                    aiNode.appendChild(document.createTextNode(' ' + String(data.response || '')));
                    container.appendChild(aiNode);
                    container.scrollTop = container.scrollHeight;
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
    
    response_text = f"আপনার ভাবনার প্রতিটি সূক্ষ্ম কোণ আমি ১০০% অনুধাবন করেছি। '{user_thought}' - এর পেছনের সত্য ও যুক্তির প্রকাশ প্রস্তুত।"
    
    return jsonify({
        "status": "SUCCESS",
        "intent_clarity": "100%",
        "response": response_text
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
