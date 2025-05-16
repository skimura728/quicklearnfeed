#!/bin/sh

set -e

echo "Creating models directory..."
mkdir -p models

echo "Downloading model..."
wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGUF/resolve/main/mistral-7b-instruct-v0.1.Q2_K.gguf -O models/mistral.gguf

echo "Model download to models/mistral.gguf"
