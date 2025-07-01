-- Add composite type to exchanges table
-- This migration allows bundled exchanges with multiple knowledge sources

-- Add composite to the type constraint
ALTER TABLE exchanges 
DROP CONSTRAINT IF EXISTS exchanges_type_check;

ALTER TABLE exchanges 
ADD CONSTRAINT exchanges_type_check 
CHECK (type IN ('local', 'github', 'google-drive', 'zotero', 'composite'));

-- Add composite to the knowledge_type constraint  
ALTER TABLE exchanges 
DROP CONSTRAINT IF EXISTS exchanges_knowledge_type_check;

ALTER TABLE exchanges 
ADD CONSTRAINT exchanges_knowledge_type_check 
CHECK (knowledge_type IN ('local', 'github', 'google-drive', 'zotero', 'composite'));

-- Add an expires_at column for exchange expiration
ALTER TABLE exchanges 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- ROLLBACK
-- Revert constraints to original values
ALTER TABLE exchanges 
DROP CONSTRAINT IF EXISTS exchanges_knowledge_type_check;

ALTER TABLE exchanges 
ADD CONSTRAINT exchanges_knowledge_type_check 
CHECK (knowledge_type IN ('local', 'github', 'google-drive', 'zotero'));

ALTER TABLE exchanges 
DROP CONSTRAINT IF EXISTS exchanges_type_check;

ALTER TABLE exchanges 
ADD CONSTRAINT exchanges_type_check 
CHECK (type IN ('local', 'github', 'google-drive', 'zotero'));

-- Remove the expires_at column
ALTER TABLE exchanges 
DROP COLUMN IF EXISTS expires_at;