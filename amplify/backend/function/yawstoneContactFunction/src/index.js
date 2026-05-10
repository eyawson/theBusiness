const awsServerlessExpress = require('aws-serverless-express');
const app = require('./app');

const server = awsServerlessExpress.createServer(app);

exports.handler = (event, context) => {
  const ctx = (event && event.requestContext) || {};
  const identity = ctx.identity || {};
  console.log('REQ', {
    requestId: ctx.requestId,
    method: event && event.httpMethod,
    path: event && event.path,
    sourceIp: identity.sourceIp,
    bytes: event && event.body ? event.body.length : 0,
  });
  return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};
