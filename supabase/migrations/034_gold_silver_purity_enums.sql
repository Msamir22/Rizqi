-- Migration: Create gold karat and silver fineness enums as SSOT for purity options
-- These enums serve as the authoritative reference for purity dropdowns in the UI.
--
-- Gold purity research confirms all 6 values are industry standard:
--   24K (99.9%), 22K (91.7%), 21K (87.5%), 18K (75%), 14K (58.3%), 10K (41.7%)
--
-- Silver fineness research confirms all 6 values are industry standard:
--   999 (Fine), 950 (French 1st Standard), 925 (Sterling),
--   900 (Coin), 850 (European), 800 (Continental)

-- Gold Karat Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gold_karat_enum') THEN
        CREATE TYPE gold_karat_enum AS ENUM ('24', '22', '21', '18', '14', '10');
    END IF;
END
$$;

-- Silver Fineness Enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'silver_fineness_enum') THEN
        CREATE TYPE silver_fineness_enum AS ENUM ('999', '950', '925', '900', '850', '800');
    END IF;
END
$$;

-- Add comments for documentation
COMMENT ON TYPE gold_karat_enum IS 'Standard gold purity levels in karats. Single source of truth for gold purity dropdowns.';
COMMENT ON TYPE silver_fineness_enum IS 'Standard silver fineness levels (parts per thousand). Single source of truth for silver purity dropdowns.';
