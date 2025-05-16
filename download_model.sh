#!/bin/sh

set -e

echo "Creating models directory..."
mkdir -p models

echo "Downloading model..."
wget https://huggingface.co/TheBloke/Nous-Hermes-2-Mistral-7B-GGUF/resolve/main/nous-hermes-2-mistral-7b.Q2_K.gguf -O models/mistral.gguf

echo "Model download to models/mistral.gguf"
