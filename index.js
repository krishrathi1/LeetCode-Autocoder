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

// Function to fix Java imports automatically
function fixJavaImports(code) {
    // Common Java imports needed for LeetCode
    const importsMap = {
        'List': ['import java.util.List;', 'import java.util.ArrayList;'],
        'ArrayList': ['import java.util.List;', 'import java.util.ArrayList;'],
        'LinkedList': ['import java.util.List;', 'import java.util.LinkedList;'],
        'Map': ['import java.util.Map;', 'import java.util.HashMap;'],
        'HashMap': ['import java.util.Map;', 'import java.util.HashMap;'],
        'TreeMap': ['import java.util.Map;', 'import java.util.TreeMap;'],
        'Set': ['import java.util.Set;', 'import java.util.HashSet;'],
        'HashSet': ['import java.util.Set;', 'import java.util.HashSet;'],
        'TreeSet': ['import java.util.Set;', 'import java.util.TreeSet;'],
        'Queue': ['import java.util.Queue;'],
        'PriorityQueue': ['import java.util.Queue;', 'import java.util.PriorityQueue;'],
        'Deque': ['import java.util.Deque;'],
        'Stack': ['import java.util.Stack;'],
        'Collections': ['import java.util.Collections;'],
        'Arrays': ['import java.util.Arrays;'],
        'StringBuilder': [], // java.lang is automatically imported
        'Math': [] // java.lang is automatically imported
    };
    
    const neededImports = new Set();
    
    // Check what's used in the code (more comprehensive)
    for (const [key, imports] of Object.entries(importsMap)) {
        // Check for type declarations like List<, Map<, Set<
        if (code.includes(`${key}<`) || code.includes(`new ${key}`) || 
            code.includes(`${key}[`) || code.match(new RegExp(`\\b${key}\\s*[<(]`))) {
            imports.forEach(imp => neededImports.add(imp));
        }
    }
    
    // Special cases
    if (code.includes('Collections.')) {
        neededImports.add('import java.util.Collections;');
    }
    if (code.includes('Arrays.')) {
        neededImports.add('import java.util.Arrays;');
    }
    
    // Check if code already has imports
    const lines = code.split('\n');
    let importStartIndex = -1;
    let importEndIndex = -1;
    const existingImports = new Set();
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('import ')) {
            if (importStartIndex === -1) importStartIndex = i;
            importEndIndex = i;
            existingImports.add(line);
        } else if (line && importStartIndex !== -1) {
            break; // End of imports section
        }
    }
    
    // Filter out imports that already exist
    const missingImports = Array.from(neededImports).filter(imp => {
        const importName = imp.replace('import ', '').replace(';', '').split('.').pop();
        return !Array.from(existingImports).some(existing => existing.includes(importName));
    });
    
    if (missingImports.length === 0) {
        return code; // No imports needed
    }
    
    // Add missing imports
    if (importStartIndex === -1) {
        // No imports section, add before class
        const classIndex = code.indexOf('class Solution');
        if (classIndex > 0) {
            return missingImports.sort().join('\n') + '\n\n' + code;
        } else {
            return missingImports.sort().join('\n') + '\n' + code;
        }
    } else {
        // Insert after existing imports
        const beforeImports = lines.slice(0, importEndIndex + 1).join('\n');
        const afterImports = lines.slice(importEndIndex + 1).join('\n');
        return beforeImports + '\n' + missingImports.sort().join('\n') + '\n' + afterImports;
    }
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

                // Wait for page to fully load
                await new Promise(r => setTimeout(r, 2000));

                // Check if problem is already submitted/accepted - more accurate check
                const isAlreadySubmitted = await page.evaluate(() => {
                    // Check for the "Accepted" status in the submissions tab or problem status
                    // Look for specific LeetCode UI elements that indicate accepted status
                    
                    // Method 1: Check for green checkmark or accepted status in problem header
                    const statusBadges = document.querySelectorAll('[data-status="ac"], .text-green-s, .accepted, [class*="accepted"]');
                    for (const badge of statusBadges) {
                        const text = badge.textContent || '';
                        if (text.toLowerCase().includes('accepted') || text.includes('✓')) {
                            return true;
                        }
                    }
                    
                    // Method 2: Check submissions tab for accepted status
                    const submissionsTab = Array.from(document.querySelectorAll('button, div[role="button"]'))
                        .find(el => el.textContent && el.textContent.includes('Submissions'));
                    if (submissionsTab) {
                        // This would require clicking, so we'll skip this method for now
                    }
                    
                    // Method 3: Check if there's a recent accepted submission indicator
                    // Look for text that shows "Accepted" with runtime info in the problem area
                    const problemArea = document.querySelector('[class*="problem"], [class*="description"], main');
                    if (problemArea) {
                        const problemText = problemArea.textContent || '';
                        // Only return true if we see "Accepted" with runtime/beats info (not just the word in description)
                        const acceptedPattern = /Accepted\s*(?:Runtime|Beats|Memory)/i;
                        if (acceptedPattern.test(problemText)) {
                            return true;
                        }
                    }
                    
                    return false;
                });

                if (isAlreadySubmitted) {
                    console.log(`✓ Problem ${problem.id} is already submitted/accepted. Skipping...`);
                    continue;
                }

                console.log(`Problem ${problem.id} needs to be solved. Proceeding...`);

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
You are a LeetCode expert. Solve this problem completely.

