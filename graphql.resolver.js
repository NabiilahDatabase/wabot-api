const sulla = require('sulla');
const fs = require('fs-extra');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const db = low(new FileSync('./logs.json'));
db.defaults({ logs: [], sessions: [] }).write();

const { fork } = require('child_process');

var server;
var state = 'inactive';

const log = async (pubsub, type, desc) => {
    const time = Math.floor(Date.now() / 1000);
    console.log(type, time, desc);
    await db.get('logs').push({type, time, desc}).write();
    const logs = await db.get('logs').value();
    pubsub.publish('logs', {logs: logs});
}
const changeState = (pubsub, s) => {
    console.log('STATE:', s);
    state = s;
    pubsub.publish('state', {state: s});
}

const startBot = async (pubsub, name, attempt) => {
    if (server) { server.kill(); server = null; console.log('kill server process'); }
    const cacheExists = await fs.pathExists(`./${name}`);
    if (cacheExists) {
        fs.remove(`./${name}/Default/Service Worker/Database/MANIFEST-000001`);
        console.log('clearing cache');
    }
    server = fork('server.js');

    changeState(pubsub, 'auth');
    log(pubsub, 'SERVER', `Starting Bot ${name}`);
    server.send({
        cmd: 'create-bot',
        data: { name, attempt }
    });
    return new Promise((resolve, reject) => {
        server.on('message', (response) => {
            const { type, message, data } = response;
            if (type === 'log') {
                const { qr, connected } = data;
                log(pubsub, 'SERVER', message);
                if (qr) { pubsub.publish('qr', {qr}); }
                if (connected) {
                    changeState(pubsub, 'active');
                    db.get('sessions').push(name).write();
                    log(pubsub, 'SERVER', `Bot ${name} Started!`);
                    resolve('ok');
                }
            } else {
                server.kill();
                server = null;
                changeState(pubsub, 'inactive');
                log(pubsub, 'SERVER', `Starting Bot ${name} canceled`);
                resolve(message);
            }
        });
    });
}

const resolvers = {
    Query: {
        getState(perent, args, { pubsub }) {
            pubsub.publish('state', {state: state});
            return state;
        },
        async getLogs(perent, args, { pubsub }) {
            const logs = await db.get('logs').value();
            pubsub.publish('logs', {logs: logs});
            const exist = logs ? true : false;
            return exist;
        },
        stopBot(perent, args, { pubsub }) {
            if (state === 'active') {
                server.kill();
                server = null;
                changeState(pubsub, 'inactive');
                log(pubsub, 'SERVER', `Bot ${name} Stopped!`);
                return 'ok';
            } else {
                log(pubsub, 'SERVER', `Bot ${name} is Inactive!`);
                return 'bot inactive';
            }
        },
        async redeployBot(perent, args, { pubsub }) {
            if (await fs.pathExists(`./server`)) {
                fs.remove(`./server`);
            }
            log(pubsub, 'SERVER', `Redeploy Bot server!`);
            startBot(pubsub, 'server', 3);
            return 'ok';
        }
    },

    Mutation: {
        async startBot(parent, args, { pubsub }) {
            db.get('logs').remove().write();
            const name = args.name;
            const attempt = args.attempt;
            if (['node_modules'].includes(name)) {
                return 'nama bot dilarang';
            }
            return startBot(pubsub, name, attempt);
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
        }
    },

    Subscription: {
        logs: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('logs'); } },
        qr: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('qr'); } },
        state: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('state'); } }
    },
};

module.exports.resolvers = resolvers;
module.exports.db = db;
module.exports.log = log;
module.exports.startBot = startBot;