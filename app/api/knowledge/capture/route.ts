export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { processTextDocument } from "@/lib/services/textProcessor";
import { embedAndStoreDocument } from "@/lib/services/embeddingIngest";
import { findAndStoreRelatedDocuments } from "@/lib/services/institutionalMemory";

export async function POST(request: NextRequest) {
  try {
    const { text, equipment_hint } = await request.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required." },
        { status: 400 }
      );
    }

    const aiResult = await processTextDocument(
      equipment_hint ? `Equipment: ${equipment_hint}\n\n${text}` : text
    );

    const fileName = `tacit-knowledge-${Date.now()}`;

    const { data: documentRow, error: documentError } = await supabaseAdmin
      .from("documents")
      .insert({
        file_name: fileName,
        file_url: "", // no file exists — this was captured as text, not uploaded
        doc_type: "tacit_knowledge",
        summary: aiResult.summary,
        raw_text: text, // store the engineer's original words, unmodified
      })
      .select()
      .single();

    if (documentError) throw documentError;

    await embedAndStoreDocument(documentRow.id, text);
    await findAndStoreRelatedDocuments(documentRow.id, aiResult.summary ?? "");

    if (aiResult.entities && aiResult.entities.length > 0) {
      const entities = aiResult.entities.map(
        (entity: { type: string; value: string; context: string }) => ({
          document_id: documentRow.id,
          entity_type: entity.type,
          entity_value: entity.value,
          context: entity.context,
        })
      );

      const { error: entityError } = await supabaseAdmin
        .from("entities")
        .insert(entities);

      if (entityError) throw entityError;
    }

    if (aiResult.flags && aiResult.flags.length > 0) {
      const flags = aiResult.flags.map(
        (flag: { type: string; description: string; severity: string }) => ({
          document_id: documentRow.id,
          flag_type: flag.type,
          description: flag.description,
          severity: flag.severity,
        })
      );

      const { error: flagError } = await supabaseAdmin
        .from("flags")
        .insert(flags);

      if (flagError) throw flagError;
    }

    return NextResponse.json({
      id: documentRow.id,
      summary: aiResult.summary,
      entities: aiResult.entities ?? [],
    });
  } catch (err: unknown) {
    console.error("========== KNOWLEDGE CAPTURE ERROR ==========");
    console.error(err);
    console.error("==============================================");

    const message =
      err instanceof Error ? err.message : "Knowledge capture failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}