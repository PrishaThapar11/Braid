export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { gemini } from "@/lib/gemini";
import { generateEmbedding } from "@/lib/services/embeddings";

const CHAT_MODEL = "gemini-3.1-flash-lite";
const MATCH_COUNT = 10;

interface ChunkMatch {
  chunk_id: string;
  document_id: string;
  content: string;
  similarity: number;
}

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json(
        { error: "A question is required." },
        { status: 400 }
      );
    }

    // 1. Embed the question the same way documents were embedded
    const questionEmbedding = await generateEmbedding(question);

    // 2. Find the most relevant chunks via the Postgres function from 4a
    const { data: matches, error: matchError } = await supabaseAdmin.rpc(
      "match_document_chunks",
      {
        query_embedding: questionEmbedding,
        match_count: MATCH_COUNT,
      }
    );

    if (matchError) throw matchError;

    if (!matches || matches.length === 0) {
      return NextResponse.json({
        answer:
          "I couldn't find anything in the uploaded documents relevant to that question.",
        citations: [],
      });
    }

    const typedMatches = matches as ChunkMatch[];

    // 3. Look up file names for the documents these chunks came from
    const documentIds = [...new Set(typedMatches.map((m) => m.document_id))];

    const { data: documents, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, file_name")
      .in("id", documentIds);

    if (docError) throw docError;

    const fileNameById = new Map(
      (documents ?? []).map((d) => [d.id, d.file_name])
    );

    // 4. Build the context block Gemini will answer from
    const contextBlock = typedMatches
      .map(
        (m, i) =>
          `[Source ${i + 1} — ${fileNameById.get(m.document_id) ?? "unknown document"}]\n${m.content}`
      )
      .join("\n\n");

    const prompt = `
You are an industrial knowledge assistant. Answer the engineer's question using
ONLY the source excerpts below. If the answer isn't in these excerpts, say so
clearly instead of guessing.

${contextBlock}

Question: ${question}

Answer:
`;

    // 5. Ask Gemini to answer using only the retrieved context
    const result = await gemini.models.generateContent({
      model: CHAT_MODEL,
      contents: prompt,
    });

    const answer = result.text ?? "No answer was generated.";

    // 6. One citation per unique source document actually used
    const citations = [
      ...new Map(
        typedMatches.map((m) => [
          m.document_id,
          {
            document_id: m.document_id,
            file_name: fileNameById.get(m.document_id) ?? "unknown document",
            excerpt: m.content.slice(0, 200),
          },
        ])
      ).values(),
    ];

    return NextResponse.json({ answer, citations });
  } catch (err: unknown) {
    console.error("========== CHAT ERROR ==========");
    console.error(err);
    console.error("=================================");

    const message = err instanceof Error ? err.message : "Chat failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}