import * as fs from "fs";
import * as path from "path";

type Unit = {
  residence: string;
  bedroom: string;
  bathroom: string;
  size: number;
  site: string;
};

type Price = {
  residence: string;
  price: number;
  timestamp: string;
  site: string;
};

type NormalizedData = {
  units: Unit[];
  prices: Price[];
};

type UnitSnapshot = {
  residence: string;
  bedroom: string;
  bathroom: string;
  price: number;
  sf: number;
  site: string;
};

function parseDataJson(data: string): NormalizedData {
  try {
    return JSON.parse(data);
  } catch {
    return {
      units: [],
      prices: [],
    };
  }
}

async function runAllSiteScrapers(): Promise<Map<string, UnitSnapshot>> {
  const sitesDir = path.join(__dirname, "sites");
  const allData = new Map<string, UnitSnapshot>();

  // Get all TypeScript files in the sites directory
  const siteFiles = fs
    .readdirSync(sitesDir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));

  for (const siteFile of siteFiles) {
    try {
      console.log(`Running scraper for ${siteFile}...`);
      const siteModule = await import(path.join(sitesDir, siteFile));
      const scraper = siteModule.default;

      if (typeof scraper === "function") {
        const siteData = await scraper();

        // Merge site data into all data
        for (const [residence, unit] of siteData.entries()) {
          allData.set(residence, unit);
        }

        console.log(
          `Successfully scraped ${siteData.size} units from ${siteFile}`
        );
      } else {
        console.error(
          `Invalid scraper in ${siteFile}: default export is not a function`
        );
      }
    } catch (error) {
      console.error(`Failed to run scraper for ${siteFile}:`, error);
    }
  }

  return allData;
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

  // Create a map of existing units for quick lookup
  const existingUnitsMap = new Map<string, Unit>();
  for (const unit of existingData.units) {
    existingUnitsMap.set(unit.residence, unit);
  }

  // Update or add units and prices
  for (const [residence, updatedUnit] of updatedData.entries()) {
    // Add or update unit information
    const unit: Unit = {
      residence: updatedUnit.residence,
      bedroom: updatedUnit.bedroom,
      bathroom: updatedUnit.bathroom,
      size: updatedUnit.sf,
      site: updatedUnit.site,
    };

    existingUnitsMap.set(residence, unit);

    // Add price record
    const price: Price = {
      residence: updatedUnit.residence,
      price: updatedUnit.price,
      timestamp: today,
      site: updatedUnit.site,
    };

    existingData.prices.push(price);
  }

  // Convert units map back to array
  existingData.units = Array.from(existingUnitsMap.values());

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));

  console.log(`Scraping successful! Data saved to ${filePath}`);
}

async function main() {
  const data = await runAllSiteScrapers();
  saveChanges(data);
}

main().catch(console.error);
