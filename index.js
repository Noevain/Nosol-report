const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Path to the SQLite database file
const dbPath = path.join(__dirname, 'reports.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Create the reports table if it doesn't exist
const createTableQuery = `
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_version INT,
    model_version INT,
    timestamp TEXT,
    type INT,
    sender TEXT,
    content TEXT,
    reason TEXT,
    suggested_classification TEXT
);
`;

db.run(createTableQuery, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    } else {
        console.log('Table setup done.');
    }
});

// /report route
app.post('/report', (req, res) => {
    const requiredFields = [
        'report_version',
        'model_version',
        'timestamp',
        'type',
        'sender',
        'content',
        'reason',
        'suggested_classification'
    ];

    const missingFields = requiredFields.filter(field => !(field in req.body));

    if (missingFields.length > 0) {
        console.log("Missing field from report:",missingFields.join(', '))
        return res.status(400).send({
            error: `Missing required fields: ${missingFields.join(', ')}`
        });
    }
    
    const { report_version, model_version, timestamp, type, sender, content, reason, suggested_classification } = req.body;

    const insertQuery = `
    INSERT INTO reports (report_version, model_version, timestamp, type, sender, content, reason, suggested_classification)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
        insertQuery,
        [report_version, model_version, timestamp, type, sender, content, reason, suggested_classification],
        function (err) {
            if (err) {
                console.error('Error inserting data into the database:', err.message);
                return res.status(500).send({ error: 'Failed to save report to the database.' });
            }

            console.log('Report saved with ID:', this.lastID);
            res.status(200).send({ message: 'ok'});
        }
    );
});


app.get('/',(req,res)=>{
    res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('What are you doing here?\n');
});
// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
