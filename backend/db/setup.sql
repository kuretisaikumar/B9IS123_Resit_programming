-- pets table
CREATE TABLE IF NOT EXISTS pets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    breed TEXT,
    status TEXT CHECK(status IN ('Available', 'Adopted', 'Fostered')),
    description TEXT
);

-- users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user'
);
