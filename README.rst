QuickLearnFeed - AI-Powered News Summarizer
===========================================

QuickLearnFeed is an AI-assisted English news reader with summarization features.

📌 What's New
-------------
- Now powered by TinyLlama (1.1B) running locally via llama.cpp (GGUF).
- External API usage (e.g. Gemini) has been replaced with a local model to avoid API limits and ensure privacy.
- Cloudflare Tunnel is used to securely connect the Render-hosted frontend to your local LLM backend.

🧩 Architecture
--------------
::

    [User]
      │
      ▼
    [Render (Flask API)]
      │ (Cloudflare Tunnel)
      ▼
    [Local PC (FastAPI + TinyLlama GGUF)]

⚙️ Local LLM Backend Setup
--------------------------
This app connects to a local summarization backend powered by TinyLlama.  
Please set up the backend by following instructions in the separate repository:

🔗 https://github.com/skimura728/llama-local-api

In short:

1. Clone the repository:
   ::

     git clone https://github.com/skimura728/llama-local-api.git
     cd llama-local-api

2. Follow the instructions in its `README.md` to download the model, install dependencies, and run:
   ::

     python llama_api.py

3. Then, start a Cloudflare Tunnel:
   ::

     cloudflared tunnel --url http://localhost:8000

4. Finally, set this environment variable on Render:
   ::

     TUNNEL_URL=https://<your-tunnel-name>.trycloudflare.com/llama

📝 Version
----------
v1.1.0 - 2025-05-18
- Migrated from Gemini API to TinyLlama (local GGUF).
- Cloudflare Tunnel integration.
- Improved summary reliability and independence from rate limits.

📜 Changelog
============

v1.1.0 (2025-05-18)
-----------------------------------------------
- Summary engine switched to TinyLlama 1.1B (local GGUF via llama-cpp-python)
- Removed dependency on Gemini API
- Cloudflare Tunnel support added

v1.0.0 (2025-05-02)
-------------------
- Initial release using Gemini API
- RSS news feed + English summary
