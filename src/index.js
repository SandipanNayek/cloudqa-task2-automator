const { executeTest } = require('./core/testExecutor');

async function main() {
    const args = process.argv.slice(2);

    const targetUrl = args[0] || "https://phptravels.com/demo";
    const testCase = args[1] || "Verify the page loads and displays PHPTRAVELS.";

    console.log(`Starting Plain-English Test Automator...`);
    console.log(`Target Site: ${targetUrl}`);
    console.log(`Test Case: "${testCase}"\n`);

    try {
        await executeTest(targetUrl, testCase);
    } catch (error) {
        console.error("Critical System Error:", error);
    }
}

main();