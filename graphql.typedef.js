const typeDefs = `
type Query {
    getState: String!,
    getLogs: Boolean!,
    stopBot: String!,
    redeployBot: String!
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
    ): String!,
    sendText(
        to: String!,
        text: String!,
    ): String!
}
type Subscription {
    logs: [Logs!]!,
    qr: String!,
    state: String!
}
`;

module.exports = typeDefs;