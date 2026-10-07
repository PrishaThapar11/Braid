-- This file is a saved record of database objects created directly in the
-- Supabase SQL Editor. It is NOT run automatically — there are no real
-- migrations set up for this hackathon project. If you're setting up a fresh
-- Supabase project, copy each block below into the SQL Editor and run it
-- manually, in order.

-- Vector similarity search function used by /api/chat to find the most
-- relevant document chunks for a given question.
create or replace function match_document_chunks(
  query_embedding vector(768),
  match_count int default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id as chunk_id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

   -- Approximate-nearest-neighbour index so match_document_chunks() does not
   -- scan every chunk. vector_cosine_ops matches the <=> (cosine) operator
   -- the function orders by.
   create index if not exists document_chunks_embedding_hnsw_idx
     on document_chunks
     using hnsw (embedding vector_cosine_ops);