const typeDefs = `
type Query {
    getLogs: [Logs!]!
    clearLogs: String!
}
type Logs {
    time: Int!,
    type: String!,
    desc: String!,
}
type Mutation{
    startBot(
        name: String!,
        attempt: Int
    ): String!
}
type Subscription {
    logs: [Logs!]!,
    qr: String!
}

`;

module.exports = typeDefs;
