const fs = require('fs');
const path = require('path');
const https = require('https');

const libs = [
    {
        name: 'mammoth.browser.min.js',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
    },
    {
        name: 'dexie.min.js',
        url: 'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js'
    }
];

const destDir = path.join(__dirname, '../frontend/js/lib');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

libs.forEach(lib => {
    const file = fs.createWriteStream(path.join(destDir, lib.name));
    console.log(`Downloading ${lib.name}...`);
    https.get(lib.url, function(response) {
        response.pipe(file);
        file.on('finish', function() {
            file.close(() => {
                console.log(`${lib.name} downloaded.`);
            });
        });
    }).on('error', function(err) {
        fs.unlink(path.join(destDir, lib.name));
        console.error(`Error downloading ${lib.name}: ${err.message}`);
    });
});
