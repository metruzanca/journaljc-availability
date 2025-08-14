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
  sf: number;
};

type Data = {
  timestamp: number;
  units: Record<string, AptUnit>;
  // floor_plans: Array<string>;
};

enum Headers {
  residence = 0,
  bedroom = 1,
  bathroom = 2,
  floor_plan = 3,
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
  sf: number;
};

async function getSquareFoot(page: Page) {
  const text = await page.getByText(/\d+\s?SF/).textContent()!;

  // Use regex to extract just the number part from the text
  const numberMatch = text?.match(/\d+/);
  return numberMatch ? +numberMatch[0] : 0;
}

async function scrapeLiveData(): Promise<Map<string, UnitSnapshot>> {
  let browser: Browser | undefined; // Declare browser variable outside try-block
  let page: Page | undefined; // Declare page variable outside try-block
  const urlToScrape: string = "https://www.journaljc.com/availability"; // Replace with your target URL

  const data = new Map<string, UnitSnapshot>();

  try {
    browser = await chromium.launch();
    page = await browser.newPage();

    await page.goto(urlToScrape);

    const floor_plans = new Map<string, number>();

    const rows = await page.$$(".tableRow[data-residence]");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = await row.$$("div");

      const bedroom = (await cells[Headers.bedroom].textContent())!;

      // Skip for non 1 bed
      if (bedroom !== "1 Bedroom") continue;

      const priceStr = await cells[Headers.price].textContent();
      const residence = (await cells[Headers.residence].textContent()) ?? "";

      const plan = residence.substring(2, 4);

      if (!floor_plans.has(plan)) {
        await cells[Headers.floor_plan].click();
        await page.waitForTimeout(500);
        await page.screenshot({
          path: path.join(__dirname, "data", `${bedroom}-${plan}-.png`),
        });

        const sf = await getSquareFoot(page);
        await page.getByRole("button", { name: "Back" }).click();

        floor_plans.set(plan, sf);
      }

      const unit: UnitSnapshot = {
        residence,
        bedroom,
        bathroom: (await cells[Headers.bathroom].textContent()) ?? "",
        price: priceStr ? getPrice(priceStr) : 0,
        sf: floor_plans.get(plan) ?? 0,
      };

      data.set(unit.residence, unit);
      console.log(`Unit ${i + 1}/${rows.length}:`);
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
    if (!existingData.units[residence]) {
      existingData.units[residence] = {
        sf: updatedUnit.sf,
        bathroom: updatedUnit.bathroom,
        bedroom: updatedUnit.bedroom,
        residence: updatedUnit.residence,
        changes: [],
      };
    }

    existingData.units[residence].changes.push({
      price: updatedUnit.price,
      deleted: false,
      timestamp: today,
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

  console.log(`Scraping successful! Data saved to ${filePath}`);
}

const data = await scrapeLiveData();
saveChanges(data);
