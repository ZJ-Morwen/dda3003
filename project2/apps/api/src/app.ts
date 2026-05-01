import Fastify from "fastify";
import cors from "@fastify/cors";

import {
  getDashboardSnapshot,
  getEnvironmentLayer,
  getEnvironmentWeights,
  getMetaLatestDate,
  getPortFlows,
  getPortFlowVoyages,
  getScatter,
  getVoyageEmissionSeries,
  getVoyageMetrics,
  getVoyageRoute,
  recordAnimationCheck
} from "./services/data-store.js";

function notFound(reply: { code: (statusCode: number) => { send: (payload: unknown) => void } }, message: string): void {
  reply.code(404).send({
    code: "VOYAGE_NOT_FOUND",
    message
  });
}

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  await app.register(cors, {
    origin: true
  });

  app.get("/api/meta/data-latest-date", async () => getMetaLatestDate());

  app.get("/api/dashboard/snapshot", async (request) => {
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string };
    return getDashboardSnapshot(query.startTs ?? query.startDate, query.endTs ?? query.endDate);
  });

  app.get("/api/voyages/emissions-scatter", async (request) => {
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string };
    return getScatter(query.startTs ?? query.startDate, query.endTs ?? query.endDate);
  });

  app.get("/api/voyages/:voyageId/route", async (request, reply) => {
    const params = request.params as { voyageId: string };
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string; ts?: string };
    const payload = await getVoyageRoute(params.voyageId, query.startTs ?? query.startDate, query.endTs ?? query.endDate, query.ts);
    if (!payload) {
      notFound(reply, "航次不存在或当前时间范围无航线数据。");
      return;
    }
    return payload;
  });

  app.get("/api/voyages/:voyageId/emission-series", async (request, reply) => {
    const params = request.params as { voyageId: string };
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string };
    const payload = await getVoyageEmissionSeries(params.voyageId, query.startTs ?? query.startDate, query.endTs ?? query.endDate);
    if (!payload) {
      notFound(reply, "航次不存在或当前时间范围无排放数据。");
      return;
    }
    return payload;
  });

  app.get("/api/voyages/:voyageId/metrics", async (request, reply) => {
    const params = request.params as { voyageId: string };
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string };
    const payload = await getVoyageMetrics(params.voyageId, query.startTs ?? query.startDate, query.endTs ?? query.endDate);
    if (!payload) {
      notFound(reply, "航次不存在或当前时间范围无指标数据。");
      return;
    }
    return payload;
  });

  app.get("/api/port-flows", async (request) => {
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string };
    return getPortFlows(query.startTs ?? query.startDate, query.endTs ?? query.endDate);
  });

  app.get("/api/port-flows/:source/:target/voyages", async (request) => {
    const params = request.params as { source: string; target: string };
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string };
    return getPortFlowVoyages(params.source, params.target, query.startTs ?? query.startDate, query.endTs ?? query.endDate);
  });

  app.get("/api/environment/weights", async (request) => {
    const query = request.query as { startDate?: string; endDate?: string; startTs?: string; endTs?: string };
    return getEnvironmentWeights(query.startTs ?? query.startDate, query.endTs ?? query.endDate);
  });

  app.get("/api/environment/layers/:layer", async (request) => {
    const params = request.params as { layer: "wind" | "current" | "wave" };
    const query = request.query as { ts?: string };
    const ts = query.ts ?? `${new Date().toISOString().slice(0, 10)}T12:00:00+08:00`;
    return getEnvironmentLayer(params.layer, ts);
  });

  app.post("/api/diagnostics/animation-check", async (request, reply) => {
    await recordAnimationCheck(request.body as Record<string, unknown>);
    reply.code(204).send();
  });

  return app;
}
