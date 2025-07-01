-- Add knowledge_type column and index to exchanges table
-- Description: Adds the knowledge_type column that was previously handled in ad-hoc migrations

-- Add knowledge_type column if it doesn't exist
ALTER TABLE exchanges 
ADD COLUMN IF NOT EXISTS knowledge_type VARCHAR(50) DEFAULT 'local' 
CHECK (knowledge_type IN ('local', 'github', 'google-drive', 'zotero'));

-- Add index for knowledge_type
CREATE INDEX IF NOT EXISTS idx_exchanges_knowledge_type ON exchanges(knowledge_type);

-- Update existing records to have knowledge_type matching their type
UPDATE exchanges 
SET knowledge_type = type 
WHERE knowledge_type IS NULL OR knowledge_type = 'local';

-- ROLLBACK
-- Remove the index
DROP INDEX IF EXISTS idx_exchanges_knowledge_type;

-- Remove the column
ALTER TABLE exchanges DROP COLUMN IF EXISTS knowledge_type;