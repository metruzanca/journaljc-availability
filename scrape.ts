import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

type AptUnit = {
  residence: string;
  bedroom: string;
  bathroom: string;
  changes: Array<{
    price: number;
    deleted: boolean;
    timestamp: string;
  }>;
};

type Data = {
  timestamp: number;
  units: Record<string, AptUnit>;
};

enum Headers {
  residence = 0,
  bedroom = 1,
  bathroom = 2,
  price = 4,
}

function getPrice(str: string): number {
  return parseFloat(str.replace(/[$*]/g, "").replace(/,/g, ""));
}

const DAY_IN_MS = 86400000;

type UnitSnapshot = {
  residence: string;
  bedroom: string;
  bathroom: string;
  price: number;
};

async function scrapeLiveData(): Promise<Map<string, UnitSnapshot>> {
  let browser: Browser | undefined; // Declare browser variable outside try-block
  let page: Page | undefined; // Declare page variable outside try-block
  const urlToScrape: string = "https://www.journaljc.com/availability"; // Replace with your target URL

  const data = new Map<string, UnitSnapshot>();

  try {
    browser = await chromium.launch();
    page = await browser.newPage();

    await page.goto(urlToScrape);

    const rows = await page.$$(".tableRow[data-residence]");
    for (const row of rows) {
      const cells = await row.$$("div");

      const priceStr = await cells[Headers.price].textContent();

      const unit: UnitSnapshot = {
        residence: (await cells[Headers.residence].textContent()) ?? "",
        bedroom: (await cells[Headers.bedroom].textContent()) ?? "",
        bathroom: (await cells[Headers.bathroom].textContent()) ?? "",
        price: priceStr ? getPrice(priceStr) : 0,
      };

      data.set(unit.residence, unit);
    }
  } catch (error: unknown) {
    // Use unknown for caught errors
    if (error instanceof Error) {
      console.error("Scraping failed:", error.message);
    } else {
      console.error("An unknown error occurred during scraping:", error);
    }
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return data;
}

function parseDataJson(data: string): Data {
  try {
    return JSON.parse(data);
  } catch {
    return {
      timestamp: 0,
      units: {} as Record<string, AptUnit>,
    };
  }
}

function saveChanges(
  updatedData: Map<string, UnitSnapshot>,
  today = new Date().toDateString()
) {
  const resultsDir: string = path.join(__dirname, "data");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }

  const fileName = "apartments.json";
  const filePath = path.join(resultsDir, fileName);

  const existingData = parseDataJson(
    fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : ""
  );

  // Update or add units
  for (const [residence, updatedUnit] of updatedData.entries()) {
    const existingUnit = existingData.units[residence];
    if (existingUnit) {
      const latestChange = existingUnit.changes.at(-1);
      if (!latestChange || latestChange.price !== updatedUnit.price) {
        existingUnit.changes.push({
          price: updatedUnit.price,
          deleted: false,
          timestamp: today,
        });
      }
    } else {
      existingData.units[residence] = {
        bathroom: updatedUnit.bathroom,
        bedroom: updatedUnit.bedroom,
        residence: updatedUnit.residence,
        changes: [
          {
            price: updatedUnit.price,
            deleted: false,
            timestamp: today,
          },
        ],
      };
    }
  }

  // Mark units as deleted if not present in updatedData
  for (const [residence, existingUnit] of Object.entries(existingData.units)) {
    if (!updatedData.has(residence)) {
      const latestChange = existingUnit.changes.at(-1);
      if (latestChange && !latestChange.deleted) {
        existingUnit.changes.push({
          price: latestChange.price,
          deleted: true,
          timestamp: today,
        });
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

  console.log(`Scraping successful! Data saved to ${filePath}`);
}

const data = await scrapeLiveData();
saveChanges(data);

// for testing
// let tomorrow: Date = new Date();

// for (let i = 0; i < 3; i++) {
//   tomorrow.setDate(tomorrow.getDate() + 1);
//   for (const [, snapshot] of data.entries()) {
//     snapshot.price += 100;
//   }
//   saveChanges(data, tomorrow.toDateString());
// }
