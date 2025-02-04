require('dotenv').config()
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const helpers = require('./helpers');
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

// Simple authentication middleware
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
function authenticate(req, res, next) {
    const authheader = req.headers.authorization;
    console.log(req.headers);

    if (!authheader) {
        let err = new Error('This route require auth');
        res.setHeader('WWW-Authenticate', 'Basic');
        err.status = 401;
        return next(err)
    }

    const auth = new Buffer.from(authheader.split(' ')[1],
        'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    if (user == ADMIN_USER && pass == ADMIN_PASSWORD) {

        // If Authorized user
        next();
    } else {
        let err = new Error('This route require auth');
        res.setHeader('WWW-Authenticate', 'Basic');
        err.status = 401;
        return next(err);
    }

}

// Create the reports table if it doesn't exist
const createTableQuery = `
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_version INT,
    model_version INT,
    timestamp TEXT,
    type INT,
    sender BLOB,
    content BLOB,
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
app.get('/review',authenticate, (req, res) => {
    db.get('SELECT * FROM reports ORDER BY id LIMIT 1', [], (err, report) => {
        if (err) {
            return res.status(500).send('Error fetching reports');
        }
        if (!report) {
            return res.send('<h1>No reports to review</h1>');
        }
        var tmp = helpers.decodeField(report.content)
        console.log(tmp);
        let html = `<h1>Review Report</h1>
            <div>
                <p><strong>Sender:</strong> ${helpers.doReplacements(helpers.getText(report.sender))}</p>
                <p><strong>Content:</strong> ${helpers.getText(report.content)}</p>
                <p><strong>Type:</strong> ${report.type}</p>
                <p><strong>Reason:</strong> ${report.reason}</p>
                <p><strong>Suggested:</strong> ${report.suggested_classification}</p>
                <form action="/accept" method="POST">
                    <input type="hidden" name="id" value="${report.id}" />
                    <input type="hidden" name="category" value="${report.suggested_classification}" />
                    <input type="hidden" name="channel" value="${report.type}" />
                    <input type="hidden" name="text" value="${helpers.getText(report.content)}" />
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
app.post('/accept',authenticate, (req, res) => {
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
app.post('/reject',authenticate, (req, res) => {
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
