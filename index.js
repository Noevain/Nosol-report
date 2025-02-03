const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;
const csvFilePath = path.join(__dirname, 'accepted_reports.csv');
// Middleware to parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
        return res.status(422).send({
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

app.get('/manifest',(req,res)=>{
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.sendFile(
        path.join(__dirname, "manifest.yaml")
    );
});

app.get('/model',(req,res)=>{
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/zip');
    res.sendFile(
        path.join(__dirname, "model.zip")
    );
});


// /review route (display one report at a time)
app.get('/review', (req, res) => {
    db.get('SELECT * FROM reports ORDER BY id LIMIT 1', [], (err, report) => {
        if (err) {
            return res.status(500).send('Error fetching reports');
        }
        if (!report) {
            return res.send('<h1>No reports to review</h1>');
        }
        
        let html = `<h1>Review Report</h1>
            <div>
                <p><strong>Sender:</strong> ${report.sender}</p>
                <p><strong>Content:</strong> ${report.content}</p>
                <p><strong>Reason:</strong> ${report.reason}</p>
                <form action="/accept" method="POST">
                    <input type="hidden" name="id" value="${report.id}" />
                    <input type="hidden" name="category" value="${report.suggested_classification}" />
                    <input type="hidden" name="channel" value="${report.sender}" />
                    <input type="hidden" name="text" value="${report.content}" />
                    <button type="submit">Accept</button>
                </form>
                <form action="/reject" method="POST">
                    <input type="hidden" name="id" value="${report.id}" />
                    <button type="submit">Reject</button>
                </form>
            </div>`;
        res.send(html);
    });
});

// Accept report
app.post('/accept', (req, res) => {
    const { id, category, channel, text } = req.body;
    
    const csvLine = `${category},${channel},${text}\n`;
    fs.appendFile(csvFilePath, csvLine, (err) => {
        if (err) {
            return res.status(500).send('Error saving to CSV');
        }
        db.run('DELETE FROM reports WHERE id = ?', [id], (err) => {
            if (err) {
                return res.status(500).send('Error deleting report');
            }
            console.log("Report accepted with ID:",id);
            res.redirect('/review');
        });
    });
});

// Reject report
app.post('/reject', (req, res) => {
    const { id } = req.body;
    db.run('DELETE FROM reports WHERE id = ?', [id], (err) => {
        if (err) {
            return res.status(500).send('Error deleting report');
        }
        console.log("Deleted report with ID:", id);
        res.redirect('/review');
    });
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
