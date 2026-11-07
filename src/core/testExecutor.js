const { chromium } = require('playwright');
const { generatePlaywrightCode } = require('../ai/llmService');

async function extractDomSnapshot(page) {
    return await page.evaluate(() => {
        const clean = (str) => (str || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        const isVisible = (el) => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };

        return {
            title: document.title,
            url: window.location.href,
            headings: Array.from(document.querySelectorAll('h1, h2, h3'))
                .filter(isVisible)
                .map(el => clean(el.innerText))
                .filter(Boolean)
                .slice(0, 15),
            links: Array.from(document.querySelectorAll('a'))
                .filter(isVisible)
                .map(el => ({ text: clean(el.innerText), href: el.getAttribute('href') }))
                .filter(l => l.text)
                .slice(0, 40),
            buttons: Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'))
                .filter(isVisible)
                .map(el => clean(el.innerText || el.value))
                .filter(Boolean)
                .slice(0, 20),
            inputs: Array.from(document.querySelectorAll('input, textarea, select'))
                .filter(isVisible)
                .map(el => ({
                    tag: el.tagName.toLowerCase(),
                    type: el.type || '',
                    name: el.name || '',
                    id: el.id || '',
                    placeholder: el.placeholder || ''
                }))
                .slice(0, 15)
        };
    });
}

async function executeTest(targetUrl, testCase) {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    let testPassed = false;

    try {
        console.log(`🌐 Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.locator('body').first().waitFor({ state: 'visible', timeout: 10000 });

        console.log(`🔍 Inspecting live DOM elements...`);
        const domSnapshot = await extractDomSnapshot(page);
        console.log(`   Loaded Page Title: "${domSnapshot.title}"`);

        console.log(`⏳ Translating English to Playwright code via AI...`);
        const generatedCode = await generatePlaywrightCode(testCase, targetUrl, domSnapshot);

        console.log(`\n--- Executing Playwright Code ---\n${generatedCode}\n---------------------------------\n`);
        console.log("▶️ Running test steps in browser...");

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const dynamicTest = new AsyncFunction('page', generatedCode);

        await dynamicTest(page);

        testPassed = true;
        console.log(`\n✅ RESULT: Test PASSED`);
    } catch (error) {
        testPassed = false;
        console.error(`\n❌ RESULT: Test FAILED`);
        console.error(`Reason: ${error.message}`);
    } finally {
        await browser.close();
    }

    return testPassed;
}

module.exports = { executeTest };