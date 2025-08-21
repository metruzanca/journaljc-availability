# Multi-Site Apartment Price Scraper

This project scrapes apartment availability and pricing data from multiple apartment complex websites and displays the data in separate charts.

## Features

- **Multi-site support**: Scrape data from multiple apartment complex websites
- **Automatic data collection**: Each site has its own scraper that runs independently
- **Separate charts**: Data is displayed in separate charts per apartment complex
- **Price tracking**: Historical price data is stored and displayed over time

## Project Structure

```
├── scrape.ts              # Main scraper orchestrator
├── migrate-data.ts        # Data migration script
├── sites/                 # Individual site scrapers
│   └── journaljc.ts       # JournalJC apartment complex scraper
├── data/                  # Scraped data storage
│   └── apartments.json    # Combined data from all sites
├── index.html             # Web interface with charts
└── README.md             # This file
```

## How to Add a New Site

To add scraping for a new apartment complex:

1. Create a new TypeScript file in the `sites/` folder (e.g., `sites/new-complex.ts`)

2. Export a default function that returns a `Map<string, UnitSnapshot>`:

```typescript
import { chromium, type Browser, type Page } from "playwright";

type UnitSnapshot = {
  residence: string;
  bedroom: string;
  bathroom: string;
  price: number;
  sf: number;
  site: string;
};

export default async function scrapeNewComplex(): Promise<
  Map<string, UnitSnapshot>
> {
  let browser: Browser | undefined;
  let page: Page | undefined;
  const urlToScrape: string = "https://your-apartment-site.com/availability";

  const data = new Map<string, UnitSnapshot>();

  try {
    browser = await chromium.launch();
    page = await browser.newPage();

    await page.goto(urlToScrape);

    // Add your scraping logic here
    // Example:
    // const units = await page.$$('.unit-selector');
    // for (const unit of units) {
    //   const residence = await unit.$eval('.residence', el => el.textContent);
    //   const bedroom = await unit.$eval('.bedroom', el => el.textContent);
    //   const bathroom = await unit.$eval('.bathroom', el => el.textContent);
    //   const price = await unit.$eval('.price', el => el.textContent);
    //   const sf = await unit.$eval('.sqft', el => el.textContent);
    //
    //   if (bedroom === "1 Bedroom") {
    //     const unitSnapshot: UnitSnapshot = {
    //       residence: residence || "",
    //       bedroom,
    //       bathroom: bathroom || "",
    //       price: parseFloat(price?.replace(/[$*,]/g, "") || "0"),
    //       sf: parseFloat(sf?.replace(/[^\d]/g, "") || "0"),
    //       site: "new-complex", // Unique identifier for this site
    //     };
    //
    //     data.set(unitSnapshot.residence, unitSnapshot);
    //   }
    // }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("New complex scraping failed:", error.message);
    } else {
      console.error(
        "An unknown error occurred during new complex scraping:",
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
```

3. The main scraper will automatically detect and run your new scraper

## Running the Scraper

```bash
# Install dependencies
npm install

# Run the scraper
npx tsx scrape.ts
```

## Data Migration

If you have existing data without site information, run the migration script:

```bash
npx tsx migrate-data.ts
```

This will:

- Add site information to all existing units and prices
- Create a backup of your original data
- Show statistics about the migration

## Viewing the Data

1. Start a local server:

```bash
python3 -m http.server 8000
```

2. Open your browser and navigate to `http://localhost:8000`

3. You'll see separate charts for each apartment complex with their respective titles

## Data Structure

The scraped data is stored in `data/apartments.json` with the following structure:

```json
{
  "units": [
    {
      "residence": "4001N",
      "bedroom": "1 Bedroom",
      "bathroom": "1",
      "size": 870,
      "site": "journaljc"
    }
  ],
  "prices": [
    {
      "residence": "4001N",
      "price": 2500,
      "timestamp": "Mon Dec 18 2023",
      "site": "journaljc"
    }
  ]
}
```

## Requirements

- Node.js
- Playwright
- TypeScript

## Notes

- Each site scraper runs independently, so if one fails, others will still run
- The system automatically groups data by site and creates separate charts
- Historical price data is preserved and displayed over time
- Only 1-bedroom units are currently tracked (can be modified in individual scrapers)
