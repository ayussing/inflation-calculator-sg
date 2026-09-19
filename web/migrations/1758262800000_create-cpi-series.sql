-- Up Migration
CREATE TABLE cpi_series (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  level smallint NOT NULL CHECK (level >= 0),
  parent_id integer REFERENCES cpi_series (id) ON DELETE RESTRICT,
  base_year smallint NOT NULL,
  CONSTRAINT cpi_series_code_key UNIQUE (code)
);

CREATE INDEX cpi_series_parent_id_idx ON cpi_series (parent_id);

-- Down Migration
DROP TABLE IF EXISTS cpi_series;
