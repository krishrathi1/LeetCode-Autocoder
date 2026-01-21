# LeetCode Local Solver

This tool automates the process of fetching LeetCode problems and solving them using your local Ollama LLM (`llama3.2`).

## Prerequisites

1.  **Node.js** installed.
2.  **Ollama** installed and running (`ollama serve`).
3.  **Llama 3.2 Model** pulled (`ollama pull llama3.2`).

## Setup

1.  Open a terminal in this folder.
2.  Install dependencies (if you haven't already):
    ```bash
    npm install
    ```

## Usage

1.  Run the script:
    ```bash
    node index.js
    ```
2.  **Browser Login**:
    - A Chrome/Chromium window will open.
    - If you are not logged in, please **log in to LeetCode manually** in that window.
    - Once logged in, the script will detect the session and start processing problems from ID 1 to End.
3.  **Output**:
    - Solutions are saved in the `solutions/` folder as Markdown files (`ID_Slug.md`).

## Notes

-   **Do not close the browser window** while the script is running.
-   The script uses a `user_data` folder to save your login session, so you only need to log in once.
-   Paid problems are skipped.
