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

const initBot = async (pubSub) => {
    try {
        pubsub = pubSub;
        await startServer();
    } catch (err) {
        console.log(err);
    }
}

const log = async (from, desc) => {
    const time = Math.floor(Date.now() / 1000);
    await dbLogs.get('logs').push({from, time, desc}).write();
    const logs = await dbLogs.get('logs').value();
    pubsub.publish('logs', {logs: logs});
    console.log('\x1b[32m' + from + '\x1b[0m', time, desc);
}
const changeState = (s) => {
    state = s;
    pubsub.publish('state', {state: s});
}

const startServer = async () => {
    server = fork('server.js');
    changeState('auth');
    log('SERVER', `Starting Server`);
    
    server.send({ cmd: 'start-server' });

    return new Promise((resolve, reject) => {
        server.on('message', (response) => {
            const { type, message, data } = response;
            if (type !== 'error') {
                log('SERVER', message);
                if (type === 'auth') {
                    const { qr, connected } = data;
                    if (qr) { pubsub.publish('qr', {qr}); }
                    if (connected) {
                        changeState('active');
                        log('SERVER', `Bot Server Started!`);
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
                log('SERVER', `Starting Bot Server canceled`);
                resolve(message);
            }
        });
    });
}

const resolvers = {
    Query: {
        async startServer(perent, args, { pubsub }) {
            await dbLogs.get('logs').remove().write();
            return await startServer();
        },
        stopServer(perent, args, { pubsub }) {
            if (state === 'active') {
                server.kill();
                server = null;
                changeState('inactive');
                log('SERVER', `Bot Server Stopped!`);
                return 'ok';
            } else {
                log('SERVER', `Bot Server is Inactive!`);
                return 'bot inactive';
            }
        },
        async redeployServer(perent, args, { pubsub }) {
            if (await fs.pathExists(`./server`)) {
                fs.remove(`./server`);
            }
            log('SERVER', `Redeploy Bot server!`);
            return await startServer();
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
            log('SERVER', `Server Log Cleared!`);
            return 'ok';
        }
    },

    Mutation: {
        async startBot(parent, args, { pubsub }) {
            const name = args.name;
            const attempt = args.attempt;
            if (['node_modules', 'server'].includes(name)) {
                return 'nama bot dilarang';
            }
            return await startServer(name, attempt);
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
                log('SERVER', `${args.hp} added as admin!`);
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