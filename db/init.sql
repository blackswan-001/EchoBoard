-- EchoBoard Database Schema
CREATE TABLE IF NOT EXISTS feedback (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT,
    category    TEXT NOT NULL DEFAULT 'General',
    rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    message     TEXT NOT NULL,
    sentiment   TEXT GENERATED ALWAYS AS (
                    CASE
                        WHEN rating >= 4 THEN 'positive'
                        WHEN rating = 3  THEN 'neutral'
                        ELSE 'negative'
                    END
                ) STORED,
    created_at  DATETIME DEFAULT (datetime('now'))
);

-- Seed data
INSERT INTO feedback (name, email, category, rating, message) VALUES
('Alice Mercer',   'alice@example.com',   'Product',  5, 'Absolutely love the new interface — smooth and fast!'),
('Ben Torres',     'ben@example.com',     'Support',  2, 'Waited 3 days for a response. Needs improvement.'),
('Clara Singh',    'clara@example.com',   'General',  4, 'Great experience overall. Minor UI quirks but solid.'),
('David Okafor',   'david@example.com',   'Billing',  3, 'Invoice process is confusing. Could be clearer.'),
('Eva Lindqvist',  'eva@example.com',     'Product',  5, 'Best update yet. The speed improvements are incredible.');
