import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { DecideRequestSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const parsed = DecideRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid request shape",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { action, context, forcedFailure, mock, scenarioId } = parsed.data;

  try {
    const trace = await runPipeline(action, context, {
      forcedFailure,
      mock: mock === true,
    });
    return NextResponse.json({ ...trace, scenarioId });
  } catch (e: any) {
    return NextResponse.json(
      { error: "pipeline error", message: e?.message ?? "unknown" },
      { status: 500 },
    );
  }
}
