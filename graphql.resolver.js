const { fork } = require('child_process');
const fs = require('fs-extra');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const dbLogs = low(new FileSync('./db.logs.json'));
const dbGroup = low(new FileSync('./db.groups.json'));
dbLogs.defaults({ logs: [] }).write();

var server;
var pubsub;
var state = 'inactive';

const initBot = async (pubSub, type) => {
    try {
        pubsub = pubSub;
        await startServer(type);
    } catch (err) {
        console.log(err);
    }
}

const log = async (from, desc) => {
    const time = Math.floor(Date.now() / 1000);
    from = from.toUpperCase();
    await dbLogs.get('logs').push({from, time, desc}).write();
    const logs = await dbLogs.get('logs').value();
    pubsub.publish('logs', {logs: logs});
    console.log('\x1b[32m' + from + '\x1b[0m', time, desc);
}
const changeState = (s) => {
    state = s;
    pubsub.publish('state', {state: s});
}

const startServer = async (type) => {
    server = fork('server.js');
    changeState('auth');
    log(type, `Starting ${type}`);
    
    server.send({ cmd: 'start-server' });

    return new Promise((resolve, reject) => {
        server.on('message', (response) => {
            const { type, message, data } = response;
            if (type !== 'error') {
                log(type, message);
                if (type === 'auth') {
                    const { qr, connected } = data;
                    if (qr) { pubsub.publish('qr', {qr}); }
                    if (connected) {
                        changeState('active');
                        log(type, `Bot ${type} Started!`);
                        resolve('ok');
                    }
                }
                if (type === 'clearLog') {
                    dbLogs.get('logs').remove().write();
                }
            } else {
                if (server) {
                    server.kill();
                    server = null;
                }
                changeState('inactive');
                log(type, `Starting Bot ${type} canceled`);
                resolve(message);
            }
        });
    });
}

const resolvers = {
    Query: {
        stopServer(perent, args, { pubsub }) {
            if (state === 'active') {
                server.kill();
                server = null;
                changeState('inactive');
                log('server', `Bot Server Stopped!`);
                return 'ok';
            } else {
                log('server', `Bot Server is Inactive!`);
                return 'bot inactive';
            }
        },
        getState(perent, args, { pubsub }) {
            pubsub.publish('state', {state: state});
            return state;
        },
        async getLogs(perent, args, { pubsub }) {
            const logs = await dbLogs.get('logs').value();
            pubsub.publish('logs', {logs: logs});
            const exist = logs ? true : false;
            return exist;
        },
        clearLog(perent, args, { pubsub }) {
            dbLogs.get('logs').remove().write();
            log('server', `Server Log Cleared!`);
            return 'ok';
        }
    },

    Mutation: {
        async startBot(parent, args, { pubsub }) {
            const name = args.name;
            const restart = args.restart;
            await dbLogs.get('logs').remove().write();
            if (['node_modules'].includes(name)) {
                return 'nama bot dilarang';
            }
            if (restart) {
                if (await fs.pathExists(`./${name}`)) {
                    fs.remove(`./${name}`);
                }
                log(name, `Redeploy Bot ${name}!`);
            }
            return await startServer(name);
        },
        async sendText(perent, args, { pubsub }) {
            if (state === 'active') {
                server.send({
                    cmd: 'send-text',
                    data: { to: args.to, text: args.text }
                });
                return 'ok';
            } else {
                return 'bot inactive';
            }
        },
        async addAdmin(perent, args, { pubsub }) {
            if (state === 'active') {
                const groups = dbGroup.get('groups').value();
                const childs = groups.flatMap(g => g.childs);
                await server.addParticipant(groups[0].id, args.hp + '@c.us');
                log('server', `${args.hp} added as admin!`);
                return 'ok';
            } else {
                return 'bot inactive';
            }
        }
    },

    Subscription: {
        logs: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('logs'); } },
        qr: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('qr'); } },
        state: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('state'); } }
    },
};

module.exports.resolvers = resolvers;
module.exports.dbLogs = dbLogs;
module.exports.log = log;
module.exports.initBot = initBot;