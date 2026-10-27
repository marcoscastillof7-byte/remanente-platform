import serverless from 'serverless-http';
import { app } from '../../server/index.js';

const serverlessHandler = serverless(app);

export const handler = async (event, context) => {
  // Evita que Netlify/Lambda espere a que el event loop se vacíe (evita cuelgues o timeouts por conexiones abiertas)
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }
  return await serverlessHandler(event, context);
};

export default handler;
