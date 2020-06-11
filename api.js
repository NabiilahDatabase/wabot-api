const { GraphQLServer, PubSub } = require('graphql-yoga');
const typeDefs = require('./graphql.typedef');
const { resolvers, initBot } = require('./graphql.resolver');
const fs = require('fs-extra');
const pubsub = new PubSub();
const server  = new GraphQLServer({
    typeDefs, resolvers,
    context: { pubsub }
});

const type = process.argv[2] ? `client-${process.argv[2]}` : 'server';
const port = 3000 + (process.argv[2] ? +process.argv[2] : 0);

initBot(pubsub, type);

server.start({port: port}, ({ port }) => {
    console.log(`Graphql ${type} started, listening on port ${port} for incoming requests.`);
});
