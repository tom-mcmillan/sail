-- Refactor packet key system to separate packet ID from access key
-- This migration updates the packet key architecture for better security

-- First, let's add new columns to packet_keys table
ALTER TABLE packet_keys 
ADD COLUMN IF NOT EXISTS packet_id VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS access_key VARCHAR(30) UNIQUE;

-- Update existing packet_keys to have proper packet_id and access_key
-- For existing records, we'll generate new IDs and keys
UPDATE packet_keys 
SET 
  packet_id = CASE 
    WHEN name IS NOT NULL THEN 
      lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) || '-' || substring(md5(random()::text), 1, 8)
    ELSE 
      'packet-' || substring(md5(random()::text), 1, 12)
  END,
  access_key = 'sail-pk-' || lower(substring(md5(random()::text), 1, 12))
WHERE packet_id IS NULL OR access_key IS NULL;

-- Make the new columns NOT NULL after updating existing data
ALTER TABLE packet_keys 
ALTER COLUMN packet_id SET NOT NULL,
ALTER COLUMN access_key SET NOT NULL;

-- Update the primary key to use packet_id instead of access_key
-- First drop the old foreign key constraints
ALTER TABLE packet_key_usage DROP CONSTRAINT IF EXISTS packet_key_usage_packet_key_fkey;

-- Add new foreign key column
ALTER TABLE packet_key_usage 
ADD COLUMN IF NOT EXISTS packet_id VARCHAR(100);

-- Update existing usage records to use packet_id
UPDATE packet_key_usage 
SET packet_id = (
  SELECT packet_id FROM packet_keys 
  WHERE packet_keys.key = packet_key_usage.packet_key
);

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_packet_keys_packet_id ON packet_keys(packet_id);
CREATE INDEX IF NOT EXISTS idx_packet_keys_access_key ON packet_keys(access_key);
CREATE INDEX IF NOT EXISTS idx_packet_key_usage_packet_id ON packet_key_usage(packet_id);

-- Update the packet key generation function
CREATE OR REPLACE FUNCTION generate_packet_identifiers(packet_name TEXT DEFAULT NULL) 
RETURNS TABLE(packet_id VARCHAR, access_key VARCHAR) AS $$
DECLARE
  new_packet_id VARCHAR;
  new_access_key VARCHAR;
  id_exists BOOLEAN;
  key_exists BOOLEAN;
BEGIN
  -- Generate packet_id
  LOOP
    IF packet_name IS NOT NULL THEN
      new_packet_id := lower(regexp_replace(regexp_replace(packet_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) || '-' || lower(substring(md5(random()::text), 1, 8));
    ELSE
      new_packet_id := 'packet-' || lower(substring(md5(random()::text), 1, 12));
    END IF;
    
    SELECT EXISTS(SELECT 1 FROM packet_keys WHERE packet_keys.packet_id = new_packet_id) INTO id_exists;
    EXIT WHEN NOT id_exists;
  END LOOP;
  
  -- Generate access_key
  LOOP
    new_access_key := 'sail-pk-' || lower(substring(md5(random()::text), 1, 12));
    SELECT EXISTS(SELECT 1 FROM packet_keys WHERE packet_keys.access_key = new_access_key) INTO key_exists;
    EXIT WHEN NOT key_exists;
  END LOOP;
  
  RETURN QUERY SELECT new_packet_id, new_access_key;
END;
$$ LANGUAGE plpgsql;

-- Update the usage tracking trigger to work with packet_id
CREATE OR REPLACE FUNCTION update_packet_key_usage() RETURNS TRIGGER AS $$
BEGIN
  -- Update using access_key to find the packet
  UPDATE packet_keys 
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE access_key = NEW.access_key;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger for usage tracking
DROP TRIGGER IF EXISTS update_packet_key_usage_trigger ON packet_key_usage;
CREATE TRIGGER update_packet_key_usage_trigger
AFTER INSERT ON packet_key_usage
FOR EACH ROW EXECUTE FUNCTION update_packet_key_usage();

-- ROLLBACK SECTION
-- DROP TRIGGER IF EXISTS update_packet_key_usage_trigger ON packet_key_usage;
-- DROP FUNCTION IF EXISTS update_packet_key_usage();
-- DROP FUNCTION IF EXISTS generate_packet_identifiers(TEXT);
-- DROP INDEX IF EXISTS idx_packet_key_usage_packet_id;
-- DROP INDEX IF EXISTS idx_packet_keys_access_key;
-- DROP INDEX IF EXISTS idx_packet_keys_packet_id;
-- ALTER TABLE packet_key_usage DROP COLUMN IF EXISTS packet_id;
-- ALTER TABLE packet_keys DROP COLUMN IF EXISTS access_key;
-- ALTER TABLE packet_keys DROP COLUMN IF EXISTS packet_id;