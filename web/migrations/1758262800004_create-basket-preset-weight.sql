-- Up Migration
CREATE TABLE basket_preset_weight (
  preset_id integer NOT NULL REFERENCES basket_preset (id) ON DELETE CASCADE,
  series_id integer NOT NULL REFERENCES cpi_series (id) ON DELETE RESTRICT,
  weight_per_10000 integer NOT NULL
    CHECK (weight_per_10000 >= 0 AND weight_per_10000 <= 10000),
  PRIMARY KEY (preset_id, series_id)
);

-- Down Migration
DROP TABLE IF EXISTS basket_preset_weight;