Problem: ${problem.title}
Description: ${problemDescription}

Task: Write a COMPLETE, WORKING Java solution that will pass all test cases.

REQUIREMENTS:
1. Return ONLY the code inside a Markdown code block like:
\`\`\`java
import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Complete implementation here
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[]{map.get(complement), i};
            }
            map.put(nums[i], i);
        }
        return new int[]{};
    }
}
\`\`\`

2. The class name MUST be 'Solution' (exactly)
3. Method signatures MUST match standard LeetCode templates exactly
4. Include ALL necessary imports at the top (java.util.*, etc.)
5. Write the COMPLETE, FULL solution - DO NOT use ellipsis (...), DO NOT abbreviate, DO NOT skip any part
6. The code must be syntactically correct and ready to compile
7. Do not include any explanations, comments about the approach, or text outside the code block
8. Return the ENTIRE solution code - every line must be present
`;

                const rawSolution = await generateSolution(prompt, MODEL_NAME);

                if (!rawSolution) {
                    console.log('Ollama failed to generate a solution.');
                    continue;
                }

                // Extract Code from Markdown
                const codeMatch = rawSolution.match(/```(?:java)?\s*([\s\S]*?)```/i);
                let code = codeMatch ? codeMatch[1].trim() : rawSolution.trim();
                
                // If no code block found, try to extract Java code directly
                if (!codeMatch) {
                    // Look for class Solution pattern
                    const javaClassMatch = rawSolution.match(/(class\s+Solution[\s\S]*?})/);
                    if (javaClassMatch) {
                        code = javaClassMatch[1].trim();
                    }
                }
                
                // Fix imports automatically
                console.log('Checking and fixing imports...');
                code = fixJavaImports(code);
                
                console.log(`Code length: ${code.length} characters`);

                console.log('Solution generated. Injecting into browser...');

                // Save locally first
                const filePath = path.join(SOLUTIONS_DIR, `${problem.id}_${problem.slug}.md`);
                fs.writeFileSync(filePath, rawSolution);

                // 5. Switch to Java language first
                console.log('Switching to Java language...');
                await page.evaluate(() => {
                    // Find and click language selector
                    const langButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                    const javaButton = langButtons.find(btn => {
                        const text = btn.textContent || '';
                        return text.trim().toLowerCase() === 'java';
                    });
                    if (javaButton) {
                        javaButton.click();
                    }
                });
                
                // Wait a bit for language switch
                await new Promise(r => setTimeout(r, 1000));

                // 6. Inject into Monaco Editor
                // We wait for Monaco to be ready
                console.log('Injecting code into editor...');
                
                // Focus on the editor first
                await page.evaluate(() => {
                    // Try to focus on Monaco editor
                    const editorContainer = document.querySelector('.monaco-editor, [data-monaco-editor]');
                    if (editorContainer) {
                        editorContainer.focus();
                    }
                });
                
                await new Promise(r => setTimeout(r, 500));
                
                const codePasted = await page.evaluate(async (codeToInject) => {
                    // Function to wait for Monaco
                    const waitForMonaco = () => new Promise(resolve => {
                        let attempts = 0;
                        const maxAttempts = 50;
                        const check = () => {
                            attempts++;
                            if (window.monaco && window.monaco.editor && window.monaco.editor.getModels().length > 0) {
                                resolve();
                            } else if (attempts < maxAttempts) {
                                setTimeout(check, 100);
                            } else {
                                resolve(); // Resolve anyway to continue
                            }
                        };
                        check();
                    });

                    await waitForMonaco();
                    
                    if (!window.monaco || !window.monaco.editor || window.monaco.editor.getModels().length === 0) {
                        console.error('Monaco editor not found');
                        return { success: false, length: 0 };
                    }
                    
                    const model = window.monaco.editor.getModels()[0];
                    
                    // Clear existing content first
                    model.setValue('');
                    await new Promise(r => setTimeout(r, 100));
                    
                    // Set the full code value
                    model.setValue(codeToInject);
                    await new Promise(r => setTimeout(r, 200));
                    
                    // Verify the code was set correctly
                    const setValue = model.getValue();
                    const success = setValue.length >= codeToInject.length * 0.95; // Allow 5% tolerance
                    
                    if (!success) {
                        console.warn(`Code length mismatch! Expected: ${codeToInject.length}, Got: ${setValue.length}`);
                        // Try again
                        model.setValue(codeToInject);
                        await new Promise(r => setTimeout(r, 200));
                        const retryValue = model.getValue();
                        return { success: retryValue.length >= codeToInject.length * 0.95, length: retryValue.length };
                    }
                    
                    return { success: true, length: setValue.length };
                }, code);
                
                // Wait for code to be fully set
                await new Promise(r => setTimeout(r, 1000));
                
                if (!codePasted.success) {
                    console.warn('Monaco setValue failed, trying clipboard method...');
                    // Alternative: Use clipboard API
                    await page.evaluate((codeToInject) => {
                        navigator.clipboard.writeText(codeToInject).catch(err => {
                            console.error('Clipboard write failed:', err);
                        });
                    }, code);
                    
                    await new Promise(r => setTimeout(r, 500));
                    
                    // Focus editor and paste
                    await page.keyboard.down('Control');
                    await page.keyboard.press('KeyA');
                    await page.keyboard.press('KeyV');
                    await page.keyboard.up('Control');
                    
                    await new Promise(r => setTimeout(r, 1000));
                }
                
                // Final verification
                const finalCodeLength = await page.evaluate(() => {
                    if (window.monaco && window.monaco.editor && window.monaco.editor.getModels().length > 0) {
                        return window.monaco.editor.getModels()[0].getValue().length;
                    }
                    return 0;
                });
                
                console.log(`Code in editor: ${finalCodeLength} characters (expected: ${code.length})`);
                if (finalCodeLength < code.length * 0.9) {
                    console.error('ERROR: Code was not fully pasted! Attempting manual retry...');
                    // Last resort: try direct typing (slow but reliable for small code)
                    if (code.length < 5000) {
                        await page.evaluate((codeToInject) => {
                            if (window.monaco && window.monaco.editor && window.monaco.editor.getModels().length > 0) {
                                window.monaco.editor.getModels()[0].setValue(codeToInject);
                            }
                        }, code);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } else {
                    console.log('✓ Code successfully pasted!');
                }

                // 7. Submit and retry loop with error fixing
                let maxRetries = 5;
                let attempt = 0;
                let isAccepted = false;
                let lastError = null;
                let lastCode = code;

                while (attempt < maxRetries && !isAccepted) {
                    attempt++;
                    if (attempt > 1) {
                        console.log(`\n--- Retry Attempt ${attempt}/${maxRetries} for Problem ${problem.id} ---`);
                        if (lastError) {
                            console.log(`Previous error: ${lastError.type} - ${lastError.message}`);
                        }
                    } else {
                        console.log('Submitting solution...');
                    }

                    // Wait a moment before submitting to ensure editor is ready
                    await new Promise(r => setTimeout(r, 1000));

                    // Inject the code (or re-inject if retrying)
                    if (attempt > 1) {
                        console.log('Re-injecting fixed code...');
                        await page.evaluate((codeToInject) => {
                            if (window.monaco && window.monaco.editor && window.monaco.editor.getModels().length > 0) {
                                window.monaco.editor.getModels()[0].setValue(codeToInject);
                            }
                        }, lastCode);
                        await new Promise(r => setTimeout(r, 1500));
                    }

                    // Try multiple methods to find and click Submit button
                    const submitResult = await page.evaluate(() => {
                        // Method 1: Find button with "Submit" text
                        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                        let submitBtn = buttons.find(b => {
                            const text = (b.textContent || '').trim();
                            return text === 'Submit' || text === 'Submit Solution';
                        });
                        
                        if (!submitBtn) {
                            // Method 2: Find by data attribute or class
                            submitBtn = document.querySelector('[data-e2e-locator="console-submit-button"], button[type="submit"]');
                        }
                        
                        if (!submitBtn) {
                            // Method 3: Find by aria-label
                            submitBtn = Array.from(document.querySelectorAll('button')).find(b => {
                                const label = b.getAttribute('aria-label') || '';
                                return label.toLowerCase().includes('submit');
                            });
                        }
                        
                        if (submitBtn && !submitBtn.disabled) {
                            submitBtn.click();
                            return true;
                        }
                        
                        return false;
                    });

                    if (!submitResult) {
                        console.log('Could not find Submit button. Trying alternative method...');
                        try {
                            await page.click('button:has-text("Submit")', { timeout: 3000 });
                        } catch (e) {
                            console.error('Failed to click Submit button:', e.message);
                            break; // Exit retry loop
                        }
                    }

                    console.log('Submit button clicked. Waiting for submission result...');

                    // Wait for submission to process and get result
                    let submissionResult = null;
                    let errorDetails = null;
                    let waitTime = 0;
                    const maxWaitTime = 60; // Wait up to 60 seconds
                    
                    for (let i = 0; i < maxWaitTime; i++) {
                        await new Promise(r => setTimeout(r, 1000));
                        waitTime++;
                        
                        // Log progress every 5 seconds
                        if (waitTime % 5 === 0 && waitTime < maxWaitTime) {
                            console.log(`Waiting for result... (${waitTime}s)`);
                        }
                        
                        const resultData = await page.evaluate(() => {
                            // First, try to find the result panel/container
                            const resultPanel = document.querySelector('[class*="result"], [class*="submission"], [data-e2e-locator="submission-result"]') || document.body;
                            const resultText = resultPanel.textContent || '';
                            
                            // More comprehensive check for Accepted
                            if ((resultText.includes('Accepted') || resultText.includes('accepted')) && 
                                (resultText.includes('Runtime') || resultText.includes('Beats') || resultText.includes('Memory'))) {
                                // Double check - look for success indicators
                                const successIndicators = document.querySelectorAll('[class*="success"], [class*="accepted"], [class*="text-green"]');
                                if (successIndicators.length > 0 || resultText.match(/Accepted[\s\S]*?Runtime/i)) {
                                    return { status: 'Accepted', details: null };
                                }
                            }
                            
                            // Check for various error types and extract details
                            if (resultText.includes('Wrong Answer') || resultText.includes('wrong answer')) {
                                // Try to extract test case info
                                const wrongAnswerMatch = resultText.match(/Wrong Answer[\s\S]*?(Input:|Output:|Expected:|Your output:|Test case)[\s\S]{0,800}/i);
                                const details = wrongAnswerMatch ? wrongAnswerMatch[0].substring(0, 800) : 'Wrong Answer - check test cases';
                                return { status: 'Wrong Answer', details: details };
                            }
                            
                            if (resultText.includes('Runtime Error') || resultText.includes('runtime error')) {
                                const runtimeErrorMatch = resultText.match(/Runtime Error[\s\S]*?(?:\n|$)[\s\S]{0,500}/i);
                                const details = runtimeErrorMatch ? runtimeErrorMatch[0].substring(0, 500) : 'Runtime Error occurred';
                                return { status: 'Runtime Error', details: details };
                            }
                            
                            if (resultText.includes('Time Limit Exceeded') || resultText.includes('time limit')) {
                                return { 
                                    status: 'Time Limit Exceeded', 
                                    details: 'Solution took too long to execute. Need to optimize algorithm.'
                                };
                            }
                            
                            // More comprehensive compile error detection
                            if (resultText.includes('Compile Error') || resultText.includes('compile error') ||
                                resultText.includes('cannot find symbol') || 
                                resultText.includes('cannot resolve') ||
                                resultText.includes('package') && resultText.includes('does not exist') ||
                                resultText.includes('symbol not found') ||
                                resultText.includes('class not found') ||
                                resultText.includes('import') && (resultText.includes('error') || resultText.includes('cannot'))) {
                                const compileErrorMatch = resultText.match(/(Compile Error|cannot find symbol|package.*does not exist|cannot resolve|symbol not found|class not found)[\s\S]*?(?:\n|$)[\s\S]{0,800}/i);
                                const details = compileErrorMatch ? compileErrorMatch[0].substring(0, 800) : 'Compilation failed - likely missing imports or syntax error';
                                return { status: 'Compile Error', details: details };
                            }
                            
                            // Check for Memory Limit Exceeded
                            if (resultText.includes('Memory Limit Exceeded') || resultText.includes('memory limit')) {
                                return { 
                                    status: 'Memory Limit Exceeded', 
                                    details: 'Solution used too much memory. Need to optimize space complexity.'
                                };
                            }
                            
                            // Check if still processing
                            if (resultText.includes('Executing') || resultText.includes('Running') || 
                                resultText.includes('Judging') || resultText.includes('Testing') ||
                                resultText.includes('Compiling')) {
                                return { status: 'Processing', details: null };
                            }
                            
                            // Check for any error indicators
                            const errorElements = document.querySelectorAll('[class*="error"], [class*="fail"], [class*="wrong"]');
                            if (errorElements.length > 0) {
                                const errorText = Array.from(errorElements).map(el => el.textContent).join(' ');
                                if (errorText.includes('Wrong') || errorText.includes('Error') || errorText.includes('Failed')) {
                                    return { status: 'Error', details: errorText.substring(0, 300) };
                                }
                            }
                            
                            return { status: null, details: null };
                        });
                        
                        submissionResult = resultData.status;
                        if (resultData.details) {
                            errorDetails = resultData.details;
                        }
                        
                        if (submissionResult && submissionResult !== 'Processing') {
                            console.log(`Result detected after ${waitTime} seconds: ${submissionResult}`);
                            break;
                        }
                    }
                    
                    // Final check if we still don't have a result
                    if (!submissionResult || submissionResult === 'Processing') {
                        console.log(`⚠ No clear result after ${waitTime} seconds. Performing final check...`);
                        await new Promise(r => setTimeout(r, 3000)); // Wait 3 more seconds
                        
                        const finalCheck = await page.evaluate(() => {
                            const resultText = document.body.textContent || '';
                            if (resultText.includes('Accepted') && (resultText.includes('Runtime') || resultText.includes('Beats'))) {
                                return { status: 'Accepted', details: null };
                            }
                            if (resultText.includes('Wrong Answer') || resultText.includes('Runtime Error') || 
                                resultText.includes('Time Limit') || resultText.includes('Compile Error')) {
                                return { status: 'Error', details: 'Error detected but details unclear' };
                            }
                            return { status: null, details: null };
                        });
                        
                        if (finalCheck.status) {
                            submissionResult = finalCheck.status;
                            errorDetails = finalCheck.details;
                        }
                    }

                    if (submissionResult === 'Accepted') {
                        console.log(`✓ Problem ${problem.id} submitted successfully - ACCEPTED! (Attempt ${attempt})`);
                        isAccepted = true;
                        break; // Exit retry loop
                    } else if (submissionResult && submissionResult !== 'Processing') {
                        console.log(`⚠ Attempt ${attempt}: Got ${submissionResult}`);
                        
                        // Try to extract more detailed error information
                        if (!errorDetails || errorDetails.length < 100) {
                            const moreDetails = await page.evaluate(() => {
                                // Look for error message containers
                                const errorContainers = document.querySelectorAll('[class*="error"], [class*="fail"], [class*="message"]');
                                let fullErrorText = '';
                                
                                errorContainers.forEach(container => {
                                    const text = container.textContent || '';
                                    if (text.length > 50 && text.length < 1000) {
                                        fullErrorText += text + '\n';
                                    }
                                });
                                
                                // Also check the main content area
                                const mainContent = document.querySelector('main, [class*="content"], [class*="result"]');
                                if (mainContent) {
                                    const mainText = mainContent.textContent || '';
                                    if (mainText.includes('Error') || mainText.includes('Wrong') || mainText.includes('Failed')) {
                                        const errorMatch = mainText.match(/(Error|Wrong|Failed)[\s\S]{0,500}/i);
                                        if (errorMatch) {
                                            fullErrorText += errorMatch[0];
                                        }
                                    }
                                }
                                
                                return fullErrorText.substring(0, 1000);
                            });
                            
                            if (moreDetails && moreDetails.length > 50) {
                                errorDetails = moreDetails;
                            }
                        }
                        
                        if (errorDetails) {
                            console.log(`Error details: ${errorDetails.substring(0, 300)}${errorDetails.length > 300 ? '...' : ''}`);
                        } else {
                            console.log(`No detailed error message available`);
                        }
                        
                        lastError = {
                            type: submissionResult,
                            message: errorDetails || submissionResult
                        };

                        // If not accepted, generate a fixed solution
                        if (attempt < maxRetries) {
                            console.log(`\nAnalyzing error and generating fixed solution...`);
                            
                            const fixPrompt = `
You are a LeetCode expert. Fix this Java solution that failed.

Problem: ${problem.title}
Description: ${problemDescription}

Previous Solution (FAILED):
\`\`\`java
${lastCode}
\`\`\`

Error Type: ${submissionResult}
Error Details: ${errorDetails || 'No additional details'}

Task: Write a CORRECTED, COMPLETE Java solution that fixes the error.

CRITICAL REQUIREMENTS:
1. Analyze the error and fix it
2. Return ONLY the code inside a Markdown code block:
\`\`\`java
// Fixed solution here
\`\`\`
3. The class name MUST be 'Solution' (exactly)
4. Method signatures MUST match standard LeetCode templates exactly
5. Include ALL necessary imports at the TOP - this is CRITICAL!
   - If using List/ArrayList: import java.util.List; import java.util.ArrayList;
   - If using Map/HashMap: import java.util.Map; import java.util.HashMap;
   - If using Set/HashSet: import java.util.Set; import java.util.HashSet;
   - If using Queue/PriorityQueue: import java.util.Queue; import java.util.PriorityQueue;
   - If using Stack: import java.util.Stack;
   - If using Arrays: import java.util.Arrays;
   - If using Collections: import java.util.Collections;
   - Add ALL imports needed for the data structures you use
6. Write the COMPLETE, FULL solution - DO NOT use ellipsis, DO NOT abbreviate
7. The code must be syntactically correct and ready to compile
8. Fix the specific error: ${submissionResult}
9. If it's Wrong Answer, ensure logic is correct
10. If it's Runtime Error, fix null pointer, array bounds, etc.
11. If it's Time Limit Exceeded, optimize the algorithm
12. If it's Compile Error (especially import errors), ADD ALL MISSING IMPORTS at the top
13. Return the ENTIRE fixed solution code with ALL imports
`;

                            const fixedSolution = await generateSolution(fixPrompt, MODEL_NAME);
                            
                            if (fixedSolution) {
                                const fixedCodeMatch = fixedSolution.match(/```(?:java)?\s*([\s\S]*?)```/i);
                                let fixedCode = fixedCodeMatch ? fixedCodeMatch[1].trim() : fixedSolution.trim();
                                
                                if (!fixedCodeMatch) {
                                    const javaClassMatch = fixedSolution.match(/(class\s+Solution[\s\S]*?})/);
                                    if (javaClassMatch) {
                                        fixedCode = javaClassMatch[1].trim();
                                    }
                                }
                                
                                if (fixedCode && fixedCode.length > 50) {
                                    // Fix imports in the fixed code too
                                    fixedCode = fixJavaImports(fixedCode);
                                    lastCode = fixedCode;
                                    console.log(`Generated fixed solution (${fixedCode.length} chars). Will retry...`);
                                    
                                    // Save the fixed solution
                                    const fixedFilePath = path.join(SOLUTIONS_DIR, `${problem.id}_${problem.slug}_attempt${attempt}.md`);
                                    fs.writeFileSync(fixedFilePath, `Attempt ${attempt} - ${submissionResult}\n\nError: ${errorDetails}\n\n${fixedSolution}`);
                                } else {
                                    console.log('Failed to extract valid fixed code. Retrying with original...');
                                }
                            } else {
                                console.log('Failed to generate fixed solution. Retrying with original...');
                            }
                            
                            // Wait before retry
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    } else {
                        console.log(`? Problem ${problem.id} submission status unknown (may still be processing)`);
                        break; // Exit retry loop if we can't determine status
                    }
                }

                if (!isAccepted) {
                    console.log(`✗ Problem ${problem.id} could not be accepted after ${attempt} attempts. Moving on...`);
                }

                // Wait a bit more to ensure result is displayed
                await new Promise(r => setTimeout(r, 2000));

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
