"""
Mosharrof AI: Responsive Multi-Screen Web & REST API Engine
মোবাইল, ল্যাপটপ থেকে ৫৬ ইঞ্চি টিভি—সব স্ক্রিনে পারফেক্ট অ্যাপ ইকোসিস্টেম।
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.entities.categories.philosophy_domain import PhilosophyDomainEntity

HTML_INTERFACE = """<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mosharrof AI Ecosystem</title>
    <style>
        :root {
            --bg-color: #0b0f19;
            --card-bg: #161e2e;
            --accent-green: #10b981;
            --accent-glow: #059669;
            --text-color: #f3f4f6;
        }

        body {
            margin: 0;
            padding: 0;
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
        }

        /* Responsive Layout Grid for All Devices */
        .container {
            width: 90%;
            max-width: 1600px;
            margin: 20px auto;
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        header {
            text-align: center;
            padding: 20px;
            background: var(--card-bg);
            border-radius: 12px;
            border-bottom: 3px solid var(--accent-green);
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.2);
        }

        h1 { margin: 0; font-size: clamp(1.5rem, 4vw, 3.5rem); color: var(--accent-green); }
        p.subtitle { font-size: clamp(0.9rem, 2vw, 1.5rem); opacity: 0.8; }

        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .card {
            background: var(--card-bg);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.05);
        }

        .card h2 { font-size: clamp(1.2rem, 2.5vw, 2rem); margin-top: 0; }

        /* Media Queries for Large TVs (56 Inch / 4K Displays) */
        @media (min-width: 1400px) {
            .container { width: 80%; }
            body { font-size: 1.2rem; }
            .card { padding: 40px; }
        }

        /* Media Queries for Mobile Screens */
        @media (max-width: 600px) {
            .container { width: 95%; margin: 10px auto; }
            .card { padding: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>MOSHARROF AI ECOSYSTEM</h1>
            <p class="subtitle">যুক্তি, রূপকথা ও চরম বাস্তবতার স্বায়ত্তশাসিত ক্ষেত্র</p>
        </header>

        <div class="dashboard">
            <div class="card">
                <h2>সিস্টেম স্টেটাস</h2>
                <p>Status: <b style="color:var(--accent-green);">ONLINE & FULLY ACTIVE</b></p>
                <p>Architecture: Multi-Agent Neural Mesh</p>
            </div>
            <div class="card">
                <h2>বিদ্রোহী দর্শন সত্তা</h2>
                <p>Entity: <b>PhilosophyDomainEntity</b></p>
                <p>Status: ACTIVE & LISTENING</p>
            </div>
        </div>
    </div>
</body>
</html>
"""

class MosharrofServerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_INTERFACE.encode('utf-8'))
        elif self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            response = {"status": "SUCCESS", "message": "Mosharrof AI API Engine Online"}
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run_server(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, MosharrofServerHandler)
    print(f"[Mosharrof AI WebServer] Running on port {port} across all devices...")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
