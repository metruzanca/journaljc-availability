import * as fs from "fs";
import * as path from "path";

// Old data structure types
type OldAptUnit = {
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

type OldData = {
  timestamp: number;
  units: Record<string, OldAptUnit>;
};

// New data structure types
type Unit = {
  residence: string;
  bedroom: string;
  bathroom: string;
  size: number;
};

type Price = {
  residence: string;
  price: number;
  timestamp: string;
};

type NormalizedData = {
  units: Unit[];
  prices: Price[];
};

function migrateData(): void {
  const filePath = path.join(__dirname, "data", "apartments.json");
  
  if (!fs.existsSync(filePath)) {
    console.log("No existing data file found. Migration not needed.");
    return;
  }

  try {
    // Read existing data
    const oldData: OldData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    
    // Create new normalized structure
    const normalizedData: NormalizedData = {
      units: [],
      prices: []
    };

    // Convert units
    for (const [residence, oldUnit] of Object.entries(oldData.units)) {
      // Add unit information
      const unit: Unit = {
        residence: oldUnit.residence,
        bedroom: oldUnit.bedroom,
        bathroom: oldUnit.bathroom,
        size: oldUnit.sf,
      };
      
      normalizedData.units.push(unit);

      // Add price records (excluding deleted ones)
      for (const change of oldUnit.changes) {
        if (!change.deleted) {
          const price: Price = {
            residence: oldUnit.residence,
            price: change.price,
            timestamp: change.timestamp,
          };
          
          normalizedData.prices.push(price);
        }
      }
    }

    // Write migrated data
    fs.writeFileSync(filePath, JSON.stringify(normalizedData, null, 2));
    
    console.log(`Migration completed successfully!`);
    console.log(`Units: ${normalizedData.units.length}`);
    console.log(`Prices: ${normalizedData.prices.length}`);
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateData();
