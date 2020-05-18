const sulla = require('sulla');

process.on('message', async (msg) => {
    const { cmd, data } = msg;
    const { name, attempt } = data;
    if (cmd === 'create-bot') {
        let counter = 1;
        sulla.create(name, async (base64Qr) => {
            if (counter <= attempt) {
                process.send({ error: false, message: `sending qr (${counter})`, data: { qr: base64Qr }});
                counter++;
            } else {
                process.send({ error: true, message: 'qr auth not scanned'});
            }
        }, {logQR: false}).then(
            (server) => {
                process.send({ error: false, data: { server, name }});
            },
            (err) => {
                process.send({ error: true, message: err});
            }
        );
    }
});