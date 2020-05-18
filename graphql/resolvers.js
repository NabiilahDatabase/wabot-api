const sulla = require('sulla');
const fs = require('fs-extra');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const db = low(new FileSync('../functions/logs.json'));
db.defaults({ logs: [], sessions: [] }).write();

const { fork } = require('child_process');

var wa = [];

const log = async (pubsub, type, desc) => {
    const time = Math.floor(Date.now() / 1000);
    console.log(type, time, desc);
    await db.get('logs').push({type, time, desc}).write();
    const logs = await db.get('logs').value();
    pubsub.publish('logs', {logs: logs});
}

const resolvers = {
    Query: {
        getLogs(parent, args, { pubsub }) {
            const logs = db.get('logs').value();
            pubsub.publish('logs', {logs: logs});
            return logs;
        },
        clearLogs(parent, args, { pubsub }) {
            const logs = db.get('logs').remove().write();
            pubsub.publish('logs', {logs: logs});
            return 'ok';
        }
    },

    Mutation: {
        async startBot(parent, args, { pubsub }) {
            const server = fork('functions/server.js');
            const name = args.name;
            const attempt = args.attempt ? args.attempt : 3;
            if (['node_modules','graphql','functions'].includes(name)) {
                return 'nama bot dilarang';
            }

            const serverExists = await fs.pathExists(`./${name}`);
            if (serverExists) { fs.remove(`./${name}/Default/Service Worker/Database/MANIFEST-000001`); }

            log(pubsub, 'SERVER', `Creating Bot ${name}`);
            server.send({
                cmd: 'create-bot',
                data: { name, attempt }
            });
            return new Promise((resolve, reject) => {
                server.on('message', (msg) => {
                    const { error, message, data } = msg;
                    if (!error) {
                        const { qr, server, name } = data;
                        log(pubsub, 'SERVER', message);
                        pubsub.publish('qr', {qr});
                        if (server) {
                            log(pubsub, 'SERVER', `Bot ${name} created!`);
                            resolve('ok');
                        }
                    } else {
                        server.kill();
                        log(pubsub, 'SERVER', `Creating Bot ${name} canceled`);
                        resolve(message);
                    }
                });
            })
        }
    },

    Subscription: {
        logs: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('logs'); } },
        qr: { subscribe(parent, args, {pubsub}) { return pubsub.asyncIterator('qr'); } }
    },
};

module.exports = resolvers;
