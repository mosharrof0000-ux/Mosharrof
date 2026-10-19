#!/usr/bin/env python3
"""Secret-safe OpenAI-compatible fallback routing for the autonomous engine."""
import json
import os
import urllib.error
import urllib.request


def request_openai_compatible(provider, endpoint, api_key, models, prompt, extra_headers=None):
    """Try compatible chat-completions routes without logging credentials or response bodies."""
    if not api_key or not endpoint:
        return None
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    headers.update(extra_headers or {})
    for model_name in models:
        payload = json.dumps({
            "model": model_name,
            "messages": [
                {"role": "system", "content": "Return exactly one valid JSON object matching the requested schema. Do not use Markdown fences."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }).encode()
        req = urllib.request.Request(endpoint, data=payload, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                result = json.load(response)
            text = result["choices"][0]["message"]["content"]
            if isinstance(text, str) and text.strip():
                print(f"Alternate provider selected: {provider} ({model_name}).")
                return text.strip()
            print(f"{provider} returned an empty response for {model_name}; trying next model.")
        except urllib.error.HTTPError as exc:
            print(f"{provider} fallback model {model_name} unavailable (HTTP {exc.code}); trying next model/provider.")
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError) as exc:
            print(f"{provider} fallback model {model_name} failed ({type(exc).__name__}); trying next model/provider.")
    return None


def request_alternate_provider(prompt):
    """Free-first fallback chain: Cloudflare Workers AI, Groq, then OpenRouter."""
    cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if cf_token and cf_account:
        endpoint = f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/ai/v1/chat/completions"
        text = request_openai_compatible(
            "Cloudflare Workers AI", endpoint, cf_token,
            ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"], prompt,
        )
        if text:
            return text

    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        text = request_openai_compatible(
            "Groq", "https://api.groq.com/openai/v1/chat/completions", groq_key,
            ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"], prompt,
        )
        if text:
            return text

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if openrouter_key:
        text = request_openai_compatible(
            "OpenRouter", "https://openrouter.ai/api/v1/chat/completions", openrouter_key,
            ["openai/gpt-oss-20b:free", "meta-llama/llama-3.3-70b-instruct:free"], prompt,
            {"HTTP-Referer": "https://mosharrof0000-ux.github.io/Mosharrof/", "X-Title": "MOSHARROF Autonomous Engine"},
        )
        if text:
            return text
    return None
