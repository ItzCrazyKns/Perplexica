#!/usr/bin/env bash

CONFIG_TOML_FILE=/home/perplexica/config.toml

TMP_FILE=${CONFIG_TOML_FILE}.tmp
touch $TMP_FILE

while IFS= read -r line; do
    # Check if line is a section header (e.g., "[GENERAL]")
    if [[ "$line" =~ ^\[([^]]+)\] ]]; then
        current_section="${BASH_REMATCH[1]}"
        echo "$line" >> "$TMP_FILE"
        continue
    fi

    # Skip empty lines and comments
    if [[ -z "$line" || "$line" =~ ^[[:space:]]*\# ]]; then
        echo "$line" >> "$TMP_FILE"
        continue
    fi

    # Extract key and value (handling quoted values)
    key=$(echo "$line" | cut -d '=' -f 1 | xargs)
    value=$(echo "$line" | cut -d '=' -f 2- | xargs)


    # Construct the environment variable name in form of SECTION_KEY (e.g., GENERAL_SIMILARITY_MEASURE, MODELS_GEMINI_API_KEY)
    current_section=$(echo "$current_section" | sed 's/\./_/')
    env_var_name="${current_section}_${key}"

    # Check if the environment variable exists
    env_var_value=$(echo "${!env_var_name}")
    if [ -n "$env_var_value" ]; then
        new_value="$env_var_value"
        echo "$key = $new_value" >> "$TMP_FILE"
    else
        # Keep original line if no env var exists
        echo "$line" >> "$TMP_FILE"
    fi

done < "$CONFIG_TOML_FILE"

# Replace the original file
mv "$TMP_FILE" "$CONFIG_TOML_FILE"

echo "Config file updated successfully."

# Start server
node server.js