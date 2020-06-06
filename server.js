const sulla = require('sulla');

var server;

const send = (type, message, data) => {
    data = data ? data : {};
    process.send({ type, message, data })
}

process.on('message', (msg) => {
    const { cmd, data } = msg;
    if (cmd === 'create-bot') {
        const { name, attempt } = data;
        startServer(name, attempt);
    } else if (cmd === 'send-text') {
        const { to, text } = data;
        send('log', `Sending Message to ${to}`);
        server.sendText(to, text);
    }
});

const startServer = async (name, attempt) => {
    let counter = 1;
    let authPassed = false;
    attempt = attempt ? attempt : 3;
    setTimeout(
        () => {
            console.log('authPassed', authPassed);
            if (!authPassed) send('error', 'Starting Bot Timeout');
        }, 90000
    );
    sulla.create(name, (base64Qr) => {
        if (counter <= attempt) {
            send('log', `Sending QR (${counter})`, { qr: base64Qr });
            counter++;
        } else {
            send('error', 'QR Auth Not Scanned');
        }
    }, {logQR: false}).then(
        (wa) => {
            authPassed = true;
            server = wa;
            send('log', 'Whatsapp Authenticated!', { connected: true });
            server.onMessage((serverMessage) => {
                messageHandler(serverMessage);
            });
        
            // In case of being logged out of whatsapp web
            // Force it to keep the current session
            // State change
            server.onStateChange((state) => {
                send('log', `Session: ${state}`);
                const conflits = [
                    sulla.SocketState.CONFLICT,
                    sulla.SocketState.UNPAIRED,
                    sulla.SocketState.UNLAUNCHED,
                ];
                if (conflits.includes(state)) {
                    server.useHere();
                }
            });
        },
        (err) => {
            send('error', err);
        }
    );
}
const restartServer = (server, from) => {
    if (from) { server.sendText(from, 'Merestart ulang server...')};
    send('log', `Restarting Server...`);
    server.close().catch((err) => console.log(err));
    startServer('server');
}

const messageHandler = async (serverMessage) => {
    const { type, body, from, t, sender, isGroupMsg, chat } = serverMessage;
    const { id, pushname } = sender;
    const { name } = chat;
    const commands = [
        '#getId', '#getAdmins', '#getSessions', '#addAdmin',
        '#createBot', '#restartServer'
    ];
    const cmds = commands.map(x => x + '\\b').join('|');
    let cmd = body.match(new RegExp(cmds, 'gi'));
    if (cmd) {
        send('log', `[EXEC] ${cmd[0]} from ${pushname}`);
        const args = body.trim().split(' ');
        switch (cmd[0]) {
            case '#getId':
                server.sendText(from, from);
            break;
            case '#getAdmins':
                const admins = db.get('admins').value();
                console.log(admins);
            break;
            case '#getSessions':
                const sessions = Object.keys(wa);
                console.log(sessions);
                server.sendText(from, 'Sesi Aktif:\n\n' + sessions.join('\n'));
            break;
            case '#addAdmin':
                if (!isGroupMsg) {
                    db.get('admins').push({id: from, name: pushname}).write()
                    server.sendText(from, 'Anda sekarang admin!');
                }
            break;
            case '#createBot':
                if (!isGroupMsg && args.length===2) {
                    const id = args[1];
                    createClient(id, server, from);
                } else {
                    server.sendText(from, 'Contoh perintah: *#createBot hp-update*');
                }
            break;
            case '#restartServer':
                if (!isGroupMsg && args.length===2) {
                    if (args[1] === 'yes') restartServer(server, from);;
                } else {
                    server.sendText(from, '*#restartServer yes* untuk merestart server.\n(!) SEMUA CLIENT JUGA AKAN DIRESET (!)');
                }
            break;
        }
    } else {
        send('log', `[RECV] Message from ${pushname}`);
    }
}

const color = (text, color) => {
    switch (color) {
      case 'red': return '\x1b[31m' + text + '\x1b[0m'
      case 'yellow': return '\x1b[33m' + text + '\x1b[0m'
      default: return '\x1b[32m' + text + '\x1b[0m' // default is green
    }
}