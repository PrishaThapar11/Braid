-- Run this in the Supabase SQL Editor, then paste it into schema.sql too.
-- Approximate-nearest-neighbour index so match_document_chunks() does not
-- scan every chunk. vector_cosine_ops matches the <=> (cosine) operator the
-- function orders by.
create index if not exists document_chunks_embedding_hnsw_idx
  on document_chunks
  using hnsw (embedding vector_cosine_ops);

-- To measure before/after (run once BEFORE creating the index, once after;
-- use a real 768-dim vector or the same query your app sends):
--   explain analyze
--   select id from document_chunks
--   order by embedding <=> (select embedding from document_chunks limit 1)
--   limit 10;
-- Compare "Execution Time" and whether the plan says Seq Scan or Index Scan.
