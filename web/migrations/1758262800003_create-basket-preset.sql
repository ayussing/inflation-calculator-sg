-- Up Migration
CREATE TABLE basket_preset (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  income_group text NOT NULL,
  source_year smallint NOT NULL,
  CONSTRAINT basket_preset_name_key UNIQUE (name)
);

-- Down Migration
DROP TABLE IF EXISTS basket_preset;
