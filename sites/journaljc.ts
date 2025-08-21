import { chromium, type Browser, type Page } from "playwright";
import * as path from "path";

type UnitSnapshot = {
  residence: string;
  bedroom: string;
  bathroom: string;
  price: number;
  sf: number;
  site: string;
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

async function getSquareFoot(page: Page) {
  const text = await page.getByText(/\d+\s?SF/).textContent()!;

  // Use regex to extract just the number part from the text
  const numberMatch = text?.match(/\d+/);
  return numberMatch ? +numberMatch[0] : 0;
}

export default async function scrapeJournalJC(): Promise<
  Map<string, UnitSnapshot>
> {
  let browser: Browser | undefined;
  let page: Page | undefined;
  const urlToScrape: string = "https://www.journaljc.com/availability";

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
          path: path.join(__dirname, "..", "data", `${bedroom}-${plan}-.png`),
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
        site: "journaljc",
      };

      data.set(unit.residence, unit);
      console.log(`JournalJC Unit ${i + 1}/${rows.length}:`);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("JournalJC scraping failed:", error.message);
    } else {
      console.error(
        "An unknown error occurred during JournalJC scraping:",
        error
      );
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return data;
}
