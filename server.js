const venom = require('venom-bot');
const fs = require('fs-extra');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const dbGroup = low(new FileSync('./db.groups.json'));
dbGroup.defaults({ groups: [] }).write();
var CronJob = require('cron').CronJob;

var server;

const send = (type, message, data) => {
    data = data ? data : {};
    process.send({ type, message, data })
}

process.on('message', (msg) => {
    const { cmd, data } = msg;
    if (cmd === 'start-server') {
        startBot('server', 3);
    } else if (cmd === 'create-bot') {
        const { name, attempt } = data;
        startBot(name, attempt);
    } else if (cmd === 'send-text') {
        const { to, text } = data;
        send('log', `Sending Message to ${to}`);
        server.sendText(to, text);
    }
});

const startBot = async (name, attempt) => {

    const cacheExists = await fs.pathExists(`./${name}`);
    if (cacheExists) {
        fs.remove(`./${name}/Default/Service Worker/Database/MANIFEST-000001`);
    }

    let counter = 1;
    let authPassed = false;
    attempt = attempt ? attempt : 3;
    setTimeout(() => {
        if (!authPassed) send('error', 'Starting Bot Timeout');
    }, 30000 * attempt);

    venom.create(name,
    (base64Qr) => {
        if (counter <= attempt) {
            send('auth', `Sending QR [${counter}]`, { qr: base64Qr });
            counter++;
        } else {
            send('error', 'QR Auth Not Scanned');
        }
    }, (logInStatus) => { console.log(logInStatus);
    }, {logQR: false}).then(
        (wa) => {
            authPassed = true;
            server = wa;
            send('auth', 'Whatsapp Authenticated!', { connected: true });
            server.onMessage((serverMessage) => {
                messageHandler(serverMessage);
            });
            server.onStateChange((state) => {
                send('log', `Session: ${state}`);
                const conflits = [
                    venom.SocketState.CONFLICT,
                    venom.SocketState.UNPAIRED,
                    venom.SocketState.UNLAUNCHED,
                ];
                if (conflits.includes(state)) {
                    server.useHere();
                }
            });
        },
        (err) => {
            console.log('VENOM ERROR: ', err);
            send('error', err);
        }
    );
}
const restartServer = (server, from) => {
    if (from) { server.sendText(from, 'Merestart ulang server...')};
    send('log', `Restarting Server...`);
    server.close().catch((err) => console.log(err));
    startBot('server');
}

var job = new CronJob('0 0 0 * * *', restartServer);
job.start();

const messageHandler = async (serverMessage) => {
    const { type, body, from, t, sender, isGroupMsg, chat } = serverMessage;
    const { id, pushname } = sender;
    const { name } = chat;

    const commands = ['#getId', '#getAdmins', '#getSessions', '#addAdmin', '#createBot', '#restartServer'];
    const cmds = commands.map(x => x + '\\b').join('|');
    let cmd = body.match(new RegExp(cmds, 'gi'));
    if (cmd) {
        send('log', `[EXEC] ${cmd[0]} from ${pushname}`);
        const args = body.trim().split(' ');
        switch (cmd[0]) {
            case '#getId':
                server.sendText(from, from);
            break;
            // case '#getSessions':
            //     const sessions = Object.keys(wa);
            //     console.log(sessions);
            //     server.sendText(from, 'Sesi Aktif:\n\n' + sessions.join('\n'));
            // break;
            // case '#createBot':
            //     if (!isGroupMsg && args.length===2) {
            //         const id = args[1];
            //         createClient(id, server, from);
            //     } else {
            //         server.sendText(from, 'Contoh perintah: *#createBot hp-update*');
            //     }
            // break;
            // case '#getAdmins':
            //     const admins = db.get('admins').value();
            //     console.log(admins);
            // break;
            // case '#addAdmin':
            //     if (!isGroupMsg) {
            //         db.get('admins').push({id: from, name: pushname}).write()
            //         server.sendText(from, 'Anda sekarang admin!');
            //     }
            // break;
            // case '#restartServer':
            //     if (!isGroupMsg && args.length===2) {
            //         if (args[1] === 'yes') restartServer(server, from);;
            //     } else {
            //         server.sendText(from, '*#restartServer yes* untuk merestart server.\n(!) SEMUA CLIENT JUGA AKAN DIRESET (!)');
            //     }
            // break;
        }
    } else {
        const ty = isGroupMsg ? 'Group' : 'Private';
        // send('log', `[RECV] ${ty} Message from ${from}`);

        const { motherIndex, isMotherGroup, isChildGroup } = checkGroup(from);
        if (isGroupMsg && isMotherGroup) {
            const groups = dbGroup.get('groups').value();
            const g = groups[motherIndex];
            send('clearLog', `Clearing Logs`);
            send('log', `[EXEC] Broadcast from ${g.name}`);
            g.childs.forEach(child => {
                server.forwardMessages(child.id, serverMessage);
                send('log', `[SEND] Message to ${child.name}`);
            });
        }
    }
}

const checkGroup = (groupID) => {
  const groups = dbGroup.get('groups').value();
  const motherIndex = groups.findIndex(g => g.id === groupID);
  const isMotherGroup = (motherIndex !== -1);
  const isChildGroup = groups.flatMap(g => g.childs).map(c => c.id).includes(groupID);
  return { motherIndex, isMotherGroup, isChildGroup };
}
const color = (text, color) => {
    switch (color) {
      case 'red': return '\x1b[31m' + text + '\x1b[0m'
      case 'yellow': return '\x1b[33m' + text + '\x1b[0m'
      default: return '\x1b[32m' + text + '\x1b[0m' // default is green
    }
}
