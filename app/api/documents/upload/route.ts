export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { processDocument } from "@/lib/services/documentProcessor";
import { embedAndStoreDocument } from "@/lib/services/embeddingIngest";
import { findAndStoreRelatedDocuments } from "@/lib/services/institutionalMemory";


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file uploaded",
        },
        { status: 400 }
      );
    }

    const fileName = `${Date.now()}-${file.name}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

  

    // Upload to Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from("documents")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
      });

    if (error) {
      console.error("========== SUPABASE STORAGE ERROR ==========");
      console.error(error);
      console.error("===========================================");

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Run Gemini AI analysis
    const aiResult = await processDocument(file);

    const { data: documentRow, error: documentError } =
      await supabaseAdmin
        .from("documents")
        .insert({
          file_name: fileName,
          file_url: data.publicUrl,
          doc_type: aiResult.doc_type,
          summary: aiResult.summary,
          raw_text: aiResult.raw_text ?? null,
        })
        .select()
        .single();

    if (documentError) {
      throw documentError;
    }
    await embedAndStoreDocument(documentRow.id, aiResult.raw_text ?? "");
    await findAndStoreRelatedDocuments(documentRow.id, aiResult.summary ?? "");

    if (aiResult.entities.length > 0) {
      const entities = aiResult.entities.map(
        (entity: {
          type: string;
          value: string;
          context: string;
        }) => ({
          document_id: documentRow.id,
          entity_type: entity.type,
          entity_value: entity.value,
          context: entity.context,
        })
      );

      const { error: entityError } =
        await supabaseAdmin
          .from("entities")
          .insert(entities);

      if (entityError) {
        throw entityError;
      }
    }

    if (aiResult.flags.length > 0) {
      const flags = aiResult.flags.map(
        (flag: {
          type: string;
          description: string;
          severity: string;
        }) => ({
          document_id: documentRow.id,
          flag_type: flag.type,
          description: flag.description,
          severity: flag.severity,
        })
      );

      const { error: flagError } =
        await supabaseAdmin
          .from("flags")
          .insert(flags);

      if (flagError) {
        throw flagError;
      }
    }

    return NextResponse.json({
      success: true,
      fileName,
      publicUrl: data.publicUrl,
      ai: aiResult,
    });
  } catch (err: unknown) {
    console.error("========== SERVER ERROR ==========");
    console.error(err);
    console.error("=================================");

    const message =
      err instanceof Error ? err.message : "Upload failed";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}