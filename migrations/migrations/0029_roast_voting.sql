ALTER TABLE roast_submissions ADD COLUMN telegram_message_id INTEGER;
ALTER TABLE roast_submissions ADD COLUMN reaction_count INTEGER DEFAULT 0;
