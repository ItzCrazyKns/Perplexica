import { initServer } from "./websocketServer";
import http from "node:http";

export const startWebSocketServer = (server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>) => {
  initServer(server);
};
