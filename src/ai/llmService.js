require('dotenv').config();
const { generateText } = require('ai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');
const readline = require('readline');

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
});

function askUserForManualCode(promptMessage) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(promptMessage, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function generatePlaywrightCode(testCase, targetUrl, domSnapshot) {
    const prompt = `
    You are an expert QA Automation Engineer.
    The browser has ALREADY navigated to "${targetUrl}".
    Write ONLY the JavaScript Playwright code required to execute the test case below on the current page.

    Test Case: "${testCase}"

    Live Visible Page DOM Snapshot (use ONLY elements that exist here):
    ${JSON.stringify(domSnapshot, null, 2)}

    Strict Rules:
    1. Assume 'page' (the Playwright page object) is already open at the Target URL. Do NOT call page.goto() again unless navigating to a sub-page.
    2. Do NOT include imports, browser setup, comments, or markdown backticks.
    3. Websites often have duplicate hidden elements in mobile/dropdown menus. ALWAYS include ':visible' in your locator before calling .first(), for example:
       - page.locator('a:has-text("Pricing"):visible').first()
       - page.locator('button:has-text("Submit"):visible').first()
       - page.locator('input[placeholder*="Email"]:visible').first()
    4. Before clicking or filling any element, wait for it: await locator.waitFor({ state: 'visible', timeout: 10000 });
    5. For text or page load verification, wait briefly for navigation if a click occurred (await page.waitForLoadState('domcontentloaded')), then check actual page text case-insensitively:
       const bodyText = await page.locator('body').innerText();
       if (!bodyText.toLowerCase().includes('expected text')) throw new Error('...');
    6. Throw an Error if any verification fails so the test runner catches it.
    `;

    try {
        const { text } = await generateText({
            model: google('gemini-3.5-flash'),
            prompt: prompt,
        });

        return text.replace(/```javascript/g, '').replace(/```/g, '').trim();

    } catch (error) {
        const isQuotaError = error.statusCode === 429 ||
                             error.message?.includes("429") ||
                             error.message?.includes("quota") ||
                             error.message?.includes("RESOURCE_EXHAUSTED");

        if (isQuotaError) {
            console.warn("\n⚠️ GEMINI API LIMIT REACHED (429: Quota Exceeded) ⚠️");
            console.log("--- MANUAL FALLBACK REQUIRED ---");
            console.log("Please paste your raw Playwright JavaScript code below and press ENTER:");

            const manualCode = await askUserForManualCode("> ");
            if (!manualCode.trim()) throw new Error("No manual code provided. Aborting test.");

            console.log("\n✅ Manual code accepted. Resuming execution...");
            return manualCode;
        }

        throw error;
    }
}

module.exports = { generatePlaywrightCode };