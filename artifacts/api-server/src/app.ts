import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

app.use("/api", router);
// @ts-ignore
const backendAppPromise = import("../../../backend/src/app.js").then((m) => m.default);
app.use(async (req, res, next) => {
  try {
    const backendApp = await backendAppPromise;
    return backendApp(req, res, next);
  } catch (err) {
    return next(err);
  }
});

export default app;
