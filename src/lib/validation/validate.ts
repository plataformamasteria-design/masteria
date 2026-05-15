import { z } from "zod";
import { NextResponse } from "next/server";

export async function validateBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "Validação falhou",
            issues: result.error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 }
        ),
      };
    }

    return { ok: true, data: result.data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Body inválido (não é JSON)" },
        { status: 400 }
      ),
    };
  }
}
