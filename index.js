const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { generateSolution } = require('./ollama');

// Configuration
const BASE_URL = 'https://leetcode.com';
const SOLUTIONS_DIR = path.join(__dirname, 'solutions');
const MODEL_NAME = 'llama3.2';

// Ensure solutions directory exists
if (!fs.existsSync(SOLUTIONS_DIR)) {
    fs.mkdirSync(SOLUTIONS_DIR);
}

async function main() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: false, // Visible so you can login
        defaultViewport: null,
        args: ['--start-maximized'],
        userDataDir: './user_data' // Persist login session
    });

    const page = await browser.newPage();

    try {
        // 1. Login Phase
        console.log('Navigating to LeetCode Login...');
        await page.goto(`${BASE_URL}/accounts/login/`, { waitUntil: 'networkidle2' });

        console.log('Attempting to auto-login...');

        // Credentials provided by user
        const EMAIL = 'krishrathi888@gmail.com';
        const PASSWORD = 'krishrathiQ1@1234';

        try {
            // Wait for input fields
            await page.waitForSelector('input[name="login"]', { timeout: 10000 });

            console.log('Typing credentials...');
            await page.type('input[name="login"]', EMAIL, { delay: 50 });
            await page.type('input[name="password"]', PASSWORD, { delay: 50 });

            // Click sign in
            const submitSelector = '#signin_btn'; // Common ID
            await page.waitForSelector(submitSelector, { timeout: 5000 });

            // Find button and click
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(e => console.log('Navigation timeout ignore')),
                page.click(submitSelector)
            ]);

            console.log('Login credentials submitted. Verifying login...');
        } catch (e) {
            console.log('Could not auto-fill login form (maybe selectors changed or already logged in). Please login manually if needed.');
            console.error(e.message);
        }

        // Wait for an element that ensures login
        // Looking for the user menu icon or successful redirect
        try {
            await page.waitForSelector('#navbar-root', { timeout: 5000 }); // Main layout
        } catch (e) {
            console.log('Still waiting for login completion...');
        }

        console.log('Login phase complete. Proceeding to fetch problems...');

        // 2. Fetch Problem List
        // We use the page context to fetch so we include cookies
        const problemsData = await page.evaluate(async () => {
            const response = await fetch('https://leetcode.com/api/problems/algorithms/');
            return await response.json();
        });

        const allProblems = problemsData.stat_status_pairs
            .map(p => ({
                id: p.stat.frontend_question_id,
                title: p.stat.question__title,
                slug: p.stat.question__title_slug,
                difficulty: p.difficulty.level, // 1: Easy, 2: Medium, 3: Hard
                paid: p.paid_only
            }))
            .sort((a, b) => a.id - b.id); // Sort by ID 1 to End

        console.log(`Found ${allProblems.length} problems.`);

        // 3. Iteration Loop
        for (const problem of allProblems) {
            if (problem.paid) {
                console.log(`Skipping Problem ${problem.id}: ${problem.title} (Paid Only)`);
                continue;
            }

            // Check if we reached the file limit or something? No, user wants all.
            // But we should be careful about 3000 problems.
            // For this demo, let's keep going.

            console.log(`\n--- Processing Problem ${problem.id}: ${problem.title} ---`);

            const problemUrl = `${BASE_URL}/problems/${problem.slug}/`;

            try {
                await page.goto(problemUrl, { waitUntil: 'domcontentloaded' });

                // Wait for description
                try {
                    await page.waitForSelector('.elfjS, [data-track-load="description_content"]', { timeout: 10000 });
                } catch (e) {
                    console.log('Timeout waiting for description (checking if page loaded)...');
                }

                // Extract text
                const problemDescription = await page.evaluate(() => {
                    const el = document.querySelector('[data-track-load="description_content"]') ||
                        document.querySelector('.elfjS') ||
                        document.body;
                    return el.innerText.substring(0, 2000); // Limit length for prompt
                });

                // 4. Solve with Ollama
                console.log(`Thinking... (Model: ${MODEL_NAME})`);

                const prompt = `
You are a LeetCode expert.
Problem: ${problem.title}
Description: ${problemDescription}

Task: Write a Python3 solution.
IMPORTANT:
1. Return ONLY the code inside a Markdown code block like:
\`\`\`python
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        ...
\`\`\`
2. Do not include explanations outside the code block.
3. The class name must be 'Solution' and method signatures must match standard LeetCode templates.
`;

                const rawSolution = await generateSolution(prompt, MODEL_NAME);

                if (!rawSolution) {
                    console.log('Ollama failed to generate a solution.');
                    continue;
                }

                // Extract Code from Markdown
                const codeMatch = rawSolution.match(/```(?:python|python3)?\s*([\s\S]*?)```/i);
                const code = codeMatch ? codeMatch[1].trim() : rawSolution.trim();

                console.log('Solution generated. Injecting into browser...');

                // Save locally first
                const filePath = path.join(SOLUTIONS_DIR, `${problem.id}_${problem.slug}.md`);
                fs.writeFileSync(filePath, rawSolution);

                // 5. Inject into Monaco Editor
                // We wait for Monaco to be ready
                await page.evaluate(async (codeToInject) => {
                    // Function to wait for Monaco
                    const waitForMonaco = () => new Promise(resolve => {
                        const check = () => {
                            if (window.monaco && window.monaco.editor.getModels().length > 0) resolve();
                            else setTimeout(check, 100);
                        };
                        check();
                    });

                    await waitForMonaco();
                    // Set value
                    window.monaco.editor.getModels()[0].setValue(codeToInject);
                }, code);

                // 6. Click Submit
                console.log('Submitting...');

                // Try to find the Submit button.
                // It's usually a button with "Submit" text.
                const submitClicked = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find(b => b.textContent.includes('Submit') && !b.textContent.includes('Submissions'));
                    if (submitBtn) {
                        submitBtn.click();
                        return true;
                    }
                    return false;
                });

                if (submitClicked) {
                    console.log('Submit button clicked. Waiting for result...');

                    // Wait a bit to see result (optional: scrape result)
                    await new Promise(r => setTimeout(r, 8000));
                    // We could check for "Accepted" text, but layouts vary wildly.
                    console.log('Moving to next problem...');
                } else {
                    console.log('Could not find Submit button (Layout might have changed).');
                }

            } catch (err) {
                console.error(`Error processing problem ${problem.id}:`, err.message);
            }

            // Cool down
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log('All processed.');
        await browser.close();

    } catch (error) {
        console.error('Fatal Error:', error);
        await browser.close();
    }
}

main();
