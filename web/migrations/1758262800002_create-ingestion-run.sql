-- Up Migration
CREATE TABLE ingestion_run (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed')),
  rows_upserted integer NOT NULL DEFAULT 0 CHECK (rows_upserted >= 0),
  error text
);

-- Down Migration
DROP TABLE IF EXISTS ingestion_run;
