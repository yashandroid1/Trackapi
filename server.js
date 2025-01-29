const express = require("express");
const puppeteer = require("puppeteer");
const { JSDOM } = require("jsdom");

const app = express();
const PORT = 3000;

// Middleware to parse JSON requests
app.use(express.json());

// API endpoint to fetch tracking page HTML
app.post("/get-tracking-details", async (req, res) => {
    const { awb_id } = req.body;

    if (!awb_id) {
        return res.status(400).json({ error: "AWB ID is required" });
    }

    try {
        // Correctly interpolate the awb_id into the URL
        const url = `https://www.delhivery.com/track-v2/package/${awb_id}`;
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });

        // Optional: Wait for specific element to ensure content is loaded
        await page.waitForSelector(".flex.items-start.w-full", { timeout: 10000 }); // Wait for the tracking details section

        // Extract content
        const content = await page.content();
        await browser.close();

        // Use JSDOM to parse the HTML
        const dom = new JSDOM(content);
        const document = dom.window.document;

        // Select the tracking details
        const trackingDetails = [];
        const trackingDivs = document.querySelectorAll(".flex.items-start.w-full");

        trackingDivs.forEach((div) => {
            const statusElement = div.querySelector(".font-semibold");
            const descriptionElement = div.querySelector(".font-normal");
            const timestampElement = div.querySelector(".text-descriptions-placeholder");

            if (statusElement && descriptionElement && timestampElement) {
                trackingDetails.push({
                    status: statusElement.textContent.trim(),
                    description: descriptionElement.textContent.trim(),
                    timestamp: timestampElement.textContent.trim(),
                });
            }
        });

        // Filter to include only the desired statuses
        const filteredTrackingDetails = trackingDetails.filter(detail =>
            ["IN-TRANSIT", "OUT FOR DELIVERY", "DELIVERED"].includes(detail.status)
        );

        if (filteredTrackingDetails.length === 0) {
            console.warn("No relevant tracking details found.");
        }

        return res.status(200).json({ trackingDetails: filteredTrackingDetails });
    } catch (error) {
        console.error("Error fetching tracking details:", error.message);
        return res.status(500).json({
            error: "Failed to fetch tracking details",
            details: error.message,
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
