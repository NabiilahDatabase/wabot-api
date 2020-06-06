const { GraphQLServer, PubSub } = require('graphql-yoga');
const fs = require('fs-extra');
const typeDefs = require('./graphql.typedef');
const { resolvers, startBot } = require('./graphql.resolver');
const pubsub = new PubSub();
const server  = new GraphQLServer({
    typeDefs, resolvers,
    context: { pubsub }
});

startBot(pubsub, 'server', 3);

server.start({port: 3000}, ({ port }) => {
    console.log(`Graphql Server started, listening on port ${port} for incoming requests.`);
});
