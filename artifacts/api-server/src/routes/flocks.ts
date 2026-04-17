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

function serializeFlock(f: any) {
  return {
    ...f,
    birthDate: f.birthDate ?? null,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
  };
}

router.get("/flocks", async (req, res) => {
  const flocks = await db.select().from(flocksTable).orderBy(flocksTable.createdAt);
  res.json(flocks.map(serializeFlock));
});

router.post("/flocks", async (req, res) => {
  const body = CreateFlockBody.parse(req.body);
  const birthDate = typeof req.body.birthDate === "string" && req.body.birthDate ? req.body.birthDate : null;
  const [flock] = await db.insert(flocksTable).values({ ...body, birthDate }).returning();
  res.status(201).json(serializeFlock(flock));
});

router.get("/flocks/:id", async (req, res) => {
  const { id } = GetFlockParams.parse({ id: Number(req.params.id) });
  const [flock] = await db.select().from(flocksTable).where(eq(flocksTable.id, id));
  if (!flock) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeFlock(flock));
});

router.put("/flocks/:id", async (req, res) => {
  const { id } = UpdateFlockParams.parse({ id: Number(req.params.id) });
  const body = UpdateFlockBody.parse(req.body);
  const birthDate = typeof req.body.birthDate === "string" && req.body.birthDate ? req.body.birthDate : undefined;
  const updateData: any = { ...body };
  if (birthDate !== undefined) updateData.birthDate = birthDate;
  const [flock] = await db.update(flocksTable).set(updateData).where(eq(flocksTable.id, id)).returning();
  if (!flock) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeFlock(flock));
});

router.delete("/flocks/:id", async (req, res) => {
  const { id } = DeleteFlockParams.parse({ id: Number(req.params.id) });
  await db.delete(flocksTable).where(eq(flocksTable.id, id));
  res.status(204).send();
});

export default router;
