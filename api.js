const { GraphQLServer, PubSub } = require('graphql-yoga');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const pubsub = new PubSub();
const server  = new GraphQLServer({
    typeDefs, resolvers,
    context: { pubsub }
});

server.start({port: 3000}, ({ port }) => {
    console.log(`Graphql Server started, listening on port ${port} for incoming requests.`);
})