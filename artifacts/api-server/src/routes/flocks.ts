import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, flocksTable } from "@workspace/db";
import {
  CreateFlockBody,
  UpdateFlockBody,
  GetFlockParams,
  UpdateFlockParams,
  DeleteFlockParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/flocks", async (req, res) => {
  const flocks = await db.select().from(flocksTable).orderBy(flocksTable.createdAt);
  res.json(flocks.map(f => ({
    ...f,
    ageWeeks: f.ageWeeks,
    createdAt: f.createdAt.toISOString(),
  })));
});

router.post("/flocks", async (req, res) => {
  const body = CreateFlockBody.parse(req.body);
  const [flock] = await db.insert(flocksTable).values(body).returning();
  res.status(201).json({ ...flock, createdAt: flock.createdAt.toISOString() });
});

router.get("/flocks/:id", async (req, res) => {
  const { id } = GetFlockParams.parse({ id: Number(req.params.id) });
  const [flock] = await db.select().from(flocksTable).where(eq(flocksTable.id, id));
  if (!flock) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...flock, createdAt: flock.createdAt.toISOString() });
});

router.put("/flocks/:id", async (req, res) => {
  const { id } = UpdateFlockParams.parse({ id: Number(req.params.id) });
  const body = UpdateFlockBody.parse(req.body);
  const [flock] = await db.update(flocksTable).set(body).where(eq(flocksTable.id, id)).returning();
  if (!flock) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...flock, createdAt: flock.createdAt.toISOString() });
});

router.delete("/flocks/:id", async (req, res) => {
  const { id } = DeleteFlockParams.parse({ id: Number(req.params.id) });
  await db.delete(flocksTable).where(eq(flocksTable.id, id));
  res.status(204).send();
});

export default router;
