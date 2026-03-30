-- Add exchange_rate column to invoices table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='invoices' AND column_name='exchange_rate') THEN
        ALTER TABLE invoices ADD COLUMN exchange_rate numeric(15,4);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='invoices' AND column_name='uyumsoft_number') THEN
        ALTER TABLE invoices ADD COLUMN uyumsoft_number text;
    END IF;
END $$;
