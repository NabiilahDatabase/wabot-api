const typeDefs = `
type Query {
    startServer: String!,
    stopServer: String!,
    redeployServer: String!,
    getState: String!,
    getLogs: Boolean!,
    clearLog: String!,
}
type Logs {
    from: String!,
    time: Int!,
    desc: String!,
}
type Mutation{
    startBot(
        name: String!,
        attempt: Int
    ): String!,
    sendText(
        to: String!,
        text: String!,
    ): String!,
    addAdmin(
        hp: String!
    ): String!
}
type Subscription {
    logs: [Logs!]!,
    qr: String!,
    state: String!
}
`;

module.exports = typeDefs;