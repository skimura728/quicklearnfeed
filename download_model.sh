#!/bin/sh

set -e

echo "Creating models directory..."
mkdir -p models

echo "Downloading model..."
wget https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q2_K.gguf -O models/mistral.gguf

echo "Model download to models/mistral.gguf"
