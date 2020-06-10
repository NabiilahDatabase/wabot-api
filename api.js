const { GraphQLServer, PubSub } = require('graphql-yoga');
const typeDefs = require('./graphql.typedef');
const { resolvers, initBot } = require('./graphql.resolver');
const fs = require('fs-extra');
const pubsub = new PubSub();
const server  = new GraphQLServer({
    typeDefs, resolvers,
    context: { pubsub }
});

initBot(pubsub);

server.start({port: 3000}, ({ port }) => {
    console.log(`Graphql Server started, listening on port ${port} for incoming requests.`);
});
